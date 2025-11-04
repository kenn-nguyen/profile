const test = require('node:test');
const assert = require('node:assert');

const kokoro = require('../extension/tts/kokoro.js');

test('synthesize returns a RIFF WAV buffer', async () => {
  const buffer = await kokoro.synthesize('Hello world from Kokoro');
  assert.ok(buffer instanceof ArrayBuffer, 'Expected an ArrayBuffer result');
  const view = new DataView(buffer, 0, 12);
  assert.strictEqual(String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3)), 'RIFF');
  assert.strictEqual(String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11)), 'WAVE');
  assert.ok(buffer.byteLength > 2000, 'Expected audio data to be present');
});

test('synthesize rejects empty input', async () => {
  await assert.rejects(() => kokoro.synthesize('   '), /Cannot synthesize empty text/);
});
