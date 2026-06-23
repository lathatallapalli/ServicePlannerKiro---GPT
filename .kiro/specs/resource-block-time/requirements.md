# Requirements Document

## Introduction

This document specifies the requirements for the Resource Block Time feature in the Service Planner application. The feature enables planners to block time on resources (e.g., for maintenance, meetings, or unavailability) via a context menu on empty scheduler slots and manage block time entries through a modal dialog. It encompasses two interconnected capabilities: a resource slot context menu and a block time creation/editing modal.

Note: The booked resource filtering capability has been separated into its own spec (`booked-resource-filter`).

## Glossary

- **CustomSchedulerComponent**: The Angular standalone component (`custom-scheduler.component.ts`) that renders the scheduler timeline, resources, events, and capacity blocks.
- **ServicePlannerComponent**: The Angular standalone component (`service-planner.component.ts`) that orchestrates the overall planning workflow including order management, scheduling, and the scheduler.
- **SchedulerResourceSlotContextMenuPayload**: The interface (extending SchedulerTimeRangePayload) that carries the context for a right-click on an empty resource time slot, including resourceId, x, y, and source.
- **SchedulerTimeRangePayload**: The interface representing a time range selection with start, end, and optional resourceId.
- **ScheduleEntry**: The data model representing a single schedule entry with properties such as id, jobId, resourceId, start, end, title, description, color, kind, and categoryIds.
- **Resource_Block**: A ScheduleEntry with `kind` set to `'resource-block'`, representing blocked time on a resource unrelated to a specific work order.
- **BookingCategoriesService**: The Angular service that manages booking categories, providing category retrieval by id and full list access.
- **BookingCategory**: The data model interface representing a scheduling category with id, label, color, and appliesTo scope.
- **Carbon_ContextMenu**: The Carbon Design System context menu component (`ibm-context-menu`) used to display right-click menus.
- **Block_Time_Modal**: The Carbon Design System modal dialog used to create or edit Resource_Block entries.

## Requirements

### Requirement 1: Resource Slot Context Menu Event Emission

**User Story:** As a planner, I want to right-click on an empty resource time slot to see available actions, so that I can quickly perform operations like blocking time without navigating away.

#### Acceptance Criteria

1. WHEN a user right-clicks on an empty resource time slot in the CustomSchedulerComponent THEN THE CustomSchedulerComponent SHALL emit a `resourceSlotContextMenu` event with a SchedulerResourceSlotContextMenuPayload containing the slot's resourceId, start time, end time, mouse x coordinate, and mouse y coordinate
2. WHEN a user right-clicks on an existing scheduler event THEN THE CustomSchedulerComponent SHALL NOT emit the `resourceSlotContextMenu` event
3. THE SchedulerResourceSlotContextMenuPayload SHALL include a `source` property set to `'slot'` when triggered from a single slot right-click
4. WHEN a user has an active time range selection and right-clicks within that selection THEN THE CustomSchedulerComponent SHALL emit the `resourceSlotContextMenu` event with `source` set to `'selection'` and the start/end from the selection range
5. WHEN the `resourceSlotContextMenu` event is emitted THEN THE CustomSchedulerComponent SHALL prevent the browser's default context menu from appearing

### Requirement 2: Resource Slot Context Menu Display

**User Story:** As a planner, I want a context menu to appear at my cursor position when I right-click an empty slot, so that I can choose actions relevant to that time and resource.

#### Acceptance Criteria

1. WHEN the ServicePlannerComponent receives a `resourceSlotContextMenu` event THEN THE ServicePlannerComponent SHALL store the payload in the `resourceSlotContextMenu` property
2. WHEN the `resourceSlotContextMenu` property is not null THEN THE ServicePlannerComponent SHALL render a Carbon_ContextMenu at the (x, y) coordinates from the payload
3. THE Carbon_ContextMenu SHALL display a menu item labeled "Block time" as the primary action
4. WHEN the user clicks outside the Carbon_ContextMenu THEN THE ServicePlannerComponent SHALL set `resourceSlotContextMenu` to null, closing the menu
5. WHEN the user presses the Escape key while the Carbon_ContextMenu is open THEN THE ServicePlannerComponent SHALL set `resourceSlotContextMenu` to null, closing the menu
6. THE Carbon_ContextMenu SHALL display the resource name and time range as contextual information (title and detail)

### Requirement 3: Block Time Modal Opening

**User Story:** As a planner, I want the block time modal to open pre-filled with the selected resource and time range, so that I can create a time block without re-entering known information.

#### Acceptance Criteria

1. WHEN the user selects "Block time" from the resource slot context menu THEN THE ServicePlannerComponent SHALL open the Block_Time_Modal pre-filled with the resourceId, start time, and end time from the context menu payload
2. WHEN the Block_Time_Modal opens from the context menu THEN THE ServicePlannerComponent SHALL close the context menu by setting `resourceSlotContextMenu` to null
3. WHEN the Block_Time_Modal opens for creating a new Resource_Block THEN THE ServicePlannerComponent SHALL initialize the title field as empty and the description field as empty
4. WHEN the Block_Time_Modal opens for editing an existing Resource_Block THEN THE ServicePlannerComponent SHALL populate all fields (resource, start, end, title, description, categories) from the existing entry

### Requirement 4: Block Time Modal Fields and Layout

**User Story:** As a planner, I want a clear form with all relevant fields to define a time block, so that I can specify exactly when and why a resource is blocked.

#### Acceptance Criteria

1. THE Block_Time_Modal SHALL display a read-only resource field showing the resource name derived from the resourceId
2. THE Block_Time_Modal SHALL display a start date picker and a start time input for specifying the block start
3. THE Block_Time_Modal SHALL display an end date picker and an end time input for specifying the block end
4. THE Block_Time_Modal SHALL display a text input for the block title
5. THE Block_Time_Modal SHALL display a textarea for the block description
6. THE Block_Time_Modal SHALL display a category selection section with checkboxes listing categories from the BookingCategoriesService
7. THE Block_Time_Modal category section SHALL be collapsible via an accordion or expandable panel

### Requirement 5: Block Time Category Selection

**User Story:** As a planner, I want to assign categories to a time block, so that blocked time can be classified and visually distinguished on the scheduler.

#### Acceptance Criteria

1. THE ServicePlannerComponent SHALL maintain a `blockTimeCategoryIds` array tracking selected category IDs for the current block time modal session
2. WHEN the user toggles a category checkbox THEN THE ServicePlannerComponent SHALL add the categoryId to `blockTimeCategoryIds` if not present, or remove it if already present
3. THE ServicePlannerComponent SHALL provide an `isBlockTimeCategorySelected(categoryId: string)` method that returns true if the categoryId exists in `blockTimeCategoryIds`
4. WHEN the Block_Time_Modal opens for a new block THEN THE ServicePlannerComponent SHALL initialize `blockTimeCategoryIds` as an empty array
5. WHEN the Block_Time_Modal opens for an existing Resource_Block THEN THE ServicePlannerComponent SHALL initialize `blockTimeCategoryIds` with the entry's existing categoryIds

### Requirement 6: Block Time Save Operation

**User Story:** As a planner, I want to save a time block so that the resource shows as blocked on the scheduler for the specified period.

#### Acceptance Criteria

1. WHEN the user clicks save on the Block_Time_Modal in create mode THEN THE ServicePlannerComponent SHALL create a new ScheduleEntry with kind set to `'resource-block'`
2. WHEN a Resource_Block is created THEN THE ScheduleEntry SHALL include: a generated unique id, the selected resourceId, start date/time, end date/time, title, description, the selected categoryIds array, and a color derived from the first selected category
3. WHEN no categories are selected THEN THE ServicePlannerComponent SHALL use a default color for the Resource_Block entry
4. WHEN the user clicks save on the Block_Time_Modal in edit mode THEN THE ServicePlannerComponent SHALL update the existing ScheduleEntry with the modified field values
5. WHEN the save operation completes THEN THE ServicePlannerComponent SHALL close the Block_Time_Modal
6. IF the specified start time is equal to or later than the end time THEN THE ServicePlannerComponent SHALL prevent the save and display a validation error indicating the end must be after the start

### Requirement 7: Block Time Overlap Validation

**User Story:** As a planner, I want the system to validate that a block does not overlap existing events on the same resource, so that scheduling conflicts are prevented.

#### Acceptance Criteria

1. WHEN saving a Resource_Block THEN THE ServicePlannerComponent SHALL validate that the block's time range does not overlap any existing timed events (kind not equal to `'resource-block'`) on the same resource
2. IF the Resource_Block overlaps an existing timed event THEN THE ServicePlannerComponent SHALL prevent the save and display a validation error indicating the conflict
3. WHEN editing an existing Resource_Block THEN THE ServicePlannerComponent SHALL exclude the current entry from the overlap check

### Requirement 8: Scheduler Interface Extensions

**User Story:** As a developer, I want well-defined TypeScript interfaces for the new payloads and model extensions, so that type safety is maintained across the scheduler and planner components.

#### Acceptance Criteria

1. THE SchedulerResourceSlotContextMenuPayload interface SHALL extend SchedulerTimeRangePayload and include: resourceId (string, required), x (number, required), y (number, required), and source (optional, `'slot' | 'selection'`)
2. THE SchedulerTimeRangePayload interface SHALL include an optional `resourceId` property of type string
3. THE ScheduleEntry `kind` property type SHALL include `'resource-block'` as a valid value
4. THE ScheduleEntry interface SHALL include an optional `description` property of type string

### Requirement 9: Accessibility for Context Menu and Modal

**User Story:** As a user with assistive technology, I want the context menu and block time modal to be fully accessible, so that I can use these features with a keyboard and screen reader.

#### Acceptance Criteria

1. WHEN the Carbon_ContextMenu opens THEN THE ServicePlannerComponent SHALL move focus to the first menu item
2. THE Carbon_ContextMenu SHALL support keyboard navigation using arrow keys to move between items and Enter or Space to select an item
3. WHEN the Block_Time_Modal opens THEN THE ServicePlannerComponent SHALL move focus to the first interactive element within the modal
4. THE Block_Time_Modal SHALL trap focus within the modal while it is open, preventing tabbing to background content
5. THE Block_Time_Modal form fields SHALL have associated labels using the `for` attribute or `aria-labelledby` for screen reader identification
6. WHEN a validation error occurs on save THEN THE Block_Time_Modal SHALL announce the error message using an ARIA live region or `role="alert"`
7. THE Block_Time_Modal close and save buttons SHALL have descriptive `aria-label` attributes conveying their purpose

### Requirement 10: Resource Block Display on Scheduler

**User Story:** As a planner, I want resource blocks to appear visually on the scheduler timeline, so that I can see at a glance which time slots are blocked.

#### Acceptance Criteria

1. WHEN a Resource_Block ScheduleEntry exists for a resource THEN THE CustomSchedulerComponent SHALL render it as a distinct event tile on the resource's timeline row
2. THE CustomSchedulerComponent SHALL visually distinguish Resource_Block events from regular job events using a different visual treatment (e.g., hatched pattern, muted color, or distinct border)
3. WHEN the user clicks on a Resource_Block event tile THEN THE ServicePlannerComponent SHALL open the Block_Time_Modal in edit mode populated with the entry's data
4. WHEN the user right-clicks on a Resource_Block event tile THEN THE CustomSchedulerComponent SHALL emit the standard `eventContextMenu` event (not `resourceSlotContextMenu`)
