/**
 * Utilitários de DOM, seletores e manipulação de elementos
 */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

let idCounter = 0;
export function uid() {
  return `msg_${Date.now()}_${++idCounter}`;
}

export function scrollToBottom(container, smooth = true) {
  if (!container) return;
  try {
    container.scrollTo({
      top: container.scrollHeight,
      behavior: smooth ? "smooth" : "auto"
    });
  } catch {
    container.scrollTop = container.scrollHeight;
  }
}

export function preventUnwantedZoom() {
  document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("dblclick", (e) => {
    if (e.target && (e.target.tagName === "BUTTON" || e.target.closest("button"))) {
      e.preventDefault();
    }
  }, { passive: false });
}
