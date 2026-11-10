import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const script = (name) => existsSync(join(root, name)) ? readFileSync(join(root, name), 'utf8') : '';

function assetVersion(phraseId, voiceId) {
  const manifest = JSON.parse(readFileSync(join(root, 'audio/wake/manifest.json'), 'utf8'));
  const clip = manifest.clips.find((item) => item.file === 'audio/wake/' + phraseId + '__' + voiceId + '.wav');
  return (clip.source || manifest.source).sha256.slice(0, 12);
}

function harness({ saved = null, blockedStorage = false, business = false, rejectNextPlay = false, deferredPlay = false } = {}) {
  const elements = new Map();
  const storage = new Map(saved === null ? [] : [['carlink-wake-counts-v1', saved]]);
  const timers = new Map();
  const audios = [];
  function element(id) {
    if (elements.has(id)) return elements.get(id);
    const children = new Map();
    const handlers = new Map();
    const attributes = new Map();
    const classes = new Set();
    const item = {
      id, innerHTML: '', textContent: '', hidden: false, disabled: false, value: '20', style: {}, dataset: {},
      classList: { toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); }, contains(name) { return classes.has(name); } },
      setAttribute(name, value) { attributes.set(name, String(value)); },
      getAttribute(name) { return attributes.get(name); },
      addEventListener(type, handler) { if (!handlers.has(type)) handlers.set(type, []); handlers.get(type).push(handler); },
      dispatch(type, event = {}) { for (const handler of handlers.get(type) || []) handler(event); },
      click() { if (!item.disabled) item.dispatch('click'); },
      querySelector(selector) { if (!children.has(selector)) children.set(selector, element(id + '/' + selector)); return children.get(selector); },
      querySelectorAll(selector) {
        if (selector !== '[data-wake-voice]') return [];
        return ['male-1', 'male-2', 'female-1', 'female-2'].map((voice) => {
          const button = item.querySelector('[data-wake-voice="' + voice + '"]');
          button.dataset.wakeVoice = voice;
          return button;
        });
      },
    };
    elements.set(id, item);
    return item;
  }
  class FakeAudio {
    constructor(src) { this.src = src; this.paused = true; this.currentTime = 0; this.handlers = new Map(); this.pending = []; audios.push(this); }
    addEventListener(type, handler) { if (!this.handlers.has(type)) this.handlers.set(type, []); this.handlers.get(type).push(handler); }
    emit(type) {
      if (type === 'playing') for (const request of this.pending.splice(0)) request.resolve();
      for (const handler of this.handlers.get(type) || []) handler();
    }
    play() {
      this.paused = false;
      if (rejectNextPlay) { rejectNextPlay = false; return Promise.reject(new Error('play blocked')); }
      if (deferredPlay) return new Promise((resolve, reject) => this.pending.push({ resolve, reject }));
      return Promise.resolve();
    }
    pause() {
      this.paused = true;
      for (const request of this.pending.splice(0)) {
        const error = new Error('play interrupted by pause');
        error.name = 'AbortError';
        request.reject(error);
      }
    }
  }
  const context = vm.createContext({
    document: { getElementById: element }, Audio: FakeAudio,
    localStorage: { getItem(key) { if (blockedStorage) throw new Error('denied'); return storage.get(key) ?? null; }, setItem(key, value) { if (blockedStorage) throw new Error('denied'); storage.set(key, value); } },
    confirm: () => true, alert: () => {}, setInterval(handler) { timers.set(timers.size + 1, handler); return timers.size; }, clearInterval(id) { timers.delete(id); },
  });
  context.window = context;
  if (business) { vm.runInContext(script('app-data.js'), context); vm.runInContext(script('app.js'), context); }
  vm.runInContext(script('wake-data.js'), context);
  vm.runInContext(script('wake.js'), context);
  const selectVoice = (voice) => element('wakeVoiceSelector').dispatch('click', { target: { closest: () => ({ dataset: { wakeVoice: voice } }) } });
  const play = (phrase) => {
    element('wakePhraseList').dispatch('click', { target: { closest: () => ({ dataset: { wakePlay: phrase } }) } });
    return audios.at(-1);
  };
  const count = (phrase) => Number(element('wakePhraseList').querySelector('[data-wake-count="' + phrase + '"]').textContent);
  const total = () => Number(element('wakeTotalCount').textContent);
  return { context, element, storage, audios, selectVoice, play, count, total };
}

test('唤醒有独立四音色、三语料和十二个计数，业务语料不变', () => {
  const { context } = harness({ business: true });
  assert.ok(context.WakeData, '独立WakeData应存在');
  assert.equal(context.WakeData.voices.length, 4);
  assert.deepEqual(Array.from(context.WakeData.phrases, (phrase) => phrase.text), ['小布小布', '小V小V', '小爱同学']);
  assert.equal(Object.keys(context.WakeData.createCounts()).length, 12);
  assert.equal(context.CarlinkData.commands.length, 30);
  assert.equal(context.CarlinkData.createDefaultRecords(context.CarlinkData.commands, context.CarlinkData.voices).size, 120);
});

test('十二个唤醒文件是独立有效WAV，并记录原录音的切分信息', () => {
  const { context } = harness();
  assert.ok(context.WakeData, '独立素材映射应存在');
  const manifest = JSON.parse(readFileSync(join(root, 'audio/wake/manifest.json'), 'utf8'));
  assert.equal(manifest.clips.length, 12);
  assert.equal(createHash('sha256').update(readFileSync(join(root, manifest.source.file))).digest('hex'), manifest.source.sha256);
  const paths = new Set();
  for (const voice of context.WakeData.voices) {
    for (const phrase of context.WakeData.phrases) {
      const path = context.WakeData.audioFile(phrase, voice).split('?')[0];
      paths.add(path);
      const clip = readFileSync(join(root, path));
      assert.equal(clip.toString('ascii', 0, 4), 'RIFF');
      assert.equal(clip.toString('ascii', 8, 12), 'WAVE');
      assert.equal(clip.readUInt16LE(22), 1);
      assert.equal(clip.readUInt32LE(24), 24000);
      assert.equal(clip.readUInt16LE(34), 16);
      assert.ok(clip.length > 24000, path);
      const entry = manifest.clips.find((item) => item.file === path);
      assert.ok(entry, path);
      assert.equal(entry.voice, voice.id);
      assert.equal(entry.phrase, phrase.id);
      assert.ok(entry.end > entry.start);
      assert.equal(createHash('sha256').update(clip).digest('hex'), entry.sha256);
      assert.equal(clip.readUInt32LE(40), Math.round(entry.duration * 24000) * 2);
      assert.equal(clip.length, clip.readUInt32LE(40) + 44);
      if (entry.source) assert.equal(createHash('sha256').update(readFileSync(join(root, entry.source.file))).digest('hex'), entry.source.sha256);
    }
  }
  assert.equal(paths.size, 12);
});

test('点击不计数，实际开始只加一次，暂停继续不重复计数', () => {
  const app = harness();
  assert.equal(app.total(), 0);
  const audio = app.play('xiaobu');
  assert.ok(audio, '点击应创建独立音频');
  assert.equal(app.total(), 0);
  audio.emit('playing');
  audio.emit('playing');
  assert.equal(app.total(), 1);
  assert.equal(app.count('xiaobu'), 1);
  app.element('wakePauseButton').click();
  assert.equal(audio.paused, true);
  app.element('wakePauseButton').click();
  audio.emit('playing');
  assert.equal(app.total(), 1);
  app.play('xiaobu').emit('playing');
  assert.equal(app.count('xiaobu'), 2);
  assert.equal(app.total(), 2);
});

test('四音色三语料可以分别选择，计数归属于播放时的组合', () => {
  const app = harness();
  assert.ok(app.context.WakeData, '独立语料应存在');
  for (const voice of app.context.WakeData.voices) {
    app.selectVoice(voice.id);
    for (const phrase of app.context.WakeData.phrases) {
      const audio = app.play(phrase.id);
      assert.equal(audio.src, 'audio/wake/' + phrase.id + '__' + voice.id + '.wav?v=' + assetVersion(phrase.id, voice.id));
      audio.emit('playing');
      audio.emit('ended');
      assert.equal(app.count(phrase.id), 1);
    }
    assert.equal(Number(app.element('wakeVoiceCount').textContent), 3);
  }
  assert.equal(app.total(), 12);
});

test('加载失败、停止和过期事件不会增加次数或覆盖新播放', () => {
  const app = harness();
  const broken = app.play('xiaobu');
  assert.ok(broken, '点击应创建独立音频');
  broken.emit('error');
  broken.emit('playing');
  assert.equal(app.total(), 0);
  assert.match(app.element('wakeStatus').textContent, /失败|无法/);
  const previous = app.play('xiaov');
  const current = app.play('xiaoai');
  previous.emit('playing');
  previous.emit('error');
  previous.emit('ended');
  assert.equal(app.total(), 0);
  current.emit('playing');
  assert.equal(app.count('xiaoai'), 1);
  assert.equal(app.element('wakeStopButton').disabled, false);
  app.element('wakeStopButton').click();
  current.emit('playing');
  assert.equal(app.total(), 1);
  const stopped = app.play('xiaov');
  app.selectVoice('female-2');
  stopped.emit('playing');
  assert.equal(app.total(), 1);
});

test('刷新恢复独立计数，非法存储不会污染十二个计数', () => {
  const app = harness();
  const audio = app.play('xiaov');
  assert.ok(audio, '点击应创建独立音频');
  audio.emit('playing');
  const restored = harness({ saved: app.storage.get('carlink-wake-counts-v1') });
  assert.equal(restored.total(), 1);
  assert.equal(restored.count('xiaov'), 1);
  const invalid = harness({ saved: JSON.stringify({ 'xiaobu::male-1': -2, 'xiaov::male-1': 1.5, 'xiaoai::male-1': '9', unknown: 100, 'xiaobu::female-1': 4 }) });
  assert.equal(invalid.total(), 4);
  invalid.selectVoice('female-1');
  assert.equal(invalid.count('xiaobu'), 4);
  assert.equal(harness({ saved: '{bad json' }).total(), 0);
});

test('浏览器禁止存储时仍播放和计数，并提示无法持久化', () => {
  const app = harness({ blockedStorage: true });
  const audio = app.play('xiaobu');
  assert.ok(audio, '禁止存储不应影响播放');
  audio.emit('playing');
  assert.equal(app.total(), 1);
  assert.equal(app.element('wakeStorageNote').hidden, false);
});

test('业务重置不清空唤醒，唤醒清零不改变业务失败项或队列', () => {
  const app = harness({ business: true });
  const wake = app.play('xiaobu');
  assert.ok(wake, '独立唤醒音频应存在');
  wake.emit('playing');
  app.element('resetButton').click();
  assert.equal(app.total(), 1);
  assert.equal(wake.paused, false);
  vm.runInContext("recordResult('nav-company', 'failure')", app.context);
  const failure = app.element('failureCount').textContent;
  assert.equal(Number(failure), 1);
  app.element('playAllButton').click();
  const businessAudio = app.audios.at(-1);
  app.element('wakeResetButton').click();
  assert.equal(app.total(), 0);
  assert.equal(wake.paused, true);
  assert.equal(businessAudio.paused, false);
  assert.equal(app.element('failureCount').textContent, failure);
  businessAudio.emit('ended');
  assert.equal(app.element('queueConsole').hidden, false);
  assert.equal(harness({ saved: app.storage.get('carlink-wake-counts-v1') }).total(), 0);
});

test('页面使用独立唤醒控件和脚本', () => {
  const html = script('index.html');
  for (const id of ['wakeVoiceSelector', 'wakePhraseList', 'wakeTotalCount', 'wakeVoiceCount', 'wakePauseButton', 'wakeStopButton', 'wakeResetButton', 'wakeStatus', 'wakeStorageNote']) assert.ok(html.includes('id="' + id + '"'), id);
  assert.match(html, /src="wake-data\.js\?v=[a-f0-9]{12}(?:&amp;clip=[a-f0-9]{12})?"/);
  assert.match(html, /src="wake\.js\?v=[a-f0-9]{12}"/);
  assert.doesNotMatch(script('wake.js'), /CarlinkData|createDefaultRecords|recordResult|cancelQueue|playQueue/);
});

test('play被浏览器拒绝不会计数，旧实例拒绝不会停止新播放', async () => {
  const blocked = harness({ rejectNextPlay: true });
  blocked.play('xiaobu');
  await Promise.resolve();
  assert.equal(blocked.total(), 0);
  assert.match(blocked.element('wakeStatus').textContent, /失败/);
  assert.equal(blocked.element('wakeStopButton').disabled, true);
  const app = harness({ rejectNextPlay: true });
  app.play('xiaobu');
  const current = app.play('xiaov');
  current.emit('playing');
  await Promise.resolve();
  assert.equal(app.total(), 1);
  assert.equal(current.paused, false);
  assert.equal(app.element('wakeStopButton').disabled, false);
});

test('取消唤醒清零保留次数和音频，确认后存储十二个零', () => {
  const app = harness();
  const audio = app.play('xiaoai');
  audio.emit('playing');
  app.context.confirm = () => false;
  app.element('wakeResetButton').click();
  assert.equal(app.total(), 1);
  assert.equal(audio.paused, false);
  app.context.confirm = () => true;
  app.element('wakeResetButton').click();
  const saved = JSON.parse(app.storage.get('carlink-wake-counts-v1'));
  assert.equal(Object.keys(saved).length, 12);
  assert.equal(Object.values(saved).every((value) => value === 0), true);
});

test('非法音色、非法唤醒词和无目标点击不会触发播放', () => {
  const app = harness();
  app.selectVoice('unknown');
  app.play('unknown');
  app.element('wakeVoiceSelector').dispatch('click', { target: { closest: () => null } });
  app.element('wakePhraseList').dispatch('click', { target: { closest: () => null } });
  assert.equal(app.audios.length, 0);
  const audio = app.play('xiaobu');
  assert.equal(audio.src, 'audio/wake/xiaobu__male-1.wav?v=' + assetVersion('xiaobu', 'male-1'));
});

test('首次加载期间暂停能继续，主动中止不误报播放失败', async () => {
  const app = harness({ deferredPlay: true });
  const audio = app.play('xiaobu');
  app.element('wakePauseButton').click();
  await Promise.resolve();
  assert.equal(app.total(), 0);
  assert.equal(app.element('wakePauseButton').disabled, false);
  assert.match(app.element('wakeStatus').textContent, /已暂停/);
  app.element('wakePauseButton').click();
  audio.emit('playing');
  assert.equal(app.total(), 1);
});

test('12个唤醒组合按对应录音加载，并对云端缓存更新版本', () => {
  const app = harness();
  const manifest = JSON.parse(readFileSync(join(root, 'audio/wake/manifest.json'), 'utf8'));
  assert.equal(manifest.source.originalName, '小布小布 小V小V 小爱同学.mp3');
  assert.equal(manifest.source.sha256, 'fd33b2130617382e5b2aef16dcf79e7864fdcf22802d19bfbd88f7be1566bc3b');
  assert.equal(app.context.WakeData.audioVersion, manifest.source.sha256.slice(0, 12));
  const html = script('index.html');
  assert.ok(html.includes('wake-data.js?v=' + app.context.WakeData.audioVersion));
  assert.ok(html.includes('wake.js?v=' + app.context.WakeData.audioVersion));
  assert.ok(html.includes('styles.css?v=' + app.context.WakeData.audioVersion));
  for (const voice of app.context.WakeData.voices) {
    for (const phrase of app.context.WakeData.phrases) {
      assert.ok(app.context.WakeData.audioFile(phrase, voice).endsWith('?v=' + assetVersion(phrase.id, voice.id)));
    }
  }
});

test('继续播放还在加载时再次暂停，仍保留音频且不重复计数', async () => {
  const app = harness({ deferredPlay: true });
  const audio = app.play('xiaov');
  audio.emit('playing');
  app.element('wakePauseButton').click();
  app.element('wakePauseButton').click();
  app.element('wakePauseButton').click();
  await Promise.resolve();
  assert.equal(app.element('wakePauseButton').disabled, false);
  assert.equal(app.total(), 1);
  app.element('wakePauseButton').click();
  audio.emit('playing');
  assert.equal(app.total(), 1);
});

test('快速暂停又继续时，旧play请求的拒绝不能中断新请求', async () => {
  const app = harness({ deferredPlay: true });
  const audio = app.play('xiaoai');
  app.element('wakePauseButton').click();
  app.element('wakePauseButton').click();
  await Promise.resolve();
  assert.equal(app.element('wakeStopButton').disabled, false);
  assert.equal(audio.paused, false);
  audio.emit('playing');
  assert.equal(app.total(), 1);
});

test('男声1小布小布单独使用新文件，其他11段音频指纹不变', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'audio/wake/manifest.json'), 'utf8'));
  const changed = manifest.clips.find((clip) => clip.file === 'audio/wake/xiaobu__male-1.wav');
  assert.ok(changed.source, '男声1小布小布应记录单独来源');
  assert.equal(changed.source.originalName, '小布小布.mp3');
  assert.equal(changed.source.sha256, '1244dab08f63af6d249b92cbdcae09d81ea92a54fcec5963077a2880cb15de94');
  assert.equal(changed.start, 0);
  assert.equal(changed.end, 1.872);
  assert.deepEqual(manifest.clips.filter((clip) => clip.file !== changed.file).map((clip) => ({ file: clip.file, sha256: clip.sha256 })), [{"file":"audio/wake/xiaobu__female-1.wav","sha256":"fe094dd10aa6a724c36ad9354eaee84d17779007e21b42cb03305621a58e008e"},{"file":"audio/wake/xiaov__female-1.wav","sha256":"bb8abaa126e1202ae1d87e0990c701714a9dd19d05c233b97c005306d2f24790"},{"file":"audio/wake/xiaoai__female-1.wav","sha256":"4e2c2d0962356a8b6efd058a9ee26c4acc09e09592b528efe4c42de0bc431b43"},{"file":"audio/wake/xiaobu__female-2.wav","sha256":"e325199ea5ecd87f37420b741c0d1a60bc4d3ac8965ebe2ae604ef5767e55eaa"},{"file":"audio/wake/xiaov__female-2.wav","sha256":"fd7628931a1ed8d27a8054eb4666e68e0019640e223970b62cd83c0cb3e29747"},{"file":"audio/wake/xiaoai__female-2.wav","sha256":"3bdf38db3e6c8c1066a90ec867dec04615cdcb819dc05b73efaa89d6f038204e"},{"file":"audio/wake/xiaov__male-1.wav","sha256":"57b73f64540afbe15be0b611223324721bad75ca3da77fe38ac3f92f0c6ad273"},{"file":"audio/wake/xiaoai__male-1.wav","sha256":"5294c1f1b41a2b3229c7acb4f3c641212907bae9e48b2796aeb0bf7f5f91db5c"},{"file":"audio/wake/xiaobu__male-2.wav","sha256":"f2be48b71ce29076cf8b0381a5102748ff15a8f39089c73584c2f32505f15aed"},{"file":"audio/wake/xiaov__male-2.wav","sha256":"923408660abcfddc8dac42f67489ec9e7f0b3f88c34dbd671d7d85bb6defc530"},{"file":"audio/wake/xiaoai__male-2.wav","sha256":"4075822af7e3c2d2b7879ba61a4f8084eb5728b27c878b0aee20177ef82a6f8a"}]);
  assert.ok(script('index.html').includes('&amp;clip=1244dab08f63'));
});
