import { useLayoutEffect, type DependencyList, type RefObject } from 'react';
import { gsap } from './gsap';

/**
 * Runs a GSAP scene scoped to `scope` and reverts every tween, ScrollTrigger
 * and SplitText it created on unmount or when dependencies change.
 * Pass `enabled: false` for reduced motion or low data: content then stays in
 * its natural, fully visible CSS state.
 */
export function useGsapScene(
  scope: RefObject<HTMLElement | null>,
  setup: (context: gsap.Context) => void | (() => void),
  enabled: boolean,
  dependencies: DependencyList = [],
): void {
  useLayoutEffect(() => {
    const root = scope.current;
    if (!enabled || !root) return undefined;
    const context = gsap.context((self) => setup(self), root);
    return () => context.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...dependencies]);
}
