import test from 'node:test';
import assert from 'node:assert/strict';
await import('../app-data.js');
const { commands, voices, calculateRate, caseKey, createDefaultRecords, queueDefaults, normalizeWaitSeconds } = globalThis.CarlinkData;

test('语料库包含四类共30条指令，并暂时只启用两种女声', () => {
  assert.equal(commands.length, 30);
  assert.equal(new Set(commands.map((item) => item.category)).size, 4);
  assert.deepEqual(voices.map((voice) => voice.id), ['female-1', 'female-2']);
  assert.equal(commands.every((item) => item.text.length > 2), true);
});

test('完成率按成功次数除以已记录次数计算', () => {
  assert.equal(calculateRate(0, 0), null);
  assert.equal(calculateRate(14, 15), 93.3);
  assert.equal(calculateRate(15, 15), 100);
});

test('同一句指令在四个音色下是四个独立测试项', () => {
  assert.equal(commands.length * voices.length, 60);
  assert.notEqual(caseKey(commands[0].id, voices[0].id), caseKey(commands[0].id, voices[1].id));
});

test('连续播放默认等待20秒，并支持显示倒计时进度', () => {
  assert.equal(queueDefaults.waitSeconds, 20);
  assert.equal(queueDefaults.progress(20), 0);
  assert.equal(queueDefaults.progress(10), 50);
  assert.equal(queueDefaults.progress(0), 100);
  assert.equal(normalizeWaitSeconds('30'), 30);
  assert.equal(normalizeWaitSeconds('0'), 1);
  assert.equal(normalizeWaitSeconds('500'), 120);
});

test('全部测试项默认通过，失败后可覆盖为未通过', () => {
  const records = createDefaultRecords(commands, voices);
  assert.equal(records.size, 60);
  assert.equal([...records.values()].every((result) => result === 'success'), true);
  records.set(caseKey(commands[0].id, voices[0].id), 'failure');
  assert.equal([...records.values()].filter((result) => result === 'failure').length, 1);
});

test('图片版30条语料文字与顺序完全一致', () => {
  assert.deepEqual(commands.map((item) => item.text), [
    '导航去公司', '关闭导航', '导航回家', '退出导航', '导航去加油站',
    '翻到下一页', '上一页', '导航到北京路1号', '切换到用时最短的路线', '切换到不走高速路线',
    '导航到深圳火车站', '第一个', '放大地图', '走最短路线', '呼叫老婆', '打电话给张三',
    '我想听音乐', '给我放首歌', '暂停播放', '继续播放', '下一首', '我想听张学友的歌',
    '播放青花瓷', '播放beyond的专辑', '播放周杰伦的范特西专辑', '我想听小提琴曲',
    '有什么安静的音乐', '今天天气怎么样', '现在是几点', '明天会下雨吗',
  ]);
});
