/* global chrome */
(function () {
  const overlay = createOverlay();
  const button = overlay.querySelector('button');
  const status = overlay.querySelector('.kokoro-status');
  let currentSelection = '';
  let isPlaying = false;
  let audioElement = null;

  button.addEventListener('click', () => {
    if (!currentSelection) {
      return;
    }
    if (isPlaying) {
      stopPlayback();
      return;
    }
    speakSelection(currentSelection);
  });

  document.addEventListener('mouseup', handleSelectionChange);
  document.addEventListener('keyup', handleSelectionChange);
  document.addEventListener('scroll', hideOverlay, { passive: true });

  function handleSelectionChange() {
    const text = window.getSelection().toString().trim();
    currentSelection = text;
    if (text) {
      const rect = getSelectionRect();
      if (rect) {
        showOverlay(rect);
        status.textContent = 'Ready';
        button.setAttribute('aria-label', `Read aloud: "${text.slice(0, 40)}"`);
      }
    } else {
      hideOverlay();
    }
  }

  function speakSelection(text) {
    setLoading(true);
    chrome.runtime.sendMessage({ type: 'speak', text }, (response) => {
      setLoading(false);
      if (!response || !response.ok) {
        status.textContent = response && response.error ? response.error : 'Unable to read text';
        return;
      }
      playAudio(response.audioUrl);
    });
  }

  function playAudio(url) {
    stopPlayback();
    audioElement = new Audio(url);
    audioElement.addEventListener('ended', () => {
      isPlaying = false;
      button.classList.remove('kokoro-playing');
      status.textContent = 'Finished';
    });
    audioElement.addEventListener('play', () => {
      isPlaying = true;
      button.classList.add('kokoro-playing');
      status.textContent = 'Playing…';
    });
    audioElement.addEventListener('error', () => {
      isPlaying = false;
      status.textContent = 'Playback error';
    });
    audioElement.play().catch((error) => {
      console.error('Playback failed', error);
      status.textContent = 'Autoplay blocked';
    });
  }

  function stopPlayback() {
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
      audioElement = null;
    }
    isPlaying = false;
    button.classList.remove('kokoro-playing');
    status.textContent = 'Stopped';
  }

  function showOverlay(rect) {
    overlay.style.display = 'flex';
    const top = window.scrollY + rect.top - overlay.offsetHeight - 12;
    const left = window.scrollX + rect.left + (rect.width - overlay.offsetWidth) / 2;
    overlay.style.top = `${Math.max(8, top)}px`;
    overlay.style.left = `${Math.max(8, left)}px`;
  }

  function hideOverlay() {
    overlay.style.display = 'none';
    currentSelection = '';
    stopPlayback();
  }

  function setLoading(value) {
    if (value) {
      button.disabled = true;
      button.classList.add('kokoro-loading');
      status.textContent = 'Loading…';
    } else {
      button.disabled = false;
      button.classList.remove('kokoro-loading');
    }
  }

  function createOverlay() {
    const container = document.createElement('div');
    container.id = 'kokoro-reader-overlay';
    container.setAttribute('role', 'dialog');
    container.setAttribute('aria-live', 'polite');
    container.style.display = 'none';
    container.innerHTML = `
      <style>
        #kokoro-reader-overlay {
          position: absolute;
          z-index: 2147483647;
          background: #111827;
          color: #f9fafb;
          border-radius: 999px;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.25);
          padding: 6px 12px;
          gap: 8px;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          align-items: center;
        }
        #kokoro-reader-overlay button {
          appearance: none;
          border: none;
          background: #2563eb;
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          font-size: 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s ease;
        }
        #kokoro-reader-overlay button:hover:not(:disabled) {
          background: #1d4ed8;
        }
        #kokoro-reader-overlay button:disabled {
          cursor: progress;
          background: #475569;
        }
        #kokoro-reader-overlay button.kokoro-playing {
          background: #16a34a;
        }
        #kokoro-reader-overlay .kokoro-status {
          font-size: 12px;
          line-height: 1;
        }
      </style>
      <button type="button" aria-label="Read selection">🔊</button>
      <span class="kokoro-status">Ready</span>
    `;
    document.body.appendChild(container);
    return container;
  }

  function getSelectionRect() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return null;
    }
    const range = selection.getRangeAt(0).cloneRange();
    if (range.collapsed) {
      return null;
    }
    let rect = range.getBoundingClientRect();
    if (!rect || (rect.x === 0 && rect.y === 0 && rect.width === 0 && rect.height === 0)) {
      const span = document.createElement('span');
      span.textContent = '\u200b';
      range.insertNode(span);
      rect = span.getBoundingClientRect();
      span.remove();
      selection.removeAllRanges();
      selection.addRange(range);
    }
    return rect;
  }
})();
