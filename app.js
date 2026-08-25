const { audioFile: getAudioFile, calculateRate, caseKey, categories, commands, createDefaultRecords, normalizeWaitSeconds, queueDefaults, voices } = globalThis.CarlinkData;

const state = { category: 'nav', voice: 'male-1', records: createDefaultRecords(commands, voices), history: [], queue: [], queueIndex: -1, currentAudio: null, playingKey: null, waitRemaining: 0, waitDuration: queueDefaults.waitSeconds, waitTimer: null, waitPaused: false };
const $ = (id) => document.getElementById(id);
const elements = {
  tabs: $('categoryTabs'), voices: $('voiceSelector'), list: $('commandList'), categoryIcon: $('categoryIcon'), categoryTitle: $('categoryTitle'), categoryDescription: $('categoryDescription'), activeVoice: $('activeVoiceLabel'), rate: $('rateValue'), rateBar: $('rateBar'), rateStatus: $('rateStatus'), tested: $('testedCount'), success: $('successCount'), failure: $('failureCount'), remaining: $('remainingCount'), undo: $('undoButton'), pause: $('pauseButton'), playAll: $('playAllButton'), playCategory: $('playCategoryButton'), reset: $('resetButton'), queueConsole: $('queueConsole'), queueStatus: $('queueStatus'), queueCountdown: $('queueCountdown'), queueProgress: $('queueProgress'), queueNext: $('queueNextButton'), queueWait: $('queueWaitButton'), waitSeconds: $('waitSeconds')
};

function resultFor(commandId) { return state.records.get(caseKey(commandId, state.voice)); }

function renderTabs() {
  elements.tabs.innerHTML = categories.map((category) => `<button type="button" class="category-tab ${category.id === state.category ? 'active' : ''}" data-category="${category.id}" role="tab">${category.label}<span> · ${commands.filter((item) => item.category === category.id).length}</span></button>`).join('');
  elements.tabs.querySelectorAll('[data-category]').forEach((button) => button.addEventListener('click', () => { state.category = button.dataset.category; cancelQueue(); stopAudio(); render(); }));
}

function renderVoiceSelector() {
  elements.voices.innerHTML = voices.map((voice) => `<button type="button" class="voice-pill ${voice.id === state.voice ? 'active' : ''}" data-voice="${voice.id}">${voice.label} · ${voice.tone}</button>`).join('');
  elements.voices.querySelectorAll('[data-voice]').forEach((button) => button.addEventListener('click', () => { state.voice = button.dataset.voice; cancelQueue(); stopAudio(); render(); }));
}

function renderCommands() {
  const voice = voices.find((item) => item.id === state.voice);
  const rows = commands.filter((item) => item.category === state.category);
  elements.list.innerHTML = rows.map((command, index) => {
    const result = resultFor(command.id);
    const key = `${command.id}:${state.voice}`;
    return `<article class="command-row ${state.playingKey === key ? 'is-playing' : ''} ${result ? `record-${result}` : ''}" data-row="${command.id}">
      <span class="command-index">${String(index + 1).padStart(2, '0')}</span>
      <div class="command-copy"><strong>${command.text}</strong><span>${voice.label} / ${voice.short} · ${result === 'failure' ? '未通过' : '默认通过'}</span></div>
      <div class="row-actions"><button class="icon-button play" type="button" data-play="${command.id}" title="播放语音" aria-label="播放 ${command.text}">▶</button><button class="icon-button pass" type="button" data-result="success" data-id="${command.id}" title="设为通过" aria-label="${command.text} 设为通过">✓</button><button class="icon-button fail" type="button" data-result="failure" data-id="${command.id}" title="设为未通过" aria-label="${command.text} 设为未通过">×</button></div>
    </article>`;
  }).join('');
  elements.list.querySelectorAll('[data-play]').forEach((button) => button.addEventListener('click', () => playCommand(button.dataset.play)));
  elements.list.querySelectorAll('[data-result]').forEach((button) => button.addEventListener('click', () => recordResult(button.dataset.id, button.dataset.result)));
}

function renderSummary() {
  const values = [...state.records.values()];
  const success = values.filter((value) => value === 'success').length;
  const failure = values.filter((value) => value === 'failure').length;
  const total = values.length;
  const rate = calculateRate(success, total);
  elements.tested.textContent = total;
  elements.success.textContent = success;
  elements.failure.textContent = failure;
  elements.remaining.textContent = commands.length * voices.length - total;
  elements.rate.innerHTML = `${rate === null ? '—' : rate}<small>%</small>`;
  elements.rateBar.style.width = `${rate ?? 0}%`;
  elements.rateStatus.textContent = rate === null ? '等待开始记录' : rate >= 93 ? '达到认证指标' : '尚未达到 93%';
  elements.rateStatus.style.color = rate !== null && rate >= 93 ? 'var(--accent)' : rate === null ? 'var(--muted)' : 'var(--bad)';
  elements.undo.disabled = state.history.length === 0;
}

function render() {
  const category = categories.find((item) => item.id === state.category);
  const voice = voices.find((item) => item.id === state.voice);
  elements.categoryIcon.textContent = category.icon;
  elements.categoryTitle.textContent = category.label;
  elements.categoryDescription.textContent = category.description;
  elements.activeVoice.textContent = `当前音色：${voice.label} / ${voice.short}`;
  renderTabs(); renderVoiceSelector(); renderCommands(); renderSummary();
}

function clearQueueWait() {
  if (state.waitTimer) window.clearInterval(state.waitTimer);
  state.waitTimer = null;
  state.waitRemaining = 0;
  state.waitPaused = false;
  elements.queueConsole.hidden = true;
}

function cancelQueue() {
  clearQueueWait();
  state.queue = [];
  state.queueIndex = -1;
}

function stopAudio() {
  if (state.currentAudio) { state.currentAudio.pause(); state.currentAudio.currentTime = 0; }
  state.currentAudio = null; state.playingKey = null; elements.pause.disabled = true; elements.pause.textContent = '暂停播放';
}

function playCommand(commandId, onEnded = null) {
  stopAudio();
  const command = commands.find((item) => item.id === commandId);
  const voice = voices.find((item) => item.id === state.voice);
  const audio = new Audio(getAudioFile(command, voice));
  state.currentAudio = audio; state.playingKey = `${command.id}:${voice.id}`; elements.pause.disabled = false; renderCommands();
  audio.addEventListener('ended', () => { state.currentAudio = null; state.playingKey = null; elements.pause.disabled = true; renderCommands(); if (onEnded) onEnded(); });
  audio.addEventListener('error', () => { stopAudio(); renderCommands(); alert(`音频文件无法加载：${getAudioFile(command, voice)}`); });
  audio.play().catch(() => { stopAudio(); renderCommands(); });
}

function playQueue(items) {
  cancelQueue();
  state.queue = items;
  state.queueIndex = -1;
  advanceQueue();
}

function finishQueue() {
  clearQueueWait();
  state.queue = [];
  state.queueIndex = -1;
}

function advanceQueue() {
  clearQueueWait();
  state.queueIndex += 1;
  if (state.queueIndex >= state.queue.length) { finishQueue(); return; }
  playCommand(state.queue[state.queueIndex].id, beginQueueWait);
}

function beginQueueWait() {
  clearQueueWait();
  if (state.queueIndex >= state.queue.length - 1) { finishQueue(); return; }
  state.waitDuration = normalizeWaitSeconds(elements.waitSeconds.value);
  elements.waitSeconds.value = state.waitDuration;
  state.waitRemaining = state.waitDuration;
  elements.queueConsole.hidden = false;
  elements.queueWait.textContent = '暂停等待';
  updateQueueConsole();
  state.waitTimer = window.setInterval(() => {
    if (state.waitPaused) return;
    state.waitRemaining -= 1;
    updateQueueConsole();
    if (state.waitRemaining <= 0) advanceQueue();
  }, 1000);
}

function updateQueueConsole() {
  elements.queueStatus.textContent = `第 ${state.queueIndex + 1} / ${state.queue.length} 句 · ${state.waitPaused ? '等待已暂停' : '等待车机响应'}`;
  elements.queueCountdown.textContent = `${state.waitRemaining}s`;
  elements.queueProgress.style.width = `${queueDefaults.progress(state.waitRemaining, state.waitDuration)}%`;
}

function recordResult(commandId, result) {
  const key = caseKey(commandId, state.voice);
  state.history.push({ key, previous: state.records.get(key) ?? null });
  state.records.set(key, result); renderSummary(); renderCommands();
}

elements.undo.addEventListener('click', () => { const last = state.history.pop(); if (!last) return; if (last.previous) state.records.set(last.key, last.previous); else state.records.delete(last.key); renderSummary(); renderCommands(); });
elements.reset.addEventListener('click', () => { if (!confirm('确定将全部测试项恢复为默认通过吗？')) return; state.records = createDefaultRecords(commands, voices); state.history = []; cancelQueue(); stopAudio(); render(); });
elements.playAll.addEventListener('click', () => playQueue(commands));
elements.playCategory.addEventListener('click', () => playQueue(commands.filter((item) => item.category === state.category)));
elements.pause.addEventListener('click', () => { if (!state.currentAudio) return; if (state.currentAudio.paused) { state.currentAudio.play(); elements.pause.textContent = '暂停播放'; } else { state.currentAudio.pause(); elements.pause.textContent = '继续播放'; } });
elements.queueNext.addEventListener('click', () => advanceQueue());
elements.queueWait.addEventListener('click', () => { state.waitPaused = !state.waitPaused; elements.queueWait.textContent = state.waitPaused ? '继续等待' : '暂停等待'; updateQueueConsole(); });

render();
