#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 22050;
const BASE_OUTPUT = path.join(__dirname, '..', 'extension', 'models', 'voicebank.json');

function writeVoicebank() {
  const phonemeDefs = getPhonemeDefinitions();
  const entries = phonemeDefs.map((def) => {
    const samples = generatePhoneme(def);
    const pcm = floatToInt16(samples);
    return {
      id: def.id,
      type: def.type,
      durationMs: Math.round((samples.length / SAMPLE_RATE) * 1000),
      data: Buffer.from(pcm.buffer).toString('base64'),
    };
  });

  const voicebank = {
    version: 1,
    sampleRate: SAMPLE_RATE,
    crossFadeMs: 12,
    metadata: {
      description: 'Procedurally generated fallback voicebank approximating Kokoro timbre.',
      generatedAt: new Date().toISOString(),
    },
    phonemes: entries,
    dictionary: buildDictionary(),
  };

  fs.mkdirSync(path.dirname(BASE_OUTPUT), { recursive: true });
  fs.writeFileSync(BASE_OUTPUT, JSON.stringify(voicebank, null, 2));
  console.log(`Wrote voicebank -> ${path.relative(process.cwd(), BASE_OUTPUT)}`);
}

function buildDictionary() {
  return {
    HELLO: ['HH', 'EH', 'L', 'OW'],
    WORLD: ['W', 'ER', 'L', 'D'],
    KOKORO: ['K', 'OW', 'K', 'OW', 'R', 'OW'],
    EXTENSION: ['EH', 'K', 'S', 'T', 'EH', 'N', 'SH', 'AH', 'N'],
    TEXT: ['T', 'EH', 'K', 'S', 'T'],
    SELECT: ['S', 'IH', 'L', 'EH', 'K', 'T'],
    READER: ['R', 'IY', 'D', 'ER'],
    AUDIO: ['AO', 'D', 'IY', 'OW'],
    MODEL: ['M', 'OW', 'D', 'EH', 'L'],
    OFFLINE: ['AO', 'F', 'L', 'AY', 'N'],
  };
}

function getPhonemeDefinitions() {
  const vowels = [
    { id: 'AA', type: 'vowel', duration: 0.18, formants: [
      { freq: 720, bw: 90, amp: 1.0 },
      { freq: 1220, bw: 100, amp: 0.8 },
      { freq: 2500, bw: 120, amp: 0.6 },
    ] },
    { id: 'AE', type: 'vowel', duration: 0.18, formants: [
      { freq: 660, bw: 100, amp: 1.0 },
      { freq: 1720, bw: 120, amp: 0.8 },
      { freq: 2410, bw: 150, amp: 0.5 },
    ] },
    { id: 'AH', type: 'vowel', duration: 0.18, formants: [
      { freq: 600, bw: 110, amp: 1.0 },
      { freq: 1040, bw: 100, amp: 0.7 },
      { freq: 2250, bw: 120, amp: 0.4 },
    ] },
    { id: 'AO', type: 'vowel', duration: 0.18, formants: [
      { freq: 570, bw: 90, amp: 1.0 },
      { freq: 840, bw: 100, amp: 0.8 },
      { freq: 2410, bw: 140, amp: 0.5 },
    ] },
    { id: 'EH', type: 'vowel', duration: 0.18, formants: [
      { freq: 530, bw: 80, amp: 1.0 },
      { freq: 1840, bw: 110, amp: 0.8 },
      { freq: 2480, bw: 140, amp: 0.5 },
    ] },
    { id: 'ER', type: 'vowel', duration: 0.2, formants: [
      { freq: 500, bw: 70, amp: 1.0 },
      { freq: 1500, bw: 100, amp: 0.7 },
      { freq: 2500, bw: 130, amp: 0.5 },
    ] },
    { id: 'IH', type: 'vowel', duration: 0.16, formants: [
      { freq: 440, bw: 80, amp: 1.0 },
      { freq: 2080, bw: 110, amp: 0.8 },
      { freq: 2760, bw: 150, amp: 0.5 },
    ] },
    { id: 'IY', type: 'vowel', duration: 0.18, formants: [
      { freq: 300, bw: 70, amp: 1.0 },
      { freq: 2200, bw: 120, amp: 0.9 },
      { freq: 3100, bw: 160, amp: 0.5 },
    ] },
    { id: 'OW', type: 'vowel', duration: 0.2, glide: ['AO', 'UW'] },
    { id: 'UH', type: 'vowel', duration: 0.16, formants: [
      { freq: 350, bw: 70, amp: 1.0 },
      { freq: 950, bw: 90, amp: 0.8 },
      { freq: 2250, bw: 130, amp: 0.5 },
    ] },
    { id: 'UW', type: 'vowel', duration: 0.18, formants: [
      { freq: 320, bw: 60, amp: 1.0 },
      { freq: 820, bw: 90, amp: 0.9 },
      { freq: 2080, bw: 120, amp: 0.5 },
    ] },
    { id: 'AY', type: 'vowel', duration: 0.22, glide: ['AA', 'IY'] },
  ];

  const consonants = [
    { id: 'B', type: 'stop', duration: 0.12, voicing: true },
    { id: 'P', type: 'stop', duration: 0.12, voicing: false },
    { id: 'D', type: 'stop', duration: 0.11, voicing: true },
    { id: 'T', type: 'stop', duration: 0.11, voicing: false },
    { id: 'G', type: 'stop', duration: 0.13, voicing: true },
    { id: 'K', type: 'stop', duration: 0.13, voicing: false },
    { id: 'F', type: 'fricative', duration: 0.12, center: 1700 },
    { id: 'V', type: 'fricative', duration: 0.12, center: 1600, voicing: true },
    { id: 'TH', type: 'fricative', duration: 0.12, center: 800 },
    { id: 'DH', type: 'fricative', duration: 0.12, center: 900, voicing: true },
    { id: 'S', type: 'fricative', duration: 0.14, center: 4000 },
    { id: 'Z', type: 'fricative', duration: 0.14, center: 3600, voicing: true },
    { id: 'SH', type: 'fricative', duration: 0.16, center: 2500 },
    { id: 'ZH', type: 'fricative', duration: 0.16, center: 2400, voicing: true },
    { id: 'CH', type: 'affricate', duration: 0.16, center: 2600 },
    { id: 'JH', type: 'affricate', duration: 0.16, center: 2500, voicing: true },
    { id: 'M', type: 'nasal', duration: 0.14 },
    { id: 'N', type: 'nasal', duration: 0.14 },
    { id: 'NG', type: 'nasal', duration: 0.16 },
    { id: 'L', type: 'liquid', duration: 0.18 },
    { id: 'R', type: 'liquid', duration: 0.18 },
    { id: 'Y', type: 'glide', duration: 0.16 },
    { id: 'W', type: 'glide', duration: 0.16 },
    { id: 'HH', type: 'aspirate', duration: 0.12 },
  ];
  const special = [
    { id: 'PAUSE', type: 'silence', duration: 0.08 },
  ];

  return vowels.concat(consonants, special);
}

function generatePhoneme(def) {
  if (def.glide) {
    const start = generatePhoneme(findPhoneme(def.glide[0]));
    const end = generatePhoneme(findPhoneme(def.glide[1]));
    const overlap = Math.max(32, Math.floor((start.length + end.length) / 10));
    return crossFade(start, end, overlap);
  }

  switch (def.type) {
    case 'vowel':
      return generateVowel(def);
    case 'stop':
      return generateStop(def);
    case 'fricative':
      return generateFricative(def);
    case 'affricate':
      return generateAffricate(def);
    case 'nasal':
      return generateNasal(def);
    case 'liquid':
      return generateLiquid(def);
    case 'glide':
      return generateGlide(def);
    case 'aspirate':
      return generateAspirate(def);
    case 'silence':
      return generateSilence(def.duration || 0.1);
    default:
      return generateSilence(def.duration || 0.1);
  }
}

function findPhoneme(id) {
  const defs = getPhonemeDefinitions();
  const match = defs.find((def) => def.id === id);
  if (!match) {
    throw new Error(`Unknown phoneme ${id}`);
  }
  return match;
}

function generateVowel(def) {
  const duration = def.duration || 0.18;
  const totalSamples = Math.round(duration * SAMPLE_RATE);
  const buffer = new Float32Array(totalSamples);
  const f0 = 185;

  for (let i = 0; i < totalSamples; i += 1) {
    const t = i / SAMPLE_RATE;
    const glottal = Math.sin(2 * Math.PI * f0 * t);
    let sample = 0;
    if (def.formants) {
      for (const formant of def.formants) {
        const bw = formant.bw || 90;
        const amp = formant.amp || 1;
        sample += amp * Math.sin(2 * Math.PI * formant.freq * t) * Math.exp(-bw * Math.abs(Math.sin(Math.PI * t / duration)));
      }
    } else {
      sample = glottal;
    }
    buffer[i] = 0.22 * glottal * sample;
  }
  applyEnvelope(buffer, 0.02, 0.04);
  return buffer;
}

function generateStop(def) {
  const duration = def.duration || 0.12;
  const release = Math.floor(duration * SAMPLE_RATE * 0.35);
  const totalSamples = Math.round(duration * SAMPLE_RATE);
  const buffer = new Float32Array(totalSamples);
  const noise = generateNoise(totalSamples);

  for (let i = 0; i < totalSamples; i += 1) {
    if (i < totalSamples - release) {
      buffer[i] = 0;
    } else {
      buffer[i] = noise[i] * 0.6;
    }
  }

  if (def.voicing) {
    const voiced = generateNasal({ duration });
    for (let i = 0; i < totalSamples; i += 1) {
      buffer[i] += voiced[i] * 0.4;
    }
  }
  applyEnvelope(buffer, 0.005, 0.04);
  return buffer;
}

function generateFricative(def) {
  const duration = def.duration || 0.14;
  const totalSamples = Math.round(duration * SAMPLE_RATE);
  const noise = generateNoise(totalSamples);
  const buffer = new Float32Array(totalSamples);
  const center = def.center || 2000;
  const bandwidth = 1200;
  const dt = 1 / SAMPLE_RATE;
  let prev = 0;
  const rc = 1 / (2 * Math.PI * bandwidth);
  const alpha = dt / (rc + dt);

  for (let i = 0; i < totalSamples; i += 1) {
    const mod = Math.sin(2 * Math.PI * center * (i / SAMPLE_RATE));
    prev = prev + alpha * (noise[i] - prev);
    buffer[i] = prev * mod * 0.6;
    if (def.voicing) {
      buffer[i] += 0.2 * Math.sin(2 * Math.PI * 140 * (i / SAMPLE_RATE));
    }
  }
  applyEnvelope(buffer, 0.015, 0.03);
  return buffer;
}

function generateAffricate(def) {
  const stop = generateStop({ duration: (def.duration || 0.16) * 0.45, voicing: def.voicing });
  const fric = generateFricative({ duration: (def.duration || 0.16) * 0.55, center: def.center, voicing: def.voicing });
  return joinBuffers(stop, fric, 80);
}

function generateNasal(def) {
  const duration = def.duration || 0.14;
  const totalSamples = Math.round(duration * SAMPLE_RATE);
  const buffer = new Float32Array(totalSamples);
  const f0 = 160;
  const formants = [
    { freq: 250, amp: 0.8 },
    { freq: 1000, amp: 0.5 },
    { freq: 2100, amp: 0.3 },
  ];
  for (let i = 0; i < totalSamples; i += 1) {
    const t = i / SAMPLE_RATE;
    let sample = 0;
    for (const formant of formants) {
      sample += formant.amp * Math.sin(2 * Math.PI * formant.freq * t);
    }
    buffer[i] = 0.18 * Math.sin(2 * Math.PI * f0 * t) * sample;
  }
  applyEnvelope(buffer, 0.02, 0.05);
  return buffer;
}

function generateLiquid(def) {
  const duration = def.duration || 0.18;
  const totalSamples = Math.round(duration * SAMPLE_RATE);
  const buffer = new Float32Array(totalSamples);
  const f0 = 170;
  for (let i = 0; i < totalSamples; i += 1) {
    const t = i / SAMPLE_RATE;
    const formants = [
      { freq: def.id === 'L' ? 400 : 300, amp: 0.9 },
      { freq: def.id === 'L' ? 1400 : 1600, amp: 0.6 },
      { freq: 2400, amp: 0.4 },
    ];
    let sample = 0;
    for (const formant of formants) {
      sample += formant.amp * Math.sin(2 * Math.PI * formant.freq * t);
    }
    buffer[i] = 0.2 * Math.sin(2 * Math.PI * f0 * t) * sample;
  }
  applyEnvelope(buffer, 0.02, 0.05);
  return buffer;
}

function generateGlide(def) {
  const duration = def.duration || 0.16;
  const start = generateVowel({ id: 'IH', type: 'vowel', duration: duration * 0.5, formants: [
    { freq: 440, bw: 80, amp: 1 },
    { freq: 2080, bw: 110, amp: 0.7 },
    { freq: 2760, bw: 150, amp: 0.5 },
  ] });
  const end = generateVowel({ id: def.id === 'Y' ? 'IY' : 'UW', type: 'vowel', duration: duration * 0.5, formants: def.id === 'Y'
    ? [
        { freq: 300, bw: 70, amp: 1 },
        { freq: 2200, bw: 120, amp: 0.9 },
        { freq: 3100, bw: 160, amp: 0.5 },
      ]
    : [
        { freq: 320, bw: 60, amp: 1 },
        { freq: 820, bw: 90, amp: 0.9 },
        { freq: 2080, bw: 120, amp: 0.5 },
      ] });
  return joinBuffers(start, end, 120);
}

function generateAspirate(def) {
  const duration = def.duration || 0.12;
  const totalSamples = Math.round(duration * SAMPLE_RATE);
  const noise = generateNoise(totalSamples);
  const buffer = new Float32Array(totalSamples);
  for (let i = 0; i < totalSamples; i += 1) {
    buffer[i] = noise[i] * 0.4;
  }
  applyEnvelope(buffer, 0.01, 0.02);
  return buffer;
}

function generateSilence(duration) {
  const totalSamples = Math.round(duration * SAMPLE_RATE);
  return new Float32Array(totalSamples);
}

function generateNoise(length) {
  const buffer = new Float32Array(length);
  let seed = 1234567;
  for (let i = 0; i < length; i += 1) {
    seed = (seed * 16807) % 2147483647;
    buffer[i] = (seed / 1073741823.5 - 1) * 0.6;
  }
  return buffer;
}

function joinBuffers(a, b, overlap) {
  if (overlap <= 0) {
    const out = new Float32Array(a.length + b.length);
    out.set(a);
    out.set(b, a.length);
    return out;
  }
  const total = a.length + b.length - overlap;
  const out = new Float32Array(total);
  out.set(a);
  for (let i = 0; i < b.length; i += 1) {
    const idx = i + a.length - overlap;
    if (idx < 0) {
      continue;
    }
    if (idx < out.length) {
      const t = i / overlap;
      const fadeIn = Math.min(1, Math.max(0, t));
      const fadeOut = 1 - Math.min(1, Math.max(0, t));
      out[idx] = out[idx] * fadeOut + b[i] * fadeIn;
    }
  }
  return out;
}

function crossFade(a, b, overlap) {
  return joinBuffers(a, b, Math.max(1, overlap));
}

function applyEnvelope(buffer, attackSeconds, releaseSeconds) {
  const attackSamples = Math.max(1, Math.round(attackSeconds * SAMPLE_RATE));
  const releaseSamples = Math.max(1, Math.round(releaseSeconds * SAMPLE_RATE));
  for (let i = 0; i < attackSamples && i < buffer.length; i += 1) {
    buffer[i] *= i / attackSamples;
  }
  for (let i = 0; i < releaseSamples && i < buffer.length; i += 1) {
    const idx = buffer.length - 1 - i;
    buffer[idx] *= i / releaseSamples;
  }
}

function floatToInt16(samples) {
  const buffer = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Int16Array(buffer);
}

writeVoicebank();
