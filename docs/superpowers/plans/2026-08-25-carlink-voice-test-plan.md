# Carlink Voice Test Bench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a self-contained local HTML test bench with 124 generated voice clips and completion-rate tracking.

**Architecture:** Store a single data model in `app-data.js`, render the UI from that model in `app.js`, and keep audio assets in `audio/`. Use a small pure completion-rate helper that is covered by Node tests.

**Tech Stack:** Native HTML, CSS, JavaScript, Python 3.14, `edge-tts`, Node.js test runner.

### Task 1: Define and test the data model

**Files:**
- Create: `app-data.js`
- Create: `tests/test_app.mjs`

- [ ] Write a failing test asserting 31 commands and four voices.
- [ ] Run `node --test tests/test_app.mjs` and confirm failure because `app-data.js` is missing.
- [ ] Add the command/voice data and exported `calculateRate(success, total)` helper.
- [ ] Run the test again and confirm it passes.

### Task 2: Generate all audio assets

**Files:**
- Create: `generate_audio.py`
- Create: `audio/*.mp3` (120 files)

- [ ] Add the 30 approved Chinese utterances grouped by category.
- [ ] Generate four MP3 files per utterance using Edge natural voices with retry and zero-byte cleanup.
- [ ] Verify exactly 124 non-empty MP3 files exist.

### Task 3: Implement the test bench UI

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Create: `app.js`

- [ ] Render summary metrics, category tabs, command rows, and playback controls from `app-data.js`.
- [ ] Implement single playback, sequential category playback, pause/next, success/failure recording, undo, and reset.
- [ ] Add responsive cockpit-style layout with accessible focus states and 93% status indicator.

### Task 4: Verify local behavior

**Files:**
- Modify: `tests/test_app.mjs` if needed for edge cases.

- [ ] Run Node tests.
- [ ] Run a local static server and inspect the page in Chromium.
- [ ] Check that every audio source returns HTTP 200 and that a single click updates the active row.
- [ ] Remove temporary `test.mp3` and zero-byte artifacts.
