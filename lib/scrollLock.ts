let lockCount = 0;

export function lockScroll(): void {
  if (typeof document === "undefined") return;
  lockCount++;
  document.body.classList.add("scroll-locked");
}

export function unlockScroll(): void {
  if (typeof document === "undefined") return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.classList.remove("scroll-locked");
    document.body.style.overflow = "";
  }
}

export function forceUnlockScroll(): void {
  if (typeof document === "undefined") return;
  lockCount = 0;
  document.body.classList.remove("scroll-locked");
  document.body.style.overflow = "";
}