// A short tap on Android when a stamp lands. iOS and desktops ignore it.
export function hapticTap(pattern: number | number[] = 12): void {
  try {
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    navigator.vibrate?.(pattern);
  } catch {
    // Vibration is optional; some in-app browsers throw without user activation.
  }
}
