import { useSyncExternalStore } from 'react';
import { isLowDataConnection, networkConnection } from './network';

function subscribe(onChange: () => void): () => void {
  const network = networkConnection();
  network?.addEventListener?.('change', onChange);
  return () => network?.removeEventListener?.('change', onChange);
}

// Read synchronously on the first render so a data-saving visit never mounts
// cinematic artwork, even briefly. Reduced motion remains an independent fallback.
export function useLowDataMode(): boolean {
  return useSyncExternalStore(subscribe, isLowDataConnection, () => false);
}
