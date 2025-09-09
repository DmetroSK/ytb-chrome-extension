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
