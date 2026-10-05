# Verification — Fix full-planner "View only this order" booked-filter drift

## What changed (minimal, confined to booked-only filter reconciliation)

Two files, only the booked-only filter reconciliation logic:

1. `src/app/features/service-planner/service-planner.component.ts`
   - `get schedulerBookedResourceFilterContext()`: for `source === 'focused-order'`,
     the `contextKey` now carries a stable signature of the live booked resource set:
     `` `focused-order:${focusedOrder.id}|${[...resourceIds].sort().join(',')}` ``.
   - `source === 'global'` keeps its id-only key unchanged: `` `global:${focusedOrder.id}` ``.
   - `active`, `source`, `resourceIds` fields unchanged. `[...resourceIds].sort()` sorts a copy; the
     `resourceIds` array handed to the context is not mutated.

2. `src/app/shared/components/scheduler/custom/custom-scheduler.component.ts`
   - Added field `private lastBookedFocusOrderKey: string | null = null;` next to `lastBookedContextKey`.
   - Added helper `getBookedFocusSessionKey(ctx)` returning the order-id portion (substring before `|`)
     for `focused-order` contexts, `null` otherwise.
   - Rewrote `syncBookedFilterWithContext()`:
     - Still early-returns when `contextKey === lastBookedContextKey` (nothing changed).
     - For `focused-order`: auto-enables `showBookedOnlyResources = true` ONLY when the focus-session
       key (order-id portion) changed vs `lastBookedFocusOrderKey` — i.e. the first activation of a new
       focused-order session. When only the resourceIds signature changed for the SAME order, the toggle
       is left untouched (manual OFF preserved). Updates `lastBookedFocusOrderKey`.
     - For `global`/`auto-proposal`: unchanged (no auto-enable); resets `lastBookedFocusOrderKey = null`.
     - For null context: `showBookedOnlyResources = false` and resets `lastBookedFocusOrderKey = null` (unchanged reset).
     - Tail `lastBookedContextKey = contextKey;` unchanged.

No change to `visibleSchedulerResources`, the dead `getFullPlannerVisibleResources()`, `getBookedResourceIdsForOrder`,
`getEffectiveBookedResourceIds` (still reads live `resourceIds`), `isResourceBooked`, `matchesResourceDisplayFilters`,
resource search, group collapse/expand, selected-only filter, capacity-only mode, or capacity/drop logic.

## Commands run (cwd = webapp)

1. `npm run build`  → **SUCCESS**, exit code 0.
   - `Application bundle generation complete.` with no TypeScript/template errors.
   - Only warnings emitted are pre-existing and unrelated: CSS/bundle budget-exceeded warnings and
     flatpickr CommonJS-not-ESM warnings. No new warnings or errors introduced by this change.

2. `npm test -- --run --watch=false`  → **COULD NOT RUN (pre-existing environment constraint)**, exit code 1.
   - vitest failed to start its forks worker with:
     `Error: Cannot find module './not-implemented'`
     require stack rooted at `node_modules/jsdom/lib/jsdom/browser/Window.js`.
   - Root cause is an incomplete/corrupted `jsdom` install in the active `webapp/node_modules`: the file
     `webapp/node_modules/jsdom/lib/jsdom/browser/not-implemented.js` is missing (it exists only in the
     unrelated `.checkpoints/*/webapp/node_modules` worktrees). This is NOT caused by the code change — no
     test file was touched, and the failure is in the test environment bootstrap before any spec runs.
   - `Test Files  no tests` / `Tests  no tests` — the suite never executed. The only project spec is
     `src/app/app.spec.ts` (default app smoke test), which does not cover this filter logic.
   - This is reported honestly rather than claimed as a pass. Build is the authoritative compile check and it passes.

## Behavior reasoning (preserved vs fixed)

- **Focused-order strict filter (leaking resources gone):** The focused-order `contextKey` now changes
  whenever the live booked-id membership changes. `syncBookedFilterWithContext()` therefore re-runs instead of
  early-returning on an id-only key, so the latched switch is reconciled. The filter predicate
  (`matchesResourceDisplayFilters` → `isResourceBooked` → `getEffectiveBookedResourceIds`) reads the CURRENT
  `bookedResourceFilterContext.resourceIds` live each change-detection pass, so while booked-only is ON the
  rendered set equals exactly the order's live booked set — no stale/partial leakage.
- **Manual toggle OFF shows all, back ON re-applies strict:** `toggleBookedOnlyResources()` is unchanged; it
  flips `showBookedOnlyResources`. OFF makes `matchesResourceDisplayFilters` skip the booked gate → all resources
  render. ON re-applies the live strict set.
- **Manual-off NOT silently overridden when live booked data changes within the same focused order:** When only
  the resourceIds signature changes (same order id), `focusSessionKey === lastBookedFocusOrderKey`, so the sync
  does NOT touch `showBookedOnlyResources`. A manual OFF survives streaming data / view-window shifts for that
  focus session. Auto-enable fires only on the first activation of a new order's focus session (order-id portion
  changes).
- **`source === 'global'` unchanged:** Global context key stays id-only; sync takes the non-focused-order branch
  which never auto-enables (same as before) and resets the focus-session tracker. No behavior change in order mode.
- **Resource search, group collapse/expand, selected-only filter:** Untouched. `matchesResourceDisplayFilters`
  still evaluates `showSelectedOnlyResources`, the search query, and group logic independently of the booked gate.

## Note

If a reviewer has a working test environment, re-running `npm test` after a clean `npm ci` (to repair the jsdom
install) is recommended. The code change itself does not affect test setup.
