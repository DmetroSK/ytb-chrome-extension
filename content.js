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

  // Load saved states
  chrome.storage?.sync.get(Object.keys(states), (res) => {
    states = { ...states, ...res };
    checkForPlayer();
  });

  // Listen for toggle messages
  chrome.runtime?.onMessage.addListener((msg) => {
    if (msg.action && msg.action.startsWith("toggle")) {
      const key = "show" + msg.action.replace("toggle", "");
      states[key] = msg.state;
      chrome.storage.sync.set({ [key]: msg.state });
      applyVisibility();
    }
  });

  function createSpeedButtons() {
    // Prevent duplicates
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
    });

    // Helper function to create individual buttons
    function createButton(label, title) {
      const button = document.createElement("button");
      button.textContent = label;
      button.title = title || label;
      Object.assign(button.style, {
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

      // Hover effect
      button.addEventListener("mouseenter", () => {
        if (button !== activeBtn) {
          button.style.background = "rgba(255,255,255,0.35)";
          button.style.transform = "scale(1.05)";
        }
      });
      button.addEventListener("mouseleave", () => {
        if (button !== activeBtn) {
          button.style.background = "rgba(255,255,255,0.2)";
          button.style.transform = "scale(1)";
        }
      });
      return button;
    }

    // Dislike button
    dislikeBtnEl = createButton("👎 N/A", "Dislike count");
    buttonsContainer.appendChild(dislikeBtnEl);

    // Speed toggle
    speedToggleBtn = createButton("⚡ Speed", "Show/Hide speed controls");
    speedToggleBtn.addEventListener("click", () => {
      if (!speedPanelVisible) {
        // Show all speed buttons
        speedPanelVisible = true;
        speedBtns.forEach((b) => (b.style.display = "flex"));

        // Auto-collapse after 10s
        clearTimeout(speedPanelTimeout);
        speedPanelTimeout = setTimeout(() => {
          speedPanelVisible = false;
          speedBtns.forEach((b) => {
            b.style.display = b === activeBtn ? "flex" : "none";
          });
        }, 10000);
      } else {
        // Hide buttons immediately (except active)
        speedPanelVisible = false;
        speedBtns.forEach((b) => {
          b.style.display = b === activeBtn ? "flex" : "none";
        });
        clearTimeout(speedPanelTimeout);
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
      if (!video) {
        console.log("Mono: No video element found");
        return;
      }

      if (!audioContext) {
        audioContext = new AudioContext();
        sourceNode = audioContext.createMediaElementSource(video);
        splitter = audioContext.createChannelSplitter(2);
        merger = audioContext.createChannelMerger(2);

        // Initial connection: normal stereo
        sourceNode.connect(splitter);
        splitter.connect(merger, 0, 0); // left -> left
        splitter.connect(merger, 1, 1); // right -> right
        merger.connect(audioContext.destination);
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

    // Append container to player
    player.appendChild(buttonsContainer);
    applyVisibility();

    // Highlight default
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
    const match = location.search.match(/v=([^&]+)/);
    if (!match) return;
    const videoId = match[1];

    chrome.runtime.sendMessage({ action: "getDislike", videoId }, (res) => {
      if (res && res.dislikes != null) {
        dislikeBtnEl.textContent = `👎 ${res.dislikes.toLocaleString()}`;
      } else {
        dislikeBtnEl.textContent = "👎 N/A";
      }
    });
  }

  function checkForPlayer() {
    const player = document.querySelector("#below");
    if (player && !buttonsContainer) createSpeedButtons();
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
