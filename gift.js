(function () {
  "use strict";

  const button = document.querySelector("#gift-button");
  const dialog = document.querySelector("#gift-dialog");
  const closeButton = document.querySelector("#gift-close");
  const retryButton = document.querySelector("#gift-retry");
  const status = document.querySelector("#gift-status");
  const video = document.querySelector("#gift-video");
  const canvas = document.querySelector("#gift-canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const hasVideoFrames = typeof video.requestVideoFrameCallback === "function";
  let frameId = null;
  let playId = 0;

  function stopDrawing() {
    if (frameId === null) return;
    if (hasVideoFrames) video.cancelVideoFrameCallback(frameId);
    else cancelAnimationFrame(frameId);
    frameId = null;
  }

  function showError() {
    if (!dialog.open) return;
    stopDrawing();
    video.pause();
    context?.clearRect(0, 0, canvas.width, canvas.height);
    status.textContent = "Не удалось воспроизвести подарок. Проверьте соединение и попробуйте ещё раз.";
    status.hidden = false;
    retryButton.hidden = false;
  }

  function drawFrame() {
    frameId = null;
    if (!dialog.open || video.paused || video.ended) return;
    if (video.readyState >= 2 && context) {
      try {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frame = context.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = frame.data;
        for (let index = 0; index < pixels.length; index += 4) {
          const red = pixels[index];
          const green = pixels[index + 1];
          const blue = pixels[index + 2];
          const dominance = green - Math.max(red, blue);
          // Key the bright green backdrop, with a soft edge and reduced green spill.
          // Dark/teal details in the animation are deliberately preserved.
          if (green > 140 && dominance > 60) {
            const key = Math.min(1, (dominance - 60) / 90, (green - 140) / 60);
            pixels[index + 3] = Math.round(255 * (1 - key));
            pixels[index + 1] = Math.round(green - dominance * key);
          }
        }
        context.putImageData(frame, 0, 0);
      } catch (_error) {
        showError();
        return;
      }
    }
    frameId = hasVideoFrames
      ? video.requestVideoFrameCallback(drawFrame)
      : requestAnimationFrame(drawFrame);
  }

  function openGift() {
    const currentPlayId = ++playId;
    stopDrawing();
    context?.clearRect(0, 0, canvas.width, canvas.height);
    status.textContent = "Открываем подарок…";
    status.hidden = false;
    retryButton.hidden = true;
    if (!dialog.open) dialog.showModal();
    document.documentElement.classList.add("gift-is-open");
    if (!context) {
      showError();
      return;
    }
    if (video.error) video.load();
    video.currentTime = 0;
    video.muted = false;
    video.volume = 1;
    // Keep play() in the click handler so browsers allow playback with sound.
    video.play().catch(() => {
      if (currentPlayId === playId) showError();
    });
  }

  function closeGift() {
    if (dialog.open) dialog.close();
  }

  button.addEventListener("click", openGift);
  retryButton.addEventListener("click", openGift);
  closeButton.addEventListener("click", closeGift);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeGift();
  });
  dialog.addEventListener("close", () => {
    playId += 1;
    stopDrawing();
    video.pause();
    video.currentTime = 0;
    context?.clearRect(0, 0, canvas.width, canvas.height);
    document.documentElement.classList.remove("gift-is-open");
    button.focus({ preventScroll: true });
  });
  video.addEventListener("loadedmetadata", () => {
    const displayWidth = canvas.clientWidth * Math.min(window.devicePixelRatio || 1, 2);
    const scale = Math.min(1, Math.max(320, Math.min(1280, displayWidth)) / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
  });
  video.addEventListener("playing", () => {
    if (!dialog.open) {
      video.pause();
      return;
    }
    status.hidden = true;
    retryButton.hidden = true;
    stopDrawing();
    drawFrame();
  });
  video.addEventListener("ended", closeGift);
  video.addEventListener("error", showError);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) closeGift();
  });
})();
