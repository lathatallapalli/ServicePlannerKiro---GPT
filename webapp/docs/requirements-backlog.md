# Service Planner Remaining Backlog

## Priority 1

- The full planner shall support searching/finding bookings from the right-panel search bar.
- Planner search shall support:
  - customer name
  - job description
  - job ID
  - order number
  - vehicle/license plate
- Planner search results shall allow navigation/scrolling to the matching booking on the planner.
- Users shall be able to right-click a job booking to split the job or view split details.
- Split job details on the tile shall show:
  - from/to timings
  - assigned resources
- Split job details shall allow easy navigation to each split event on the planner.
- Drag/drop shall show grid/time-slot highlights in addition to row highlight.
- Drag/drop shall provide clear snap feedback for the target resource and time slot.
- Planner tiles shall immediately show key booking information:
  - license plate
  - customer name
  - job description
  - order number
- Customer contact information shall be easy to copy, especially:
  - phone number
  - email address

## Priority 2

- Hovering a tile shall highlight all related bookings for the same order/job/activity set.
- Hovering truncated text in planner tiles shall show booking information in a tooltip.
- The planner shall support selecting partial resources and then dragging/dropping within that partial-selection context.
- Moving bookings shall be validated against business rules.
- Move validation shall prevent jobs from being moved before corresponding Check-In is complete.
- Move validation shall update/move Handover when the last job is moved, according to the defined business rule.
- Move validation shall show an error for resource qualification mismatch.
- Move validation shall block moves when the target resource is booked or unavailable during the target time.
- The product shall define and implement whether moving Check-In should move the full order.
- Adding a resource to a view shall prevent duplicates or clearly inform the user that the resource is already part of the view.
- Resource views shall support reordering resources.
- Resource reordering may use an order-number column or dropdown.
- Save and Close on resource views shall return to the planner context from which the resource view editor was opened.
- The previously selected resource view shall persist after returning from resource view editing.
- The visible/booked resources concept shall be straightened and documented so visible resources, selected resources, filtered resources, and booked resources have clear meanings.
