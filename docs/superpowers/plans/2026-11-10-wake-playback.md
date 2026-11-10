# Independent Wake Playback Implementation Plan

> **For agentic workers:** Execute inline with executing-plans. No delegation, branches or commits requested.

**Goal:** Add twelve selectable original-recording wake clips with completely independent persistent counters.

**Architecture:** WakeData describes four voices and three phrases. Isolated wake.js owns audio, counts, storage and controls; business scripts remain untouched.

**Tech Stack:** Static HTML/CSS/JavaScript, Node built-in tests, local Chromium WebAudio, PCM WAV.

---

### Task 1: Test and implement isolation

Files: create tests/test_wake.mjs, wake-data.js, wake.js.

- [x] Create VM DOM/Audio/storage tests for12 combinations, actual playing events, replay/resume, stale events, failures, storage and independent resets.
- [x] Run node --test tests/test_wake.mjs; expect failure from missing WakeData and controller.
- [x] Implement independent data and controller with counter key `${phraseId}::${voiceId}` and storage key carlink-wake-counts-v1.
- [x] Repeat focused tests after assets and markup; expect pass.

### Task 2: Split source

Files: audio/wake/original.mp3, audio/wake/manifest.json,12 audio/wake/<phrase>__<voice>.wav files.

- [x] Decode original MP3 locally with Chromium AudioContext at24 kHz, no uploads or downloads.
- [x] Cut all12 clips from the replacement recording with buffers around speech intervals:0–0.88,1.55–2.43,3.08–3.99;5.11–5.88,6.53–7.33,8.00–8.93;10.07–10.87,11.51–12.30,12.91–13.72;14.90–15.56,16.11–17.03,17.49–18.15 seconds.
- [x] Save16-bit mono WAV and manifest of hash, group, voice, phrase and source boundaries.
- [x] Check RIFF/WAVE headers and compare decoded clips against original slices within16-bit quantization tolerance.

### Task 3: Integrate UI

Files: index.html, styles.css, README.md. Do not edit app.js/app-data.js.

- [x] Add wakeVoiceSelector, wakePhraseList, wakeTotalCount, wakeVoiceCount, wakePauseButton, wakeStopButton, wakeResetButton, wakeStatus and wakeStorageNote before business library.
- [x] Load separate wake-data.js/wake.js and wake-prefixed events/attributes.
- [x] Add scoped styles, accessible states and mobile single-column layout.
- [x] Document source,12 combinations, independent controls, persistence and clear-only-wake behavior.

### Task 4: Verify

- [x] Run node --test tests/test_app.mjs tests/test_queue.mjs tests/test_wake.mjs; expect pass, original120 items unchanged.
- [x] Run git diff --check and inspect changes for unrelated edits.
- [x] Browser-test all combinations, resume/replay/refresh/reset and desktop/mobile layout.
