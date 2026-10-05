# Mock-data location/reference integrity fix — verification note

## Problem

The May 2024 planner demo bookings (`mayPlannerDemoBookings` + `mayPlannerDayCapacity`) reused real
Munich order references (`014826501`–`014826509`) and also pointed at references that backed no order
(`014826511`–`014826523`, dangling). Because entry→order resolution is reference-first
(`findOrderForScheduleEntry` matches `candidate.referenceNumber === entry.workOrderReference`), the May
demo rows (on Munich resources `mech-mark-owen`, `advisor-ted-phillips`, …) resolved to the same
`wo-bg-*` orders used by the April background bookings. That is why, when focusing an order such as
`wo-bg-1002` (ref `014826501`), the booked-resource set leaked May-only resources into the April view.

## Fix (DATA-ONLY, `mock-data.ts` only)

Re-homed every May demo entry onto its OWN unique standalone Munich order, using a dedicated reference
band that collides with nothing.

### New reference band chosen: `014900001`–`014900022`

Verified unused before writing: a repo-wide search for `0149[0-9]{5}` / `0149` across `webapp/src/**/*.ts`
returned zero matches. Existing bands (Munich `014826500`–`509`, Klagenfurt `014826610`–`617`,
Vienna `014826701`–`711`, scenario `014826312`/`014826455`) do not intersect `0149…`.

### Old → new reference map (first-appearance order; day order preserved)

| old | new | old | new |
|---|---|---|---|
| 014826501 | 014900001 | 014826513 | 014900012 |
| 014826502 | 014900002 | 014826514 | 014900013 |
| 014826503 | 014900003 | 014826515 | 014900014 |
| 014826504 | 014900004 | 014826516 | 014900015 |
| 014826505 | 014900005 | 014826517 | 014900016 |
| 014826506 | 014900006 | 014826518 | 014900017 |
| 014826507 | 014900007 | 014826519 | 014900018 |
| 014826508 | 014900008 | 014826520 | 014900019 |
| 014826509 | 014900009 | 014826521 | 014900020 |
| 014826511 | 014900010 | 014826522 | 014900021 |
| 014826512 | 014900011 | 014826523 | 014900022 |

Applied to all 44 `mayPlannerDemoBookings` rows (2 per reference) and the 8 `mayPlannerDayCapacity`
rows. `day`, `jobId`, `resourceId`, `start`, `end`, `title`, `category` are unchanged — the bookings
stay on their Munich resources and their original May 2024 dates/times.

### 22 new backing Munich WorkOrders added

Appended a second `.map(...)` spread immediately after the `wo-bg-1001`–`wo-bg-1010` spread in
`MOCK_WORK_ORDERS`. Ids `wo-may-1001`–`wo-may-1022`, references `014900001`–`014900022` (1:1 ascending).
Each mirrors the exact `wo-bg-*` object shape (status `preparation`, `vehicle` without `location`/`vin`,
Munich `customer`, two mechanic jobs with `getMechanicJobDescription`, `createdAt/updatedAt = baseDate`).
Shape notes honored:
- `demoLocationId` omitted on every new order (undefined === Munich scope). Confirmed via test (d):
  `ord.demoLocationId` is `undefined` for every May reference.
- Jobs use `resourceRequirements: defaultBackgroundJobRequirements` (NOT
  `backgroundJobRequirementsByOrder[newRef]`, which has no `0149…` keys and would crash with
  `undefined[0]`). `backgroundJobRequirementsByOrder` was not modified.
- Reused in-scope `getMechanicJobDescription`, `QUALIFICATIONS.generalService`, `baseDate`,
  `defaultBackgroundJobRequirements`. Customer names are Munich-flavoured; plates `M-MY 001`…`M-MY 022`.

## Before / after for `wo-bg-1002` (ref `014826501`, April window 2024-04-15 → 2024-04-17)

- **Before:** May demo entries on day 1 (`sch-may-demo-1/-2`) carried ref `014826501`, so
  `isEntryForOrder` matched them to `wo-bg-1002`. (They were out of the April window, so the
  window-overlap guard already excluded them from the April booked-set — but the underlying reference
  reuse was the integrity defect, and in a May window the same reference reuse would have leaked.)
- **After:** `sch-may-demo-1/-2` carry ref `014900001` → resolve to `wo-may-1001`, not `wo-bg-1002`.
  The booked-set for `wo-bg-1002` in the April window is exactly:
  `{ advisor-frank-miller, bay-pc-2, car-audi-a3-kl643ju, mech-phil-parker }`
  and does NOT contain `mech-mark-owen` or `advisor-ted-phillips`. (Confirmed by integrity check (c),
  which reproduces the component's reference-first `isEntryForOrder` + `doRangesOverlap(viewStart,
  viewEnd)` logic against the mock data.)

## Verification run

### 1. Build / type-check — `npm run build` (cwd `webapp/`)

Exit code 0. "Application bundle generation complete." Only pre-existing warnings:
initial-bundle budget overrun, several `.scss` budget overruns, and the flatpickr CJS/ESM
optimization-bailout warnings from `carbon-components-angular`. No new errors introduced by the data
change. (The Angular `ng test` suite is known broken by a pre-existing jsdom install issue; integrity
was proven via `npm run build` plus a headless node/vitest spec, per the task note.)

### 2. Headless integrity spec (throwaway, deleted after capture)

A node-environment Vitest spec importing `MOCK_SCHEDULE_ENTRIES` and `MOCK_WORK_ORDERS` was run with
`npx vitest run … --environment node`. Result: **Test Files 1 passed (1), Tests 5 passed (5)**, exit 0.
Checks:
- **(a)** No `workOrderReference` is used by schedule entries across more than one location
  (grouped by reference; resource-location prefix none=munich / `vie-`=vienna / `klg-`=klagenfurt must be
  consistent within each reference). PASS.
- **(b)** Every schedule entry's `workOrderReference` resolves to exactly one existing WorkOrder — no
  dangling or ambiguous references anywhere (not just the May set). PASS.
- **(c)** `wo-bg-1002` (ref `014826501`) booked-set in the April window = exactly
  `{mech-phil-parker, bay-pc-2, advisor-frank-miller, car-audi-a3-kl643ju}`; excludes `mech-mark-owen`
  and `advisor-ted-phillips`. PASS. (Reproduces the component's exact matching + window logic.)
- **(d)** May demo entries resolve to the new `014900001`–`014900022` Munich orders;
  `sch-may-demo-1/-2` → ref `014900001` → `wo-may-1001`; every May reference is in-band, resolves to
  one order, and that order's `demoLocationId` is `undefined`. PASS.
- **(e)** Legitimate owners untouched: `wo-bg-*` still own `014826500`–`014826509` (1 owner each);
  Vienna `014826701`–`711` and Klagenfurt `014826610`–`617` all still resolve; no May entry carries any
  `014826…` reference. PASS.

Captured verbose output:

```
 ✓ (a) no workOrderReference is used by schedule entries belonging to more than one location
 ✓ (b) every schedule entry workOrderReference resolves to exactly one existing WorkOrder (no dangling)
 ✓ (c) wo-bg-1002 (ref 014826501) booked-set in April window is exactly the four Munich resources, excluding May demo resources
 ✓ (d) May demo entries resolve to the new 014900xxx Munich orders
 ✓ (e) legitimate owners untouched: wo-bg-* own 014826500-509; Vienna/Klagenfurt bands intact
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

The throwaway spec (`mock-data-integrity.throwaway.spec.ts`) was deleted after capturing output.

### 3. `git status --porcelain`

Only source change is `mock-data.ts`, plus this verification note under `.agents/tasks/`. No stray files.
(See the commit for the exact set.)

## Constraints honored

- DATA-ONLY: only `mock-data.ts` was edited. No component/service/model code changed —
  `getBookedResourceIdsForOrder`, `isEntryForOrder`, `findOrderForScheduleEntry`, the scheduler, and
  `schedule.model.ts` are untouched; no `location` field added to `ScheduleEntry`; the window-overlap
  logic in `getBookedResourceIdsForOrder` is unchanged.
- Vienna (`wo-vie-*`, `sch-vie-*`, `vie-*`, `014826701`–`711`) and Klagenfurt (`sch-klg-*`, `klg-*`,
  `014826610`–`617`) clusters untouched.
- Real Munich background orders `wo-bg-1001`–`wo-bg-1010` and their `sch-bg-*` entries
  (`014826500`–`014826509`) unchanged — they remain the legitimate owners of those references.
- May planner demo still populates its May 2024 window (same resources, dates, times) — only the
  reference wiring and the new backing orders changed.
