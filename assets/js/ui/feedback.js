let toastCounter = 0;

export function showToast(options = {}, root) {
  const { title = "Aviso", description = "", variant = "info", timeout = 4200 } = options;
  const container = root || document.getElementById("toast-root");
  if (!container) {
    console.warn("No se encontró el contenedor de toasts.");
    return;
  }

  toastCounter += 1;
  const toast = document.createElement("div");
  toast.className = `toast${variant ? ` toast--${variant}` : ""}`;
  toast.dataset.toastId = `toast-${toastCounter}`;
  toast.innerHTML = `
    <div class="toast__title">${title}</div>
    ${description ? `<div class="text-muted" style="font-size:0.85rem;">${description}</div>` : ""}
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-8px)";
  }, timeout - 400);
  setTimeout(() => {
    toast.remove();
  }, timeout);
}

