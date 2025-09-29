(function () {
  const speeds = [1, 1.5, 2, 2.5, 3];
  let buttonsContainer;
  let lastSpeed = 2; // default speed
  let activeBtn = null; // Track selected speed button
  let dislikeBtnEl = null;
  let snapBtn = null;
  let speedBtns = [];
  let speedToggleBtn = null;
  let speedPanelVisible = false;
  let speedPanelTimeout;
  let monoBtn = null;
  let audioContext = null;
  let sourceNode = null;
  let splitter = null;
  let merger = null;
  let monoEnabled = false;

  // default visibility
  let states = {
    showToolbar: true,
    showDislike: true,
    showSnapshot: true,
    showSpeed: true,
    showMono: true,
  };

  // Load saved visibility states
  chrome.storage?.sync.get(Object.keys(states), (res) => {
    states = { ...states, ...res };
    checkForPlayer();
  });

  // Listen for popup toggle messages
  chrome.runtime?.onMessage.addListener((msg) => {
    if (msg.action && msg.action.startsWith("toggle")) {
      const key = "show" + msg.action.replace("toggle", "");
      states[key] = msg.state;
      chrome.storage.sync.set({ [key]: msg.state });
      applyVisibility();
    }
  });

  function createButton(label, title) {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.title = title || label;
    Object.assign(btn.style, {
      padding: "3px 8px",
      fontSize: "13px",
      color: "#fff",
      background: "rgba(255,255,255,0.2)",
      border: "1px solid rgba(255,255,255,0.3)",
      borderRadius: "8px",
      cursor: "pointer",
      transition: "all 0.15s ease",
      outline: "none",
      display: "flex",
      alignItems: "center",
      gap: "3px",
    });

    btn.addEventListener("mouseenter", () => {
      if (btn !== activeBtn) {
        btn.style.background = "rgba(255,255,255,0.35)";
        btn.style.transform = "scale(1.05)";
      }
    });

    btn.addEventListener("mouseleave", () => {
      if (btn !== activeBtn) {
        btn.style.background = "rgba(255,255,255,0.2)";
        btn.style.transform = "scale(1)";
      }
    });

    return btn;
  }

  function createButtons() {
    if (buttonsContainer) return;

    // Get the YouTube player container
    const player = document.querySelector("#below");
    if (!player) return;

    // Create buttons container
    buttonsContainer = document.createElement("div");
    Object.assign(buttonsContainer.style, {
      position: "absolute",
      top: "-4px",
      right: "0px",
      zIndex: "9999",
      display: "flex",
      flexDirection: "row",
      gap: "6px",
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
      flexWrap: "wrap", // safer for small screens
    });

    // Dislike button
    dislikeBtnEl = createButton("👎 N/A", "Dislike count");
    buttonsContainer.appendChild(dislikeBtnEl);

    // Speed toggle button
    speedToggleBtn = createButton("⚡ Speed", "Show/Hide speed controls");
    speedToggleBtn.addEventListener("click", () => {
      speedPanelVisible = !speedPanelVisible;
      speedBtns.forEach(
        (b) =>
          (b.style.display = speedPanelVisible
            ? "flex"
            : b === activeBtn
            ? "flex"
            : "none")
      );

      // Auto-collapse after 10s
      clearTimeout(speedPanelTimeout);
      if (speedPanelVisible) {
        speedPanelTimeout = setTimeout(() => {
          speedPanelVisible = false;
          speedBtns.forEach(
            (b) => (b.style.display = b === activeBtn ? "flex" : "none")
          );
        }, 10000);
      }
    });
    buttonsContainer.appendChild(speedToggleBtn);

    // Speed buttons
    speeds.forEach((speed) => {
      const btn = createButton(`${speed}x`, `Set playback speed to ${speed}x`);
      btn.style.display = "none"; // hidden by default
      btn.addEventListener("click", () => {
        const video = document.querySelector("video");
        if (video) video.playbackRate = speed;
        lastSpeed = speed;

        // Reset previous active
        if (activeBtn) {
          activeBtn.style.background = "rgba(255,255,255,0.2)";
          activeBtn.style.transform = "scale(1)";
        }

        // Highlight new active
        btn.style.background = "rgba(0,150,255,0.6)";
        btn.style.transform = "scale(1.1)";
        activeBtn = btn;
      });

      buttonsContainer.appendChild(btn);
      speedBtns.push(btn);
      if (speed === lastSpeed) activeBtn = btn;
    });

    // Screenshot button
    snapBtn = createButton("📸", "Capture screenshot");
    snapBtn.addEventListener("click", () => {
      const video = document.querySelector("video");
      if (!video || !video.videoWidth) return;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas
        .getContext("2d")
        .drawImage(video, 0, 0, canvas.width, canvas.height);
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = "yt-screenshot.png";
      document.body.appendChild(link);
      link.click();
      link.remove();
    });
    buttonsContainer.appendChild(snapBtn);

    // Mono audio button
    monoBtn = createButton("🎵 ", "Toggle mono audio");
    monoBtn.addEventListener("click", () => {
      const video = document.querySelector("video");
      if (!video) return console.log("Mono: No video element found");

      if (!audioContext) {
        try {
          audioContext = new AudioContext();
          sourceNode = audioContext.createMediaElementSource(video);
          splitter = audioContext.createChannelSplitter(2);
          merger = audioContext.createChannelMerger(2);

          // Initial connection: normal stereo
          sourceNode.connect(splitter);
          splitter.connect(merger, 0, 0); // left -> left
          splitter.connect(merger, 1, 1); // right -> right
          merger.connect(audioContext.destination);
        } catch (e) {
          console.error("AudioContext error:", e);
          return;
        }
      }

      // Toggle mono
      monoEnabled = !monoEnabled;

      // Update connections
      splitter.disconnect();
      if (monoEnabled) {
        splitter.connect(merger, 0, 0);
        splitter.connect(merger, 0, 1);
      } else {
        splitter.connect(merger, 0, 0);
        splitter.connect(merger, 1, 1);
      }

      // Highlight button
      monoBtn.style.background = monoEnabled
        ? "rgba(0,150,255,0.6)"
        : "rgba(255,255,255,0.2)";
    });
    buttonsContainer.appendChild(monoBtn);

    // Append buttons
    player.appendChild(buttonsContainer);

    // Apply saved visibility
    applyVisibility();

    // Highlight default speed button
    if (activeBtn) {
      activeBtn.style.background = "rgba(0,150,255,0.6)";
      activeBtn.style.transform = "scale(1.1)";
    }
  }

  // Apply last used speed on video load
  function applyLastSpeed() {
    const video = document.querySelector("video");
    if (video) video.playbackRate = lastSpeed;
    if (activeBtn) {
      activeBtn.style.background = "rgba(0,150,255,0.6)";
      activeBtn.style.transform = "scale(1.1)";
    }
  }

  function applyVisibility() {
    if (!buttonsContainer) return;
    buttonsContainer.style.display = states.showToolbar ? "flex" : "none";
    if (!states.showToolbar) return;

    dislikeBtnEl.style.display = states.showDislike ? "flex" : "none";
    snapBtn.style.display = states.showSnapshot ? "flex" : "none";
    speedToggleBtn.style.display = states.showSpeed ? "flex" : "none";

    if (monoBtn) {
      monoBtn.style.display = states.showMono ? "flex" : "none";
      if (states.showMono) {
        monoBtn.style.background = monoEnabled
          ? "rgba(0,150,255,0.6)"
          : "rgba(255,255,255,0.2)";
      }
    }

    if (!speedPanelVisible) {
      speedBtns.forEach(
        (b) => (b.style.display = b === activeBtn ? "flex" : "none")
      );
    }
  }

  function updateDislikeCount() {
    if (!dislikeBtnEl) return;
    const videoId = new URLSearchParams(location.search).get("v");
    if (!videoId) return;

    chrome.runtime.sendMessage({ action: "getDislike", videoId }, (res) => {
      dislikeBtnEl.textContent =
        res?.dislikes != null
          ? `👎 ${res.dislikes.toLocaleString()}`
          : "👎 N/A";
    });
  }

  function checkForPlayer() {
    const player = document.querySelector("#below");
    if (player && !buttonsContainer) createButtons();
    applyLastSpeed();
    if (location.pathname === "/watch") updateDislikeCount();

    // Show all speed buttons at start of video, then auto-collapse after 10s
    const video = document.querySelector("video");
    if (video) {
      video.addEventListener("play", () => {
        speedPanelVisible = true;
        speedBtns.forEach((b) => (b.style.display = "flex"));

        clearTimeout(speedPanelTimeout);
        speedPanelTimeout = setTimeout(() => {
          speedPanelVisible = false;
          speedBtns.forEach(
            (b) => (b.style.display = b === activeBtn ? "flex" : "none")
          );
        }, 10000);
      });
    }
  }

  const observer = new MutationObserver(checkForPlayer);
  observer.observe(document.body, { childList: true, subtree: true });

  // Initial check
  checkForPlayer();
})();
