# Carlink 语音端到端测试台

用于低噪环境下验证车机语音端到端任务完成率。

## 使用

直接打开 `index.html`，或访问 GitHub Pages 部署地址。页面包含：

- 导航、电话、音乐、天气时间共 30 条测试语料，分 4 类
- 两男两女 4 种中文自然音色（云希、云扬、晓晓、晓艺），共 120 个 MP3
- 默认全部通过，发现失败时点击「×」改为未通过
- 成功率统计、撤销、重置
- 连续播放时每句默认等待 20 秒；控制台提供「上一句 / 重播 / 立即播放下一句 / 暂停等待」

## 独立语音唤醒

页面的「语音唤醒」区与业务测试完全独立：

- 两男两女四种原录音音色，每种可选「小布小布」「小V小V」「小爱同学」，共12段。
- 先选唤醒音色，再点对应唤醒词的「播放」。唤醒有自己的暂停/继续、停止按钮，不使用业务播放队列。
- 每次音频实际开始播放，对应组合次数加1；再次播放再加1，暂停后继续不重复计数，加载失败不计数。
- 展示唤醒总次数、当前音色次数和三个组合次数；切换音色查看对应的计数。
- 计数使用独立的浏览器本地存储，刷新后保留。仅「清零唤醒计数」会清空12个组合；原「重置测试」不影响唤醒计数。
- 唤醒不计入原30条指令、120项业务测试及完成率。浏览器禁止本地存储时仍能计数，但刷新不能恢复。

除男声1的「小布小布」外，其余11段素材切自「小布小布 小V小V 小爱同学.mp3」。男声1的「小布小布」单独使用提供的「小布小布.mp3」，按文件原有语速播放，未变声或额外调速。文件位于audio/wake/，使用24 kHz单声道PCM WAV；original.mp3保留默认来源，xiaobu__male-1.original.mp3保留单段来源。manifest.json记录各段的SHA-256和切分时间，单段的source字段优先于默认source。音色编号和独立计数键保持不变。音频按对应来源指纹更新缓存版本；替换单段时同步更新wake-data.js的clipVersions和index.html中的脚本缓存参数。

验证命令：node --test tests/test_app.mjs tests/test_queue.mjs tests/test_wake.mjs。

## 业务语音资源

音频由 `generate_audio.py` 通过 Edge TTS 合成，命名规则 `audio/<指令id>__<音色id>.mp3`。
`app-data.js` 是语料文案的唯一来源，脚本里的 `COMMANDS` / `VOICES` 必须与其保持一致。

依赖：`pip install edge-tts`（合成时需要能访问 Edge 朗读服务）。

```bash
python generate_audio.py                                  # 只补齐缺失或为空的音频
python generate_audio.py --force --only nav-address       # 重做指定指令的全部音色
python generate_audio.py --voices male-1 male-2 --force   # 只重做男声
python generate_audio.py --check                          # 校验音频与文案是否一致
python generate_audio.py --proxy http://127.0.0.1:7890 --force   # 经代理合成
```

> **关于 403**：2026 年 10 月起，微软旧的合成端点
> `speech.platform.bing.com` 在多数地区（10 月 12 日起含美国）对合成握手直接返回
> 403，与令牌、版本、时钟都无关。脚本已自动把合成请求切到微软当前使用的
> `api.msedgeservices.com`，**国内可直连，无需代理**。
> 上游修复见 [rany2/edge-tts#491](https://github.com/rany2/edge-tts/pull/491)，
> 依赖版本内置该改动后脚本会自动跳过这层兼容。
> 若所在网络仍需代理，可用 `--proxy http://127.0.0.1:7890` 指定。

`audio/manifest.json` 记录每个文件合成时所用文案的指纹，请随音频一起提交。
`--check` 会据此找出**文案已变更但音频没跟着更新**的文件，并以非零码退出，可接入 CI。
新增或修改语料后请务必重新合成对应音频，否则车机会念出与页面文字不符的内容。

## GitHub Pages

仓库使用 `.github/workflows/pages.yml` 自动部署。将仓库 Pages 设置为 `GitHub Actions` 后，每次推送到 `main` 会自动发布。

自定义域名：`https://hyggec.eu.cc/`

DNS 配置：添加 CNAME 记录 `hyggec.eu.cc` → `hyggec.github.io`。
