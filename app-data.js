(function () {
const voices = [
  { id: 'female-1', label: '女声 1', short: 'Xiaoxiao', edge: 'zh-CN-XiaoxiaoNeural', tone: '自然' },
  { id: 'female-2', label: '女声 2', short: 'Xiaoyi', edge: 'zh-CN-XiaoyiNeural', tone: '亲和' },
];

const categories = [
  { id: 'nav', label: '导航', icon: '⌖', description: '目的地、路线与地图操作' },
  { id: 'call', label: '拨打电话', icon: '◉', description: '联系人呼叫与拨号' },
  { id: 'music', label: '音乐播放', icon: '♫', description: '播放控制、歌手与专辑' },
  { id: 'other', label: '其他', icon: '◷', description: '天气与时间查询' },
];

const commands = [
  { id: 'nav-company', category: 'nav', text: '导航去公司' },
  { id: 'nav-close', category: 'nav', text: '关闭导航' },
  { id: 'nav-home', category: 'nav', text: '导航回家' },
  { id: 'nav-exit', category: 'nav', text: '退出导航' },
  { id: 'nav-gas', category: 'nav', text: '导航去加油站' },
  { id: 'nav-next-page', category: 'nav', text: '翻到下一页' },
  { id: 'nav-prev-page', category: 'nav', text: '上一页' },
  { id: 'nav-address', category: 'nav', text: '导航到北京路1号' },
  { id: 'nav-fastest', category: 'nav', text: '切换到用时最短的路线' },
  { id: 'nav-no-highway', category: 'nav', text: '切换到不走高速路线' },
  { id: 'nav-station', category: 'nav', text: '导航到深圳火车站' },
  { id: 'nav-first', category: 'nav', text: '第一个' },
  { id: 'nav-zoom', category: 'nav', text: '放大地图' },
  { id: 'nav-shortest', category: 'nav', text: '走最短路线' },
  { id: 'call-wife', category: 'call', text: '呼叫老婆' },
  { id: 'call-zhangsan', category: 'call', text: '打电话给张三' },
  { id: 'music-start', category: 'music', text: '我想听音乐' },
  { id: 'music-song', category: 'music', text: '给我放首歌' },
  { id: 'music-pause', category: 'music', text: '暂停播放' },
  { id: 'music-resume', category: 'music', text: '继续播放' },
  { id: 'music-next', category: 'music', text: '下一首' },
  { id: 'music-jacky', category: 'music', text: '我想听张学友的歌' },
  { id: 'music-qinghuaci', category: 'music', text: '播放青花瓷' },
  { id: 'music-beyond', category: 'music', text: '播放beyond的专辑' },
  { id: 'music-fantasy', category: 'music', text: '播放周杰伦的范特西专辑' },
  { id: 'music-violin', category: 'music', text: '我想听小提琴曲' },
  { id: 'music-quiet', category: 'music', text: '有什么安静的音乐' },
  { id: 'other-weather', category: 'other', text: '今天天气怎么样' },
  { id: 'other-time', category: 'other', text: '现在是几点' },
  { id: 'other-rain', category: 'other', text: '明天会下雨吗' },
];

function calculateRate(success, total) {
  if (!total) return null;
  return Math.round((success / total) * 1000) / 10;
}

function audioFile(command, voice) {
  return `audio/${command.id}__${voice.id}.mp3`;
}

function caseKey(commandId, voiceId) {
  return `${commandId}::${voiceId}`;
}

const queueDefaults = {
  waitSeconds: 20,
  progress: (remaining, total = 20) => Math.round(((total - remaining) / total) * 100),
};
function normalizeWaitSeconds(value) {
  const seconds = Number.parseInt(value, 10);
  if (!Number.isFinite(seconds)) return queueDefaults.waitSeconds;
  return Math.min(120, Math.max(1, seconds));
}
function createDefaultRecords(commandList, voiceList) {
  return new Map(commandList.flatMap((command) => voiceList.map((voice) => [caseKey(command.id, voice.id), 'success'])));
}

globalThis.CarlinkData = { voices, categories, commands, calculateRate, audioFile, caseKey, queueDefaults, normalizeWaitSeconds, createDefaultRecords };
})();
