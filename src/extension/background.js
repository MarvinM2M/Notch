// WinNotch Web Connector - Background Service Worker
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.sender && msg.text) {
    fetch("http://127.0.0.1:3457/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app: msg.app || "generic",
        sender: String(msg.sender).trim(),
        text: String(msg.text).trim()
      })
    }).catch(() => {});
  }
});
