import type { PageSnapshot, FrameSnapshot } from '../shared/types'
import type { ExtensionMessage } from '../shared/messages'

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(console.error)

chrome.runtime.onMessage.addListener((msg: ExtensionMessage) => {
  if (msg.kind === 'START_RUN') {
    startRun(msg.tabId).catch(console.error)
  }
  if (msg.kind === 'STOP') {
    broadcastStop().catch(console.error)
  }
})

async function broadcastStop() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return
  await chrome.tabs.sendMessage(tab.id, { kind: 'STOP' }).catch(() => {})
  broadcast({ kind: 'RUN_STATUS', status: 'error', message: 'Stopped' })
}

async function startRun(tabId: number) {
  broadcast({ kind: 'RUN_STATUS', status: 'reading' })

  try {
    // Discover all frames by executing a no-op in each
    const frameResults = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => true,
    })
    const frameIds = frameResults.map((r) => r.frameId ?? 0)

    const snapshots: FrameSnapshot[] = []
    for (const frameId of frameIds) {
      try {
        const resp = await chrome.tabs.sendMessage(
          tabId,
          { kind: 'EXTRACT_REQUEST', frameId } satisfies ExtensionMessage,
          { frameId },
        )
        if (resp?.kind === 'EXTRACT_RESPONSE') {
          snapshots.push(resp.snapshot as FrameSnapshot)
        }
      } catch {
        // Frame may not have content script (e.g. cross-origin iframe), skip
      }
    }

    const merged = merge(snapshots)
    broadcast({ kind: 'RUN_UPDATE', snapshot: merged })
  } catch (err) {
    broadcast({ kind: 'RUN_STATUS', status: 'error', message: String(err) })
  }
}

function merge(frames: FrameSnapshot[]): PageSnapshot {
  const main = frames.find((f) => f.frameId === 0) ?? frames[0]
  const allFields = frames.flatMap((f) => f.fields)
  const allButtons = frames.flatMap((f) => f.buttons)

  return {
    url: main?.url ?? '',
    domain: (() => { try { return new URL(main?.url ?? '').hostname } catch { return '' } })(),
    title: main?.title ?? '',
    atsGuess: main?.atsGuess,
    jobTitle: main?.jobTitle,
    company: main?.company,
    fields: allFields,
    buttons: allButtons,
  }
}

function broadcast(msg: ExtensionMessage) {
  chrome.runtime.sendMessage(msg).catch(() => {})
}
