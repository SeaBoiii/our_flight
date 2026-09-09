import { useSyncExternalStore } from 'react';

type NetworkInformation = {
  saveData?: boolean;
  effectiveType?: string;
  addEventListener?: (type: 'change', listener: () => void) => void;
  removeEventListener?: (type: 'change', listener: () => void) => void;
};

function connection(): NetworkInformation | undefined {
  return typeof navigator === 'undefined'
    ? undefined
    : (navigator as Navigator & { connection?: NetworkInformation }).connection;
}

function snapshot(): boolean {
  const network = connection();
  return network?.saveData === true || network?.effectiveType === 'slow-2g' || network?.effectiveType === '2g';
}

function subscribe(onChange: () => void): () => void {
  const network = connection();
  network?.addEventListener?.('change', onChange);
  return () => network?.removeEventListener?.('change', onChange);
}

// Read synchronously on the first render so a data-saving visit never mounts
// a video source, even briefly. Browsers without the API keep normal playback.
export function useLowDataMode(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
