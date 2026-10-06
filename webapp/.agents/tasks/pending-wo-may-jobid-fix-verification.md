# Verification — Booked May orders no longer leak into Pending (DATA-ONLY)

## Root cause (confirmed against the code)

The 22 Munich May-planner demo orders `wo-may-1001..wo-may-1022` (reference band
`014900001`–`014900022`) showed in the **Pending** panel section even though each had two May
booking schedule entries. Pending is status-based and intentionally NOT date-scoped
(`visiblePendingOrders` = orders where `isOrderPlanned(order)` is false). `isOrderPlanned` is true
only when `getOrderPlanningState(order)` is one of `reserved | scheduled | in-progress | completed`.

`getOrderPlanningState` walks each order's work-order items and attaches a schedule entry only when
BOTH `entry.workOrderReference === order.referenceNumber` AND `entry.jobId === item.id` (jobs) /
templateId match (activities). The orders' job items were generated as `job-wo-may-10NN-1/-2` while
the booking rows (`mayPlannerDemoBookings`) carried `jobId: 'job-may-dNN-1/-2'`. The reference
matched but the jobId never did, so every item resolved `unscheduled` → order `unscheduled` →
Pending.

### Additional cause the original plan did not account for

`mock-data.ts` has post-processing that (a) **injects default activity items** `act-checkin` and
`act-handover` onto *every* order, and (b) a second loop that **overwrites** each activity item's
`workorderItemStatus` to `unscheduled` unless a schedule entry exists whose jobId ends with
`:<templateId>` (e.g. `wo-may-1001:act-checkin`). The booked wo-bg-*/Vienna/Klagenfurt orders all
satisfy this because their activity schedule entries use the `:act-*` jobId convention. The plan's
"two items keyed to `job-may-dNN-*`" approach cannot satisfy this: even with the two booking jobIds
aligned, the injected `act-checkin`/`act-handover` items stay `unscheduled`, leaving every order
`partiallyScheduled` — which is still NOT in `isOrderPlanned`'s accepted set, so the orders would
remain in Pending. (Verified empirically: with id-alignment only, wo-may-1001 resolved to
`partiallyScheduled`.)

## Approach chosen (and why it deviates from the plan)

Because mock-data's own activity post-processing keys on the `:act-*` templateId convention, the fix
models the wo-may orders exactly the way every other booked order is modelled, entirely within
`mock-data.ts` (DATA-ONLY), with no change to component/service/model logic and no change to
Pending being status-based:

1. **Mechanic booking rows → job items.** Each order's work-order JOB items are keyed to the jobIds
   of its mechanic (non-activity) booking rows (`job-may-dNN-1/-2`). The existing job-status
   post-processing then resolves them to `scheduled`.
2. **Activity booking rows → `:act-*` activity entries.** Each `category: 'activity'` booking row is
   re-keyed onto the owning order's `:act-*` id — courtesy-car (`car-*`) → `wo-may-10NN:act-mobility`,
   advisor (`advisor-*`) → `wo-may-10NN:act-checkin`. The matching activity item is supplied by the
   shared default-activity injection (which also adds `act-mobility` when a mobility entry exists).
3. **Synthesized check-in + handover entries for every order.** So the always-injected
   `act-checkin`/`act-handover` items resolve, each order gets a `:act-checkin` (unless already
   provided by an advisor booking row) and a `:act-handover` entry on its booked day, backed by an
   advisor resource.
4. **Day-capacity holds preserved.** Day-capacity rows that previously pointed at an activity booking
   jobId (`job-may-d06-2`, `job-may-d15-2`, now re-keyed) are repointed to the order's first mechanic
   job id so the hold still attaches to a real job item.

This keeps the fix DATA-ONLY and behavior-preserving (Pending stays status-based, no component edits).
It deviates from the plan's "exactly two items / don't touch the booking arrays" shape, which was not
viable given the activity post-processing described above; the deviation changes only the shape of the
May demo *data*, not any product behavior.

Edge: order `014900014` (`wo-may-1014`) has two activity booking rows and no mechanic row, so it is
modelled with only activity items (check-in / handover / mobility), all resolving `scheduled`.

## Before/after Pending count (Munich)

Reproduced `getOrderPlanningState` + `isOrderPlanned` headless over the exported mock arrays
(scratch spec, since removed):

- **After fix:** `munichTotal=33  munichPending=2  woMayPending=0`.
- **Before fix:** the 22 wo-may orders all resolved `unscheduled` → `munichPending=24`,
  `woMayPending=22`.
- **Net:** Munich Pending drops by exactly 22 (the wo-may orders leave Pending). The remaining 2
  Munich pending orders are legitimately-unscheduled non-wo-may orders and are unchanged. No
  `wo-bg-*`/Vienna/Klagenfurt order changed planning state.

## Integrity re-check (no regressions)

Preserved and asserted (new spec + existing `mock-data.integrity.spec.ts`):

- One location per reference (all wo-may resources stay Munich-scoped).
- No dangling references; work-order referenceNumbers unique; `014900001`–`022` map 1:1 to
  `wo-may-1001..1022`.
- `014826501`–`509` remain only on `wo-bg-*`/`sch-bg-*`; `014826511`–`523` do not exist.
- Window-overlap behavior for `wo-bg-1002` (`014826501`) unchanged — no `wo-bg-*`/Vienna/Klagenfurt
  data touched.

## Permanent spec added

`src/app/core/services/mock/mock-data.may-pending.integrity.spec.ts` — reproduces the production
attachment + status-rollup logic over `MOCK_WORK_ORDERS` / `MOCK_SCHEDULE_ENTRIES` /
`MOCK_RESOURCES` and asserts: every wo-may order item is referenced by a schedule entry, every
wo-may order resolves to `scheduled`/`reserved` (never `unscheduled`), zero wo-may orders in the
status-based Pending set, plus re-assertion of the reference-band invariants.

## Commands run

1. `npm run build` → `Application bundle generation complete.`, exit 0. Only pre-existing SCSS-budget
   and flatpickr CommonJS warnings; no new TypeScript errors.
2. `npm test -- --run` → `Test Files 4 passed (4)`, `Tests 18 passed (18)`, exit 0. Includes
   `mock-data.integrity.spec.ts`, `service-planner-booked-set.window-overlap.spec.ts`,
   `mock-data.may-pending.integrity.spec.ts`, and `app.spec.ts`.
3. `git status --porcelain` → only `webapp/src/app/core/services/mock/mock-data.ts` (modified) and
   `webapp/src/app/core/services/mock/mock-data.may-pending.integrity.spec.ts` (new) as source
   changes; `.agents/tasks/*` artifacts expected; no stray scratch files; no production code changed.
