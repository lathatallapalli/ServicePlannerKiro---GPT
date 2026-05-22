# AGENTS.md - Feature 1 Tile Info Extension

Scope: this branch owns Feature 1 `tile-info-extension`.

## Branch assignment

- Branch: `features/enhancements-MV`
- Feature: visible planner tile information and easy customer contact copy.
- This is design-led work: produce design recommendations before implementation.

## Primary ownership

Prefer changes in these files only:

- `webapp/src/app/shared/components/scheduler/custom/custom-scheduler.component.html`
- `webapp/src/app/shared/components/scheduler/custom/custom-scheduler.component.scss`
- `webapp/src/app/shared/components/scheduler/custom/custom-scheduler.component.ts`
- Optional, only if copy actions belong in the existing modal: `webapp/src/app/features/service-planner/service-planner.component.html`
- Optional, only if modal copy behavior needs logic: `webapp/src/app/features/service-planner/service-planner.component.ts`

## Design recommendation required first

Before coding, write a short recommendation covering:

- Tile information hierarchy for normal-width, narrow-width, and collapsed/short-duration tiles.
- Which fields are always visible versus truncated: order number, license plate, customer name, job title/description, timing.
- Where copy phone/email should live: booking modal, details affordance, hover/details popover, or safe tile action.
- Accessibility behavior for truncation, tooltips, copy buttons, keyboard use, and ARIA labels.
- How the design avoids interfering with drag, resize, click, and context-menu interactions.

## Implementation guidelines

- Preserve the existing scheduler event loop and tile structure; do not rewrite the whole scheduler template.
- Reuse `SchedulerEvent.meta.order`, `SchedulerEvent.meta.job`, and `SchedulerEvent.meta.entry` as the source of truth.
- Add small helper methods such as `getEventCustomerName(event)`, `getEventLicensePlate(event)`, and `getEventJobDescription(event)` if needed.
- Keep tile rendering responsive and compact; avoid increasing row height unless explicitly required by the design recommendation.
- Use additive CSS classes under the existing scheduler naming, for example `scheduler__event-customer`, `scheduler__event-vehicle`, or `scheduler__event-copy-action`.
- If adding copy buttons inside interactive areas, call `stopPropagation()` and prevent drag/resize/context-menu side effects.
- Follow the existing Carbon-like visual language, spacing, colors, typography, and truncation patterns.

## Do not do

- Do not implement booking search.
- Do not implement split details or split navigation.
- Do not change drag/drop calculations or payloads.
- Do not change `ScheduleEntry.bookingSetId` behavior.
- Do not modify resource view management screens or services.
- Do not globally reformat files.

## Merge coordination

- Feature 2+4 on `features/enhancements-LT` owns search, split details, and event navigation helpers.
- Feature 3 on `features/enhancements-FH` owns drag/snap feedback.
- Feature 5 on `features/enhancements-KR` owns resource view management.
- If tile design needs split/search visual indicators, add optional styling hooks only after coordinating with `LT`; do not invent separate navigation state.

## Validation

Before push, run from `webapp`:

```powershell
npm run build
```

Manual smoke test:

- `/service-planner` loads.
- Scheduler tiles still click, right-click, drag, and resize correctly.
- Booking modal still opens.
- Customer/order/vehicle/job information remains readable at common tile widths.
- Copy interaction, if implemented, works without triggering tile drag/click/context-menu.

## Handoff note

Include in the branch handoff:

- Design recommendation summary.
- Files changed.
- New helper methods/classes.
- Any shared contracts changed.
- Manual scenarios verified.
