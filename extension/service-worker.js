/* global chrome, importScripts, TextEncoder */
importScripts('tts/kokoro.js');

const memoryCache = new Map();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'speak') {
    return false;
  }

  const text = typeof message.text === 'string' ? message.text : '';
  synthesize(text)
    .then((audioUrl) => sendResponse({ ok: true, audioUrl }))
    .catch((error) => {
      console.error('Kokoro synthesis failed', error);
      sendResponse({ ok: false, error: error.message || String(error) });
    });
  return true;
});

async function synthesize(text) {
  const sanitized = text.trim();
  if (!sanitized) {
    throw new Error('No text selected');
  }

  const key = await hashText(sanitized);

  if (memoryCache.has(key)) {
    return memoryCache.get(key);
  }

  const stored = await chrome.storage.local.get(key);
  if (stored && stored[key]) {
    memoryCache.set(key, stored[key]);
    return stored[key];
  }

  const buffer = await self.kokoro.synthesize(sanitized);
  const dataUrl = arrayBufferToDataUrl(buffer);
  memoryCache.set(key, dataUrl);
  await chrome.storage.local.set({ [key]: dataUrl });
  return dataUrl;
}

async function hashText(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function arrayBufferToDataUrl(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return `data:audio/wav;base64,${base64}`;
}
