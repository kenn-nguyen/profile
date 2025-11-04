(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory({
      env: 'node',
      fs: require('fs'),
      path: require('path'),
    });
  } else {
    root.kokoro = factory({ env: 'browser' });
  }
})(typeof self !== 'undefined' ? self : this, function (platform) {
  'use strict';

  const DEFAULT_SAMPLE_RATE = 22050;
  const LETTER_MAP = buildLetterMap();
  const DIGIT_MAP = buildDigitMap();
  const DIGRAPHS = ['CH', 'SH', 'TH', 'PH', 'GH', 'NG', 'WH'];
  const SENTENCE_PAUSE = new Set(['.', '!', '?']);
  const CLAUSE_PAUSE = new Set([',', ';', ':']);

  let voicebankPromise = null;

  async function ensureVoicebank() {
    if (!voicebankPromise) {
      voicebankPromise = loadVoicebank().then(prepareVoicebank);
    }
    return voicebankPromise;
  }

  function loadVoicebank() {
    if (platform.env === 'browser') {
      const url = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL
        ? chrome.runtime.getURL('models/voicebank.json')
        : 'models/voicebank.json';
      return fetch(url).then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load Kokoro voicebank: ${response.status}`);
        }
        return response.json();
      });
    }

    const fs = platform.fs;
    const path = platform.path;
    const override = process.env.KOKORO_VOICEBANK_PATH;
    const filePath = override || path.join(__dirname, '..', 'models', 'voicebank.json');
    const data = fs.readFileSync(filePath, 'utf8');
    return Promise.resolve(JSON.parse(data));
  }

  function prepareVoicebank(data) {
    if (!data || !Array.isArray(data.phonemes)) {
      throw new Error('Invalid Kokoro voicebank payload.');
    }
    const sampleRate = data.sampleRate || DEFAULT_SAMPLE_RATE;
    const crossFade = typeof data.crossFadeMs === 'number' ? data.crossFadeMs : 12;
    const phonemes = new Map();
    for (const entry of data.phonemes) {
      const samples = decodePhoneme(entry.data);
      phonemes.set(entry.id, {
        id: entry.id,
        type: entry.type || 'unknown',
        durationMs: entry.durationMs || Math.round((samples.length / sampleRate) * 1000),
        samples,
      });
    }
    return {
      sampleRate,
      crossFadeMs: crossFade,
      phonemes,
      dictionary: data.dictionary || {},
      metadata: data.metadata || {},
    };
  }

  function decodePhoneme(base64) {
    if (!base64) {
      return new Float32Array(0);
    }
    let bytes;
    if (platform.env === 'browser') {
      const binary = atob(base64);
      bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
    } else {
      const buffer = Buffer.from(base64, 'base64');
      bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const samples = new Float32Array(view.byteLength / 2);
    for (let i = 0; i < samples.length; i += 1) {
      samples[i] = view.getInt16(i * 2, true) / 0x7fff;
    }
    return samples;
  }

  async function synthesize(text) {
    if (typeof text !== 'string' || !text.trim()) {
      return Promise.reject(new Error('Cannot synthesize empty text.'));
    }
    const voicebank = await ensureVoicebank();
    const sequence = phonemize(text, voicebank);
    if (sequence.length === 0) {
      throw new Error('No phonemes produced from input text.');
    }
    const crossFadeSamples = Math.max(1, Math.round((voicebank.crossFadeMs / 1000) * voicebank.sampleRate));
    let buffer = new Float32Array(0);
    for (const phonemeId of sequence) {
      const entry = voicebank.phonemes.get(phonemeId);
      if (!entry) {
        continue;
      }
      buffer = joinWithCrossFade(buffer, entry.samples, crossFadeSamples);
    }
    if (buffer.length === 0) {
      throw new Error('Synthesizer generated an empty buffer.');
    }
    const tail = new Float32Array(Math.round(voicebank.sampleRate * 0.05));
    buffer = joinWithCrossFade(buffer, tail, crossFadeSamples);
    normalize(buffer, 0.92);
    return encodeWav(buffer, voicebank.sampleRate);
  }

  function phonemize(text, voicebank) {
    const dictionary = voicebank.dictionary || {};
    const tokens = tokenize(text);
    const result = [];
    tokens.forEach((token) => {
      if (token.type === 'word') {
        const upper = token.value.toUpperCase();
        if (dictionary[upper]) {
          result.push(...dictionary[upper]);
          result.push('PAUSE');
        } else if (/^[0-9]+$/.test(upper)) {
          result.push(...expandDigits(upper));
          result.push('PAUSE');
        } else {
          result.push(...fallbackWord(upper));
          result.push('PAUSE');
        }
      } else if (token.type === 'punctuation') {
        if (SENTENCE_PAUSE.has(token.value)) {
          result.push('PAUSE', 'PAUSE');
        } else if (CLAUSE_PAUSE.has(token.value)) {
          result.push('PAUSE');
        }
      }
    });
    while (result.length > 0 && result[result.length - 1] === 'PAUSE') {
      result.pop();
    }
    return result.filter(Boolean);
  }

  function expandDigits(digits) {
    const sequence = [];
    for (const char of digits) {
      const mapping = DIGIT_MAP[char];
      if (mapping) {
        sequence.push(...mapping, 'PAUSE');
      }
    }
    if (sequence.length > 0 && sequence[sequence.length - 1] === 'PAUSE') {
      sequence.pop();
    }
    return sequence;
  }

  function fallbackWord(word) {
    const phonemes = [];
    let index = 0;
    while (index < word.length) {
      let consumed = false;
      for (const digraph of DIGRAPHS) {
        if (word.startsWith(digraph, index)) {
          const mapping = LETTER_MAP[digraph];
          if (mapping) {
            phonemes.push(...mapping);
            index += digraph.length;
            consumed = true;
            break;
          }
        }
      }
      if (consumed) {
        continue;
      }
      const letter = word[index];
      const mapping = LETTER_MAP[letter] || LETTER_MAP.DEFAULT;
      phonemes.push(...mapping);
      index += 1;
    }
    return phonemes;
  }

  function tokenize(text) {
    const tokens = [];
    const re = /[A-Za-z]+|[0-9]+|[^\s]/g;
    let match;
    while ((match = re.exec(text)) !== null) {
      const value = match[0];
      if (/^[A-Za-z]+$/.test(value)) {
        tokens.push({ type: 'word', value });
      } else if (/^[0-9]+$/.test(value)) {
        tokens.push({ type: 'word', value });
      } else {
        tokens.push({ type: 'punctuation', value });
      }
    }
    return tokens;
  }

  function joinWithCrossFade(existing, addition, overlap) {
    if (addition.length === 0) {
      return existing;
    }
    if (existing.length === 0) {
      return addition.slice();
    }
    const actualOverlap = Math.min(overlap, existing.length, addition.length);
    const total = existing.length + addition.length - actualOverlap;
    const output = new Float32Array(total);
    output.set(existing);
    for (let i = 0; i < addition.length; i += 1) {
      const target = i + existing.length - actualOverlap;
      if (target < 0) {
        continue;
      }
      if (target >= output.length) {
        break;
      }
      if (i < actualOverlap) {
        const mix = i / actualOverlap;
        output[target] = output[target] * (1 - mix) + addition[i] * mix;
      } else {
        output[target] = addition[i];
      }
    }
    return output;
  }

  function normalize(buffer, maxAmplitude) {
    let peak = 0;
    for (let i = 0; i < buffer.length; i += 1) {
      const value = Math.abs(buffer[i]);
      if (value > peak) {
        peak = value;
      }
    }
    if (peak > maxAmplitude && peak > 0) {
      const scale = maxAmplitude / peak;
      for (let i = 0; i < buffer.length; i += 1) {
        buffer[i] *= scale;
      }
    }
  }

  function encodeWav(samples, sampleRate) {
    const byteRate = sampleRate * 2;
    const blockAlign = 2;
    const dataLength = samples.length * 2;
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);
    floatTo16BitPCM(view, 44, samples);
    return buffer;
  }

  function floatTo16BitPCM(view, offset, samples) {
    for (let i = 0; i < samples.length; i += 1) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
  }

  function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i += 1) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  function buildLetterMap() {
    return {
      A: ['AE'],
      B: ['B', 'IY'],
      C: ['K'],
      D: ['D', 'IY'],
      E: ['IY'],
      F: ['EH', 'F'],
      G: ['JH', 'IY'],
      H: ['EY', 'CH'],
      I: ['AY'],
      J: ['JH', 'EY'],
      K: ['K', 'EY'],
      L: ['EH', 'L'],
      M: ['EH', 'M'],
      N: ['EH', 'N'],
      O: ['OW'],
      P: ['P', 'IY'],
      Q: ['K', 'Y', 'UW'],
      R: ['AA', 'R'],
      S: ['EH', 'S'],
      T: ['T', 'IY'],
      U: ['Y', 'UW'],
      V: ['V', 'IY'],
      W: ['D', 'AH', 'B', 'Y', 'UW'],
      X: ['EH', 'K', 'S'],
      Y: ['W', 'AY'],
      Z: ['Z', 'IY'],
      CH: ['CH'],
      SH: ['SH'],
      TH: ['TH'],
      PH: ['F'],
      GH: ['G'],
      NG: ['NG'],
      WH: ['W'],
      DEFAULT: ['AH'],
    };
  }

  function buildDigitMap() {
    return {
      '0': ['Z', 'IY', 'R', 'OW'],
      '1': ['W', 'AH', 'N'],
      '2': ['T', 'UW'],
      '3': ['TH', 'R', 'IY'],
      '4': ['F', 'AO', 'R'],
      '5': ['F', 'AY', 'V'],
      '6': ['S', 'IH', 'K', 'S'],
      '7': ['S', 'EH', 'V', 'AH', 'N'],
      '8': ['EY', 'T'],
      '9': ['N', 'AY', 'N'],
    };
  }

  return {
    synthesize,
    _internals: {
      ensureVoicebank,
      loadVoicebank,
      prepareVoicebank,
      decodePhoneme,
      phonemize,
      fallbackWord,
      joinWithCrossFade,
      normalize,
    },
  };
});
