# agent.md - Feature 3 Drag Feedback

Scope: this branch owns Feature 3 `drag-feedback`.

## Branch assignment

- Branch: `features/enhancements-FH`
- Feature: grid/time-slot highlight and snap feedback while dragging.

## Primary ownership

Prefer changes in these files only:

- `webapp/src/app/shared/components/scheduler/custom/custom-scheduler.component.ts`
- `webapp/src/app/shared/components/scheduler/custom/custom-scheduler.component.html`
- `webapp/src/app/shared/components/scheduler/custom/custom-scheduler.component.scss`
- Optional additive scheduler payload/interface fields only: `webapp/src/app/shared/components/scheduler/scheduler.interface.ts`

## Implementation guidelines

- Preserve existing row highlight behavior.
- Add a clear grid/time-slot highlight while dragging.
- Add clear snap feedback for target resource and time slot.
- The visual preview must match the final drop target.
- Keep final drop calculation and preview calculation in one shared internal helper so they cannot drift.
- Suggested internal state shape:

```ts
interface DropPreview {
  resourceId: string;
  start: Date;
  end: Date;
  left: number;
  top: number;
  width: number;
}
```

- Render lightweight preview/highlight overlays inside the scheduler timeline.
- Use additive CSS classes such as:
  - `scheduler__drop-preview`
  - `scheduler__snap-highlight`
  - `scheduler__slot-highlight`
- Keep existing `dropTargetResourceId` behavior compatible.
- Prefer component-private helpers/state over shared model changes.

## Do not do

- Do not implement booking search.
- Do not implement split details or split navigation.
- Do not redesign scheduler tile content; Feature 1 on `features/enhancements-MV` owns tile information design.
- Do not change resource view editor/list behavior.
- Do not add business validation for moves unless explicitly required; this feature is visual feedback only.
- Do not globally reformat files.

## Merge coordination

- Feature 2+4 on `features/enhancements-LT` owns search, split details, and event focus/navigation.
- Feature 1 on `features/enhancements-MV` may also touch scheduler tile markup/styles. Avoid moving or rewriting tile blocks.
- If optional scheduler inputs/outputs are needed, make them additive and backwards-compatible.
- Keep drag preview markup separate from event tile markup to reduce conflicts with `MV`.

## Validation

Before push, run from `webapp`:

```powershell
npm run build
```

Manual smoke test:

- `/service-planner` loads.
- Dragging over rows keeps existing row highlight.
- Dragging shows target time-slot/resource snap preview.
- Dropping creates/moves booking at the same time/resource shown by the preview.
- Existing event click, right-click, resize, and modal behavior still work.
- Resource view filtering still works.

## Handoff note

Include in the branch handoff:

- Files changed.
- Preview/drop helper methods added.
- Any optional scheduler interface fields added.
- Manual drag/drop scenarios verified.
- Any known tile markup overlap with `MV`.
