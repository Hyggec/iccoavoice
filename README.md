# Carlink 语音端到端测试台

用于低噪环境下验证车机语音端到端任务完成率。

## 使用

直接打开 `index.html`，或访问 GitHub Pages 部署地址。页面包含：

- 导航、电话、音乐、天气时间共 30 条测试语料，分 4 类
- 两男两女 4 种中文自然音色（云希、云扬、晓晓、晓艺），共 120 个 MP3
- 默认全部通过，发现失败时点击「×」改为未通过
- 成功率统计、撤销、重置
- 连续播放时每句默认等待 20 秒；控制台提供「上一句 / 重播 / 立即播放下一句 / 暂停等待」

## 语音资源

音频由 `generate_audio.py` 通过 Edge TTS 合成，命名规则 `audio/<指令id>__<音色id>.mp3`。
`app-data.js` 是语料文案的唯一来源，脚本里的 `COMMANDS` / `VOICES` 必须与其保持一致。

依赖：`pip install edge-tts`（合成时需要能访问 Edge 朗读服务）。

```bash
python generate_audio.py                                  # 只补齐缺失或为空的音频
python generate_audio.py --force --only nav-address       # 重做指定指令的全部音色
python generate_audio.py --voices male-1 male-2 --force   # 只重做男声
python generate_audio.py --check                          # 校验音频与文案是否一致
```

`audio/manifest.json` 记录每个文件合成时所用文案的指纹，请随音频一起提交。
`--check` 会据此找出**文案已变更但音频没跟着更新**的文件，并以非零码退出，可接入 CI。
新增或修改语料后请务必重新合成对应音频，否则车机会念出与页面文字不符的内容。

## GitHub Pages

仓库使用 `.github/workflows/pages.yml` 自动部署。将仓库 Pages 设置为 `GitHub Actions` 后，每次推送到 `main` 会自动发布。

自定义域名：`https://hyggec.eu.cc/`

DNS 配置：添加 CNAME 记录 `hyggec.eu.cc` → `hyggec.github.io`。
