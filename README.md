# Carlink 语音端到端测试台

用于低噪环境下验证车机语音端到端任务完成率。

## 使用

直接打开 `index.html`，或访问 GitHub Pages 部署地址。页面包含：

- 导航、电话、音乐、天气时间测试语料
- 当前启用 2 种中文自然女声
- 图片版 30 条语料，共 60 个女声 MP3；男声待确认女声效果后再更新
- 默认全部通过，发现失败时点击“×”改为未通过
- 成功率统计、撤销、重置
- 连续播放时每句默认等待 20 秒，可提前播放下一句或暂停等待

## GitHub Pages

仓库使用 `.github/workflows/pages.yml` 自动部署。将仓库 Pages 设置为 `GitHub Actions` 后，每次推送到 `main` 会自动发布。

自定义域名：`https://hyggec.eu.cc/`

DNS 配置：添加 CNAME 记录 `hyggec.eu.cc` → `hyggec.github.io`。
