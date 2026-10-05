import { MantineProvider } from '@mantine/core';
import { StrictMode, useEffect } from 'react';
import { AppRouter } from './router';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';
import { useIbexStore } from './stores';
import { TestState } from './types';
import { mergeTestState, projectTestState } from './utils';
import { keysOf, PayloadKey, sweep } from './stores/payloadRegistry';

export function App() {
  /**
   * Keeps the payload registry in step with the store.
   *
   * The registry holds a second reference to every fetched array, so without
   * this it would keep alive exactly what the configuration dropped. Sweeping
   * from what the store can still reach means deleting a grid or a
   * configuration needs no bookkeeping of its own - which is the point of
   * choosing mark-and-sweep over reference counting across two dozen writers.
   *
   * Debounced onto an idle callback: a slider drag writes the store many times
   * a second and none of those writes changes reachability.
   */
  useEffect(() => {
    let scheduled = false;

    const runSweep = () => {
      scheduled = false;
      const { configurations, active } = useIbexStore.getState();
      const reachable = new Set<PayloadKey>();
      for (const configuration of configurations) {
        for (const key of keysOf(configuration)) reachable.add(key);
      }
      // `active` is normally the same object as its entry in `configurations`,
      // but it is briefly its own between a load and the `setActive` after it.
      if (active) for (const key of keysOf(active)) reachable.add(key);
      sweep(reachable);
    };

    const scheduleSweep = () => {
      if (scheduled) return;
      scheduled = true;
      const idle = (
        window as Window & {
          requestIdleCallback?: (
            callback: () => void,
            options?: { timeout: number },
          ) => void;
        }
      ).requestIdleCallback;
      if (idle) idle(runSweep, { timeout: 2000 });
      else window.setTimeout(runSweep, 500);
    };

    return useIbexStore.subscribe(scheduleSweep);
  }, []);

  useEffect(() => {
    // The store is read at call time rather than subscribed to: this is the
    // root component, so a subscription here re-renders the whole tree on every
    // store write, for a bridge only the e2e suite ever uses.
    const updateHandler = (
      _event: Electron.IpcRendererEvent,
      testState: Partial<TestState>,
    ) => {
      const store = useIbexStore.getState();
      // The snapshot the spec sends back lost its payloads on the way out, so
      // they are re-attached from what the store still holds.
      store.setState(mergeTestState(testState, store));
    };

    const getStateHandler = (
      _event: Electron.IpcRendererEvent,
      replyChannel: string,
    ) => {
      // Sends the configuration and the derived vectors, never the bulk
      // payloads - see `utils/testState.ts` for the contract. This also drops
      // the actions, which are not structured-cloneable.
      window.api.send(replyChannel, projectTestState(useIbexStore.getState()));
    };

    window.api.onUpdateTestState(updateHandler);
    window.api.on('getTestState', getStateHandler);

    return () => {
      window.api.removeUpdateTestStateListener(updateHandler);
      window.api.removeListener('getTestState', getStateHandler);
    };
  }, []);

  return (
    <div>
      <StrictMode>
        <MantineProvider cssVariablesSelector="html">
          <Notifications />
          <ModalsProvider>
            <AppRouter />
          </ModalsProvider>
        </MantineProvider>
      </StrictMode>
    </div>
  );
}
