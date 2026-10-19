// WinNotch Web Connector - Content Script
(function () {
  const host = window.location.hostname;
  let appName = "generic";
  if (host.includes("whatsapp")) appName = "whatsapp";
  else if (host.includes("telegram")) appName = "telegram";
  else if (host.includes("discord")) appName = "discord";

  function forward(sender, text) {
    if (!sender || !text) return;
    try {
      chrome.runtime.sendMessage({
        app: appName,
        sender: sender,
        text: text
      });
    } catch (e) {}
  }

  // 1. Listen for intercepted Notification calls
  window.addEventListener("message", (event) => {
    if (event.data && event.data.type === "WINNOTCH_NOTIFICATION") {
      const title = event.data.title || appName;
      const body = event.data.body || "Pesan baru masuk";
      forward(title, body);
    }
  });

  // 2. Fallback for WhatsApp Web: Monitor unread chat messages
  if (appName === "whatsapp") {
    let lastKey = "";
    setInterval(() => {
      const badges = document.querySelectorAll("span[aria-label*='unread'], span[aria-label*='belum dibaca'], [data-icon='unread-count']");
      if (badges.length > 0) {
        for (const badge of badges) {
          const row = badge.closest("div[role='listitem']") || badge.closest("div[data-testid='cell-frame-container']");
          if (row) {
            const titleEl = row.querySelector("span[title]");
            const textEl = row.querySelector("span[dir='ltr']") || row.querySelector("span[title]");
            const sender = titleEl ? (titleEl.getAttribute("title") || titleEl.textContent) : "WhatsApp";
            const text = textEl ? textEl.textContent : "Pesan baru";
            const key = sender + ":" + text;
            if (key !== lastKey) {
              lastKey = key;
              forward(sender, text);
            }
          }
        }
      }
    }, 1000);
  }

  // 3. Fallback for Discord Web: Monitor incoming messages
  if (appName === "discord") {
    let lastDiscordKey = "";
    setInterval(() => {
      // Check title for unread mention/DM count (e.g., "(1) Discord")
      if (document.title.startsWith("(") && !document.hasFocus()) {
        const lastMsg = document.querySelector("li[class*='messageListItem']:last-child");
        if (lastMsg) {
          const authorEl = lastMsg.querySelector("span[class*='username']");
          const contentEl = lastMsg.querySelector("div[class*='messageContent']");
          const sender = authorEl ? authorEl.textContent.trim() : "Discord";
          const text = contentEl ? contentEl.textContent.trim() : "Pesan baru masuk";
          const key = sender + ":" + text;
          if (key !== lastDiscordKey && text) {
            lastDiscordKey = key;
            forward(sender, text);
          }
        }
      }
    }, 1500);
  }
})();
