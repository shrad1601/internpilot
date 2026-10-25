import { extractPage } from './extract'
import { initOverlay, removeOverlay, renderFieldOutlines, showStatusBar, removeStatusBar, updateFieldStatus } from './overlay'
import { initStopListener, removeStopListener } from './stop'
import { executeAction } from './fill'
import type { ExtensionMessage } from '../shared/messages'

chrome.runtime.onMessage.addListener(
  (msg: ExtensionMessage, _sender, sendResponse) => {
    if (msg.kind === 'EXTRACT_REQUEST') {
      try {
        const snapshot = extractPage(document, window.location.href, msg.frameId)
        sendResponse({ kind: 'EXTRACT_RESPONSE', snapshot })

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
      return true
    }

    if (msg.kind === 'FILL_ACTION') {
      updateFieldStatus(msg.action.agentId, 'waiting')

      executeAction(msg.action).then((result) => {
        updateFieldStatus(msg.action.agentId, result.success ? 'filled' : 'blocked')
        sendResponse({
          kind: 'FILL_RESULT',
          idx: msg.idx,
          success: result.success,
          actualValue: result.actualValue,
          error: result.error,
        } satisfies ExtensionMessage)
      }).catch((err) => {
        updateFieldStatus(msg.action.agentId, 'blocked')
        sendResponse({
          kind: 'FILL_RESULT',
          idx: msg.idx,
          success: false,
          error: String(err),
        } satisfies ExtensionMessage)
      })
      return true // async sendResponse
    }

    if (msg.kind === 'STOP') {
      removeOverlay()
      removeStatusBar()
      removeStopListener()
    }
  },
)
