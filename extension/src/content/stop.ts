let _active = false

export function initStopListener(): void {
  if (_active) return
  _active = true
  window.addEventListener('keydown', _handler, { capture: true })
}

export function removeStopListener(): void {
  _active = false
  window.removeEventListener('keydown', _handler, { capture: true })
}

function _handler(e: KeyboardEvent) {
  if (e.key === 'Escape' && _active) {
    e.stopPropagation()
    chrome.runtime.sendMessage({ kind: 'STOP' }).catch(() => {})
  }
}
