# Remaining Features

Last updated: 2026-05-22

This document captures additional remaining features that are not part of the current Priority 1 / Priority 2 feature split, or that need to be tracked separately for future branch assignment.

## Remaining Feature List

| Feature | Summary | Suggested ownership notes |
| --- | --- | --- |
| Quick View updates | Update the Quick View component look and visual hierarchy. | Best fit: `features/enhancements-MV` because it owns design-led UI/display work. Keep changes visual-only unless coordinated. |
| Workweek/day/month views | Add scheduler view modes for day, workweek, and month. | Future scheduler-focused branch. Coordinate with drag feedback because both touch scheduler layout/time-grid code. |
| Block capacity for a Job/Order on a specific day | Allow capacity to be blocked/reserved for a job or full order on a selected day. | Future planner/scheduler business-logic branch. Requires clear model and validation rules before UI work. |
| Visually indicate begin and end of the complete customer appointment | Show clear visual appointment boundaries spanning the customer appointment lifecycle. | Future planner/scheduler visual feature. Coordinate with tile info, search/split navigation, and scheduler order-run rendering. |

## Merge-Risk Notes

- Quick View updates should stay in Quick View files unless a data contract change is explicitly required.
- Workweek/day/month views will likely touch scheduler sizing, slot generation, scrolling, and date headers; avoid combining with tile redesign or drag/drop validation.
- Capacity blocking needs a defined data model before implementation. Avoid overloading existing split/job booking fields without agreement.
- Appointment begin/end indicators should reuse existing order/appointment start/end data where possible and avoid conflicting with split-job or order-run visuals.

## Suggested Future Assignment

- Assign Quick View visual updates to `features/enhancements-MV` if it remains the design-led UI branch.
- Create a new dedicated scheduler-view branch for workweek/day/month views.
- Create a new capacity-planning branch for day-level Job/Order capacity blocking.
- Create a new appointment-visualization branch, or group it with scheduler-view work only if the same agent owns scheduler rendering.
