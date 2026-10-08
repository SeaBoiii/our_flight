type NetworkInformation = {
  saveData?: boolean;
  effectiveType?: string;
  addEventListener?: (type: 'change', listener: () => void) => void;
  removeEventListener?: (type: 'change', listener: () => void) => void;
};

export function networkConnection(): NetworkInformation | undefined {
  return typeof navigator === 'undefined'
    ? undefined
    : (navigator as Navigator & { connection?: NetworkInformation }).connection;
}

/** Data saver, slow-2g and 2g visits receive the static, artwork-free journey. */
export function isLowDataConnection(): boolean {
  const network = networkConnection();
  return network?.saveData === true || network?.effectiveType === 'slow-2g' || network?.effectiveType === '2g';
}
