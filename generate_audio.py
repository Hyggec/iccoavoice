import asyncio
from pathlib import Path

import edge_tts


ROOT = Path(__file__).parent
OUT = ROOT / "audio"
VOICES = {
    "male-1": "zh-CN-YunxiNeural",
    "male-2": "zh-CN-YunyangNeural",
    "female-1": "zh-CN-XiaoxiaoNeural",
    "female-2": "zh-CN-XiaoyiNeural",
}
COMMANDS = [
    ("nav-company", "导航去公司"), ("nav-close", "关闭导航"), ("nav-home", "导航回家"),
    ("nav-exit", "退出导航"), ("nav-gas", "导航去加油站"), ("nav-next-page", "翻到下一页"),
    ("nav-prev-page", "上一页"), ("nav-first", "第一个"), ("nav-fastest", "切换到用时最短的路线"),
    ("nav-no-highway", "切换到不走高速路线"), ("nav-zoom", "放大地图"), ("nav-shortest", "走最短路线"),
    ("nav-address", "导航到人民路123号"), ("nav-station", "导航到北京火车站"),
    ("call-wife", "呼叫老婆"), ("call-husband", "呼叫老公"), ("call-zhangsan", "打电话给张三"),
    ("music-start", "我想听音乐"), ("music-song", "给我放首歌"),
    ("music-pause", "暂停播放"), ("music-resume", "继续播放"), ("music-next", "下一首"),
    ("music-jacky", "我想听张学友的歌"), ("music-qinghuaci", "播放青花瓷"),
    ("music-beyond", "播放Beyond的专辑"), ("music-fantasy", "播放周杰伦的范特西专辑"),
    ("music-violin", "我想听小提琴曲"), ("music-quiet", "有什么安静的音乐"),
    ("other-weather", "明天天气怎么样"), ("other-time", "现在是几点"), ("other-rain", "明天会下雨吗"),
]


async def synthesize(filename: Path, voice: str, text: str) -> None:
    if filename.exists() and filename.stat().st_size > 0:
        return
    for attempt in range(4):
        try:
            if filename.exists():
                filename.unlink()
            await edge_tts.Communicate(text=text, voice=voice, rate="+0%", volume="+0%").save(str(filename))
            if filename.stat().st_size > 0:
                return
        except Exception:
            if attempt == 3:
                raise
            await asyncio.sleep(1.2)
    raise RuntimeError(f"No audio generated for {filename}")


async def main() -> None:
    OUT.mkdir(exist_ok=True)
    for command_id, text in COMMANDS:
        for voice_id, voice in VOICES.items():
            target = OUT / f"{command_id}__{voice_id}.mp3"
            await synthesize(target, voice, text)
            print(f"created {target.name}")
    files = list(OUT.glob("*.mp3"))
    assert len(files) == len(COMMANDS) * len(VOICES), len(files)
    assert all(item.stat().st_size > 0 for item in files)
    print(f"verified {len(files)} audio files")


if __name__ == "__main__":
    asyncio.run(main())
