/**
 * Counts the work the app is waiting on - backend requests, loading a saved
 * configuration, plotting a checked node - so the header can show a spinner
 * while any of it runs.
 *
 * It lives outside the Zustand store on purpose: it flips on every request,
 * and going through the store would re-run every selector each time.
 */

import { useEffect, useState, useSyncExternalStore } from 'react';

let pending = 0;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const isPending = () => pending > 0;

/** Counts `work` as ongoing until it settles, whether it succeeds or not. */
export const trackBusy = async <T>(
  work: Promise<T> | (() => Promise<T>),
): Promise<T> => {
  pending++;
  if (pending === 1) notify();
  try {
    return await (typeof work === 'function' ? work() : work);
  } finally {
    pending--;
    if (pending === 0) notify();
  }
};

/**
 * Resolves once the browser has painted a frame after the current one, so
 * work that has just written the store also covers React and Plotly drawing
 * what it wrote.
 *
 * A hidden window gets no frames, and the node checks queue behind this, so
 * it gives up waiting after `timeoutMs`.
 */
export const afterNextPaint = (timeoutMs = 1000) =>
  new Promise<void>((resolve) => {
    const timer = window.setTimeout(resolve, timeoutMs);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        window.clearTimeout(timer);
        resolve();
      }),
    );
  });

/**
 * Whether work has been ongoing for at least `delayMs`. The delay keeps quick
 * operations - cached requests, mostly - from flashing the spinner.
 */
export const useIsBusy = (delayMs = 300): boolean => {
  const busy = useSyncExternalStore(subscribe, isPending);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!busy) {
      setShown(false);
      return;
    }
    const timer = window.setTimeout(() => setShown(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [busy, delayMs]);

  return busy && shown;
};
