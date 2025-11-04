# Offline Kokoro 82M Chrome Extension Requirements

This document captures the current requirements for the offline-first Chrome extension that reads selected text aloud using the Kokoro 82M model. Update this file whenever the requirements evolve.

## Functional Requirements
- The extension must run entirely offline after installation; all text-to-speech inference happens locally in the browser.
- When users select text on a webpage, display an accessible floating speaker button.
- Upon clicking the speaker button, synthesize the selected text with the Kokoro 82M voice and play it back to the user.
- Provide audio playback controls that handle concurrent requests gracefully (e.g., stop prior playback when a new selection is read).
- Cache synthesized audio keyed by text hash to avoid redundant inference for repeated selections.

## Technical Requirements
- Target Manifest V3 with a service worker coordinating between content scripts and the local TTS pipeline.
- Bundle quantized Kokoro 82M model weights suitable for browser execution (e.g., INT8) and load them lazily to stay within Chrome Web Store package limits.
- Ship the inference runtime (WebGPU or WebAssembly) alongside the extension, ensuring no external network dependencies during normal operation.
- Provide a repeatable build script that downloads Kokoro model assets, applies the chosen compression, and emits an extension-readable manifest.
- Implement first-run initialization that caches decompressed weight chunks locally with user-visible progress feedback and graceful failure handling.
- Release in-memory model resources after periods of inactivity while keeping cached weights available for quick reload.
- During early development milestones, a lightweight procedural audio synthesizer or bundled fallback voicebank may stand in for the full Kokoro 82M pipeline so UX flows can be exercised without the final weights; clearly flag this mode in developer documentation and tests.

## UX Requirements
- Ensure the floating speaker button is keyboard accessible, screen-reader friendly, and visually unobtrusive.
- Use Shadow DOM or scoped styles to prevent conflicts with host page CSS.
- Provide clear error messaging if synthesis fails (e.g., due to resource constraints) and guidance on recovery steps.

## Testing & QA Requirements
- Validate selection detection and playback across a representative set of websites, including SPAs and pages with heavy DOM updates.
- Test performance on both high- and low-spec hardware, including offline scenarios, to confirm acceptable load and inference times.
- Run automated integration tests (e.g., with Playwright) for critical flows and perform accessibility checks on injected UI components.

## Documentation & Maintenance Requirements
- Document installation steps, storage requirements, and troubleshooting guidance in the project README.
- Document the Kokoro asset preparation workflow, including how to update or replace model weights.
- Maintain privacy documentation explaining that text never leaves the user’s device.
- Update this requirements file whenever new capabilities are added, constraints change, or acceptance criteria evolve.
