# Implementation Plan — `features/enhancements-KR`

Analysis date: 2026-05-22

## Inputs Reviewed

- Branch: `features/enhancements-KR`
- Feature split: `webapp/docs/feature-split-summary-prio1-prio2.md`
- Backlog: `webapp/docs/requirements-backlog.md`, `webapp/docs/backlog-features.md`
- Agent instructions: `.github/copilot-instructions.md`
- Current Angular implementation under `webapp/src/app`

## Agent / Repository Guidance

`.github/copilot-instructions.md` currently contains only `#Directives`, so there are no project-specific coding, testing, naming, or workflow rules to enforce beyond the existing code style and Angular conventions already present in the repository.

## Current Architecture Summary

- The main planner orchestration lives in `src/app/features/service-planner/service-planner.component.ts` and `service-planner.component.html`.
- The timeline/grid UI lives in `src/app/shared/components/scheduler/custom/custom-scheduler.component.ts`, `.html`, and `.scss`.
- Scheduler event/resource contracts live in `src/app/shared/components/scheduler/scheduler.interface.ts`.
- Booking, drag/drop, split, and modal flows are currently handled mostly inside `ServicePlannerComponent`.
- Resource View list/editor/catalog flows live in:
  - `src/app/features/resource-views/resource-views-list.component.ts`
  - `src/app/features/resource-view-editor/resource-view-editor.component.ts`
  - `src/app/features/resource-catalog/*`
  - `src/app/features/service-planner/services/resource-views.service.ts`
  - `src/app/features/service-planner/services/planner-settings.service.ts`
  - `src/app/app.ts`

## Existing Functionality Snapshot

### Planner tiles

- Tiles already render order/reference information, job/activity title, time range, duration, and status tags.
- Booking modal already exposes order, vehicle, customer, customer email, and customer phone.
- Missing P1 tile fields: license plate, customer name, and job description directly on the tile.
- Contact information is visible but not copy-friendly.

### Search

- Right panel search exists through `orderPanelSearch` and `filteredPanelOrders`.
- It searches order reference, order id, license plate, and customer name.
- It does not yet behave as booking-level search and does not search job description/job id.
- Existing “Show booking on planner” buttons already provide a reusable scroll/navigation pattern via `scrollToBookingInAvailabilityView()`.

### Drag feedback

- Row highlight exists through `dropTargetResourceId` and `.scheduler__row--drop-target`.
- Dropped and moved bookings already snap to slot duration.
- Existing event drag preview exists through `dragPreview`.
- Missing P1 feedback: explicit target time-slot/grid highlight and snap indicator before drop.

### Job splitting

- Right-click job context menu exists with Split, See details, and Delete.
- `splitJobBookingSet()` splits job booking sets at the midpoint and preserves sibling resource grouping through `bookingSetId`.
- Split segments are visible indirectly through right-panel booking sets and booking modal.
- Missing P1 split detail experience: a direct split-details panel/modal showing each segment’s from/to timings, assigned resources, and navigation actions.

### Resource Views

- Resource Views dropdown/list/editor/catalog flows exist.
- Duplicate resources are silently prevented in some paths through `Set`-based merging.
- Resource view state is in-memory via `ResourceViewsService` signals.
- Missing P2 items: clear duplicate messaging, resource reorder UI/persistence, reliable save/close return behavior, and selected view preservation after editing.

## Implementation Strategy

Implement in the order recommended by the feature split, with Resource Views handled as an independent P2 workstream after the P1 planner improvements.

## Phase 0 — Stabilize Contracts and Shared Data

**Goal:** Make scheduler events carry enough typed data to support tile rendering, search, and split details without duplicating lookup logic.

### Tasks

1. Extend or formalize `SchedulerEvent.meta` in `scheduler.interface.ts` to include typed order/job/entry data used by the scheduler.
2. Add helper methods in `ServicePlannerComponent` for:
   - order reference;
   - license plate;
   - customer name;
   - customer email;
   - customer phone;
   - job id;
   - job description;
   - booking set id.
3. Correct `EventDropPayload.dropType` to include `'activity'`, because runtime code already emits and consumes activity drops.
4. Keep event mapping centralized in `mapScheduleEntriesToEvents()`.

### Primary files

- `src/app/shared/components/scheduler/scheduler.interface.ts`
- `src/app/features/service-planner/service-planner.component.ts`

### Acceptance criteria

- No duplicated order/job lookup logic in scheduler templates.
- TypeScript accepts `dropType: 'activity'`.
- Existing booking, move, resize, and split behavior remains unchanged.

## Phase 1 — `tile-info-extension`

**Goal:** Show required booking information immediately on planner tiles and make contact details easy to copy.

### Tasks

1. Add tile display helpers for the required visible fields:
   - license plate;
   - customer name;
   - job description;
   - order number/reference.
2. Update scheduler event tile markup to render the extra lines in detailed mode.
3. Add compact layout rules so small tiles degrade gracefully without breaking drag/resize handles.
4. Add copy actions for customer email and phone in the booking modal.
5. Provide user feedback after copy, such as a small copied state or inline text.
6. Optionally add native `title` attributes as a low-risk first step for truncated tile fields, while leaving full tooltip behavior to P2.

### Primary files

- `src/app/shared/components/scheduler/custom/custom-scheduler.component.html`
- `src/app/shared/components/scheduler/custom/custom-scheduler.component.scss`
- `src/app/shared/components/scheduler/custom/custom-scheduler.component.ts`
- `src/app/features/service-planner/service-planner.component.ts`
- `src/app/features/service-planner/service-planner.component.html`
- `src/app/features/service-planner/service-planner.component.scss`

### Acceptance criteria

- Planner tiles show order number, license plate, customer name, and job description where details are visible.
- Email and phone can be copied from the booking details modal.
- Copy action has visible feedback.
- Existing event drag, resize, click, and context-menu interactions still work.

## Phase 2 — `booking-search`

**Goal:** Convert the right-panel search from order-only search into booking-aware search with navigation to matching planner events.

### Tasks

1. Define a booking search result model in `ServicePlannerComponent`, including:
   - event id / entry id;
   - order id/reference;
   - customer name;
   - license plate;
   - job/activity title;
   - job description;
   - job id;
   - resource;
   - start/end summary;
   - visibility status in the current resource view/filter.
2. Build `bookingSearchResults` from `events`, `scheduleEntries`, and `allOrders`.
3. Update `filteredPanelOrders` or add a dedicated results block so users can see matching bookings, not only matching orders.
4. Support search by:
   - customer name;
   - job description;
   - job id;
   - order number/reference;
   - vehicle/license plate.
5. Reuse `scrollToBookingInAvailabilityView()` or add a `scrollToBookingResult()` wrapper.
6. Decide first behavior for hidden matches:
   - show result with a “not visible in current view” marker;
   - optionally switch to all resources or prompt the user to change Resource View in a later enhancement.

### Primary files

- `src/app/features/service-planner/service-planner.component.ts`
- `src/app/features/service-planner/service-planner.component.html`
- `src/app/features/service-planner/service-planner.component.scss`

### Acceptance criteria

- Searching by each required field returns matching booking-level results.
- Selecting a result scrolls/navigates to the planner booking.
- Matching orders can still be discovered from the right panel.
- Hidden/filtered results are not silently lost.

## Phase 3 — `drag-feedback`

**Goal:** Add target time-slot/grid highlight and clear snap feedback during external drop and event move interactions.

### Tasks

1. Add a scheduler drag target state such as `dropTargetPreview` with:
   - resource id;
   - snapped start;
   - snapped end;
   - left;
   - width;
   - top;
   - label.
2. Update `onDragOver()` to compute snapped slot from pointer position using the same math as `onDrop()`.
3. Render a visual snap indicator inside `.scheduler__timeline-cell` for external drags from the right panel.
4. Align move preview behavior in `onDragMove()` so the preview snaps visually, not only on mouse up.
5. Style the target resource/time-slot indicator distinctly from regular row highlight.
6. Ensure `onDrop()` and `onEventMoved()` use the same snapped target that the user saw.

### Primary files

- `src/app/shared/components/scheduler/custom/custom-scheduler.component.ts`
- `src/app/shared/components/scheduler/custom/custom-scheduler.component.html`
- `src/app/shared/components/scheduler/custom/custom-scheduler.component.scss`

### Acceptance criteria

- Dragging from the right panel highlights the target resource row and exact snapped time slot.
- Moving existing events shows snapped target feedback before release.
- Final drop/move target matches the displayed feedback.
- Existing resize preview remains unaffected.

## Phase 4 — `job-splitting`

**Goal:** Provide a direct split-detail experience for right-clicked job bookings.

### Tasks

1. Add split detail state in `ServicePlannerComponent`, for example `selectedSplitDetails`.
2. Build split detail data from booking-set siblings:
   - booking set id;
   - from/to timings;
   - duration;
   - assigned resources;
   - event ids for navigation.
3. Change context-menu “See details” for job bookings to open split details when the job has one or more booking-set segments.
4. Add a modal or side panel listing split segments.
5. Add “Show on planner” action per segment, reusing `scrollToBookingInAvailabilityView()` or setting `scrollToEventId` directly.
6. Keep Split action midpoint-based unless product confirms split creation/editing is in scope.

### Primary files

- `src/app/features/service-planner/service-planner.component.ts`
- `src/app/features/service-planner/service-planner.component.html`
- `src/app/features/service-planner/service-planner.component.scss`

### Acceptance criteria

- Right-clicking a job booking can open split details.
- Split details show from/to timings and assigned resources.
- Each split segment can be navigated to on the planner.
- Existing midpoint split behavior still works.

## Phase 5 — `resource-views-management`

**Goal:** Complete independent P2 Resource View items: duplicate communication, ordering, return behavior, and selected-view preservation.

### Tasks

1. Preserve selected Resource View after returning from editor:
   - remove unconditional `this.plannerSettings.setResourceView(null)` from `ServicePlannerComponent.ngOnInit()`;
   - resolve selected view from route query/state or `PlannerSettingsService`.
2. Normalize route query parameters for Resource View list/editor/catalog:
   - `returnTo` should mean editor/list return target;
   - `plannerReturnTo` should preserve full planner vs workflow planner context;
   - avoid sending new views back to `/resource-views` when the user came from planner and expects planner return.
3. Add duplicate feedback when catalog selection contains resources already in the view.
4. Add reorder support in the Resource View editor:
   - simplest first version: order column with up/down controls;
   - alternative: numeric order field/dropdown if closer to design.
5. Persist resource order through `ResourceViewsService.upsert()` by preserving `resourceIds` order.
6. Ensure groups/flattened rows do not re-sort and accidentally destroy the chosen order.

### Primary files

- `src/app/features/service-planner/service-planner.component.ts`
- `src/app/features/service-planner/services/planner-settings.service.ts`
- `src/app/features/service-planner/services/resource-views.service.ts`
- `src/app/features/resource-views/resource-views-list.component.ts`
- `src/app/features/resource-view-editor/resource-view-editor.component.ts`
- `src/app/features/resource-view-editor/resource-view-editor.component.html`
- `src/app/features/resource-view-editor/resource-view-editor.component.scss`
- `src/app/features/resource-catalog/*`
- `src/app/app.ts`

### Acceptance criteria

- Adding an existing resource is blocked with clear user feedback.
- Resources in a view can be reordered.
- Reordered resource order is preserved in the planner view.
- Save and Close returns to the planner context that opened the editor.
- The previously selected Resource View remains selected after returning.

## Follow-up / Out of Initial Scope

These are listed in the backlog but should be implemented only after product behavior is clarified:

- Business-rule move validation for jobs before Check-In, Handover movement, qualification mismatch, target conflicts, and unavailable resources.
- Whether moving Check-In moves the full order.
- Partial resource selection plus drag/drop semantics.
- Related booking hover highlight across order/job/activity sets.
- Full Carbon tooltip behavior for truncated tile text.
- Formal definition of visible resources vs selected resources vs filtered resources vs booked resources.

## Suggested Validation

Run these after each phase:

1. `npm run build`
2. Manual planner smoke test:
   - load full planner;
   - open right panel;
   - search bookings;
   - drag a job/activity to planner;
   - move and resize an event;
   - right-click job event and split/view details;
   - open booking modal and copy email/phone;
   - edit Resource View and return.

## Risk Notes

- Scheduler tiles are height-constrained; adding more visible fields needs careful compact rendering.
- Search results hidden by Resource View filters need explicit UX to avoid confusing users.
- Drag feedback math must stay consistent between preview and final drop/move.
- Split jobs currently depend on `bookingSetId`; any backend integration must preserve equivalent grouping.
- Resource Views are currently in-memory only, so “persist” means signal-level persistence unless backend/local storage is added later.