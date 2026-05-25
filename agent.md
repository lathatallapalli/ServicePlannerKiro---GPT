# agent.md - LT/FH Merge Simulation

Scope: isolated merge-test worktree combining LT search/split work with FH drag feedback work.

## Merge policy

- Prefer LT for booking search, search result highlighting, split details, split segment navigation, and `scrollToEventId` focus behavior.
- Prefer FH for drag/drop mechanics, drag validation feedback, snap/drop preview, row highlight, and scheduler drag event payloads.
- Preserve shared split identity helpers such as `bookingSetId`, `splitRootId`, and `sourceEventId` so FH drag works with LT split segments.

## Primary ownership

- LT-owned files/areas:
  - `webapp/src/app/features/service-planner/service-planner.component.ts`
  - `webapp/src/app/features/service-planner/service-planner.component.html`
  - `webapp/src/app/features/service-planner/service-planner.component.scss`
  - optional model fields in `webapp/src/app/core/models/schedule.model.ts`
- FH-owned files/areas:
  - `webapp/src/app/shared/components/scheduler/custom/custom-scheduler.component.ts`
  - `webapp/src/app/shared/components/scheduler/custom/custom-scheduler.component.html`
  - `webapp/src/app/shared/components/scheduler/custom/custom-scheduler.component.scss`
  - additive drag/drop payloads in `webapp/src/app/shared/components/scheduler/scheduler.interface.ts`

## Validation

Before using this as a real merge candidate, run from `webapp`:

```powershell
npm run build
```

Manual smoke test:

- `/service-planner` loads.
- Search finds bookings by customer, job, order, and license plate.
- Search result navigation scrolls/focuses the correct scheduler event.
- Split details still show segment times/resources and navigate to each segment.
- Dragging shows FH target row/time-slot feedback.
- Dropping/moving events uses the same target shown by FH preview.
- Resize, event click, right-click, and booking modal behavior still work.