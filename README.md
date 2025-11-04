# Kokoro Reader Extension Workspace

This repository contains an experimental offline-first Chrome extension that reads
selected text aloud using a procedurally generated fallback voicebank bundled with
the project. The scaffolding remains compatible with the Kokoro 82M voice model and
can be swapped once the quantised weights are available.

## Project Structure

- `extension/manifest.json` – Manifest V3 definition.
- `extension/content-script.js` – Injected UI that reveals the floating speaker
  control and handles audio playback.
- `extension/service-worker.js` – Coordinates messages, caching, and local TTS
  synthesis.
- `extension/tts/kokoro.js` – Offline synthesiser that stitches together the
  bundled fallback Kokoro voicebank.
- `scripts/build-voicebank.js` – Generates the distributable voicebank JSON from the
  procedural phoneme definitions.
- `requirements.md` – Living requirements document; update this whenever the
  scope or acceptance criteria change.

## Getting Started

1. Install dependencies for testing:

   ```bash
   npm install
   ```

2. Run the automated tests:

   ```bash
   npm test
   ```

3. (Optional) Regenerate the fallback voicebank after making phoneme tweaks:

   ```bash
   npm run build-voicebank
   ```

4. (Optional) Download and bundle Kokoro assets locally:

   The repository ships with `kokoro-assets.template.json`. Copy it to `kokoro-assets.json`
   and update the file list to match the Kokoro 82M artifacts you intend to bundle.
   Then run:

   ```bash
   npm run prepare-kokoro
   ```

   This script downloads each asset, Brotli-compresses it, and writes an `extension/models/manifest.json`
   that the extension can load at runtime. Large artifacts are ignored by git; rerun the script whenever
   you refresh the Kokoro weights.

5. Load the extension in Chrome:

   - Open `chrome://extensions/`.
   - Enable **Developer mode**.
   - Click **Load unpacked** and select the `extension/` directory in this
     repository.
   - The repository omits binary icon assets to keep pull requests text-only;
     Chrome will display its default puzzle icon unless you supply PNGs in
     `extension/icons/` before packaging your own build.

6. Highlight text on any page; a floating speaker button will appear near the
   selection. Click it to play back the synthesized audio. The current build
   speaks using the bundled fallback Kokoro-inspired voicebank while the real
   Kokoro 82M model is being integrated.

## Testing Strategy

Automated tests currently validate the offline synthesizer’s output. As the
project evolves, extend the test suite with integration and browser-level
checks (e.g., Playwright) to cover the selection UX and full audio pipeline.
