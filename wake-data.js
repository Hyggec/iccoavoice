(function () {
  const voices = [
    { id: 'male-1', label: '男声 1' },
    { id: 'male-2', label: '男声 2' },
    { id: 'female-1', label: '女声 1' },
    { id: 'female-2', label: '女声 2' },
  ];
  const phrases = [
    { id: 'xiaobu', text: '小布小布' },
    { id: 'xiaov', text: '小V小V' },
    { id: 'xiaoai', text: '小爱同学' },
  ];
  const storageKey = 'carlink-wake-counts-v1';
  const audioVersion = 'fd33b2130617';

  function countKey(phraseId, voiceId) {
    return phraseId + '::' + voiceId;
  }

  function audioFile(phrase, voice) {
    return 'audio/wake/' + phrase.id + '__' + voice.id + '.wav?v=' + audioVersion;
  }

  function createCounts() {
    return Object.fromEntries(voices.flatMap((voice) => phrases.map((phrase) => [countKey(phrase.id, voice.id), 0])));
  }

  function normalizeCounts(saved) {
    const counts = createCounts();
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return counts;
    for (const key of Object.keys(counts)) {
      if (Object.hasOwn(saved, key) && Number.isSafeInteger(saved[key]) && saved[key] >= 0) counts[key] = saved[key];
    }
    return counts;
  }

  globalThis.WakeData = { voices, phrases, storageKey, audioVersion, countKey, audioFile, createCounts, normalizeCounts };
})();
