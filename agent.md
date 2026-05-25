# agent.md - Integrated feature merge

This worktree integrates the LT, FH, and MV planner enhancements.

## Ownership decisions

- LT owns order-panel search, split booking details, event segmentation, source-event ID mapping, and right-click menu behavior.
- FH owns manual drag/drop and resize validation feedback, invalid ranges, and red/blue preview behavior.
- MV owns scheduler tile information density, customer/license/contact display, and contact copy actions.

## Merge rules

- Render events through `getRenderedEventsForResource()` so long/split bookings display on every segment.
- Emit and handle original source event IDs for click, right-click, drag, resize, split, details, and delete actions.
- Keep contact copy buttons on tiles and stop propagation for copy actions.
- Keep FH drop preview/invalid placement behavior unchanged.
- Keep LT floating hover tooltip while using MV-style customer/contact content.
- Use job title as the visible tile title; keep long job descriptions in tooltip/ARIA/details.
