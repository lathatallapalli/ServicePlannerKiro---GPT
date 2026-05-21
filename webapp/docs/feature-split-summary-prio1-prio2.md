# Feature Split Summary for Priority 1 and Priority 2

Analysis date: 2026-05-21

## Goal

This document summarizes the backlog split into five feature areas.

The purpose is to make ownership and backlog coverage clear for the team.

## Feature Areas

| Order | Feature | Main purpose |
| --- | --- | --- |
| 1 | `tile-info-extension` | Improve visible booking information and make customer contact details easy to copy. |
| 2 | `booking-search` | Allow users to search for bookings and navigate to matching planner entries. |
| 3 | `drag-feedback` | Improve drag/drop feedback and later extend into drag/move validation. |
| 4 | `job-splitting` | Allow users to inspect split job details and navigate to split events. |
| 5 | `resource-views-management` | Cover Resource Views duplicate handling, ordering, and save/close return behavior. |

## Backlog Coverage Matrix

| Backlog priority | Backlog item | Covered by feature | Coverage phase |
| --- | --- | --- | --- |
| P1 | Tile visible information | `tile-info-extension` | Initial feature scope |
| P1 | Copy customer info | `tile-info-extension` | Initial feature scope |
| P1 | Planner search / find booking | `booking-search` | Initial feature scope |
| P1 | Grid highlights and snap while dragging | `drag-feedback` | Initial feature scope |
| P1 | Split jobs | `job-splitting` | Initial feature scope |
| P2 | Tooltip for truncated tile text | `tile-info-extension` | Follow-up scope |
| P2 | Related booking hover highlight | `tile-info-extension`, `job-splitting` | Follow-up scope |
| P2 | Partial resource selection then drag/drop | `drag-feedback` | Follow-up scope |
| P2 | Move/drag validation | `drag-feedback`, `job-splitting` | Follow-up scope |
| P2 | Duplicate resource in view | `resource-views-management` | Initial scope for Feature 5 |
| P2 | Reorder resources in view | `resource-views-management` | Initial scope for Feature 5 |
| P2 | Resource view save/close return behavior | `resource-views-management` | Initial scope for Feature 5 |
| P2 | Straighten visible/booked resources concept | `drag-feedback`, `booking-search` | Cross-feature definition/follow-up |

## Feature 1 — `tile-info-extension`

### Priority 1 Items Covered

- `Tile visible information`
- `Copy customer info`

### Subtasks

- Show the requested key booking information on planner tiles:
  - license plate;
  - customer name;
  - job description;
  - order number.
- Ensure critical booking information is not available only behind a modal or tooltip.
- Make customer phone easy to copy.
- Make customer email easy to copy.

### Related Priority 2 Follow-Ups

- Add tooltip behavior for truncated tile text.
- Highlight related bookings on hover, if assigned to this feature area.

## Feature 2 — `booking-search`

### Priority 1 Items Covered

- `Planner search / find booking`

### Subtasks

- Use the right-panel search bar for booking search.
- Support search by customer name.
- Support search by job description.
- Support search by job id.
- Support search by order number.
- Support search by vehicle/license plate.
- Show matching booking results.
- Allow users to navigate or scroll to the matching planner booking.
- Prioritize full planner behavior.

### Related Priority 2 Follow-Ups

- Define behavior for results hidden by current resource filters.
- Connect search results with split job navigation if needed.
- Use the visible/booked/filtered resource concept once defined.

## Feature 3 — `drag-feedback`

### Priority 1 Items Covered

- `Grid highlights and snap while dragging`

### Subtasks

- Keep existing row highlight behavior.
- Add grid/time-slot highlight while dragging.
- Add clear snap feedback for target resource and time slot.
- Ensure drag feedback matches the final drop target.

### Related Priority 2 Follow-Ups

- Add validation while moving bookings.
- Prevent jobs from moving before corresponding Check-In is complete.
- Define and implement what happens to Handover when the last job is moved.
- Show errors for resource qualification mismatch.
- Block moves when target resource is already booked or unavailable.
- Define and implement whether moving Check-In moves the full order.
- Support partial resource selection during drag/drop once the expected behavior is defined.

## Feature 4 — `job-splitting`

### Priority 1 Items Covered

- `Split jobs`

### Subtasks

- Support right-click on a job booking tile for split/details behavior.
- Show split details.
- Show from/to timings for split events.
- Show assigned resources for split events.
- Allow users to navigate to each split event on the planner.

### Related Priority 2 Follow-Ups

- Highlight related bookings for the same order/job/activity set.
- Validate moves involving split job segments.
- Extend into split creation/editing only if confirmed as in scope.


## Feature 5 — `resource-views-management`

### Priority 2 Items Covered

- `Duplicate resource in view`
- `Reorder resources in view`
- `Resource view save/close return behavior`

### Subtasks

- Prevent duplicate resources from being added to a view, or clearly communicate when the resource already exists.
- Allow resources in a view to be reordered.
- Persist the resource order in the view.
- Ensure Save and Close returns to full planner when Resource Views was opened from full planner.
- Ensure Save and Close returns to workflow planner when Resource Views was opened from workflow planner.
- Preserve the selected Resource View after returning from editing.

### Related Follow-Ups

- Keep this feature aligned with the future definition of visible, selected, filtered, and booked resources.

## Cross-Feature or Separate Follow-Up

The following item is cross-cutting and should be defined before it is implemented inside a specific feature:

- `Straighten visible/booked resources concept`

## Recommended Execution Order

1. `tile-info-extension`
2. `booking-search`
3. `drag-feedback`
4. `job-splitting`
5. `resource-views-management`

Reasoning:

- `tile-info-extension` provides the data visibility needed by users and can support later search/split work.
- `booking-search` builds on booking information and improves planner navigation.
- `drag-feedback` improves interaction clarity before adding validation complexity.
- `job-splitting` follows the planner interaction features because it depends on clear booking relationships and may later connect with search, hover, and validation behavior.
- `resource-views-management` can run independently from the four planner-focused features because it belongs to the Resource Views flow.

## Summary

The Priority 1 backlog plus the independent Resource Views P2 items can be split into five clear feature areas:

- `tile-info-extension` covers visible tile information and customer contact copy.
- `booking-search` covers right-panel booking search and navigation.
- `drag-feedback` covers grid/time-slot highlight and snap feedback, with move validation as a later P2 extension.
- `job-splitting` covers split detail inspection and navigation, with creation/editing left for future scope confirmation.
- `resource-views-management` covers duplicate resource handling, resource ordering, and Resource View save/close return behavior.
