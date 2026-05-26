# Quick View Implementation Summary

## Purpose

Quick View helps the service advisor choose a scheduler-backed appointment for a work order. It calculates valid Check-In and Handover time slots based on resource availability, existing bookings, unavailability, sequencing rules, lunch break, and working-hour constraints.

## Main Files Involved

### Quick View

- `webapp/src/app/features/quick-view/quick-view.component.ts`
- `webapp/src/app/features/quick-view/quick-view.component.html`
- `webapp/src/app/features/quick-view/quick-view.component.scss`
- `webapp/src/app/features/quick-view/quick-view-selection.service.ts`
- `webapp/src/app/features/quick-view/schedule-proposal.service.ts`
- `webapp/src/app/features/quick-view/schedule-proposal-persistence.service.ts`

### Scheduler / Planner Integration

- `webapp/src/app/features/service-planner/services/auto-scheduler.service.ts`
- `webapp/src/app/features/service-planner/service-planner.component.ts`

### Appointment Integration

- `webapp/src/app/features/appointment-selection/appointment-selection.component.ts`
- `webapp/src/app/features/appointment-selection/appointment-selection.component.html`
- `webapp/src/app/core/services/appointment-sync.service.ts`

## Current Quick View Flow

### 1. Page Load

Quick View loads:

- active work order
- resources
- schedule entries
- existing Quick View / appointment selection state

The active work order is resolved from the route order ID or reference number.

### 2. Check-In Slot Generation

Check-In slots are generated using `AutoSchedulerService`.

Each displayed Check-In slot is backed by a valid schedule proposal. This means the system can schedule:

- Check-In
- all jobs
- Handover
- Mobility

Only valid scheduler-backed slots are shown.

### 3. Check-In Selection

When a Check-In slot is selected:

- the slot is highlighted
- Handover section becomes active
- page scrolls to the Handover slot section
- Handover proposals are generated for the selected Check-In

The selected Check-In fixes:

- Check-In start
- Check-In end
- Check-In resource

### 4. Handover Slot Generation

Handover slots are generated using the auto scheduler with the selected Check-In fixed.

The scheduler searches for valid Handover options while respecting:

- fixed Check-In
- required jobs
- Handover advisor availability
- Mobility resource availability
- existing schedule entries
- unavailability
- no Sunday scheduling
- no lunch overlap
- no scheduling after `18:00`

### 5. Handover Selection

When a Handover slot is selected:

- the Handover slot is highlighted
- the corresponding proposal is persisted
- previous schedule entries for the order are removed
- new entries are created

The created entries are:

- Check-In
- job entries
- Handover
- Mobility Service

## Shared Proposal Model

`ScheduleProposalService` converts auto-scheduler results into a reusable schedule proposal.

The proposal contains:

- order ID
- order reference
- Check-In start/end
- Handover start/end
- resource IDs
- job entries
- all schedule entries
- source

This keeps Quick View proposal construction separate from the UI component.

## Persistence Flow

`ScheduleProposalPersistenceService` handles saving a selected proposal.

It:

1. finds existing schedule entries for the order
2. unassigns/removes them
3. assigns the new proposal entries
4. updates the work order appointment
5. updates `QuickViewSelectionService`

This centralizes destructive save behavior.

## Selection State

`QuickViewSelectionService` stores the current selected appointment state:

- order ID
- Check-In start
- Handover start
- Handover end

This state is shared across:

- Quick View
- Appointment Selection
- Service Planner

## Appointment Selection Integration

Appointment Selection displays the selected Quick View appointment values.

When Appointment Selection date/time fields change:

- the work order appointment is updated
- `QuickViewSelectionService` is updated
- Quick View reads the updated values when opened

The Handover time shown in Appointment Selection represents the Handover start time.

Example:

```text
Handover card: 16.30 - 17.00
Appointment Selection Handover Time: 16.30
```

## Service Planner Integration

Service Planner syncs with Quick View in both directions.

### Quick View to Service Planner

After Quick View saves a proposal:

- Service Planner loads the updated schedule entries
- visible date range is aligned to the appointment
- planner scrolls to the active order booking
- workflow planner can collapse to booked resources

### Service Planner to Quick View

When Service Planner changes Check-In or Handover bookings through:

- move
- resize
- booking modal save
- auto-booking
- undo/delete re-evaluation

The shared selection state is updated so Quick View and Appointment Selection can reflect the latest values.

## Constraints Implemented

### No Sunday Slots

Quick View does not display Check-In or Handover slots on Sunday.

### Lunch Break

No booking can overlap:

```text
12:00 - 13:00
```

This is enforced in:

- auto scheduler
- planner move/resize/drop
- booking modal save
- appointment-derived activity creation

### Day End Cutoff

No appointment or booking can end after:

```text
18:00
```

This is enforced in Service Planner booking logic and scheduler proposal generation.

## UI Behavior

### Check-In Section

- Displays scheduler-backed Check-In slots.
- Slot grid has reduced height and internal scrolling.
- Selected slot is highlighted.

### Handover Section

- Disabled until a Check-In slot is selected.
- Displays scheduler-backed Handover options for the selected Check-In.
- Slot grid has reduced height and internal scrolling.
- Selected slot is highlighted.
- If a saved Handover slot from Service Planner is not regenerated, it is restored for display/highlight.

## Important Behavior Note

Quick View is primarily auto-scheduler driven.

However, for sync consistency, a saved Check-In/Handover slot from Service Planner or Appointment Selection can be restored into the UI for highlighting if it is not regenerated in the available scheduler proposal list.

This keeps the current saved booking visible while preserving scheduler-generated availability for new choices.


