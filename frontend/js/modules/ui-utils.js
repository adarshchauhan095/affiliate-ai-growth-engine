// UI Utilities: Universal Clipboard & Notification Helpers

export async function copyToClipboard(text, label = "Field") {
  if (!text) {
    showToast(`No text available to copy for ${label}`, "warning");
    return;
  }

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      showToast(`Copied ${label}!`, "success");
      return;
    }
  } catch (err) {
    console.warn("Clipboard API failed, using fallback:", err);
  }

  // Fallback for older mobile browsers
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    if (successful) {
      showToast(`Copied ${label}!`, "success");
    } else {
      showToast(`Could not copy ${label}`, "danger");
    }
  } catch (err2) {
    showToast(`Copy failed: ${err2.message}`, "danger");
  }
}

// Global copy handler on window
window.copyText = function(text, label) {
  copyToClipboard(text, label);
};

export function showToast(message, type = "info") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("fade-out");
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, 2500);
}

window.closeModal = function() {
  const container = document.getElementById("modal-container");
  if (container) container.innerHTML = "";
};
