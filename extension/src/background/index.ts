import type { ExtensionMessage } from '../shared/messages'
import * as machine from './runMachine'

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(console.error)

chrome.runtime.onMessage.addListener((msg: ExtensionMessage, _sender, sendResponse) => {
  switch (msg.kind) {
    case 'START_RUN':
      machine.startRun(msg.tabId).catch(console.error)
      break

    case 'STOP':
      machine.stop().catch(console.error)
      break

    case 'APPROVE_ACTION':
      machine.approveAction(msg.idx, msg.editedValue).catch(console.error)
      break

    case 'REJECT_ACTION':
      machine.rejectAction(msg.idx).catch(console.error)
      break

    case 'ANSWER_QUESTION':
      machine.answerQuestion(msg.idx, msg.value, msg.remember).catch(console.error)
      break

    case 'GET_STATE':
      machine.getState().then(sendResponse).catch(() => sendResponse(null))
      return true

    case 'PING':
      sendResponse({ kind: 'PONG' } satisfies ExtensionMessage)
      return true
  }
})
