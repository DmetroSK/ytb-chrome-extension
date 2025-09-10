(function () {
  const speeds = [1, 1.25, 1.5, 1.75, 2, 2.5, 3];
  let buttonsContainer;
  // default speed
  let lastSpeed = 2;
  // Track selected button
  let activeBtn = null;

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
        fontSize: "11px",
        color: "#fff",
        background: "rgba(255,255,255,0.2)",
        border: "1px solid rgba(255,255,255,0.3)",
        borderRadius: "8px",
        cursor: "pointer",
        transition: "all 0.15s ease",
        outline: "none",
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

    // Add speed buttons
    speeds.forEach((speed) => {
      const btn = createButton(`${speed}x`, `Set playback speed to ${speed}x`);
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

      // Pre-highlight default 1x
      if (speed === lastSpeed) activeBtn = btn;
    });

    // Screenshot button
    const snapBtn = createButton("📸", "Capture screenshot");
    snapBtn.style.fontSize = "15px";
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

    // Append container to player
    player.appendChild(buttonsContainer);

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

    // Sync active button if speed reapplied after ads
    if (buttonsContainer) {
      const buttons = buttonsContainer.querySelectorAll("button");
      buttons.forEach((btn) => {
        if (btn.textContent === `${lastSpeed}x`) {
          if (activeBtn) {
            activeBtn.style.background = "rgba(255,255,255,0.2)";
            activeBtn.style.transform = "scale(1)";
          }
          btn.style.background = "rgba(0,150,255,0.6)";
          btn.style.transform = "scale(1.1)";
          activeBtn = btn;
        }
      });
    }
  }

  // Watch for player container in case of dynamic page loads
  function checkForPlayer() {
    const player = document.querySelector("#below");
    if (player && !buttonsContainer) {
      createSpeedButtons();
    }
    applyLastSpeed();
  }

  const observer = new MutationObserver(checkForPlayer);
  observer.observe(document.body, { childList: true, subtree: true });

  // Initial check
  checkForPlayer();
})();
