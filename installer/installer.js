// Nusa Custom Setup Simulator & Controller
document.addEventListener("DOMContentLoaded", () => {
  const statusLabel = document.getElementById("statusLabel");
  const percentLabel = document.getElementById("percentLabel");
  const progressFill = document.getElementById("progressFill");

  const steps = [
    { p: 25, label: "Memeriksa pembaruan..." },
    { p: 55, label: "Loading..." },
    { p: 85, label: "Loading..." },
    { p: 100, label: "Selesai!" }
  ];

  let currentStep = 0;
  function runStep() {
    if (currentStep >= steps.length) {
      setTimeout(() => {
        if (window.winNotchInstaller) {
          window.winNotchInstaller.finish();
        }
      }, 500);
      return;
    }

    const { p, label } = steps[currentStep];
    if (progressFill) progressFill.style.width = p + "%";
    if (percentLabel) percentLabel.textContent = p + "%";
    if (statusLabel) statusLabel.textContent = label;

    currentStep++;
    const delay = currentStep === steps.length ? 600 : 400;
    setTimeout(runStep, delay);
  }

  document.body.addEventListener("click", () => {
    if (currentStep >= steps.length) {
      window.winNotchInstaller?.finish();
    }
  });

  setTimeout(runStep, 250);
});
