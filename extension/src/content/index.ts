import { extractPage } from './extract'
import { initOverlay, removeOverlay, renderFieldOutlines, showStatusBar, removeStatusBar } from './overlay'
import { initStopListener, removeStopListener } from './stop'
import type { ExtensionMessage } from '../shared/messages'

chrome.runtime.onMessage.addListener(
  (msg: ExtensionMessage, _sender, sendResponse) => {
    if (msg.kind === 'EXTRACT_REQUEST') {
      try {
        const snapshot = extractPage(document, window.location.href, msg.frameId)
        sendResponse({ kind: 'EXTRACT_RESPONSE', snapshot })

        // Only main frame (frameId 0) drives the overlay
        if (msg.frameId === 0) {
          initOverlay()
          renderFieldOutlines(snapshot.fields)
          initStopListener()
          showStatusBar(
            `Found ${snapshot.fields.filter((f) => f.visible).length} fields`,
            () => chrome.runtime.sendMessage({ kind: 'STOP' }),
          )
        }
      } catch (err) {
        sendResponse({ kind: 'EXT_ERROR', message: String(err) })
      }
      return true // keep channel open for async sendResponse
    }

    if (msg.kind === 'STOP') {
      removeOverlay()
      removeStatusBar()
      removeStopListener()
    }
  },
)
