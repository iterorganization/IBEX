# Frontend dependency security notes

`npm audit` does not come back clean, and it cannot today. This file records why,
so the remaining report can be read at a glance instead of being re-investigated
every time.

Last reviewed: 2026-09-14 (36 advisories: 3 critical, 27 high, 3 moderate, 3 low).

## Never run `npm audit fix --force`

npm's "fix" for the Electron Forge advisories is a **downgrade** to
`@electron-forge/cli@6.4.2`, and for the webpack plugin to
`@electron-forge/plugin-webpack@0.0.2`. Both would destroy the build. Only plain
`npm audit fix` (semver-compatible) is safe here.

## Accepted exceptions

Every remaining advisory traces to one of three roots.

### 1. `@electron-forge/*` — build-time only, no forward fix

The entire Forge 7.x line is flagged (`>=7.0.0 <8.0.0-alpha.9`), because it depends
on vulnerable `tar`, `tmp`, `uuid`, `sockjs`, `webpack-dev-server`, `@electron/node-gyp`,
`@electron/packager` and `@electron/rebuild`. There is no fixed 7.x release: the only
version npm considers safe is 6.4.2, a downgrade. Forge 8 is still in alpha.

These packages run on a developer or CI machine to build and package the app. None of
them is shipped inside the application. We track the latest 7.x (currently 7.11.2) and
will move to 8.x once it is stable.

### 2. `electron-chromedriver` → `extract-zip` — test-time only

`extract-zip` has no fixed release (npm proposes `electron-chromedriver@1.4.0`, from
2016). It is used once, to unpack the chromedriver archive that the e2e suite drives
Electron with. It never runs in the application, and it only processes an archive
downloaded from Electron's own release infrastructure.

`electron-chromedriver`'s major version must stay in lockstep with `electron`
(see `src/tests/setup.ts`), so it cannot be pinned independently anyway.

### 3. `plotly.js` → `maplibre-gl` (critical) — shipped, but unreachable

`maplibre-gl` has an XSS sanitizer bypass (GHSA-jrc7-96c5-q579) affecting every
release `<= 6.4.0`. `plotly.js` 3.x depends on `^4.7.1` and even plotly 4.x depends on
`^5.24.0`, so no plotly release resolves it, and forcing maplibre 6.x across two majors
would be more likely to break plotting than to help.

The vulnerable code is only reachable through plotly's map traces. IBEX uses none:
`scattermap`, `scattermapbox`, `choroplethmap`, `mapbox` and `maplibre` have zero
occurrences in `src/`. The traces actually used are scatter, heatmap, contour and
surface.

The real fix is to build a partial plotly bundle (`plotly.js/lib/core` plus only the
traces IBEX needs) so maplibre is never bundled at all. That is tracked as a follow-up;
it changes `SimplePlotly.tsx` and `Heatmap2D.tsx` and needs every plot type re-tested.

## Note on the plotly dependency

`package.json` used to declare `plotly.js-dist`, but nothing ever imported it:
`react-plotly.js` does `require('plotly.js/dist/plotly')`, and all type imports come
from `plotly.js`. The declared package was dead weight while the package actually
bundled was an undeclared peer. `plotly.js` is now declared explicitly and
`plotly.js-dist` has been removed. Keep it that way — a partial bundle, if it lands,
should alias `plotly.js` rather than reintroduce a second copy.
