document.addEventListener("DOMContentLoaded", () => {
  const toggles = ["Toolbar", "Dislike", "Snapshot", "Speed", "Mono"];

  chrome.storage.sync.get(
    toggles.map((t) => "show" + t),
    (res) => {
      toggles.forEach((name) => {
        const el = document.getElementById("toggle" + name);
        if (!el) return;

        // Set default checked
        el.checked = res["show" + name] !== false;

        // Listen for changes
        el.addEventListener("change", () => {
          const state = el.checked;

          // Save state
          chrome.storage.sync.set({ ["show" + name]: state });

          // Send message to active tab to show/hide button
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0]) return; // no active tab
            chrome.tabs.sendMessage(tabs[0].id, {
              action: "toggle" + name,
              state, // true = show, false = hide
            });
          });
        });
      });
    }
  );
});
