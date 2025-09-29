// Fallback: capture the visible tab if canvas screenshot is blocked by CORS.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "YT_HELPER_CAPTURE_TAB") {
    chrome.tabs.captureVisibleTab({ format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ ok: true, dataUrl });
      }
    });
    // Indicate we'll respond asynchronously
    return true;
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "getDislike" && msg.videoId) {
    fetch(`https://returnyoutubedislikeapi.com/votes?videoId=${msg.videoId}`)
      .then((res) => res.json())
      .then((data) => sendResponse({ dislikes: data.dislikes }))
      .catch(() => sendResponse({ dislikes: null }));
    return true; // keep the message channel open for async response
  }
});
