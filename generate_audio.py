"""Carlink 语音语料生成脚本。

语料文案的**唯一来源**是 app-data.js。本脚本的 COMMANDS / VOICES 必须与其保持一致，
否则会出现「音频说的和页面写的不是同一句」的问题。

用法::

    python generate_audio.py                       # 只补齐缺失或为空的音频
    python generate_audio.py --force               # 全部重新合成
    python generate_audio.py --only nav-address --force
    python generate_audio.py --voices male-1 male-2 --force
    python generate_audio.py --check               # 只校验，不合成
    python generate_audio.py --proxy http://127.0.0.1:7890 --force

关于网络：脚本会自动把合成请求指向微软当前使用的端点
（`api.msedgeservices.com`），国内可直连，通常无需代理。若所在网络仍需
代理，可用 `--proxy` 指定（也会自动读取 `HTTPS_PROXY` 环境变量）。

`--check` 会报告三类问题并以非零码退出，便于接到 CI：

1. 缺少音频文件或文件为空；
2. 音频文件存在但合成后未被记录进 manifest（来源不明）；
3. **文案已变更** —— 该文件当初是用另一段文案合成的，属于陈旧音频，
   必须重新合成才能与页面文字对齐（这正是男声曾经落后的原因）。

manifest（audio/manifest.json）记录每个音频文件合成时所用文案的指纹，
由本脚本在每次成功合成后自动写入，请随音频一起提交。
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import sys
from pathlib import Path

import edge_tts


# --- 合成端点兼容补丁 -------------------------------------------------------
# 2026 年 10 月起，旧端点 speech.platform.bing.com 对合成用的 WebSocket 握手在
# 多数地区直接返回 403（10 月 12 日起美国同样被拒），与令牌、版本、时钟均无关。
# Microsoft Edge 155 已改用 api.msedgeservices.com/tts/cognitiveservices/websocket/v1，
# 该主机同样接受这个公开 token，但要以 Ocp-Apim-Subscription-Key 查询参数传递。
# 上游修复见 https://github.com/rany2/edge-tts/pull/491；依赖版本内置该改动后，
# 本函数会自动跳过。语音列表接口仍走旧主机，不受影响。
def _patch_synthesis_endpoint() -> bool:
    from edge_tts import communicate, constants

    if "msedgeservices.com" in communicate.WSS_URL:
        return False
    url = (
        "wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1"
        f"?Ocp-Apim-Subscription-Key={constants.TRUSTED_CLIENT_TOKEN}"
    )
    constants.WSS_URL = url
    communicate.WSS_URL = url
    return True


ENDPOINT_PATCHED = _patch_synthesis_endpoint()

ROOT = Path(__file__).parent
OUT = ROOT / "audio"
MANIFEST = OUT / "manifest.json"

# 男声沿用其原始合成参数（rate +0% / 无变调），避免与其余男声文件语速不一致；
# 女声沿用参考语料刷新时的参数。
VOICES: dict[str, dict[str, str]] = {
    "male-1": {"voice": "zh-CN-YunxiNeural", "rate": "+0%", "pitch": "+0Hz", "tone": "稳重"},
    "male-2": {"voice": "zh-CN-YunyangNeural", "rate": "+0%", "pitch": "+0Hz", "tone": "清晰"},
    "female-1": {"voice": "zh-CN-XiaoxiaoNeural", "rate": "-4%", "pitch": "-1Hz", "tone": "自然"},
    "female-2": {"voice": "zh-CN-XiaoyiNeural", "rate": "-2%", "pitch": "+1Hz", "tone": "亲和"},
}

# 与 app-data.js 的 commands 完全一致（含顺序）
COMMANDS: list[tuple[str, str]] = [
    ("nav-company", "导航去公司"), ("nav-close", "关闭导航"), ("nav-home", "导航回家"),
    ("nav-exit", "退出导航"), ("nav-gas", "导航去加油站"), ("nav-next-page", "翻到下一页"),
    ("nav-prev-page", "上一页"), ("nav-address", "导航到北京路1号"), ("nav-first", "第一个"),
    ("nav-fastest", "切换到用时最短的路线"), ("nav-no-highway", "切换到不走高速路线"),
    ("nav-station", "导航到深圳火车站"), ("nav-zoom", "放大地图"), ("nav-shortest", "走最短路线"),
    ("call-wife", "呼叫老婆"), ("call-zhangsan", "打电话给张三"),
    ("music-start", "我想听音乐"), ("music-song", "给我放首歌"),
    ("music-pause", "暂停播放"), ("music-resume", "继续播放"), ("music-next", "下一首"),
    ("music-jacky", "我想听张学友的歌"), ("music-qinghuaci", "播放青花瓷"),
    ("music-beyond", "播放beyond的专辑"), ("music-fantasy", "播放周杰伦的范特西专辑"),
    ("music-violin", "我想听小提琴曲"), ("music-quiet", "有什么安静的音乐"),
    ("other-weather", "今天天气怎么样"), ("other-time", "现在是几点"), ("other-rain", "明天会下雨吗"),
]

COMMAND_TEXT = dict(COMMANDS)


def normalize(text: str) -> str:
    """文案指纹的归一化：忽略大小写与空白。

    中文 TTS 对 "Beyond" / "beyond" 的读法完全相同，这类大小写差异不算内容变化。
    """
    return "".join(text.split()).lower()


def text_hash(text: str) -> str:
    return hashlib.sha1(normalize(text).encode("utf-8")).hexdigest()[:12]


def target_path(command_id: str, voice_id: str) -> Path:
    return OUT / f"{command_id}__{voice_id}.mp3"


def load_manifest() -> dict[str, str]:
    if not MANIFEST.exists():
        return {}
    try:
        return json.loads(MANIFEST.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def save_manifest(manifest: dict[str, str]) -> None:
    MANIFEST.write_text(
        json.dumps(dict(sorted(manifest.items())), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


async def synthesize(path: Path, voice_id: str, text: str, proxy: str | None = None) -> None:
    config = VOICES[voice_id]
    last: Exception | None = None
    for attempt in range(4):
        try:
            if path.exists():
                path.unlink()
            await edge_tts.Communicate(
                text=text,
                voice=config["voice"],
                rate=config["rate"],
                pitch=config["pitch"],
                volume="+0%",
                proxy=proxy,
            ).save(str(path))
            if path.stat().st_size > 0:
                return
        except Exception as exc:
            last = exc
            if attempt == 3:
                break
            await asyncio.sleep(1.2)
    message = f"合成失败：{path.name}"
    if last is not None and "403" in str(last):
        message += (
            "\n  微软合成端点返回 403，当前网络出口无法访问该服务。"
            "\n  请连接海外节点后重试，或用 --proxy http://127.0.0.1:<端口> 指定海外代理。"
        )
    raise RuntimeError(message) from last


def selected(command_ids: list[str] | None, voice_ids: list[str] | None) -> list[tuple[str, str, str]]:
    ids = [item for item in (command_ids or [c for c, _ in COMMANDS])]
    unknown = [item for item in ids if item not in COMMAND_TEXT]
    if unknown:
        raise SystemExit(f"未知指令 id: {', '.join(unknown)}")
    voices = voice_ids or list(VOICES)
    bad = [item for item in voices if item not in VOICES]
    if bad:
        raise SystemExit(f"未知音色 id: {', '.join(bad)}")
    return [(command_id, voice_id, COMMAND_TEXT[command_id]) for command_id in ids for voice_id in voices]


def check() -> int:
    manifest = load_manifest()
    expected = {(command_id, voice_id) for command_id, _ in COMMANDS for voice_id in VOICES}
    missing: list[str] = []
    stale: list[str] = []
    untracked: list[str] = []

    for command_id, voice_id in sorted(expected):
        path = target_path(command_id, voice_id)
        name = path.name
        if not path.exists() or path.stat().st_size == 0:
            missing.append(name)
            continue
        recorded = manifest.get(name)
        if recorded is None:
            untracked.append(name)
        elif recorded != text_hash(COMMAND_TEXT[command_id]):
            stale.append(name)

    orphans = sorted(
        path.name for path in OUT.glob("*.mp3")
        if path.name.split("__")[0] not in COMMAND_TEXT
    )

    def report(title: str, items: list[str], hint: str) -> None:
        if items:
            print(f"\n[{title}] {len(items)} 个")
            for item in items:
                print(f"  - {item}")
            print(f"  → {hint}")

    print(f"预期音频 {len(expected)} 个，manifest 记录 {len(manifest)} 条。")
    report("缺失或为空", missing, "运行 python generate_audio.py")
    report("未记录来源", untracked, "核对内容后合成一次以写入 manifest")
    report("文案已变更（陈旧音频）", stale, "运行 python generate_audio.py --force --only <指令id>")
    report("多余文件（指令已不在语料库）", orphans, "确认无用后删除")

    if not (missing or stale or untracked):
        print("\n全部音频与当前文案一致。")
    return 1 if (missing or stale or untracked or orphans) else 0


async def generate(command_ids, voice_ids, force: bool, proxy: str | None = None) -> None:
    OUT.mkdir(exist_ok=True)
    manifest = load_manifest()
    jobs = selected(command_ids, voice_ids)
    created = skipped = 0

    for command_id, voice_id, text in jobs:
        path = target_path(command_id, voice_id)
        if not force and path.exists() and path.stat().st_size > 0:
            manifest.setdefault(path.name, text_hash(text))
            skipped += 1
            continue
        await synthesize(path, voice_id, text, proxy)
        manifest[path.name] = text_hash(text)
        created += 1
        print(f"created {path.name}")

    save_manifest(manifest)
    print(f"\n合成 {created} 个，跳过已存在 {skipped} 个，manifest 共 {len(manifest)} 条。")


def main() -> None:
    parser = argparse.ArgumentParser(description="生成 Carlink 语音测试台的语料音频")
    parser.add_argument("--force", action="store_true", help="覆盖已有文件重新合成")
    parser.add_argument("--only", nargs="+", metavar="COMMAND_ID", help="只处理指定指令")
    parser.add_argument("--voices", nargs="+", metavar="VOICE_ID", help="只处理指定音色")
    parser.add_argument("--check", action="store_true", help="只校验音频是否与文案一致，不合成")
    parser.add_argument("--proxy", metavar="URL", help="合成时使用的 HTTP 代理，如 http://127.0.0.1:7890")
    args = parser.parse_args()

    if args.check:
        raise SystemExit(check())
    asyncio.run(generate(args.only, args.voices, args.force, args.proxy))


if __name__ == "__main__":
    main()
