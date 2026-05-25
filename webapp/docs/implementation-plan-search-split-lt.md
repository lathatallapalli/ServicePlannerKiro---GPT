# Implementation Plan - Search + Job Splitting

Branch: `features/enhancements-LT`  
Scope owner: Feature 2 `booking-search` + Feature 4 remaining `job-splitting`

## Purpose

This plan is based on the current files in this branch, especially:

- `agent.md`
- `webapp/docs/feature-split-summary-prio1-prio2.md`
- `webapp/src/app/features/service-planner/service-planner.component.ts`
- `webapp/src/app/features/service-planner/service-planner.component.html`
- `webapp/src/app/core/models/schedule.model.ts`

The main goal is to implement planner booking search and complete the remaining split-job inspection/navigation experience while preserving the existing split mechanics.

## Current Functionality Analysis

### Existing planner search state

- `orderPanelSearch` already exists in `ServicePlannerComponent` and currently filters orders in the right panel.
- `filteredPanelOrders` filters by order reference, order id, vehicle license plate, and customer name.
- The current right-panel search input is labelled `Search orders`, so it is not yet a true planner booking search.
- There is no current dedicated list of booking-level search results.

### Existing event navigation support

- `scrollToEventId` already exists and is passed to `app-custom-scheduler`.
- Existing code resets and sets `scrollToEventId` with `queueMicrotask` when scrolling to the first booking for an active order.
- Do not refactor existing navigation as a first step. Use the existing `scrollToEventId` pattern where search or split segment navigation needs it.
- If a helper is introduced later, it must be additive and low-risk, and it must preserve all current consumers of `scrollToEventId`, `onEventClicked()`, and booking-modal state.

### Existing split behavior

- Job context menu already exists for job events only.
- The context menu already offers `Split`, `See details`, and `Delete`.
- `splitContextEvent()` calls `splitJobBookingSet(eventId)`.
- `splitJobBookingSet()` already splits the selected job booking set at a midpoint:
  - finds the selected event and schedule entry,
  - checks `canSplitEvent()` and `isJobScheduleEntry()`,
  - finds sibling entries by `bookingSetId`,
  - reschedules original entries to first half,
  - creates second-half entries with a new split `bookingSetId`,
  - updates `events`, `scheduleEntries`, and `latestAutoBookingEntryIds`.
- `syncJobSiblings()` keeps entries in the same booking set aligned after move/resize.
- `ScheduleEntry.bookingSetId` already exists and must remain the grouping key for sibling behavior.

### Gaps to implement

- Search needs booking/event-level results, not only order filtering.
- Search needs to include job title/description/id and scheduled booking events.
- Search results need to navigate to concrete scheduler events.
- Hidden-by-resource-view/filter search results need explicit handling.
- Split segment details should use the existing resource booking details modal and show each selected segment's own duration/resource.
- Split segment navigation should reuse existing `scrollToEventId` and `onEventClicked()` patterns rather than introducing a competing navigation flow.
- Split metadata should remain backward-compatible and optional if added.

## Design Principles For Smooth Merge

- Keep this branch focused on `service-planner` search, split details, and event navigation only.
- Do not redesign scheduler tile markup; `features/enhancements-MV` owns tile display/design.
- Do not change drag/drop preview behavior; `features/enhancements-FH` owns drag feedback.
- Do not change resource view editor/list logic; `features/enhancements-KR` owns resource views.
- Preserve `bookingSetId` behavior; other existing planner code depends on it.
- Add optional data fields only; do not rename or require new model fields.
- Prefer small helper methods and small template blocks over broad rewrites.

## Implementation Phases

### Phase 1 - Build Booking Search Data Model

Add lightweight component interfaces near existing `BookingSet`:

```ts
interface BookingSearchResult {
  eventId: string;
  orderId: string;
  orderReference: string;
  title: string;
  subtitle: string;
  resourceLabel: string;
  timeLabel: string;
  hiddenByCurrentView: boolean;
}
```

Add component state:

```ts
bookingSearchQuery = '';
```

Add derived getter:

```ts
get bookingSearchResults(): BookingSearchResult[]
```

Result source:

- Build from `events`, `scheduleEntries`, `allOrders`, and `resources`.
- Target only real scheduled/blocked scheduler events that can be focused.
- Include job events and activity events if they match the query, but prioritize job bookings.

Search fields:

- customer name,
- job title,
- job description,
- job id,
- order reference/order number,
- order id,
- vehicle/license plate,
- event title,
- resource label.

Hidden-state detection:

- Compare result `resourceId` against `visibleSchedulerResources`.
- If not present, set `hiddenByCurrentView = true`.
- Do not silently drop hidden results.

Acceptance checks:

- Search by customer finds matching scheduled bookings.
- Search by job description/id finds matching scheduler events.
- Search by order number and license plate works.
- Hidden results are visibly marked instead of disappearing.

### Phase 2 - Update Right-Panel Search UI

Current right-panel search filters orders only. Update it without breaking existing order panel behavior.

Recommended approach:

- Keep `orderPanelSearch` if it continues to filter order cards.
- Add a clear booking-search section when in full planner mode.
- If using one input for both order and booking search, rename labels/placeholders to indicate planner booking search and keep existing order filtering behavior intact.
- Prefer a separate computed result panel above the existing order list to avoid rewriting order cards.

Template guidance:

- Add a small result list near the existing search input.
- Each result should be a button with:
  - primary label: order reference + job/activity title,
  - secondary label: customer, vehicle, resource, time,
  - hidden-by-current-view indicator when applicable.
- Result click should use the existing `scrollToEventId` reset/set pattern to navigate to the event.
- Optional Open details action should call the existing `onEventClicked({ eventId })` path so the current resource booking details modal opens.

Acceptance checks:

- Existing order tabs still work.
- Existing order drag cards still work.
- Search result click does not trigger order-card drag behavior.

### Phase 3 - Add Split Segment Helpers

Build on current `bookingSetId` grouping without breaking sibling synchronization.

Suggested helpers:

```ts
getSplitSegmentsForEvent(eventId: string): SchedulerEvent[]
getRelatedSplitEvents(event: SchedulerEvent): SchedulerEvent[]
getSplitSegmentResourceLabel(event: SchedulerEvent): string
getSplitSegmentTimeLabel(event: SchedulerEvent): string
```

Rules:

- Resolve the selected event to its `ScheduleEntry`.
- Use existing `getEntryBookingSetId(entry)` and `bookingSetId` conventions.
- Include events from the original and split-generated booking sets when they share a root relationship.
- If no optional split metadata exists yet, derive related segments by matching:
  - `jobId`,
  - `workOrderReference`,
  - job schedule entries only,
  - overlapping/same-day adjacent split times.

Optional model metadata:

- Add optional fields only if derivation is too fragile:
  - `splitRootId?: string`,
  - `splitParentBookingSetId?: string`,
  - `splitSequence?: number`.
- If added, populate these fields inside `splitJobBookingSet()` while preserving `bookingSetId`.

Acceptance checks:

- Split segments can be listed after splitting.
- Multi-resource segments show each assigned resource.
- Existing non-split job details still work.

### Phase 4 - Reuse Existing Booking Details Modal For Split Segments

Do not add a separate split details modal as the primary UX. The app already has a resource booking details modal for job bookings, and split segments should use that same modal.

Required behavior:

- After a job is split, each split segment should be represented by its own scheduler event.
- Clicking a split segment should continue to call the existing `onEventClicked({ eventId })` path.
- The existing resource booking details modal should open for the selected split segment.
- The modal should show the selected segment's own start/end duration, resource, order, vehicle, customer, and job context.
- The modal must not show the original unsplit duration when a split segment is selected.

Implementation guidance:

- Prefer fixing/enriching `events` and `scheduleEntries` produced by `splitJobBookingSet()` so the existing modal receives the correct selected event data.
- Ensure `initializeBookingModalState()` receives the selected split event's `start`, `end`, `resourceId`, and entry metadata.
- If a segment list/navigation is added later, it should be a secondary enhancement inside or near the existing booking modal, not a new competing modal.

Context menu behavior:

- Keep `Split` for creating the split.
- Keep `See details` wired to `openContextEventDetails()` and the existing booking modal.
- If a label change is needed, prefer a small copy update such as `See booking details`; do not create a separate split-details flow unless explicitly approved.

Acceptance checks:

- Right-click job -> Split still works.
- Click first split segment -> existing booking modal opens with first segment duration.
- Click second split segment -> existing booking modal opens with second segment duration.
- Resource field reflects the selected segment's assigned resource.
- Generic non-split job booking modal behavior is unchanged.
### Phase 5 - Harden Split Creation Behavior Carefully

Current split creation has nested asynchronous calls per sibling. Treat it as existing consumed functionality and change only what is required for correctness.

Recommended hardening:

- Generate one stable `splitTimestamp` before the loop.
- Generate deterministic ids per sibling as much as practical.
- Ensure `firstHalf` and `secondHalf` retain `workOrderReference`, `workorderItemCategory`, and job fields.
- Update both `events` and `scheduleEntries` with consistent `bookingSetId`/optional split metadata.
- Avoid modifying activity entries.
- Do not change ookingSetId semantics without updating every consumer listed in the Existing split behavior section.

Acceptance checks:

- Split one-resource job.
- Split multi-resource job.
- Move first split half and confirm its same-set siblings move together.
- Move second split half and confirm its same-set siblings move together.
- Generic booking modal still opens for split segments.

### Phase 6 - Validation And Handoff

Run from `webapp`:

```powershell
npm run build
```

Manual scenarios:

- `/service-planner` loads.
- Right-panel search finds bookings by customer, job, order, and license plate.
- Search result navigation scrolls to the correct event.
- Hidden-by-resource-view/filter result is marked clearly.
- Right-click menu opens for job events only.
- Split creates first/second-half entries.
- Existing resource booking details modal shows the correct duration/resource for each split segment.
- Split segment navigation/search uses existing `scrollToEventId` / `onEventClicked()` patterns without breaking existing consumers.
- Move/resize still keeps booking-set siblings synchronized.

## Suggested File Change Plan

### `service-planner.component.ts`

- Add search result interfaces near `BookingSet`.
- Add `bookingSearchQuery`.
- Add `bookingSearchResults` getter and search helper methods.
- Reuse existing `scrollToEventId` and `onEventClicked()` patterns; do not perform a broad navigation refactor.
- Add split segment helper methods.
- Do not add standalone split details modal state unless explicitly approved.
- Harden `splitJobBookingSet()` only where needed to ensure split segment events carry correct duration/resource metadata for the existing booking modal.

### `service-planner.component.html`

- Update the right-panel search area to show booking result list.
- Add hidden-result indicator and navigation buttons.
- Reuse the existing booking modal for split segment details; do not add a separate split details modal.
- Keep existing order cards and drag behavior intact.

### `service-planner.component.scss`

- Add scoped styles for search results and split details.
- Avoid touching scheduler tile styles.

### `schedule.model.ts`

- Only add optional split metadata if needed.
- Do not remove or rename `bookingSetId`.

## Dependencies On Other Branches

- `features/enhancements-MV`: owns scheduler tile visual design. This branch may expose optional split/search data, but should not style scheduler tiles.
- `features/enhancements-FH`: owns drag feedback. This branch should not change drag preview/drop calculations.
- `features/enhancements-KR`: owns resource views. This branch can request a small helper for revealing hidden resources if needed, but should not edit resource view flows directly.

## Merge-Risk Controls

- Keep search/split changes local and additive; avoid broad refactors of existing navigation or split consumers.
- Do not rewrite large template regions.
- Do not reformat unrelated sections.
- Keep optional model additions backward-compatible.
- Keep scheduler shared component changes out of this branch unless absolutely necessary.




