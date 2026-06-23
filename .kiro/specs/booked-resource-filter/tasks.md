# Implementation Plan: Booked Resource Filter

## Overview

The Booked Resource Filter feature is largely implemented in the existing codebase. The task list focuses on finalizing the implementation to match all requirements (notably Requirement 7.4's union semantics), setting up the test framework with fast-check, and writing property-based and unit tests to validate correctness.

The implementation spans two main files:
- `webapp/src/app/features/service-planner/service-planner.component.ts` — context derivation
- `webapp/src/app/shared/components/scheduler/custom/custom-scheduler.component.ts` — filter state management

## Tasks

- [ ] 1. Define and export the SchedulerBookedResourceFilterContext interface
  - [ ] 1.1 Verify and finalize the SchedulerBookedResourceFilterContext interface in scheduler.interface.ts
    - Confirm the interface in `webapp/src/app/shared/components/scheduler/scheduler.interface.ts` includes all required fields: `contextKey` (string), `active` (boolean), `resourceIds` (string[]), `label` (optional string), `source` (optional `'auto-proposal' | 'focused-order' | 'global'`)
    - Ensure the interface is exported and importable by both the service planner and scheduler components
    - _Requirements: 1.1, 1.2, 1.3_

- [ ] 2. Implement context derivation in ServicePlannerComponent
  - [ ] 2.1 Implement the schedulerBookedResourceFilterContext getter
    - Verify the `schedulerBookedResourceFilterContext` getter in `service-planner.component.ts` correctly derives context from focused order (priority 1) and auto-proposal (priority 2), returning `null` when neither is active
    - Ensure `contextKey` uses `focused-order:{orderId}` or `auto-proposal:{orderId|'all'}` format for change detection
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ] 2.2 Implement getBookedResourceIdsForOrder helper
    - Verify the `getBookedResourceIdsForOrder(order, options)` method collects resourceIds from events (via `isEventForOrder`), capacity blocks (via `isEntryForOrder`), and schedule entries (via `isEntryForOrder`)
    - Ensure the `includePinned` option adds pinned visible resource IDs to the result
    - _Requirements: 5.1, 5.2_

  - [ ] 2.3 Implement getBookedResourceIdsForVisibleSchedule helper
    - Verify the `getBookedResourceIdsForVisibleSchedule()` method returns the union of all resourceIds from visible events and capacity blocks
    - _Requirements: 5.3_

  - [ ] 2.4 Implement isEventForOrder and isEntryForOrder helpers
    - Verify `isEventForOrder(event, order)` checks event metadata for order association via referenceNumber or order id
    - Verify `isEntryForOrder(entry, order)` checks entry association via `findOrderForScheduleEntry`, `workOrderReference`, or order id
    - _Requirements: 5.4, 5.5_

  - [ ]* 2.5 Write property tests for context derivation (Properties 1, 2)
    - **Property 1: Focused-order context derivation produces correct output**
    - **Property 2: Auto-proposal context derivation produces correct output**
    - **Validates: Requirements 2.2, 2.3, 1.3**

  - [ ]* 2.6 Write property tests for helper methods (Properties 7, 8, 9, 10)
    - **Property 7: getBookedResourceIdsForOrder collects all associated resourceIds**
    - **Property 8: getBookedResourceIdsForVisibleSchedule collects all visible resourceIds**
    - **Property 9: isEventForOrder correctly identifies order association**
    - **Property 10: isEntryForOrder correctly identifies order association**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

- [ ] 3. Implement filter state management in CustomSchedulerComponent
  - [ ] 3.1 Implement bookedResourceFilterContext input and ngOnChanges wiring
    - Verify the `@Input() bookedResourceFilterContext` is declared as `SchedulerBookedResourceFilterContext | null`
    - Verify `ngOnChanges` calls `rebuildDerivedBookedResourceIds()` when `events` or `capacityBlocks` change
    - Verify `ngOnChanges` calls `syncBookedFilterWithContext()` when `bookedResourceFilterContext` changes
    - _Requirements: 3.1, 4.4, 4.5_

  - [ ] 3.2 Implement syncBookedFilterWithContext state machine
    - Verify the `syncBookedFilterWithContext()` method:
      - Saves `showBookedOnlyResources` to `restoreBookedOnlyAfterContext` on first activation from null
      - Sets `showBookedOnlyResources = true` when context is active
      - Restores saved state when context becomes null
      - Does NOT overwrite saved state on context key transitions (only saves on first activation)
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ] 3.3 Implement rebuildDerivedBookedResourceIds
    - Verify the `rebuildDerivedBookedResourceIds()` method builds a `Set<string>` from all event resourceIds and capacity block resourceIds
    - _Requirements: 7.1, 7.2_

  - [ ] 3.4 Fix getEffectiveBookedResourceIds to use union semantics per Requirement 7.4
    - Update `getEffectiveBookedResourceIds()` to return the **union** of `context.resourceIds` and `derivedBookedResourceIds` when an external context is active (currently only returns context resourceIds)
    - When no context is active, continue returning `derivedBookedResourceIds` only
    - _Requirements: 7.3, 7.4_

  - [ ] 3.5 Implement matchesResourceDisplayFilters integration
    - Verify `matchesResourceDisplayFilters(resource)` checks `isResourceBooked(resourceId)` when `showBookedOnlyResources` is true
    - Verify `isResourceBooked(resourceId)` delegates to `getEffectiveBookedResourceIds()`
    - _Requirements: 4.2, 4.3, 4.6_

  - [ ] 3.6 Implement toggleBookedOnlyResources for manual user toggle
    - Verify `toggleBookedOnlyResources()` allows manual toggling: sets to false if currently true, enables only if booked resources exist
    - _Requirements: 4.1, 4.3_

  - [ ]* 3.7 Write property tests for state synchronization (Properties 3, 4, 5)
    - **Property 3: Context activation saves prior state and enables filter**
    - **Property 4: Context deactivation restores original state (round trip)**
    - **Property 5: Context key transitions do not overwrite saved state**
    - **Validates: Requirements 3.2, 3.3, 3.4, 6.1, 6.2, 6.3, 6.4**

  - [ ]* 3.8 Write property tests for filtering and derived IDs (Properties 6, 11, 12)
    - **Property 6: Resource visibility filtering rule**
    - **Property 11: rebuildDerivedBookedResourceIds produces union of event and block resourceIds**
    - **Property 12: Effective booked IDs uses union of context resourceIds and derived resourceIds when context is active**
    - **Validates: Requirements 4.2, 4.3, 4.6, 7.1, 7.4**

- [ ] 4. Checkpoint - Verify core implementation
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Wire template binding and integration
  - [ ] 5.1 Verify template binding passes computed context to scheduler
    - Confirm `[bookedResourceFilterContext]="schedulerBookedResourceFilterContext"` exists in `service-planner.component.html` on the `<app-custom-scheduler>` element
    - _Requirements: 3.1, 2.1_

  - [ ]* 5.2 Write integration tests for end-to-end filter flow
    - Test: focusing an order in full planner mode triggers resource filtering via context derivation
    - Test: auto-proposal visibility triggers resource filtering
    - Test: clearing focus/proposal restores previous resource view
    - _Requirements: 2.2, 2.3, 3.3, 6.2_

- [ ] 6. Set up test infrastructure and install fast-check
  - [ ] 6.1 Install fast-check and configure Vitest for property-based tests
    - Run `npm install --save-dev fast-check` in the webapp directory
    - Create a test file at `webapp/src/app/shared/components/scheduler/custom/booked-resource-filter.spec.ts` for scheduler filter logic
    - Create a test file at `webapp/src/app/features/service-planner/booked-resource-filter-context.spec.ts` for context derivation logic
    - Ensure Vitest can discover and run the test files
    - _Requirements: All (test infrastructure)_

- [ ] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The main code change required is in task 3.4 — updating `getEffectiveBookedResourceIds()` to use union semantics per Requirement 7.4. The current implementation only returns context resourceIds when a context is active, but the requirement specifies the union of context and derived IDs.
- Test files use Vitest (already in devDependencies) with fast-check for property-based testing
- The design uses TypeScript throughout — all tests and implementation are in TypeScript

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "6.1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "2.4", "3.1", "3.3"] },
    { "id": 2, "tasks": ["3.2", "3.4", "3.5", "3.6"] },
    { "id": 3, "tasks": ["2.5", "2.6", "3.7", "3.8", "5.1"] },
    { "id": 4, "tasks": ["5.2"] }
  ]
}
```
