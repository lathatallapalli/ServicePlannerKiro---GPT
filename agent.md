# agent.md - Feature 2 Search + Feature 4 Job Splitting

Scope: this branch owns Feature 2 `booking-search` and Feature 4 remaining `job-splitting` functionality.

## Branch assignment

- Branch: `features/enhancements-LT`
- Features: planner booking search, split details, split segment navigation, and shared event focus/navigation behavior.
- This branch is the single owner for search/split navigation. Do not duplicate this logic in other branches.

## Existing split functionality to preserve

The app already has a partial job split implementation:

- Job right-click is handled by `onEventContextMenu()` in `webapp/src/app/features/service-planner/service-planner.component.ts`.
- The context menu already contains `Split`, `See details`, and `Delete` in `webapp/src/app/features/service-planner/service-planner.component.html`.
- `splitContextEvent()` calls `splitJobBookingSet(eventId)`.
- `splitJobBookingSet()` currently splits the job booking set at the midpoint, reschedules the original entries to the first half, creates second-half entries, and assigns a new `bookingSetId`.
- `syncJobSiblings()` keeps multi-resource bookings in the same booking set aligned when moving/resizing.
- `ScheduleEntry.bookingSetId` already exists and is used for grouping.

Preserve this behavior unless replacing it with a strictly compatible implementation.

## Primary ownership

Prefer changes in these files only:

- `webapp/src/app/features/service-planner/service-planner.component.ts`
- `webapp/src/app/features/service-planner/service-planner.component.html`
- `webapp/src/app/features/service-planner/service-planner.component.scss`
- Optional utility: `webapp/src/app/features/service-planner/utils/planner-search.util.ts`
- Optional utility: `webapp/src/app/features/service-planner/utils/planner-split.util.ts`
- Optional additive model fields only: `webapp/src/app/core/models/schedule.model.ts`

## Booking search implementation guidelines

- Search must support customer name, job title, job description, job id, order number/reference, order id, and vehicle/license plate.
- Results should target concrete scheduler event ids, not only orders.
- Keep order-panel filtering separate if needed. If `orderPanelSearch` becomes ambiguous, introduce `bookingSearchQuery` and `bookingSearchResults` rather than overloading state.
- Implement one shared navigation method such as:

```ts
focusPlannerEvent(eventId: string, options?: { openDetails?: boolean }): void
```

- `focusPlannerEvent()` should clear and reset `scrollToEventId`, using `queueMicrotask` when needed so repeated navigation to the same event works.
- If a result is hidden by current resource filters/resource view, show that state and provide a safe way to reveal or navigate.
- Do not add separate event navigation helpers in multiple places; split segment navigation should use the same method.

## Remaining split implementation guidelines

- Build on the existing `splitJobBookingSet()` implementation.
- Add a split details experience that shows:
  - split segment label/order,
  - from/to times,
  - assigned resource for each segment,
  - order/job/customer context,
  - action to navigate to each segment on the planner.
- Suggested helper methods:
  - `getSplitSegmentsForEvent(eventId)`
  - `getRelatedSplitEvents(event)`
  - `getSplitSegmentResourceLabel(event)`
  - `focusPlannerEvent(eventId, { openDetails: false })`
- Keep split job-only. Preserve the existing `isJobEvent()` / `isJobScheduleEntry()` checks.
- Preserve `bookingSetId` grouping because sibling sync depends on it.
- If extra split metadata is needed, add optional fields only, for example:
  - `splitRootId?: string`
  - `splitParentBookingSetId?: string`
  - `splitSequence?: number`
- If adding a visible split indicator, keep it minimal or expose optional data/classes for the tile design branch to style.

## Do not do

- Do not redesign scheduler tile layout; Feature 1 on `features/enhancements-MV` owns tile information design.
- Do not implement drag/snap feedback; Feature 3 on `features/enhancements-FH` owns that.
- Do not change resource view editor/list behavior; Feature 5 on `features/enhancements-KR` owns that.
- Do not change existing payload shapes unless adding optional fields.
- Do not globally reformat files.

## Merge coordination

- This branch owns all search/split event navigation and `scrollToEventId` helper behavior.
- Coordinate with `MV` if split/search indicators need tile-level visual styling.
- Coordinate with `FH` only if drag feedback needs to be aware of split segments; use optional state/hooks only.
- Coordinate with `KR` if search results hidden by resource views require a service-level helper.

## Validation

Before push, run from `webapp`:

```powershell
npm run build
```

Manual smoke test:

- `/service-planner` loads.
- Search finds bookings by customer, job, order, and license plate.
- Clicking a result scrolls/focuses the correct scheduler event.
- Hidden-by-filter/resource-view results are handled clearly.
- Right-click menu still opens for job events only.
- Splitting a job still creates first/second-half segments.
- Multi-resource job siblings remain synchronized after split, move, and resize.
- Split details show segment times/resources and navigate to each segment.

## Handoff note

Include in the branch handoff:

- Files changed.
- New search/split helper methods.
- Any optional model/interface fields added.
- Manual scenarios verified.
- Any expected styling dependency for `MV`.
