# Reactivity baseline

Measured with `npm run test:perf` on the benchmark canvas (a 2-D
`equilibrium/time_slice/profiles_2d/psi` heatmap plus a 1-D grid with two
traces, both from `iter_disruption_113112_1.nc`).

`requests` counts calls to `/data/*` and `/ids_info/*`; `redraws` counts Plotly
redraws across all panels; `renders` counts renders of the instrumented
components. Timings are informational only — they are not asserted.

## Before any reactivity work (commit 697db19)

| Scenario                   | requests | redraws | renders | ms   |
| -------------------------- | -------- | ------- | ------- | ---- |
| toggle edit mode (UI flag) | 0        | 11      | 42      | 1209 |
| coordinate slider, 2 steps | 0        | 12      | 40      | 1618 |
| metadata panel, first open | 4        | 3       | 6       | 989  |
| metadata panel, revisit    | 6        | 19      | 72      | 1881 |
| idle (no interaction)      | 0        | 0       | 0       | 2125 |

Three guards fail at this baseline, which is the point of committing them:

1. **Toggling one panel's edit flag redraws the other panel 6 times.** The flag
   is a boolean; no data changes. Cause: `updatedConfiguration` replaces the
   whole configuration and every component subscribes without a selector.
2. **Two slider steps cost 12 redraws, 3 of them on the unrelated 1-D panel.**
   Sliders correctly issue no backend request, but every tick writes the whole
   configuration.
3. **Reopening the same metadata tab re-downloads 2 `plot_data` payloads.**
   `VisualizationMetaData` refetches the entire payload to read
   `response.data.coordinates`.

The idle scenario passes and must keep passing: it guards against runaway
effect loops.

## After the session request cache (stage 1)

| Scenario                   | requests  | redraws | renders | ms   |
| -------------------------- | --------- | ------- | ------- | ---- |
| toggle edit mode (UI flag) | 0         | 11      | 42      | 1251 |
| coordinate slider, 2 steps | 0         | 12      | 40      | 1637 |
| metadata panel, first open | 4 → **2** | 3       | 6       | 1031 |
| metadata panel, revisit    | 6 → **1** | 19 → 14 | 72 → 58 | 1802 |
| idle (no interaction)      | 0         | 0       | 0       | 2127 |

Guard 3 now passes: reopening a metadata tab issues **no** `plot_data` request.
The single remaining request on revisit is `/ids_info/array_summary`, which is
a different endpoint and a genuine first-time call for that tab.

The two cross-panel redraw guards still fail, as expected: they are caused by
the store replacing the whole configuration on every write, which stages 3 and
4 address. Nothing in the fetch layer can fix them.

## After the render-path fixes (stage 2)

| Scenario                   | requests | redraws | renders | ms   |
| -------------------------- | -------- | ------- | ------- | ---- |
| toggle edit mode (UI flag) | 0        | **2**   | 42      | 1145 |
| coordinate slider, 2 steps | 0        | **6**   | 40      | 1546 |
| metadata panel, first open | 2        | 3       | 6       | 1106 |
| metadata panel, revisit    | **0**    | **9**   | 52      | 1679 |
| idle (no interaction)      | 0        | 0       | 0       | 2130 |

Three of the four guards now pass. Redraws against the original baseline:
toggling a UI flag 11 → 2, two slider steps 12 → 6, reopening the metadata
panel 19 → 9, and its backend requests 6 → 0.

The slider guard passes: stepping the heatmap's time slider no longer redraws
the 1-D panel at all.

One guard still fails, and it is the honest remainder: toggling one panel's
edit flag still causes **1** redraw of the untouched heatmap panel (it was 6).
That last one cannot be fixed from the render path — the store replaces the
whole configuration on every write, so the sibling panel genuinely receives new
props. Stages 3 and 4 (the data/config split and selector subscriptions) are
what close it.

## After narrowing subscriptions and memoizing the panel (stage 3, partial)

| Scenario                   | requests | redraws | renders | ms   |
| -------------------------- | -------- | ------- | ------- | ---- |
| toggle edit mode (UI flag) | 0        | 2       | **14**  | 1105 |
| coordinate slider, 2 steps | 0        | 6       | **28**  | 1547 |
| metadata panel, first open | 2        | 3       | 6       | 993  |
| metadata panel, revisit    | 0        | 9       | 52      | 1650 |
| idle (no interaction)      | 0        | 0       | 0       | 2126 |

Component renders against the original baseline: toggling a UI flag 42 → 14,
two slider steps 40 → 28.

## Where the last guard stands

`toggle edit mode` still redraws the untouched heatmap panel **once** (it was 6
at the baseline). Closing it needs the full data/config store split: the plot
components no longer subscribe to the store and the panel is memoized, but the
configuration object is still replaced wholesale on every write, so
`VisualizationPlot` — which does subscribe — re-renders and rebuilds the grid,
and react-grid-layout clones its children on the way through.

## After fixing the layout write cycle (stage 4)

| Scenario                   | requests | redraws | renders | ms   |
| -------------------------- | -------- | ------- | ------- | ---- |
| toggle edit mode (UI flag) | 0        | **1**   | **4**   | 1015 |
| coordinate slider, 2 steps | 0        | 6       | 28      | 1583 |
| metadata panel, first open | 2        | 3       | 6       | 1024 |
| metadata panel, revisit    | 0        | 9       | 44      | 1687 |
| idle (no interaction)      | 0        | 0       | 0       | 2126 |

**All four guards pass.** Toggling one panel's edit flag now redraws only the
panel that was toggled; the untouched heatmap redraws 0 times, down from 6 at
the original baseline. Component renders for that scenario: 42 → 4.

The cause was not the store after all. Entering edit mode sets `static` on the
grid, which changes the layout react-grid-layout derives from its children, so
RGL reports `onLayoutChange` — and `VisualizationPlot.handleUpdateLayout`
rebuilt _every_ grid object from that report, which defeated the `memo` added in
the previous stage. It now keeps the identity of grids that did not move and
writes nothing at all when the report changes nothing (which also stops the
configuration being flagged unsaved by a no-op).

Note for the store split: `VisualizationPlot` subscribes to `active`, not to
`active.dataPlot`, because `handleNewPlot` (`utils/plot.ts:235`) pushes a new
grid into that array **in place**. A narrower selector never fires when a panel
is added, and memoizing the RGL children on it renders an empty canvas.

## After deriving the Plotly layout (stage 5)

| Scenario                   | requests | redraws | renders | ms   |
| -------------------------- | -------- | ------- | ------- | ---- |
| toggle edit mode (UI flag) | 0        | 1       | 4       | 1023 |
| coordinate slider, 2 steps | 0        | 6       | 28      | 1570 |
| metadata panel, first open | 2        | **2**   | **4**   | 1012 |
| metadata panel, revisit    | 0        | **6**   | 40      | 1548 |
| idle (no interaction)      | 0        | 0       | 0       | 2126 |

The layout used to be assembled by fifteen effects (seven in `SimplePlotly`,
five in `usePlotLayout`, six in `Heatmap2D`), each calling `setLayoutPlot` and
so handing `react-plotly.js` a new `layout` identity — one redraw apiece as a
panel appeared. It is now a single `useMemo` per component, with the user's mode
bar changes kept in state and merged last so a rebuild never discards a zoom.

Redraws when a panel appears: 9 → 6 on revisit, 3 → 2 on first open. Against the
original baseline, reopening the metadata panel costs 19 → 6 redraws and 72 → 40
renders.

The remaining 6 on the slider scenario are data-driven, not layout-driven: each
tick rebuilds the plot arrays.

## Against real ITER data

The fixtures are small, so the same scenarios were also run by hand against a
production entry — `imas:hdf5?path=/work/imas/shared/imasdb/ITER/3/134173/106`,
an equilibrium with 720 time slices, plotting
`equilibrium/time_slice/profiles_2d/psi` as a heatmap. This is the case
issue #121 reports. Measured with the same counters, on one panel, comparing
commit 5614230 (the benchmark, before any fix) with the end of this work.

| Scenario                     | before                                | after                                 |
| ---------------------------- | ------------------------------------- | ------------------------------------- |
| open the tree to profiles_2d | 3 req, 0 redraws, 2559 ms             | 3 req, 0 redraws, 1652 ms             |
| plot the 2D psi heatmap      | 3 req, 8 redraws, 36 renders, 6357 ms | 3 req, 4 redraws, 26 renders, 4663 ms |
| toggle edit mode (UI flag)   | 0 req, 3 redraws, 10 renders, 1655 ms | 0 req, 1 redraw, 8 renders, 1561 ms   |
| coordinate slider, 1 step    | 0 req, 6 redraws, 20 renders, 1698 ms | 0 req, 4 redraws, 20 renders, 1459 ms |
| coordinate slider, 2 steps   | 0 req, 6 redraws, 20 renders, 2004 ms | 0 req, 4 redraws, 20 renders, 1496 ms |
| idle                         | 0 req, 0 redraws                      | 0 req, 0 redraws                      |

Timings include the ~1.4 s the harness spends waiting for the UI to go quiet,
so the interaction itself improved by more than the totals suggest.

Two notes for whoever runs this again:

- Drive it from the DOM. `getTestState` serializes the whole store over IPC, and
  on this entry that means serializing the psi matrix on every poll — it times
  the WebDriver script out rather than the app.
- The remaining cost of plotting is the payload itself: the backend never
  downsamples a 2-D node (`imas_python_source.py:488` and `:1369` gate on
  `ndim == 1`), so the whole matrix crosses the wire at full resolution. That is
  a separate, API-shaped change.

## After shrinking the e2e state bridge (stage 6)

| Scenario                   | requests | redraws | renders | ms   |
| -------------------------- | -------- | ------- | ------- | ---- |
| toggle edit mode (UI flag) | 0        | 1       | 4       | 945  |
| coordinate slider, 2 steps | 0        | 6       | 28      | 2146 |
| metadata panel, first open | 2        | 2       | 4       | 810  |
| metadata panel, revisit    | 0        | 6       | 40      | 1136 |
| idle (no interaction)      | 0        | 0       | 0       | 2130 |

Every count is unchanged, which is the point: this stage moves no renderer code,
only what the test bridge is allowed to serialize.

`getStateHandler` used to hand Electron's structured clone — and then the
WebDriver JSON bridge — the whole store, payloads included. `utils/testState.ts`
now drops four families on the way out (`plot[].yData`,
`plot[].error_bands[].yData`, `coordinates[].data`, `geometries[].x`/`.y`) and
re-attaches them on the way back in. The derived vectors `plot.x`, `plot.y`,
`plot.customdata` and `error_bands[].array` still cross: the specs assert exact
floats on them, and they are a single row, so they stay small at any entry size.

Measured on `imas:hdf5?path=/work/imas/shared/imasdb/ITER/3/134173/106`, one
panel plotting `equilibrium/time_slice/profiles_2d/psi` (coordinate shapes
`[871,1,65] [871,1,129] [871,1] [871]`):

| One `getTestState()` poll | before               | after              |
| ------------------------- | -------------------- | ------------------ |
| wall clock                | `ScriptTimeoutError` | 52 ms, then 5-6 ms |
| snapshot size             | the psi matrix       | 17 kB              |

The "before" column is not an estimate — the old handler was restored, the app
relaunched, and the same measurement re-run: WebDriver gives up before the
renderer finishes serializing. That is what `BASELINE.md` meant by "drive it
from the DOM"; the specs can now poll the store on a production entry instead.

The inverse matters as much as the projection. `dataManipulation.ts` and
`reactivity.perf.spec.ts` read the whole state and write it straight back to
flip one field, and `setState` replaces `configurations`/`active` wholesale — so
without `mergeTestState` the first such round trip would silently empty every
plot in the store. The two ship together and must stay together.

## After moving edit mode out of the configuration (stage 7)

| Scenario                   | requests | redraws | renders | ms   |
| -------------------------- | -------- | ------- | ------- | ---- |
| toggle edit mode (UI flag) | 0        | 1       | 4       | 930  |
| coordinate slider, 2 steps | 0        | 6       | 28      | 1553 |
| metadata panel, first open | 2        | 2       | 4       | 804  |
| metadata panel, revisit    | 0        | 6       | 40      | 1137 |
| idle (no interaction)      | 0        | 0       | 0       | 2133 |

Unchanged again, and again that is the result: the counts were already at their
floor for this scenario. What changed is what produces them.

`isEditing` was a boolean on every grid that only one grid could ever hold —
`handleEditGrid` cleared it on all the others on its way through, and stage 4
had to add explicit identity preservation so that clearing it did not re-render
every panel. It is now `editingGridId` in a `ui` slice, so entering or leaving
edit mode writes one string and touches **no grid object at all**. The panels
read it through a boolean selector, so only the two whose flag actually flips
re-render.

`static` went with it. It was a persisted grid field always equal to
`isEditing`, and that is what made the stage-4 write cycle possible: setting it
changed the layout react-grid-layout derives from its children, RGL reported
`onLayoutChange`, and the report was written back. It is now derived where the
`data-grid` prop is built, and `handleUpdateLayout` drops `static` from what RGL
reports. The cycle cannot form rather than being unpicked after the fact.

The remaining 1 redraw on the toggle is the toggled panel itself: its Plotly
`config` genuinely changes (a grid in edit mode is the interactive one). The
guard — the _untouched_ heatmap redrawing 0 times — still passes.

### One translation to be careful with

`fetchErrorBandsInConfig` used to locate its grid with
`dataPlot.find((d) => d.isEditing)`, so it returned early whenever nothing was
being edited. Passing each panel its own id instead looks equivalent and is not:
`HoverButtons`' effect runs on mount for every panel with `displayErrorBand`
defaulting to true, so every panel started fetching error bands as it appeared —
`metadata panel, revisit` went from 0 requests to 12 before this was caught by
the benchmark. It takes the editing grid's id, whichever grid that is.

### The metadata and customization panels follow (stage 7, second half)

`metadataGridLayout` and `customizedGridLayout` joined `editingGridId` in the
`ui` slice, so opening either panel writes one field and leaves the
configuration - and every grid in it - untouched. Counts are unchanged again
(0/1/4, 0/6/28, 2/2/4, 0/6/40, 0/0/0); the `JSON.stringify` memos
`TreeLibrariesAccordion` needed to stabilise those two selectors are gone, since
both are now plain ids.

Moving them exposed an invariant that the old model held by accident. While the
ids lived on the configuration, clearing the configuration took them with it.
As session state they outlive it - and a stale `customizing` is not harmless:
`TreeLibrary.handleDisableTree` disables the whole node tree whenever a panel is
open, so an id belonging to a configuration that no longer exists leaves the
tree dead with no panel on screen to explain why. Eight e2e specs failed on it,
all of them reporting that checking a node plotted nothing.

The fix belongs in the store, not in the specs: `pruneUiState` drops any ui id
that does not name a grid of the active configuration, and `setActive`,
`removeConfiguration` and `setState` apply it. Anyone adding a field to the `ui`
slice that references a grid must add it there too.

## After giving the payloads an identity (stage 8)

| Scenario                   | requests | redraws | renders | payloads | elements | ms   |
| -------------------------- | -------- | ------- | ------- | -------- | -------- | ---- |
| toggle edit mode (UI flag) | 0        | 1       | 4       | 8        | 25785    | 959  |
| coordinate slider, 2 steps | 0        | 6       | 28      | 8        | 25785    | 1522 |
| metadata panel, first open | 2        | 2       | 4       | 10       | 25791    | 793  |
| metadata panel, revisit    | 0        | 6       | 40      | 8        | 25785    | 1142 |
| idle (no interaction)      | 0        | 0       | 0       | 8        | 25785    | 2125 |

Two new columns, both cumulative rather than per-scenario: how many fetched
arrays the registry is holding when the scenario ends, and how many elements
they add up to (from the shape the backend reported, which is far cheaper than
walking a nested array).

`stores/payloadRegistry.ts` gives every fetched array a name derived from the
request that produced it — the same canonical form `requestCacheKey` computes,
so a payload and its cached response body are one identity rather than two.
Registration happens in `fetchDataPlot` and `fetchFieldValue`, where the request
is known and the post-processing has finished, instead of at the twenty-odd
call sites that store the result. The store carries `yDataRef`, `dataRef` and
`error_bands[].yDataRef` **alongside** the arrays: nothing reads through the
registry yet, so this stage cannot change behaviour, and the counts above say
it did not.

The interesting row is `metadata panel, first open`: entries go 8 → 10 while
that panel fetches, and back to 8 on the next scenario. That is the sweep. It
is driven by a store subscription that walks the configurations for reachable
refs, debounced onto an idle callback — a slider drag writes the store dozens of
times a second and none of those writes changes reachability. Deleting a grid
or a configuration needs no code of its own, which is the reason for choosing
mark-and-sweep over reference counting across two dozen writers.

It sweeps for real from the first commit rather than in audit mode. The registry
holds a _second_ reference to every payload, so a registry that reports what it
would free and frees nothing is a memory leak — and since nothing reads through
it yet, an over-eager sweep has no observable effect. Audit mode stays, for
diagnosing the stages that do read.

`DataplotCustomization` holds a detached copy of a grid that the store cannot
see; `pin`/`unpin` exist for it and the sweep treats pins as roots.

Where a transform still replaces a payload — `transposeAxis`, the `applyRange`
family, tensorising a coordinate — the ref is cleared rather than re-derived.
Those arrays are genuinely different payloads, and deriving keys for them is
what the transposition and range stages do.

`npm run test:unit` (mocha + ts-node + chai, all already devDependencies) covers
the key algebra and the sweep: 16 tests, no Electron, no renderer, ~20 ms. One
constraint for anything added under it — import relatively, not through the
`src/*` alias, which ts-node does not resolve without `tsconfig-paths/register`.

## After making a transposition a named payload (stage 9)

| Scenario                   | requests | redraws | renders | payloads | elements | derived | ms   |
| -------------------------- | -------- | ------- | ------- | -------- | -------- | ------- | ---- |
| toggle edit mode (UI flag) | 0        | 1       | 4       | 8        | 25785    | 0       | 952  |
| coordinate slider, 2 steps | 0        | 6       | 28      | 8        | 25785    | 0       | 1851 |
| swap two axes              | 0        | 3       | 10      | 9        | 50985    | 1       | 988  |
| swap the same axes back    | 0        | 3       | 10      | 9        | 50985    | 1       | 920  |
| metadata panel, first open | 2        | 2       | 4       | 11       | 50991    | 1       | 785  |
| metadata panel, revisit    | 0        | 6       | 40      | 9        | 50985    | 1       | 1090 |
| idle (no interaction)      | 0        | 0       | 0       | 9        | 50985    | 1       | 2237 |

The existing rows are unchanged. The two new ones are the stage, and the column
that carries it is `derived`: how many arrays the session computed from another
array rather than fetching.

Swapping two axes derives one payload - the transposed psi matrix, 25200
elements on top of the 25785 already resident. Swapping the same two axes back
derives **nothing**. That is the whole point of the change: a transposed matrix
is now a payload with a name, and the name is the permutation _composed onto the
source key_, so going back composes to the identity and names the untransposed
array the registry still holds. Undoing a transposition moves no bytes at all.

Composition is what makes this work, and it is worth being precise about. A
transposition permutes axes - `out.dim[k] = in.dim[p[k]]` - so applying `q` to
an array already held as the base under `p` leaves the base under `p[q[k]]`.
Keys therefore never stack: every axis order of one payload names one entry,
whichever route reached it. `transposedKey` in the registry does this and
`payloadRegistry.test.ts` pins it, including the swap-and-swap-back identity.

The `elements` column goes up and stays up, from 25785 to 50985. That is the
trade and it is deliberate: the sweep treats a payload and every view derived
from it as one family, so a live base keeps its views and a live view keeps its
base. Freeing the untransposed array the moment the user looks at the transposed
one would make going back cost a full transpose again. The family is bounded by
what the user actually asked for, and deleting the grid still frees all of it -
the `metadata panel` rows show the sweep still running (11 entries while that
panel fetches, 9 afterwards).

### What this stage is not

The plan called for a stride scheme - `{ value, shape, strides, offset }` - so a
transposition would permute strides and move nothing. That is deferred to stage
11 by agreement. A stride representation only pays once something _reads through
it_; while the derived vectors still live in the store, every transform has to
materialise at the boundary anyway, so introducing a second array representation
now would add a translation layer without removing a copy. `transposeAxis`,
`transposeMatrix`, `transposeDataGrid` and `reapplyAxisOrder` therefore all
stay - the back end still answers in default axis order, so there is still
something to re-apply after a re-fetch.

### The clones that went with it

Three deep copies on the transposition path are gone, replaced by
`utils/cloneGrid.ts`. `cloneGridStructure` copies every object a transform
assigns fields on - the grid, each coordinate, each trace, each error band, each
geometry, the axis descriptors - and shares the arrays hanging off them.

- `swapAxis` deep-cloned **every grid of the active configuration** to modify
  one. It now copies that one grid's structure and keeps the others by
  reference, so the panels showing them do not re-render either.
- `getErrorYVectors` deep-cloned every error payload to replace one derived
  vector per band. It runs on every slider tick.
- `transposeDataGrid` cloned the coordinates only to read `axeIndex` off them,
  and `reapplyAxisOrder` cloned a whole grid to build a temporary one.

Sharing arrays between a grid and its replacement is only sound because nothing
writes _into_ a payload: a grep for element assignment, `push` and `splice` on
`yData` and `coordinate.data` finds nothing anywhere in the renderer. Transforms
replace arrays wholesale. Anything added later that edits a payload in place
would corrupt every grid sharing it, which is what the note in `cloneGrid.ts`
says and what freezing on registration will eventually enforce.

### On the numbers

The fixture matrix is 3x1x120x70, so the transpose this stage avoids is
sub-millisecond and the `ms` column cannot show it - the counts are the proof,
not the timings. The saving is one tfjs transpose plus one `array()`
materialisation per trace and per error band, and it scales with the payload:
on the ITER entry whose coordinates are `[871,1,65] [871,1,129]` it is the
difference between rebuilding a 112k-element matrix and a `Map` lookup. That
real-data pass was not re-run for this stage; the next one worth doing is after
stage 11, when the slider row finally moves.

## After making a range a window rather than a smaller array (stage 10)

Branch `perf/split_configuration_store_object`, on the same canvas, with the
range scenario inserted between the axis swap and the metadata panel.

| Scenario                     | req   | redraws | renders | payloads | elements | derived | ms   |
| ---------------------------- | ----- | ------- | ------- | -------- | -------- | ------- | ---- |
| toggle edit mode (UI flag)   | 0     | 1       | 4       | 8        | 25785    | 0       | 952  |
| coordinate slider, 2 steps   | 0     | 6       | 28      | 8        | 25785    | 0       | 1561 |
| swap two axes                | 0     | 3       | 10      | 9        | 50985    | 1       | 993  |
| swap the same axes back      | 0     | 3       | 10      | 9        | 50985    | 1       | 939  |
| apply a data range           | 0     | 9       | 58      | 11       | 63690    | 3       | 1965 |
| **restore the data range**   | **0** | 9       | 58      | 13       | 89100    | 5       | 1748 |
| apply the same range again   | 0     | 9       | 58      | 13       | 89100    | **5**   | 1799 |
| restore the data range again | 0     | 9       | 58      | 13       | 89100    | **5**   | 1650 |
| metadata panel, first open   | 2     | 2       | 4       | 15       | 89106    | 5       | 786  |
| metadata panel, revisit      | 0     | 7       | 48      | 13       | 89100    | 5       | 1197 |
| idle (no interaction)        | 0     | 0       | 0       | 13       | 89100    | 5       | 2133 |

The row this stage is about is `restore the data range`. It used to issue one
`plot_data` per trace of the grid, plus one `fetchErrorBands` per trace that had
any, for no reason other than to recover the values the trim had destroyed. It
now issues none. The two rows after it are the other half of the claim: applying
a range that was applied before, and restoring again, both add **zero**
derivations - they are `Map` lookups.

`apply a data range` costs three derivations (the windowed matrix and the
windowed coordinates) and `restore the data range` costs two more. That second
pair is not an oversight, see "Why restoring is not free the first time" below.

`derived` is cumulative from app start, so its absolute value depends on what
ran before the benchmark - a run taken straight after `test:e2e` starts at 9
rather than 0. The claim is in the deltas, and those reproduce: +3, +2, 0, 0.

### What a range means now

A range used to be applied by cutting the array in the store down to size, which
made it a one-way operation: the wider data was gone, and the only way back was
to ask the back end again. Widening a range, or adding a trace to a grid that
already had one, therefore had to be special-cased - `oldRange` threaded through
five async functions to convert an absolute range into an offset into the array
that had already been cut, and `rangeAlreadyAppliedInPlot`, flipped by
membership of a `newPlotsUri` list, to guess whether a _particular_ trace had
been narrowed yet. None of that had a test.

A range is now a **window on the payload**, expressed as absolute bounds against
the array the back end sent, and named: `…#value|range:3:119-177`. Windows
replace rather than stack, so applying [40,120] and then [50,60] names the same
entry as applying [50,60] to the untouched payload, and asking for no window at
all names the payload itself. Three consequences, all in
`payloadRegistry.test.ts`:

- widening needs no restore first, because the bounds are resolved against the
  full vector either way;
- a range applied twice is computed once;
- re-applying the grid's ranges is idempotent, so a trace that arrives narrowed
  and a trace that arrives full converge on the same answer.

That last one is what let `applyRangeInCoord`, `applyRangeInPlot`,
`trimCoordData`, `trimPlotData` and `formatTrimmedCoordinate` collapse into one
`applyRangesToGrid`, and it deleted `oldRange`, `rangeAlreadyAppliedInPlot`,
`shouldApplyRangeOriginInCoord` and the `newPlotsUri` plumbing outright.
`applyRange` is now pure - it returns a grid rather than mutating the one handed
to it - which cost two call sites a write-back.

Windows are written before the transposition in a key and in the axes of the
base, so a window and a transposition commute: `transposedKey` still composes by
looking at a single trailing step, and the two can be applied in either order.

### Why restoring is not free the first time

Restoring lands on the _full window_ of the payload, not on the payload itself,
and that costs one slice the first time. It has to: the base is the response as
it was parsed, in double precision, while every window is a tfjs slice of it and
therefore single precision. Landing on the base would move every value slightly
the moment a range was dropped - `plot-ui.spec.ts` asserts on exact floats at
restoration and pins precisely that. Naming the full window means the second
restore is a lookup, which is the `restore the data range again` row.

The same precision argument decides where a typed bound is resolved. Bounds are
matched against `Math.fround` of the coordinate, because everything on the
render path has been through a tensor: a bound typed as 0.6 has to select the
point the axis _labels_ 0.6, and single precision puts that value fractionally
above the double 0.6. The old code got this by accident and inconsistently - the
first range on a grid resolved against the raw response and every later one
against a float32 array, because the coordinate had been through a tensor by
then. It is now the same rule for every range.

### On the numbers

`elements` goes from 50985 to 89100 and stays. That is the price of the row
above it: a window no longer destroys what it was cut from, and restoring adds
the full window as an entry of its own. All of it is one family, so deleting the
grid frees the lot, and the `metadata panel` rows still show the sweep running
(15 entries while that panel fetches, 13 afterwards).

Two rows are not comparable with stage 9's table: `metadata panel, revisit` went
from 6/40 to 7/48 redraws/renders, because the canvas it revisits has now been
through four range operations rather than arriving straight from the axis swap.
The counts it actually guards - no `plot_data` on a revisit - are unchanged. The
four guards all still hold: idle 0/0, a UI toggle 0 requests and 0 redraws on
the untouched heatmap, a slider step 0 requests, a metadata revisit 0
`plot_data`.

The fixture canvas is small, so the `ms` column cannot show the saving either:
what it removes is four HTTP round trips and four `JSON.parse`s of a matrix, on
a 3x1x120x70 payload where that is milliseconds. On the ITER entry with 720
slices it is the difference between a multi-megabyte refetch per trace and a
`Map` lookup. That real-data pass was not re-run for this stage; the one worth
doing is after stage 11.

### Still open

`keepValueIndex` survives, as an explicit `keepCursor` argument to `applyRange`.
The plan expected it to go with the rest, but the cursor is still an index into
the window rather than into the payload, so it still has to be reset when the
window moves and left alone when the same window is merely re-applied. It dies
in stage 11, when the cursor stops indexing a stored array at all.

## After moving the drawn vectors out of the store (stage 11)

Branch `perf/split_configuration_store_object`, same canvas and same scenarios.

| Scenario                       | req | redraws | renders | payloads | elements | derived | ms   |
| ------------------------------ | --- | ------- | ------- | -------- | -------- | ------- | ---- |
| toggle edit mode (UI flag)     | 0   | 1       | 4       | 8        | 25785    | 9       | 975  |
| **coordinate slider, 2 steps** | 0   | **2**   | **16**  | 8        | 25785    | 9       | 1391 |
| swap two axes                  | 0   | **1**   | **4**   | 9        | 50985    | 10      | 960  |
| swap the same axes back        | 0   | **1**   | **4**   | 9        | 50985    | 10      | 884  |
| apply a data range             | 0   | 12      | 54      | 11       | 63690    | 12      | 1869 |
| restore the data range         | 0   | 12      | 54      | 13       | 89100    | 14      | 1701 |
| apply the same range again     | 0   | 12      | 54      | 13       | 89100    | 14      | 1691 |
| restore the data range again   | 0   | 12      | 54      | 13       | 89100    | 14      | 1661 |
| metadata panel, first open     | 2   | 2       | 4       | 15       | 89106    | 14      | 775  |
| metadata panel, revisit        | 0   | 10      | 44      | 13       | 89100    | 14      | 1212 |
| idle (no interaction)          | 0   | 0       | 0       | 13       | 89100    | 14      | 2134 |

The slider row has not moved since stage 2. It moves here: **6 redraws to 2**,
one per step, and 28 renders to 16. Swapping two axes goes from 3 redraws and
10 renders to 1 and 4.

### What a slider tick is now

`handleUpdateCoordinate` was 130 lines in `GridLayoutPlot.tsx` that rebuilt, on
every tick, every trace of the grid and of every grid synchronized with it: a
new `x`, a new `y`, a new `customdata`, a new array per error band, each copied
out of the payload with `[...]`. It is now a call to one store action,
`setCursor`, which writes integers and labels and no array at all - so what a
tick costs no longer depends on how big the payload is.

What is drawn comes from `derive/vectors.ts` instead, called on the render path:

- `axisVector(coordinates, axeIndex)` - the vector of the axis on display;
- `lineVector(payload, coordinates)` - the row the cursor points at;
- `bandVectors` / `customdataOf` - the same for error bands;
- `slabMatrix` - the 2-D slab a heatmap draws.

Each is memoised on **the payload array itself**, and within that on the cursor.
Two consequences that the counts above depend on: moving one grid's cursor does
not invalidate another grid's rows, and two synchronized grids sitting at the
same cursor derive once between them. The map is weak on the payload, so a
family the sweep frees takes its derived rows with it and there is no bookkeeping
to get wrong. Entries are dropped oldest-first past eight cursors, because
dragging a slider walks through indices that will never be asked for again.

`isSameAxisData` is gone. It walked both coordinates element by element, on
every tick, to decide whether a synchronized grid was showing the same data;
`setCursor` compares the payload keys instead, which is a string compare and is
also more correct - two grids can hold equal numbers from different nodes.
`limitSlidersToMaxLength` survives, renamed `clampCursors`: a cursor is an index,
and narrowing a range can still leave one pointing past the end of its axis.

### Where the other two redraws went

Heatmap2D held `x`, `y`, `z`, three axis descriptors and an `are3DAxisInit` flag
in `useState`, filled by a chain of `useEffect`s. Plotly compares `data` by
reference, so each link in that chain was a separate draw of the panel - which
is why one slider step cost three. They are all pure functions of the payload
and the cursor, so they are one `useMemo` now.

That is also why the rows that open a customization panel show **three more
redraws** than in stage 10 (12 against 9, and 10 against 7 for the metadata
revisit) while showing four fewer renders. The panel's preview used to stay
blank until its effects had settled, so the renders before that produced no
draw; it now has its vectors on the first render and draws straight away. Fewer
React renders, the preview appears sooner, and the intermediate states are drawn
rather than skipped. Opening a panel is a deliberate, occasional action, and the
guards - idle 0/0, a UI toggle not redrawing the untouched heatmap, a slider
step issuing no request, a metadata revisit issuing no `plot_data` - all still
hold.

### The store no longer holds a vector it can compute

`plot.x`, `plot.y`, `plot.customdata` and `error_bands[].array` are not written
anywhere any more - not by `plotData`, not by `swapAxis`, not by
`applyRangesToGrid`, not by the four `Customize*` panels that each rebuilt them
after a fetch. `getErrorsAreaToPlot` became `buildTraces`, which _creates_ the
objects Plotly is handed instead of copying the store's and writing back onto
the copy. They stay on the `DataPlotly` type as optional, because the render
path and the e2e projection both build traces that carry them; a grid in the
store does not.

`projectTestState` computes them on the way out, through the same functions the
renderer draws from, and `mergeTestState` drops them again on the way back in.
That is what keeps `plot-ui.spec.ts`'s exact-float assertions working with no
spec edits - and it makes them assert on what is actually drawn rather than on a
copy that a writer might have forgotten to refresh.

### The stride scheme, revisited as agreed

Deferred from stage 9 to be looked at here, and the answer is that it still does
not belong here. Deriving a row is now a handful of pointer chases into the
nested arrays, memoised - there is no copy left on the read path for strides to
remove. What does still materialise a whole matrix is the _transform_ path:
`derive/ranges.ts` tensorises a payload and calls `.array()` to get nested
arrays back, ~670 ms for the 871x1x129x65 psi. Fixing that means changing what a
payload _is_ - a flat `Float64Array` with a shape and strides, materialised only
at the boundary - which is the item the plan already parks until after stage 12,
and it wants the request cache merged first so there is one ingest path to
change rather than twenty.

## After caching finished responses and stopping stale writes (stage 12, first half)

Branch `perf/split_configuration_store_object`, same canvas and same scenarios.
Measured with the backend installed from PyPI (`imas-python` 2.3.0,
`imas-idstools` 2.5.0) into a fresh Python 3.13 venv.

| Scenario                     | req | redraws | renders | payloads | elements | derived | ms   |
| ---------------------------- | --- | ------- | ------- | -------- | -------- | ------- | ---- |
| toggle edit mode (UI flag)   | 0   | 1       | 4       | 8        | 25785    | 9       | 1264 |
| coordinate slider, 2 steps   | 0   | 2       | 16      | 8        | 25785    | 9       | 1423 |
| swap two axes                | 0   | 1       | 4       | 9        | 50985    | 10      | 977  |
| swap the same axes back      | 0   | 1       | 4       | 9        | 50985    | 10      | 906  |
| **apply a data range**       | 0   | **6**   | **22**  | 11       | 63690    | 12      | 1572 |
| **restore the data range**   | 0   | **6**   | **22**  | 13       | 89100    | 14      | 1450 |
| apply the same range again   | 0   | 6       | 22      | 13       | 89100    | 14      | 1553 |
| restore the data range again | 0   | 6       | 22      | 13       | 89100    | 14      | 1438 |
| metadata panel, first open   | 2   | 2       | 4       | 15       | 89106    | 14      | 787  |
| **metadata panel, revisit**  | 0   | **4**   | **12**  | 13       | 89100    | 14      | 988  |
| idle (no interaction)        | 0   | 0       | 0       | 13       | 89100    | 14      | 2123 |

### The request cache holds what the fetch layer finished

It used to hold response _text_ and parse it for every caller, because
`fetchDataPlot` then post-processed the parsed graph in place and callers
aliased its arrays into the store, where transforms mutated them. Neither is
true any more - stages 9 to 11 made every transform assign a new array under a
new key - so the cache now keeps the response after `normalizeDataPlotResponse`
has renamed, tensorised and cleaned it, once per request. A hit costs a copy of
the objects around the arrays, never a `JSON.parse` of a multi-megabyte body.
The byte budgets still count the body the entry was parsed from.

The arrays a hit hands out are the ones the registry holds, so the two layers
now share one copy of each payload rather than a parsed one and a text one. What
keeps that sound is the invariant the registry states: nothing writes into a
payload. Under `E2E_TEST` registration deep-freezes every array, so a write that
breaks the invariant fails the suites with a TypeError instead of corrupting
every grid sharing the array. Both suites ran green with freezing on.

Complex nodes are finished differently from real ones, so a CPX request is
retained - and registered - under its own `#cpx` / `value:cpx` name.

### The rows that moved, and why

None of this stage's cache work changes a count on this canvas: the benchmark
never re-parses a large body. The rows in bold moved because of a fix the e2e
suite forced. `HoverButtons`' error-band effect deep-copied the configuration
its render had closed over, awaited the fetches, and wrote the whole copy back -
on every mount and every toggle, whether or not a band had arrived. It now
fetches into a structural copy of the store as it is, merges only the bands and
band nodes onto the store as it is _after_ the await, and writes nothing when
nothing changed. The range and metadata rows mount panels, so each of those
mounts used to cost a configuration write and the redraws that followed it.

### Stale writes the old one had been hiding

That write was not only wasteful. Anything that happened during its await - a
slider moved, a panel linked - was undone when it landed, which is why the
synchronized-grids spec failed here on the unmodified branch. Fixing it
uncovered two more writers of the same shape, previously masked because the
error-band write happened to restore what they destroyed:

- `VisualizationTree`'s tree updates wrote `{ ...configurationBeforeAwait,
customDataTree }`, dropping a plot made while node infos loaded. They now
  write the tree onto the latest configuration.
- `getNodesChecked` sent the whole checked list as the tree saw it, and each
  plot operation wrote back the configuration it started from. Unchecking one
  node while another was still loading removed the loading node's grid, and the
  load then wrote it back. A click is now reduced to what it added and removed,
  and the operations run one at a time, each onto the configuration the previous
  one left.

The e2e bridge had the same flaw: `mergeTestState` re-linked `active` to its
`configurations` entry only when the spec also sent `configurations`, so a spec
writing `active` alone left a stale entry for those writers to restore.

Still open from the plan: the deep clones in `DataplotCustomization` and
`updateInterpolatedPlots`, and the real-data measurement on the 720-slice entry.
