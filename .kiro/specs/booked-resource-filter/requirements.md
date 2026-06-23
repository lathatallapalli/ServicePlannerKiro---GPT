# Requirements Document

## Introduction

This document specifies the requirements for the Booked Resource Filter feature in the Service Planner application. The feature provides a mechanism to filter the scheduler's visible resources based on booking context — showing only resources that have bookings related to the user's current focus (a focused order or an active auto-proposal). It encompasses a context derivation layer in the ServicePlannerComponent, a scheduler input for receiving filter context, internal scheduler filter state management, and helper methods for collecting booked resource IDs.

This feature is independent of the Resource Block Time spec and can be implemented separately. It depends on the base scheduler component and service planner being functional.

## Glossary

- **CustomSchedulerComponent**: The Angular standalone component (`custom-scheduler.component.ts`) that renders the scheduler timeline, resources, events, and capacity blocks.
- **ServicePlannerComponent**: The Angular standalone component (`service-planner.component.ts`) that orchestrates the overall planning workflow including order management, scheduling, and the scheduler.
- **SchedulerBookedResourceFilterContext**: The interface describing a filter context for showing only booked resources, including contextKey, active, resourceIds, label, and source.
- **SchedulerTimeRangePayload**: The interface representing a time range selection with start, end, and optional resourceId.
- **ScheduleEntry**: The data model representing a single schedule entry with properties such as id, jobId, resourceId, start, end, title, description, color, kind, and categoryIds.
- **Booked_Resource_Filter**: The scheduler mechanism that filters visible resources to show only those that have bookings in the current context.
- **Focused_Order**: A work order that the user has explicitly focused on in the full planner mode, triggering resource filtering to that order's booked resources.
- **Auto_Proposal**: An automatically generated scheduling proposal that, when visible, constrains the resource view to only resources involved in the proposal.

## Requirements

### Requirement 1: Booked Resource Filter Context Interface

**User Story:** As a developer, I want a well-defined TypeScript interface for the filter context, so that type safety is maintained between the scheduler and planner components.

#### Acceptance Criteria

1. THE SchedulerBookedResourceFilterContext interface SHALL include: contextKey (string, required), active (boolean, required), resourceIds (string array, required), label (optional string), and source (optional, `'auto-proposal' | 'focused-order' | 'global'`)
2. THE SchedulerBookedResourceFilterContext interface SHALL be exported from the scheduler interface file (`scheduler.interface.ts`)
3. THE contextKey property SHALL uniquely identify the current filter context so that changes can be detected

### Requirement 2: Booked Resource Filter Context Derivation

**User Story:** As a planner, I want the scheduler to automatically filter resources based on my current context (focused order or auto-proposal), so that I can focus on relevant resources without manual filtering.

#### Acceptance Criteria

1. THE ServicePlannerComponent SHALL provide a computed property `schedulerBookedResourceFilterContext` that derives a SchedulerBookedResourceFilterContext from the current application state
2. WHEN a focused order exists THEN THE `schedulerBookedResourceFilterContext` SHALL return a context with source `'focused-order'`, contextKey based on the order id, and resourceIds matching the order's booked resources
3. WHEN an auto-proposal is visible (and no focused order exists) THEN THE `schedulerBookedResourceFilterContext` SHALL return a context with source `'auto-proposal'`, contextKey based on the proposal identifier, and resourceIds matching the proposal's resources
4. WHEN no focused order exists and no auto-proposal is visible THEN THE `schedulerBookedResourceFilterContext` SHALL return null
5. WHEN the focused order changes THEN THE `schedulerBookedResourceFilterContext` SHALL recompute immediately to reflect the new order's booked resources

### Requirement 3: Booked Resource Filter Context Input

**User Story:** As a scheduler consumer, I want to pass a filter context to the scheduler so that it can automatically show or hide resources based on external booking state.

#### Acceptance Criteria

1. THE CustomSchedulerComponent SHALL accept a `bookedResourceFilterContext` input of type `SchedulerBookedResourceFilterContext | null`
2. WHEN the `bookedResourceFilterContext` input changes to a non-null value with `active` set to true THEN THE CustomSchedulerComponent SHALL activate the booked-only resource filter using the context's resourceIds
3. WHEN the `bookedResourceFilterContext` input changes to null THEN THE CustomSchedulerComponent SHALL restore the previous booked-only filter state (deactivate if it was not manually activated)
4. WHEN the `bookedResourceFilterContext` input changes to a new context with a different contextKey THEN THE CustomSchedulerComponent SHALL update the booked resource filter to reflect the new context's resourceIds

### Requirement 4: Scheduler Internal Booked Resource Filter

**User Story:** As a planner, I want to toggle showing only booked resources on the scheduler, so that I can reduce visual clutter when focusing on active work.

#### Acceptance Criteria

1. THE CustomSchedulerComponent SHALL maintain an internal `showBookedOnlyResources` boolean toggle
2. WHEN `showBookedOnlyResources` is active THEN THE CustomSchedulerComponent SHALL display only resources that have at least one event, capacity block, or are included in the bookedResourceFilterContext's resourceIds
3. WHEN the user manually toggles `showBookedOnlyResources` off THEN THE CustomSchedulerComponent SHALL display all resources matching other active filters regardless of booking state
4. THE CustomSchedulerComponent SHALL invoke `rebuildDerivedBookedResourceIds()` to recompute the set of resource IDs with bookings whenever events or capacity blocks change
5. THE CustomSchedulerComponent SHALL invoke `syncBookedFilterWithContext()` whenever the `bookedResourceFilterContext` input changes to synchronize the filter toggle state with the provided context
6. WHEN `showBookedOnlyResources` is active and the bookedResourceFilterContext is null THEN THE CustomSchedulerComponent SHALL filter using only the internally derived booked resource IDs (resources that have events or capacity blocks)

### Requirement 5: Booked Resource ID Collection Helpers

**User Story:** As a developer, I want helper methods to collect booked resource IDs for a given context, so that the filter context can be derived accurately.

#### Acceptance Criteria

1. THE ServicePlannerComponent SHALL provide a `getBookedResourceIdsForOrder(order, options)` method that collects all resourceIds from events, capacity blocks, and schedule entries associated with the specified order
2. THE `getBookedResourceIdsForOrder` method SHALL accept an optional `includePinned` option that, when true, also includes pinned visible resource IDs in the result
3. THE ServicePlannerComponent SHALL provide a `getBookedResourceIdsForVisibleSchedule()` method that collects all resourceIds from currently visible events on the scheduler
4. THE ServicePlannerComponent SHALL provide an `isEventForOrder(event, order)` method that returns true if the event's metadata references the specified order (by referenceNumber or order id)
5. THE ServicePlannerComponent SHALL provide an `isEntryForOrder(entry, order)` method that returns true if the schedule entry is associated with the specified order

### Requirement 6: Filter State Synchronization

**User Story:** As a planner, I want the filter to activate and deactivate smoothly as I navigate between orders and proposals, so that the resource view always reflects my current focus.

#### Acceptance Criteria

1. WHEN `syncBookedFilterWithContext()` is invoked with a non-null context THEN THE CustomSchedulerComponent SHALL save the current `showBookedOnlyResources` state (if not already saved) and set `showBookedOnlyResources` to the context's `active` value
2. WHEN `syncBookedFilterWithContext()` is invoked with a null context THEN THE CustomSchedulerComponent SHALL restore `showBookedOnlyResources` to its previously saved value
3. WHEN the context changes from one contextKey to another (both non-null) THEN THE CustomSchedulerComponent SHALL update the filter resourceIds without toggling the saved state
4. THE CustomSchedulerComponent SHALL not overwrite the saved state if a context is already active (only save on first activation from null)

### Requirement 7: Derived Booked Resource IDs Rebuild

**User Story:** As a developer, I want the scheduler to automatically track which resources have bookings, so that the booked-only filter works correctly even without an external context.

#### Acceptance Criteria

1. WHEN `rebuildDerivedBookedResourceIds()` is invoked THEN THE CustomSchedulerComponent SHALL scan all events and capacity blocks to build a set of resource IDs that have at least one booking
2. THE `rebuildDerivedBookedResourceIds()` method SHALL be invoked whenever the `events` or `capacityBlocks` inputs change (detected via ngOnChanges)
3. WHEN `showBookedOnlyResources` is active and no external context is provided THEN THE CustomSchedulerComponent SHALL use the derived booked resource IDs to filter visible resources
4. WHEN an external context is provided THEN THE CustomSchedulerComponent SHALL use the union of the context's resourceIds and the derived booked resource IDs for filtering

