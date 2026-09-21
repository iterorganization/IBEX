import { MantineProvider } from '@mantine/core';
import { StrictMode, useEffect } from 'react';
import { AppRouter } from './router';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';
import { useIbexStore } from './stores';
import { TestState } from './types';
import { mergeTestState, projectTestState } from './utils';

export function App() {
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
