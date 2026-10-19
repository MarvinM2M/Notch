// Nusa Home Launcher Controller
document.addEventListener("DOMContentLoaded", async () => {
  const btnMin = document.getElementById("btnMin");
  const btnMax = document.getElementById("btnMax");
  const btnClose = document.getElementById("btnClose");
  const btnLaunchNotch = document.getElementById("btnLaunchNotch");
  const mascotNotch = document.getElementById("mascotNotch");
  const toggleAutoStart = document.getElementById("toggleAutoStart");
  const btnCheckUpdate = document.getElementById("btnCheckUpdate");
  const updateStatusText = document.getElementById("updateStatusText");

  // Window Controls
  btnMin?.addEventListener("click", () => {
    window.winNotchHome?.minimize();
  });

  btnMax?.addEventListener("click", () => {
    window.winNotchHome?.maximize();
  });

  btnClose?.addEventListener("click", () => {
    window.winNotchHome?.close();
  });

  // Launch Notch Function
  function launchNotchAction() {
    if (!btnLaunchNotch) return;
    btnLaunchNotch.style.transform = "scale(0.96)";
    const label = btnLaunchNotch.querySelector(".btn-label") || btnLaunchNotch;
    label.textContent = "Meluncurkan Nusa...";
    setTimeout(() => {
      window.winNotchHome?.launchNotch();
      setTimeout(() => {
        label.textContent = "Mulai Nusa Sekarang";
        btnLaunchNotch.style.transform = "";
      }, 1000);
    }, 280);
  }

  btnLaunchNotch?.addEventListener("click", launchNotchAction);

  // Playful Mascot Click
  mascotNotch?.addEventListener("click", () => {
    mascotNotch.style.transform = "scale(1.05)";
    setTimeout(() => {
      mascotNotch.style.transform = "";
    }, 300);
  });

  // Auto-Start Toggle
  if (toggleAutoStart) {
    try {
      const isEnabled = await window.winNotchHome?.getAutoStart();
      toggleAutoStart.checked = Boolean(isEnabled);
    } catch {}

    toggleAutoStart.addEventListener("change", async (e) => {
      const state = e.target.checked;
      await window.winNotchHome?.setAutoStart(state);
    });
  }

  // Check GitHub Updates
  btnCheckUpdate?.addEventListener("click", async (e) => {
    e.preventDefault();
    if (updateStatusText) updateStatusText.textContent = "Memeriksa...";
    btnCheckUpdate.style.pointerEvents = "none";
    try {
      const info = await window.winNotchHome?.checkUpdate();
      if (info && info.hasUpdate) {
        if (updateStatusText) {
          updateStatusText.innerHTML = `<span style="color:#19b8ff">Update v${info.version} tersedia!</span>`;
        }
        btnCheckUpdate.style.pointerEvents = "auto";
        btnCheckUpdate.onclick = (ev) => {
          ev.preventDefault();
          window.winNotchHome?.downloadUpdate(info.downloadUrl);
        };
      } else {
        if (updateStatusText) updateStatusText.textContent = "Versi Terbaru (v1.0.0)";
        setTimeout(() => {
          if (updateStatusText) updateStatusText.textContent = "Cek Update (v1.0.0)";
          btnCheckUpdate.style.pointerEvents = "auto";
        }, 3000);
      }
    } catch {
      if (updateStatusText) updateStatusText.textContent = "Cek Update (v1.0.0)";
      btnCheckUpdate.style.pointerEvents = "auto";
    }
  });
});
