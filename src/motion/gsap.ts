// The single animation engine for the invitation. Only lazily loaded chunks
// import this module, so check-in never downloads GSAP before it is useful.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);
// Mobile address bars resize the viewport while scrolling; ignoring those
// resizes avoids visible jumps in every scrubbed scene.
ScrollTrigger.config({ ignoreMobileResize: true });
gsap.defaults({ ease: 'expo.out', duration: 0.9 });

if (typeof document !== 'undefined') {
  if (document.fonts?.ready) void document.fonts.ready.then(() => ScrollTrigger.refresh());

  // ScrollTrigger measures start/end positions once. Sections that arrive
  // later (the lazily loaded journey, fonts, an opened <details>) move every
  // scene below them, so re-measure whenever the document's size changes.
  // Without this the envelope could be measured before the 600svh journey
  // existed and appear already "opened" when the guest reached it.
  if (typeof ResizeObserver === 'function') {
    let lastSize = '';
    let timer = 0;
    new ResizeObserver(() => {
      const size = `${document.documentElement.scrollWidth}x${document.documentElement.scrollHeight}`;
      if (size === lastSize) return;
      lastSize = size;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => ScrollTrigger.refresh(), 100);
    }).observe(document.body);
  }
}

export { gsap, ScrollTrigger, SplitText };
