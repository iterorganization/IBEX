import { Configuration, CustomizedGrid } from '..';

/**
 * The shape the E2E bridge exchanges: the configuration and the transient state
 * a spec needs to drive the app, and nothing else.
 *
 * It is deliberately its own type rather than the whole store. `renderer/utils/
 * testState.ts` also strips the bulk payloads out of the configurations on the
 * way through - see the contract documented there.
 */
export interface TestState {
  configurations: Configuration[];
  active: Configuration | null;
  editingGridId: string | null;
  metadataGridId: string | null;
  customizing: CustomizedGrid | null;
}
