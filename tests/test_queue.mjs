import test from 'node:test';
import assert from 'node:assert/strict';

// —— 极简 DOM / 定时器 / Audio 桩，用来在 Node 里驱动 app.js 的队列逻辑 ——
const els = new Map();
function makeElement(id) {
  return {
    id, textContent: '', innerHTML: '', hidden: false, disabled: false, value: '20',
    style: {}, dataset: {}, _handlers: {},
    addEventListener(type, fn) { (this._handlers[type] ||= []).push(fn); },
    click() { if (this.disabled) return; (this._handlers.click || []).forEach((fn) => fn()); },
    querySelectorAll() { return []; },
    pause() {}, play() {},
  };
}
const timers = new Map();
let nextTimerId = 1;
function tick(times = 1) {
  for (let i = 0; i < times; i += 1) [...timers.values()].forEach((fn) => fn());
}

class FakeAudio {
  constructor(src) { this.src = src; this.paused = false; this.currentTime = 0; FakeAudio.instances.push(this); }
  addEventListener(type, fn) { (this._handlers ||= {}); (this._handlers[type] ||= []).push(fn); }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  emit(type) { ((this._handlers || {})[type] || []).forEach((fn) => fn()); }
}
FakeAudio.instances = [];
const lastAudio = () => FakeAudio.instances[FakeAudio.instances.length - 1];
const playingId = () => lastAudio().src.replace(/^audio\//, '').split('__')[0];

globalThis.document = { getElementById: (id) => { if (!els.has(id)) els.set(id, makeElement(id)); return els.get(id); } };
globalThis.window = globalThis;
globalThis.Audio = FakeAudio;
globalThis.setInterval = (fn) => { const id = nextTimerId += 1; timers.set(id, fn); return id; };
globalThis.clearInterval = (id) => { timers.delete(id); };
globalThis.confirm = () => true;
globalThis.alert = () => {};

await import('../app-data.js');
await import('../app.js');
const { commands } = globalThis.CarlinkData;
const el = (id) => els.get(id);

function startQueue() {
  FakeAudio.instances.length = 0;
  timers.clear();
  el('playAllButton').click();
}

test('播放中不再重置队列位置：等待阶段三个按钮可用状态正确', () => {
  startQueue();
  assert.equal(playingId(), commands[0].id, '应从第一条开始播');

  lastAudio().emit('ended');
  assert.equal(el('queueConsole').hidden, false, '等待阶段应显示控制台');
  assert.equal(el('queueNextButton').disabled, false, '第一句等待时应可点「立即播放下一句」');
  assert.equal(el('queueReplayButton').disabled, false, '等待时应可点「重播」');
  assert.equal(el('queuePrevButton').disabled, true, '第一句没有上一句，应禁用');
});

test('重播不会推进队列位置，也不会结束队列', () => {
  el('queueReplayButton').click();
  assert.equal(playingId(), commands[0].id, '重播应重放当前句');

  lastAudio().emit('ended');
  assert.equal(el('queueConsole').hidden, false, '重播后应回到等待');
  assert.equal(el('queueReplayButton').disabled, false, '重播后仍可再次重播');

  tick(20);
  assert.equal(playingId(), commands[1].id, '倒计时结束后应推进到第 2 句，说明位置未被重播打乱');
});

test('「立即播放下一句」与「上一句」按队列位置前后移动', () => {
  lastAudio().emit('ended');
  assert.equal(el('queuePrevButton').disabled, false, '第 2 句等待时应可点「上一句」');

  el('queueNextButton').click();
  assert.equal(playingId(), commands[2].id, '「立即播放下一句」应前进到第 3 句');

  lastAudio().emit('ended');
  el('queuePrevButton').click();
  assert.equal(playingId(), commands[1].id, '「上一句」应回退到第 2 句');

  lastAudio().emit('ended');
  el('queuePrevButton').click();
  assert.equal(playingId(), commands[0].id, '再点「上一句」应回到第 1 句');
});

test('「暂停等待」可切换且会冻结倒计时', () => {
  lastAudio().emit('ended');
  const before = el('queueReplayButton').disabled;

  el('queueWaitButton').click();
  assert.equal(el('queueWaitButton').textContent, '继续等待');
  assert.equal(el('queueReplayButton').disabled, before, '暂停等待不应改变重播可用性');

  tick(3);
  assert.equal(playingId(), commands[0].id, '暂停等待期间倒计时应停止推进');

  el('queueWaitButton').click();
  assert.equal(el('queueWaitButton').textContent, '暂停等待');
  tick(20);
  assert.equal(playingId(), commands[1].id, '恢复等待后倒计时继续，应推进到第 2 句');
});
