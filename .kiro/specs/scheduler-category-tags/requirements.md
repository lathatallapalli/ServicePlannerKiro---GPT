# Requirements Document

## Introduction

This document specifies the requirements for the Scheduler Category Tags feature in the Service Planner application. This feature adds visual category tags (color-coded pills) to events on the custom scheduler component, displayed alongside existing status tags. The tags use an adaptive width algorithm to gracefully degrade when event blocks are narrow, prioritizing status information while fitting as many category labels or icons as space permits.

This feature depends on the Booking Categories CRUD spec being implemented first, which provides the BookingCategory data model, persistence, and management UI.

## Glossary

- **CustomSchedulerComponent**: The Angular standalone component (`custom-scheduler.component.ts`) that renders time-based events on a resource grid.
- **ServicePlannerComponent**: The parent component that hosts the CustomSchedulerComponent and passes data inputs including booking categories.
- **SchedulerEvent**: An interface representing a single scheduled event on the grid, containing id, resourceId, start, end, title, color, and meta (which includes job, order, and entry references).
- **ScheduleEntry**: The underlying data model for a booking entry, containing an optional `categoryIds: string[]` field linking the entry to BookingCategory records.
- **BookingCategory**: The data model interface representing a single category with properties: id, label, color, tagBackgroundColor, tagTextColor, appliesTo, description, and isSystem.
- **BookingCategoriesService**: The Angular service responsible for managing the lifecycle of booking categories.
- **Status_Tag**: The existing tag pill on an event that displays the workorder item status (e.g., "In Progress", "Complete").
- **Category_Tag**: A color-coded pill rendered on an event representing a BookingCategory assignment; displays a colored dot and optionally the category label.
- **Adaptive_Width_Algorithm**: The set of calculations that determine how much space is available for tags on an event block and which tags (status and category) can be displayed at what fidelity.
- **Full_Label_Mode**: Tag rendering where both the colored dot/icon and the text label are displayed.
- **Icon_Only_Mode**: Tag rendering where only the colored dot/icon is displayed without text.
- **Event_Width**: The calculated pixel width of a scheduler event block on the timeline.
- **Content_Reserve_Width**: The pixel width reserved for the event's text content (title, detail, customer/vehicle line) before allocating remaining space to tags.
- **Available_Tag_Width**: The remaining pixel width after Content_Reserve_Width is subtracted from Event_Width, available for rendering status and category tags.
- **EVENT_FULL_TAG_MIN_WIDTH**: A constant (360px) representing the minimum event width at which full label tags can be shown.
- **EVENT_ICON_TAG_MIN_WIDTH**: A constant (150px) representing the minimum event width at which icon-only tags can be shown.
- **EVENT_CONTENT_MAX_WIDTH**: A constant (120px) representing the maximum text content width used in reserve calculation.
- **EVENT_CONTENT_PADDING**: A constant (40px) representing padding added to content width in reserve calculation.
- **EVENT_CONTENT_MAX_RESERVE**: A constant (160px = EVENT_CONTENT_MAX_WIDTH + EVENT_CONTENT_PADDING) representing the maximum content reserve width.
- **Greedy_Fit_Algorithm**: The algorithm that iterates categories in order, accumulating widths, and stops when the next tag would exceed available space.

## Requirements

### Requirement 1: Scheduler Category Input

**User Story:** As a parent component developer, I want to pass booking categories into the scheduler, so that the scheduler can resolve and display category tags on events.

#### Acceptance Criteria

1. THE CustomSchedulerComponent SHALL expose a public `@Input() bookingCategories` property of type `BookingCategory[]` with a default value of an empty array
2. WHEN the ServicePlannerComponent initializes THEN THE ServicePlannerComponent SHALL pass the complete list of categories from BookingCategoriesService to the CustomSchedulerComponent bookingCategories input
3. WHEN the BookingCategoriesService categories collection changes THEN THE ServicePlannerComponent SHALL pass the updated categories to the CustomSchedulerComponent bookingCategories input

### Requirement 2: Event Category Resolution

**User Story:** As the scheduler rendering logic, I want to resolve which categories apply to each event, so that I can determine what category tags to display.

#### Acceptance Criteria

1. WHEN getEventCategories is called with a SchedulerEvent THEN THE CustomSchedulerComponent SHALL read the categoryIds array from event.meta.entry.categoryIds
2. WHEN getEventCategories is called THEN THE CustomSchedulerComponent SHALL map each categoryId to its corresponding BookingCategory object by finding a match in the bookingCategories input array
3. WHEN a categoryId in the event does not match any BookingCategory in the bookingCategories input THEN THE CustomSchedulerComponent SHALL exclude that categoryId from the result
4. WHEN event.meta.entry.categoryIds is undefined or empty THEN THE CustomSchedulerComponent SHALL return an empty array
5. THE CustomSchedulerComponent SHALL preserve the order of categories as they appear in the categoryIds array

### Requirement 3: Event Width Calculation

**User Story:** As the adaptive layout engine, I want to calculate the pixel width of each event block, so that I can determine available space for tags.

#### Acceptance Criteria

1. THE CustomSchedulerComponent SHALL calculate event width in pixels based on the event's start time, end time, and the current timeline scale (hours per pixel)
2. WHEN an event spans multiple time slots THEN THE CustomSchedulerComponent SHALL compute width as the difference between the event end position and start position on the timeline
3. THE getEventWidth method SHALL return a non-negative number representing the event block width in pixels

### Requirement 4: Content Reserve Width Calculation

**User Story:** As the adaptive layout engine, I want to calculate how much horizontal space the event text content requires, so that tags do not overlap content.

#### Acceptance Criteria

1. WHEN getEventContentReserveWidth is called THEN THE CustomSchedulerComponent SHALL estimate the text width of the event job description, event detail, and customer/vehicle detail lines
2. THE CustomSchedulerComponent SHALL use the estimateTextWidth function with approximately 7.25 pixels per character to calculate text widths
3. THE CustomSchedulerComponent SHALL select the maximum width among the three text lines as the base content width
4. THE CustomSchedulerComponent SHALL add EVENT_CONTENT_PADDING (40px) to the base content width to produce the content needed value
5. THE CustomSchedulerComponent SHALL cap the content reserve at the minimum of EVENT_CONTENT_MAX_RESERVE (160px) and the event width
6. THE CustomSchedulerComponent SHALL ensure the content reserve is at least 120px
7. THE CustomSchedulerComponent SHALL limit the content reserve so that at least 60px remains for tags (reserve cannot exceed eventWidth minus 60)

### Requirement 5: Available Tag Width Calculation

**User Story:** As the adaptive layout engine, I want to know the remaining space after content reservation, so that I can allocate it among status and category tags.

#### Acceptance Criteria

1. WHEN getEventAvailableTagWidth is called THEN THE CustomSchedulerComponent SHALL return the event width minus the content reserve width
2. THE CustomSchedulerComponent SHALL return zero if the content reserve width equals or exceeds the event width
3. THE Available_Tag_Width SHALL represent the total horizontal space shared between the Status_Tag and all Category_Tags

### Requirement 6: Status Tag Width and Priority

**User Story:** As the tag rendering logic, I want the status tag to be allocated space first, so that workorder status always takes priority over category tags.

#### Acceptance Criteria

1. THE CustomSchedulerComponent SHALL calculate status tag width as: icon (16px) + horizontal padding (16px) + optional gap (4px when label shown) + optional label width
2. THE CustomSchedulerComponent SHALL enforce a minimum status tag width of 32px
3. WHEN Available_Tag_Width is sufficient for the full status tag (icon + label) THEN THE CustomSchedulerComponent SHALL allocate full status tag width before computing leftover for categories
4. WHEN Available_Tag_Width is insufficient for the full status tag but sufficient for icon-only THEN THE CustomSchedulerComponent SHALL render the status tag in Icon_Only_Mode and allocate only icon width before computing leftover for categories
5. WHEN Available_Tag_Width is less than the icon-only status tag width THEN THE CustomSchedulerComponent SHALL not render any tags (status or category)

### Requirement 7: Category Tag Width Calculation

**User Story:** As the tag rendering logic, I want to estimate the pixel width of each category tag pill, so that I can determine how many fit in the available space.

#### Acceptance Criteria

1. THE CustomSchedulerComponent SHALL calculate category tag width as: icon (16px) + horizontal padding (16px, 8px each side) + optional gap (4px when label shown) + optional label text width
2. THE CustomSchedulerComponent SHALL enforce a minimum category tag width of 24px regardless of calculated values
3. THE CustomSchedulerComponent SHALL estimate label text width using approximately 7.25 pixels per character
4. WHEN withLabel is false THEN THE CustomSchedulerComponent SHALL calculate width without label text and without the inter-element gap

### Requirement 8: Greedy Tag Fitting Algorithm

**User Story:** As the tag rendering logic, I want to fit as many category tags as possible within the available space, so that the user sees the maximum number of categories without overflow.

#### Acceptance Criteria

1. WHEN getMaxFittingCategoryCount is called THEN THE CustomSchedulerComponent SHALL iterate categories in order, accumulating tag widths plus inter-tag spacing (2px between tags)
2. WHEN adding the next category tag width (plus spacing) would exceed the available width THEN THE CustomSchedulerComponent SHALL stop and return the count of tags that fit
3. THE CustomSchedulerComponent SHALL count 0px spacing before the first tag and 2px spacing before each subsequent tag
4. WHEN no categories fit within the available width THEN THE CustomSchedulerComponent SHALL return zero

### Requirement 9: Visible Categories Determination

**User Story:** As the scheduler, I want to determine exactly which category tags to display for an event based on available space, so that the display is optimal and predictable.

#### Acceptance Criteria

1. WHEN getVisibleEventCategories is called THEN THE CustomSchedulerComponent SHALL first calculate the leftover width after allocating status tag width from the available tag width
2. WHEN the leftover width cannot fit even the first category tag in icon-only mode THEN THE CustomSchedulerComponent SHALL return an empty array
3. WHEN the status tag is in Full_Label_Mode and all categories fit with full labels THEN THE CustomSchedulerComponent SHALL return all categories
4. WHEN more categories fit in icon-only mode than in full-label mode THEN THE CustomSchedulerComponent SHALL prefer icon-only mode to show more categories
5. WHEN fewer or equal categories fit in icon-only mode compared to full-label mode THEN THE CustomSchedulerComponent SHALL use full-label mode for the fitting subset
6. THE CustomSchedulerComponent SHALL slice categories from the beginning of the list up to the computed fitting count

### Requirement 10: Tag Display Mode Determination

**User Story:** As the scheduler rendering logic, I want to determine whether tags should show full labels, icon-only, or be hidden entirely, so that the UI adapts correctly to event size.

#### Acceptance Criteria

1. WHEN the event width is greater than or equal to EVENT_FULL_TAG_MIN_WIDTH (360px) THEN THE CustomSchedulerComponent SHALL allow Full_Label_Mode for status and category tags (subject to space)
2. WHEN the event width is greater than or equal to EVENT_ICON_TAG_MIN_WIDTH (150px) but less than EVENT_FULL_TAG_MIN_WIDTH THEN THE CustomSchedulerComponent SHALL render tags in Icon_Only_Mode only
3. WHEN the event width is less than EVENT_ICON_TAG_MIN_WIDTH (150px) THEN THE CustomSchedulerComponent SHALL not render any tags
4. WHEN shouldShowEventTagIconOnly returns true THEN THE canShowEventCategoryLabels method SHALL return false regardless of available width
5. WHEN canShowEventCategoryLabels is called THEN THE CustomSchedulerComponent SHALL return true only if all visible categories fit with full labels within the space remaining after the full-width status tag

### Requirement 11: Category Tag Visual Rendering

**User Story:** As a user, I want to see category tags as visually distinct colored pills on events, so that I can quickly identify event categories at a glance.

#### Acceptance Criteria

1. THE CustomSchedulerComponent SHALL render each visible Category_Tag as a pill-shaped element with rounded corners
2. THE CustomSchedulerComponent SHALL render a small colored circle (dot) inside each Category_Tag using the category's color property
3. WHEN the category has a tagBackgroundColor property THEN THE CustomSchedulerComponent SHALL use tagBackgroundColor as the pill background color
4. WHEN the category does not have a tagBackgroundColor property THEN THE CustomSchedulerComponent SHALL derive a background color from the category's color property
5. WHEN the category has a tagTextColor property THEN THE CustomSchedulerComponent SHALL use tagTextColor as the label text color
6. WHEN canShowEventCategoryLabels returns true THEN THE CustomSchedulerComponent SHALL display the category label text alongside the colored dot
7. WHEN canShowEventCategoryLabels returns false THEN THE CustomSchedulerComponent SHALL display only the colored dot without label text
8. THE CustomSchedulerComponent SHALL position Category_Tags to the right of the event content area within the tag region

### Requirement 12: Tag Rendering Order and Layout

**User Story:** As a user, I want status and category tags arranged in a consistent order, so that the layout is predictable and scannable.

#### Acceptance Criteria

1. THE CustomSchedulerComponent SHALL render the Status_Tag first (leftmost in the tag area)
2. THE CustomSchedulerComponent SHALL render Category_Tags after the Status_Tag in the order they appear in the event's categoryIds array
3. THE CustomSchedulerComponent SHALL apply 2px horizontal spacing between adjacent tags
4. WHEN no categories are visible THEN THE CustomSchedulerComponent SHALL render only the Status_Tag in the tag area

### Requirement 13: Edge Case Handling

**User Story:** As a developer, I want the tag system to handle edge cases gracefully, so that the scheduler does not break with unexpected data.

#### Acceptance Criteria

1. WHEN an event has no categories assigned (categoryIds is empty or undefined) THEN THE CustomSchedulerComponent SHALL render only the Status_Tag without any Category_Tags
2. WHEN the bookingCategories input is an empty array THEN THE CustomSchedulerComponent SHALL render only Status_Tags on events (no category tags)
3. WHEN all category tags are hidden due to insufficient space THEN THE CustomSchedulerComponent SHALL still render the Status_Tag if space permits
4. WHEN an event's categoryIds contains duplicate ids THEN THE CustomSchedulerComponent SHALL resolve each id independently (potentially showing duplicates if both match)
5. WHEN the bookingCategories input changes (categories added or removed) THEN THE CustomSchedulerComponent SHALL re-evaluate visible categories on the next change detection cycle
6. IF the event width is zero or negative THEN THE CustomSchedulerComponent SHALL not render any tags and shall not throw errors

### Requirement 14: Performance Considerations

**User Story:** As a developer, I want category tag calculations to be performant, so that the scheduler remains responsive with many events and categories.

#### Acceptance Criteria

1. THE CustomSchedulerComponent SHALL use the estimateTextWidth approximation (7.25px per character) rather than DOM measurement for text width calculation
2. THE CustomSchedulerComponent SHALL avoid DOM queries during width calculations by using computed values from the timeline scale
3. WHEN the bookingCategories input has not changed THEN THE CustomSchedulerComponent SHALL not recompute category resolutions for events whose categoryIds have not changed
4. THE Greedy_Fit_Algorithm SHALL terminate early when available width is exhausted rather than evaluating all remaining categories

### Requirement 15: Accessibility

**User Story:** As a user with assistive technology, I want category tags to be accessible, so that I can understand event categorization without relying solely on color.

#### Acceptance Criteria

1. THE CustomSchedulerComponent SHALL include the category label in the event's aria-label or tooltip regardless of whether the label is visually displayed
2. WHEN a Category_Tag is rendered in Icon_Only_Mode THEN THE CustomSchedulerComponent SHALL provide a title attribute or aria-label on the tag element containing the category label
3. THE CustomSchedulerComponent SHALL ensure the colored dot within each Category_Tag is marked as decorative (aria-hidden="true") since the label provides the semantic meaning
4. THE CustomSchedulerComponent SHALL include category information in the event tile's overall aria-label string for screen reader announcement
