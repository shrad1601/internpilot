// Service worker: orchestrate runs, commands, side panel

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(console.error)

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'activate') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id != null) {
      await chrome.sidePanel.open({ tabId: tab.id })
    }
  } else if (command === 'stop') {
    // Phase 2+: broadcast STOP to all frames in active tab
  }
})
