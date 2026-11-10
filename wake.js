(function () {
  const { voices, phrases, storageKey, countKey, audioFile, createCounts, normalizeCounts } = globalThis.WakeData;
  const elements = {
    voices: document.getElementById('wakeVoiceSelector'),
    list: document.getElementById('wakePhraseList'),
    total: document.getElementById('wakeTotalCount'),
    voiceCount: document.getElementById('wakeVoiceCount'),
    pause: document.getElementById('wakePauseButton'),
    stop: document.getElementById('wakeStopButton'),
    reset: document.getElementById('wakeResetButton'),
    status: document.getElementById('wakeStatus'),
    storageNote: document.getElementById('wakeStorageNote'),
  };
  let counts = loadCounts();
  let voiceId = voices[0].id;
  let currentAudio = null;
  let playingPhrase = null;
  let playRequestId = 0;

  function loadCounts() {
    let saved;
    try {
      saved = window.localStorage.getItem(storageKey);
    } catch {
      elements.storageNote.hidden = false;
      return createCounts();
    }
    try {
      return normalizeCounts(JSON.parse(saved));
    } catch {
      return createCounts();
    }
  }

  function saveCounts() {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(counts));
      elements.storageNote.hidden = true;
    } catch {
      elements.storageNote.hidden = false;
    }
  }

  function updateDisplay() {
    const voice = voices.find((item) => item.id === voiceId);
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    elements.total.textContent = total;
    elements.voiceCount.textContent = phrases.reduce((sum, phrase) => sum + counts[countKey(phrase.id, voiceId)], 0);
    elements.reset.disabled = total === 0;
    elements.pause.disabled = !currentAudio;
    elements.stop.disabled = !currentAudio;
    elements.pause.textContent = currentAudio && currentAudio.paused ? '继续唤醒播放' : '暂停唤醒播放';
    elements.voices.querySelectorAll('[data-wake-voice]').forEach((button) => {
      const selected = button.dataset.wakeVoice === voiceId;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', selected);
    });
    for (const phrase of phrases) {
      const playing = playingPhrase === phrase.id;
      elements.list.querySelector('[data-wake-count="' + phrase.id + '"]').textContent = counts[countKey(phrase.id, voiceId)];
      elements.list.querySelector('[data-wake-label="' + phrase.id + '"]').textContent = voice.label + ' · 原录音';
      elements.list.querySelector('[data-wake-row="' + phrase.id + '"]').classList.toggle('is-playing', playing);
      const button = elements.list.querySelector('[data-wake-play="' + phrase.id + '"]');
      button.textContent = playing ? '↻ 重播' : '▶ 播放';
      button.setAttribute('aria-label', '播放 ' + voice.label + ' ' + phrase.text);
    }
  }

  function stopAudio() {
    const previous = currentAudio;
    playRequestId += 1;
    currentAudio = null;
    playingPhrase = null;
    if (previous) {
      previous.pause();
      previous.currentTime = 0;
    }
    updateDisplay();
  }

  function startAudio(audio, onFailure) {
    const requestId = ++playRequestId;
    audio.play().catch(() => {
      if (currentAudio !== audio || requestId !== playRequestId) return;
      onFailure();
    });
  }

  function playPhrase(phraseId) {
    const phrase = phrases.find((item) => item.id === phraseId);
    if (!phrase) return;
    stopAudio();
    const voice = voices.find((item) => item.id === voiceId);
    const audio = new Audio(audioFile(phrase, voice));
    const key = countKey(phrase.id, voice.id);
    let counted = false;
    currentAudio = audio;
    playingPhrase = phrase.id;
    elements.status.textContent = '正在加载：' + voice.label + ' · ' + phrase.text;
    updateDisplay();
    audio.addEventListener('playing', () => {
      if (currentAudio !== audio) return;
      if (!counted) {
        counted = true;
        counts[key] += 1;
        saveCounts();
      }
      elements.status.textContent = '正在播放：' + voice.label + ' · ' + phrase.text;
      updateDisplay();
    });
    audio.addEventListener('ended', () => {
      if (currentAudio !== audio) return;
      stopAudio();
      elements.status.textContent = '播放完成：' + voice.label + ' · ' + phrase.text;
    });
    const failed = () => {
      if (currentAudio !== audio) return;
      stopAudio();
      elements.status.textContent = '播放失败，请检查唤醒音频文件：' + audioFile(phrase, voice);
    };
    audio.addEventListener('error', failed);
    startAudio(audio, failed);
  }

  elements.voices.innerHTML = voices.map((voice) => '<button type="button" class="voice-pill" data-wake-voice="' + voice.id + '" aria-pressed="false">' + voice.label + '</button>').join('');
  elements.list.innerHTML = phrases.map((phrase) => '<article class="wake-phrase" data-wake-row="' + phrase.id + '">' +
    '<div class="wake-phrase-copy"><h4>' + phrase.text + '</h4><p data-wake-label="' + phrase.id + '"></p></div>' +
    '<div class="wake-phrase-count"><strong data-wake-count="' + phrase.id + '">0</strong><span>次</span></div>' +
    '<button class="secondary-button small wake-play-button" type="button" data-wake-play="' + phrase.id + '">▶ 播放</button></article>').join('');

  elements.voices.addEventListener('click', (event) => {
    const button = event.target.closest('[data-wake-voice]');
    if (!button || !voices.some((voice) => voice.id === button.dataset.wakeVoice) || button.dataset.wakeVoice === voiceId) return;
    stopAudio();
    voiceId = button.dataset.wakeVoice;
    updateDisplay();
    elements.status.textContent = '已选择' + voices.find((voice) => voice.id === voiceId).label + '，请选择唤醒词播放';
  });
  elements.list.addEventListener('click', (event) => {
    const button = event.target.closest('[data-wake-play]');
    if (button) playPhrase(button.dataset.wakePlay);
  });
  elements.pause.addEventListener('click', () => {
    const audio = currentAudio;
    if (!audio) return;
    if (audio.paused) {
      startAudio(audio, () => {
        if (currentAudio !== audio) return;
        stopAudio();
        elements.status.textContent = '继续播放失败，请重新播放唤醒词';
      });
    } else {
      playRequestId += 1;
      audio.pause();
      elements.status.textContent = '唤醒播放已暂停，继续播放不会重复计数';
    }
    updateDisplay();
  });
  elements.stop.addEventListener('click', () => {
    stopAudio();
    elements.status.textContent = '唤醒播放已停止';
  });
  elements.reset.addEventListener('click', () => {
    if (!window.confirm('确定清零全部12个组合的唤醒次数吗？不会影响业务测试。')) return;
    stopAudio();
    counts = createCounts();
    saveCounts();
    updateDisplay();
    elements.status.textContent = '唤醒计数已清零，业务测试不受影响';
  });
  updateDisplay();
})();
