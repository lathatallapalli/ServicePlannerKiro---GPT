# Requirements Document

## Introduction

This document specifies the requirements for the Booking Category Assignment feature in the Service Planner application. The feature enables planners to assign and remove booking categories to/from scheduled entries via the event context menu, and displays category tags at the appropriate scope level (order, booking-set, entry) on the job tiles and booking rows in the side panel.

This feature depends on the Booking Categories CRUD spec (for the BookingCategory model, BookingCategoriesService, and the categoryIds field on ScheduleEntry).

## Glossary

- **ServicePlannerComponent**: The Angular standalone component that orchestrates the planning workflow and hosts both the scheduler and the side panel with job/order tiles.
- **BookingCategoriesService**: The Angular injectable service providing category CRUD operations and the full categories list.
- **BookingCategory**: The data model interface with id, label, color, tagBackgroundColor, tagTextColor, appliesTo (scope), description, and isSystem.
- **BookingCategoryApplyScope**: The scope at which a category applies: 'entry' (single booking), 'booking-set' (group of related bookings for a job), or 'order' (all bookings in a work order).
- **ScheduleEntry**: The data model for a booking entry containing categoryIds (string array) linking it to categories.
- **Event_Context_Menu**: The right-click context menu displayed when the user right-clicks on a scheduler event, managed by the ServicePlannerComponent.
- **Category_Flyout**: A sub-menu within the Event_Context_Menu that lists all available categories as checkbox items for toggling assignment.
- **Category_Tag**: A small colored pill/badge displayed on panel tiles showing the category's color and optionally its label.
- **Affected_Entries**: The set of ScheduleEntry records that a category toggle should affect, determined by the category's appliesTo scope and the context event.

## Requirements

### Requirement 1: Category Flyout in Event Context Menu

**User Story:** As a planner, I want a category sub-menu in the event right-click context menu, so that I can quickly assign or remove categories from a booking without opening a separate dialog.

#### Acceptance Criteria

1. THE Event_Context_Menu SHALL include a "Categories" menu item that expands a Category_Flyout sub-menu when clicked
2. WHEN the user clicks the "Categories" menu item THEN THE ServicePlannerComponent SHALL toggle the `isCategoryFlyoutOpen` state and display/hide the Category_Flyout
3. THE Category_Flyout SHALL list all categories from BookingCategoriesService as menu items with `role="menuitemcheckbox"`
4. EACH category menu item in the Category_Flyout SHALL display the category label and a color indicator
5. THE Category_Flyout SHALL include a "Manage categories" item at the bottom that navigates to `/booking-categories`
6. WHEN the user clicks "Manage categories" THEN THE ServicePlannerComponent SHALL close the context menu and navigate to the booking categories list view

### Requirement 2: Category Applied State Detection

**User Story:** As a planner, I want to see which categories are currently applied to a booking in the context menu, so that I know what's already assigned before making changes.

#### Acceptance Criteria

1. THE ServicePlannerComponent SHALL provide an `isContextCategoryApplied(category: BookingCategory)` method that determines if the category is currently applied to the context event
2. WHEN all affected entries for the category's scope have the category's id in their categoryIds THEN `isContextCategoryApplied` SHALL return true
3. WHEN no affected entries exist or not all affected entries have the category's id THEN `isContextCategoryApplied` SHALL return false
4. EACH category menu item in the flyout SHALL display a checkmark or checked state via `aria-checked` when the category is applied

### Requirement 3: Category Toggle on Context Event

**User Story:** As a planner, I want to toggle a category on/off for a booking via the context menu, so that I can quickly classify my bookings.

#### Acceptance Criteria

1. THE ServicePlannerComponent SHALL provide a `toggleContextCategory(category: BookingCategory, domEvent?: Event)` method
2. WHEN `toggleContextCategory` is called and the category is currently applied to all affected entries THEN THE method SHALL remove the category id from the categoryIds array of each affected entry
3. WHEN `toggleContextCategory` is called and the category is not fully applied THEN THE method SHALL add the category id to the categoryIds array of each affected entry
4. WHEN the category is toggled THEN THE ServicePlannerComponent SHALL persist the updated entries via the ScheduleRepository
5. WHEN the category is toggled THEN THE ServicePlannerComponent SHALL refresh the scheduler events to reflect the change
6. THE `toggleContextCategory` method SHALL call `stopPropagation()` on the DOM event to prevent the context menu from closing

### Requirement 4: Affected Entries Resolution by Scope

**User Story:** As a developer, I want the category toggle to affect the correct entries based on the category's appliesTo scope, so that order-level categories apply to all entries in the order and entry-level categories apply only to the specific entry.

#### Acceptance Criteria

1. WHEN the category's appliesTo is 'entry' THEN THE ServicePlannerComponent SHALL identify only the single ScheduleEntry associated with the context event as the affected entry
2. WHEN the category's appliesTo is 'booking-set' THEN THE ServicePlannerComponent SHALL identify all ScheduleEntry records belonging to the same booking set as the context event
3. WHEN the category's appliesTo is 'order' THEN THE ServicePlannerComponent SHALL identify all ScheduleEntry records belonging to the same work order as the context event
4. THE ServicePlannerComponent SHALL provide a private `getCategoryAffectedEntries(event, category)` method that implements this resolution logic

### Requirement 5: Order-Level Category Tags on Panel Tiles

**User Story:** As a planner, I want to see order-level category tags on the order tile in the side panel, so that I can immediately identify the classification of an entire order.

#### Acceptance Criteria

1. THE ServicePlannerComponent SHALL provide a `getOrderCategories(order)` method that returns all BookingCategory objects with appliesTo 'order' that are assigned to any entry belonging to that order
2. THE side panel order tile SHALL render Category_Tags for each category returned by `getOrderCategories`
3. EACH Category_Tag SHALL display a colored dot using the category's color property
4. THE Category_Tags SHALL be displayed inline next to or below the order reference/title

### Requirement 6: Job/Booking-Set Level Category Tags on Panel Tiles

**User Story:** As a planner, I want to see booking-set level category tags on job tiles, so that I can identify classifications that apply to a group of related bookings.

#### Acceptance Criteria

1. THE ServicePlannerComponent SHALL provide a `getJobBookingSetCategories(job, order)` method that collects all BookingCategory objects with appliesTo 'booking-set' from booking sets belonging to the specified job and order
2. THE side panel job tile SHALL render Category_Tags for each category returned by `getJobBookingSetCategories`
3. THE method SHALL deduplicate categories by id (a category appearing in multiple booking sets should be shown only once)

### Requirement 7: Entry-Level Category Tags on Booking Rows

**User Story:** As a planner, I want to see entry-level category tags on individual booking rows, so that I can distinguish specific bookings within a job.

#### Acceptance Criteria

1. THE ServicePlannerComponent SHALL provide a `getEntryCategoriesForBooking(booking: JobBooking)` method that returns all BookingCategory objects with appliesTo 'entry' assigned to the specific booking's entry
2. THE ServicePlannerComponent SHALL provide a `getEntryCategories(entry: ScheduleEntry)` method that returns entry-scoped categories for a given entry
3. THE side panel booking row SHALL render Category_Tags for each category returned by `getEntryCategoriesForBooking`
4. WHEN a booking has no entry-level categories assigned THEN no Category_Tags SHALL be rendered on that booking row

### Requirement 8: Category Scope Filtering Helper

**User Story:** As a developer, I want a helper that filters categories by scope from a set of entries, so that the resolution logic is consistent across order, job, and entry levels.

#### Acceptance Criteria

1. THE ServicePlannerComponent SHALL provide a private `getCategoriesForEntriesByScope(entries: ScheduleEntry[], scope: BookingCategoryApplyScope)` method
2. THE method SHALL iterate all categoryIds across the provided entries, resolve each via BookingCategoriesService.getById, and include only those whose appliesTo matches the specified scope
3. THE method SHALL deduplicate categories by id, returning each unique category only once
4. WHEN a categoryId does not resolve to a valid BookingCategory THEN THE method SHALL skip it without error

### Requirement 9: Category Tag Visual Styling on Panel

**User Story:** As a planner, I want category tags on the side panel to be visually consistent and compact, so that they don't overwhelm the tile layout.

#### Acceptance Criteria

1. EACH Category_Tag on the panel SHALL be styled as a small colored dot/pill using a CSS custom property `--category-color` bound to the category's color
2. THE Category_Tag SHALL have a `title` attribute and `aria-label` attribute set to the category label for accessibility
3. THE Category_Tags SHALL be laid out inline with a small gap between them (e.g., 4px)
4. THE Category_Tag styling SHALL be defined in the service-planner component SCSS using a class like `service-planner__booking-category-tag`

### Requirement 10: Context Menu State Cleanup

**User Story:** As a planner, I want the category flyout to reset when the context menu closes, so that stale state doesn't carry over to the next right-click.

#### Acceptance Criteria

1. WHEN the event context menu closes (via clicking outside, Escape, or selecting a non-category action) THEN THE ServicePlannerComponent SHALL set `isCategoryFlyoutOpen` to false
2. WHEN a new event context menu opens THEN THE ServicePlannerComponent SHALL ensure `isCategoryFlyoutOpen` starts as false
3. THE context menu close handler SHALL reset the flyout state before nulling the context menu payload

### Requirement 11: Accessibility

**User Story:** As a user with assistive technology, I want the category flyout and tags to be accessible, so that I can manage and understand category assignments using keyboard and screen reader.

#### Acceptance Criteria

1. THE "Categories" menu item SHALL have `aria-haspopup="true"` and `aria-expanded` reflecting the flyout state
2. EACH category item in the flyout SHALL have `role="menuitemcheckbox"` and `aria-checked` reflecting the applied state
3. THE Category_Flyout SHALL support keyboard navigation (arrow keys to move between items, Enter/Space to toggle)
4. EACH Category_Tag on the panel SHALL have an `aria-label` attribute set to the category label so screen readers can announce it
5. THE colored dot within each Category_Tag SHALL be decorative (conveyed via CSS background, not meaningful without the label)

