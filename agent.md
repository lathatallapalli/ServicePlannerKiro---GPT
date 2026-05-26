# agent.md - Feature 5 Resource Views Management

Scope: this branch owns Feature 5 `resource-views-management`.

## Branch assignment

- Branch: `features/enhancements-KR`
- Feature: duplicate resource handling, resource ordering, and Resource View save/close return behavior.

## Primary ownership

Prefer changes in these files only:

- `webapp/src/app/features/service-planner/services/resource-views.service.ts`
- `webapp/src/app/features/resource-view-editor/resource-view-editor.component.ts`
- `webapp/src/app/features/resource-view-editor/resource-view-editor.component.html`
- `webapp/src/app/features/resource-view-editor/resource-view-editor.component.scss`
- `webapp/src/app/features/resource-views/resource-views-list.component.ts`
- `webapp/src/app/features/resource-views/resource-views-list.component.html`
- `webapp/src/app/features/resource-views/resource-views-list.component.scss`
- Optional shared list changes only if required: `webapp/src/app/shared/components/generic-list/*`

## Implementation guidelines

- Put duplicate resource prevention in `ResourceViewsService`, not only in the UI.
- Preserve resource ordering in the saved `resourceIds` array.
- Add explicit save/close behavior that respects existing query params such as `returnTo`, `plannerReturnTo`, and `listReturnTo`.
- Keep reorder UI localized to the resource view editor if possible.
- If the planner must consume saved resource order, make the smallest possible change to planner resource sorting only.
- Keep service methods deterministic and easy to merge, for example:
  - `addResourcesToView(viewId, resourceIds)` should de-duplicate while preserving first-seen order.
  - `reorderResources(viewId, resourceIds)` should persist the provided order after validating ids.
  - `saveView(view)` should normalize duplicates before saving.
- Avoid storing duplicate resource names; use resource ids as the durable identity.

## Do not do

- Do not touch scheduler drag/drop behavior.
- Do not implement booking search.
- Do not implement split details or split navigation.
- Do not redesign scheduler tile display.
- Do not change `SchedulerEvent` or schedule entry split behavior.
- Do not globally reformat files.

## Merge coordination

- Feature 2+4 on `features/enhancements-LT` owns search, split details, and planner event navigation.
- Feature 3 on `features/enhancements-FH` owns drag/snap feedback.
- Feature 1 on `features/enhancements-MV` owns tile information design.
- If `LT` needs a helper to reveal resources hidden by a selected resource view, expose a small service method rather than editing search logic directly.

## Validation

Before push, run from `webapp`:

```powershell
npm run build
```

Manual smoke test:

- `/resource-views` loads.
- Existing resource views list correctly.
- Opening a resource view editor works.
- Adding duplicate resources does not create duplicates.
- Resource order is preserved after save/return.
- Save/close returns to the expected planner/list route.
- `/service-planner` still loads and resource view filtering still works.

## Handoff note

Include in the branch handoff:

- Files changed.
- Resource view service methods added/changed.
- Return navigation behavior implemented.
- Manual scenarios verified.
- Any dependency needed by `LT` for hidden resource search results.
