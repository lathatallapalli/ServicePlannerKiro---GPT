# Implementation Plan: Resource Block Time

## Overview

The Resource Block Time feature enables planners to block time on scheduler resources via a right-click context menu and a modal dialog. Implementation spans two Angular standalone components:

- **CustomSchedulerComponent** (`custom-scheduler.component.ts`) — emits `resourceSlotContextMenu` events on right-click of empty slots, renders resource-block tiles with distinct visual treatment.
- **ServicePlannerComponent** (`service-planner.component.ts`) — manages context menu display, block time modal lifecycle, validation (time ordering, overlap), category selection, and persistence via ScheduleRepository.

The implementation uses inline state management (component-level properties) consistent with the existing booking modal pattern in the codebase.

## Tasks

- [ ] 1. Define interfaces and extend data models
  - [ ] 1.1 Add SchedulerResourceSlotContextMenuPayload interface to scheduler.interface.ts
    - Create `SchedulerResourceSlotContextMenuPayload` extending `SchedulerTimeRangePayload` with: `resourceId` (string), `x` (number), `y` (number), `source` (optional `'slot' | 'selection'`)
    - Add optional `resourceId` property to `SchedulerTimeRangePayload` if not already present
    - _Requirements: 8.1, 8.2_

  - [ ] 1.2 Extend ScheduleEntry interface with resource-block support
    - Add `'resource-block'` to the `kind` union type in `ScheduleEntry`
    - Add optional `description` property (string) to `ScheduleEntry`
    - Ensure `categoryIds` optional property exists on `ScheduleEntry`
    - _Requirements: 8.3, 8.4_

- [ ] 2. Implement context menu event emission in CustomSchedulerComponent
  - [ ] 2.1 Add resourceSlotContextMenu Output and handler method
    - Declare `@Output() resourceSlotContextMenu = new EventEmitter<SchedulerResourceSlotContextMenuPayload>()`
    - Implement `onResourceSlotContextMenu(event: MouseEvent, resourceId: string)` method
    - Guard: return early if click target is inside `.scheduler__event`, capacity lane, or unavailability block
    - Call `event.preventDefault()` to suppress browser context menu
    - Determine `source`: check for active time range selection — use `'selection'` with selection range, otherwise `'slot'` with slot boundaries
    - Compute start/end from slot position or active selection
    - Emit payload with resourceId, start, end, x (`event.clientX`), y (`event.clientY`), source
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ] 2.2 Wire contextmenu event binding in CustomSchedulerComponent template
    - Add `(contextmenu)="onResourceSlotContextMenu($event, resource.id)"` to empty slot elements in the scheduler template
    - Ensure existing event tiles do NOT trigger this handler (guard clause handles this)
    - _Requirements: 1.1, 1.2_

  - [ ]* 2.3 Write property test for context menu payload completeness
    - **Property 1: Context menu payload completeness**
    - For any empty slot right-click, verify emitted payload contains correct resourceId, valid start < end, pointer x/y, and correct source value
    - **Validates: Requirements 1.1, 1.3, 1.4**

- [ ] 3. Implement context menu display in ServicePlannerComponent
  - [ ] 3.1 Add context menu state and handler methods
    - Declare `resourceSlotContextMenu: SchedulerResourceSlotContextMenuPayload | null = null`
    - Implement `onResourceSlotContextMenu(payload)` to store payload
    - Implement `closeResourceSlotContextMenu()` to set payload to null
    - Implement `getResourceSlotContextMenuTitle()` returning "Block time" label
    - Implement `getResourceSlotContextMenuDetail()` returning resource name and formatted time range
    - _Requirements: 2.1, 2.3, 2.6_

  - [ ] 3.2 Add context menu dismiss listeners
    - Add `@HostListener('document:click')` to close context menu when clicking outside
    - Add `@HostListener('document:keydown.escape')` to close context menu on Escape key
    - _Requirements: 2.4, 2.5_

  - [ ] 3.3 Add context menu template markup
    - Add `@if (resourceSlotContextMenu)` block rendering a `role="menu"` container positioned at payload x/y
    - Include contextual info (resource name, time range) and "Block time" menu item with `role="menuitem"`
    - Wire `(click)="openBlockTimeFromContext()"` on the menu item
    - Ensure focus moves to first menu item on render (autofocus or `cdkTrapFocus`)
    - Support keyboard navigation: arrow keys between items, Enter/Space to select
    - _Requirements: 2.2, 2.3, 2.6, 9.1, 9.2_

  - [ ] 3.4 Wire resourceSlotContextMenu output in service-planner template
    - Add `(resourceSlotContextMenu)="onResourceSlotContextMenu($event)"` to the `<app-custom-scheduler>` element
    - _Requirements: 2.1_

  - [ ]* 3.5 Write property test for context menu detail formatting
    - **Property 2: Context menu detail formatting**
    - For any valid payload, verify `getResourceSlotContextMenuDetail()` returns string containing resource label and time range
    - **Validates: Requirements 2.6**

- [ ] 4. Checkpoint - Verify context menu flow works
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement block time modal lifecycle and fields
  - [ ] 5.1 Add modal state properties to ServicePlannerComponent
    - Declare: `blockTimeModalOpen`, `blockTimeResourceId`, `blockTimeStartDate`, `blockTimeStartTime`, `blockTimeEndDate`, `blockTimeEndTime`, `blockTimeTitle`, `blockTimeDescription`, `blockTimeEditingEntryId`, `blockTimeCategoryIds`
    - _Requirements: 3.1, 3.3, 4.1–4.5, 5.1_

  - [ ] 5.2 Implement openBlockTimeFromContext and openBlockTimeModal methods
    - `openBlockTimeFromContext()`: transfer resourceId, start, end from context menu payload, clear context menu, open modal in create mode (empty title, description, categoryIds)
    - `openBlockTimeModal(resourceId, start, end, entry?)`: set all state properties; if entry provided (edit mode), populate title, description, categoryIds from entry
    - `closeBlockTimeModal()`: reset all state properties to defaults, set `blockTimeModalOpen = false`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ] 5.3 Add block time modal template markup
    - Render modal with `@if (blockTimeModalOpen)` inside overlay
    - Include `role="dialog"`, `aria-modal="true"`, `aria-labelledby="block-time-modal-title"`
    - Fields: read-only resource name, start date picker, start time input, end date picker, end time input, title text input, description textarea
    - Add collapsible category section (accordion/expandable panel) with checkboxes from BookingCategoriesService
    - Add Save and Cancel buttons with `aria-label` attributes
    - Ensure focus traps within modal, first interactive element receives focus on open
    - Associate labels with inputs via `for` attribute or `aria-labelledby`
    - _Requirements: 4.1–4.7, 9.3, 9.4, 9.5, 9.7_

  - [ ]* 5.4 Write property test for modal opening transfers context
    - **Property 3: Modal opening transfers context and clears menu**
    - For any non-null payload, verify `openBlockTimeFromContext()` sets correct modal state and clears context menu
    - **Validates: Requirements 3.1, 3.2, 2.1**

  - [ ]* 5.5 Write property test for edit mode population
    - **Property 4: Edit mode populates all fields from existing entry**
    - For any existing resource-block ScheduleEntry, verify all modal fields are populated correctly
    - **Validates: Requirements 3.4, 5.5, 10.3**

- [ ] 6. Implement category selection logic
  - [ ] 6.1 Implement toggleBlockTimeCategory and isBlockTimeCategorySelected methods
    - `toggleBlockTimeCategory(categoryId)`: add to `blockTimeCategoryIds` if not present, remove if present
    - `isBlockTimeCategorySelected(categoryId)`: return true if categoryId exists in `blockTimeCategoryIds`
    - _Requirements: 5.2, 5.3_

  - [ ] 6.2 Wire category checkboxes in modal template
    - Iterate categories from `BookingCategoriesService`, render checkboxes with `[checked]="isBlockTimeCategorySelected(cat.id)"` and `(change)="toggleBlockTimeCategory(cat.id)"`
    - Initialize `blockTimeCategoryIds` as empty array for new blocks, or from existing entry for edits
    - _Requirements: 5.1, 5.4, 5.5, 4.6_

  - [ ]* 6.3 Write property test for category toggle self-inverse
    - **Property 5: Category toggle is a self-inverse operation**
    - For any categoryId, verify toggling twice returns state to original, and single toggle flips `isBlockTimeCategorySelected`
    - **Validates: Requirements 5.2, 5.3**

- [ ] 7. Implement save operation with validation
  - [ ] 7.1 Implement saveBlockTime method with time ordering validation
    - Combine date and time fields into Date objects for start and end
    - Validate start < end; if invalid, display error via `setSchedulingError()` and return without saving
    - Validate title is non-empty (trimmed)
    - _Requirements: 6.6_

  - [ ] 7.2 Implement isResourceBlockPlacementValid overlap validation
    - Check proposed block does not overlap existing timed events (kind !== `'resource-block'`) on the same resource
    - Exclude current entry (by `blockTimeEditingEntryId`) from overlap check when editing
    - If overlap detected, display scheduling error and prevent save
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ] 7.3 Implement entry creation and update persistence
    - Create mode: build new ScheduleEntry with generated id (`block-{timestamp}`), `kind: 'resource-block'`, `jobId: 'resource-block'`, resourceId, start, end, trimmed title, trimmed description, categoryIds, color from first category or default `'#6F6F6F'`
    - Edit mode: update existing entry with modified fields
    - Persist via ScheduleRepository, update events array, close modal
    - Add validation error announcement via ARIA live region (`role="alert"`)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 9.6_

  - [ ]* 7.4 Write property test for saved entry field correctness
    - **Property 6: Saved entry contains all required fields with correct values**
    - For any valid modal state, verify created ScheduleEntry has correct kind, jobId, resourceId, start, end, title, description, categoryIds, and color
    - **Validates: Requirements 6.1, 6.2, 6.3**

  - [ ]* 7.5 Write property test for time ordering validation
    - **Property 7: Time ordering validation rejects invalid ranges**
    - For any start >= end pair, verify save does not create/update entry and modal remains open
    - **Validates: Requirements 6.6**

  - [ ]* 7.6 Write property test for overlap detection
    - **Property 8: Overlap detection prevents conflicts while allowing self-overlap in edit mode**
    - For any set of existing events and proposed block: overlapping blocks are rejected, non-overlapping blocks succeed, self-exclusion works in edit mode
    - **Validates: Requirements 7.1, 7.2, 7.3**

- [ ] 8. Checkpoint - Verify modal and save flow
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement resource block rendering on scheduler
  - [ ] 9.1 Add resource-block tile rendering in CustomSchedulerComponent
    - Implement `isResourceBlockEvent(event)` helper returning true when `event.meta?.entry?.kind === 'resource-block'`
    - Apply distinct CSS class `scheduler__event--resource-block` to resource-block event tiles
    - Add distinct visual treatment (hatched pattern, muted color, or distinct border) via CSS
    - _Requirements: 10.1, 10.2_

  - [ ] 9.2 Wire click and right-click handlers for resource-block tiles
    - Click on resource-block tile: call `openBlockTimeModal` in edit mode with entry data
    - Right-click on resource-block tile: emit standard `eventContextMenu` event (not `resourceSlotContextMenu`)
    - _Requirements: 10.3, 10.4_

  - [ ]* 9.3 Write unit tests for resource-block rendering
    - Verify `isResourceBlockEvent` returns correct boolean
    - Verify resource-block tiles have `scheduler__event--resource-block` CSS class
    - Verify click opens edit modal, right-click emits `eventContextMenu`
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [ ] 10. Set up test infrastructure and install fast-check
  - [ ] 10.1 Install fast-check and create test files
    - Run `npm install --save-dev fast-check` in the webapp directory (skip if already installed)
    - Create test file at `webapp/src/app/features/service-planner/resource-block-time.spec.ts` for modal and validation logic
    - Create test file at `webapp/src/app/shared/components/scheduler/custom/resource-block-time-scheduler.spec.ts` for scheduler event emission logic
    - Ensure Vitest can discover and run the test files
    - _Requirements: All (test infrastructure)_

- [ ] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (8 properties using fast-check)
- Unit tests validate specific examples and edge cases
- The implementation uses TypeScript throughout — all tests and implementation are in TypeScript
- Inline state management pattern (component-level properties) is used consistent with existing booking modal in the codebase
- Carbon Design System context menu follows the custom `role="menu"` container pattern already used for the event context menu
- Default block color is `#6F6F6F` when no categories are selected; otherwise derived from first selected category's color
- The `ScheduleRepository` is used for persistence, consistent with existing save patterns

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "10.1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "3.1", "3.2"] },
    { "id": 2, "tasks": ["2.3", "3.3", "3.4", "3.5"] },
    { "id": 3, "tasks": ["5.1", "5.2"] },
    { "id": 4, "tasks": ["5.3", "5.4", "5.5", "6.1"] },
    { "id": 5, "tasks": ["6.2", "6.3", "7.1"] },
    { "id": 6, "tasks": ["7.2", "7.3"] },
    { "id": 7, "tasks": ["7.4", "7.5", "7.6", "9.1"] },
    { "id": 8, "tasks": ["9.2", "9.3"] }
  ]
}
```
