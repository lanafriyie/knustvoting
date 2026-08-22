// src/lib/toast.js
// Global toast event dispatcher for the KNUST AIM Portal

export function showToast(message, type = 'info') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('knust_toast', {
      detail: { message, type }
    }));
  }
}
