import test from 'node:test';
import assert from 'node:assert/strict';
await import('../app-data.js');
const { commands, voices, calculateRate, caseKey, createDefaultRecords, queueDefaults, normalizeWaitSeconds } = globalThis.CarlinkData;

test('语料库包含四类共31条指令，并覆盖两男两女音色', () => {
  assert.equal(commands.length, 31);
  assert.equal(new Set(commands.map((item) => item.category)).size, 4);
  assert.deepEqual(voices.map((voice) => voice.id), ['male-1', 'male-2', 'female-1', 'female-2']);
  assert.equal(commands.every((item) => item.text.length > 2), true);
});

test('完成率按成功次数除以已记录次数计算', () => {
  assert.equal(calculateRate(0, 0), null);
  assert.equal(calculateRate(14, 15), 93.3);
  assert.equal(calculateRate(15, 15), 100);
});

test('同一句指令在四个音色下是四个独立测试项', () => {
  assert.equal(commands.length * voices.length, 124);
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
  assert.equal(records.size, 124);
  assert.equal([...records.values()].every((result) => result === 'success'), true);
  records.set(caseKey(commands[0].id, voices[0].id), 'failure');
  assert.equal([...records.values()].filter((result) => result === 'failure').length, 1);
});
