# Implementation Plan: Booking Category Assignment

## Overview

This implementation adds category assignment functionality to the service planner's event context menu and displays category tags on the side panel's order tiles, job tiles, and booking rows. The work modifies the existing `ServicePlannerComponent` (TS, HTML, SCSS) and assumes `BookingCategoriesService` and the `categoryIds` field on `ScheduleEntry` are already in place from the booking-categories-crud spec.

## Tasks

- [ ] 1. Add categoryIds field to ScheduleEntry model
  - [ ] 1.1 Add optional `categoryIds?: string[]` property to the ScheduleEntry interface
    - File: `webapp/src/app/core/models/schedule.model.ts`
    - Add `categoryIds?: string[];` to the ScheduleEntry interface
    - _Requirements: 1.1 (from booking-categories-crud Req 1.4)_

- [ ] 2. Implement category state and helper methods on ServicePlannerComponent
  - [ ] 2.1 Add isCategoryFlyoutOpen state and bookingCategories getter
    - File: `webapp/src/app/features/service-planner/service-planner.component.ts`
    - Add `isCategoryFlyoutOpen = false;` property
    - Add `get bookingCategories(): BookingCategory[]` that returns `this.bookingCategoriesService.getAll()`
    - Inject `BookingCategoriesService` in the constructor if not already injected
    - _Requirements: 1.1, 1.3_

  - [ ] 2.2 Implement toggleCategoryFlyout and openCategoryManagement methods
    - `toggleCategoryFlyout(event?: Event)`: call `event?.stopPropagation()`, toggle `isCategoryFlyoutOpen`
    - `openCategoryManagement()`: set `eventContextMenu = null`, `isCategoryFlyoutOpen = false`, navigate to `/booking-categories`
    - _Requirements: 1.2, 1.5, 1.6_

  - [ ] 2.3 Implement getCategoryAffectedEntries private method
    - Accept `(contextMenu: { eventId: string } | null, category: BookingCategory): ScheduleEntry[]`
    - For 'entry' scope: return only the single entry matching `contextMenu.eventId`
    - For 'booking-set' scope: return all entries with same `bookingSetId` as the context entry
    - For 'order' scope: return all entries with same `workOrderReference` as the context entry
    - Return `[]` if contextMenu is null or entry not found
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ] 2.4 Implement isContextCategoryApplied method
    - Call `getCategoryAffectedEntries` to get affected entries
    - Return `true` only if all affected entries contain the category id in their `categoryIds`
    - Return `false` if no affected entries or not all have the id
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 2.5 Implement toggleContextCategory method
    - Accept `(category: BookingCategory, domEvent?: Event)`
    - Call `domEvent?.stopPropagation()`
    - Get affected entries via `getCategoryAffectedEntries`
    - If currently applied (all have it): remove category id from each entry's categoryIds
    - If not fully applied: add category id to each entry's categoryIds (if not already present)
    - Persist each modified entry via `this.scheduleRepository.assign(entry).subscribe()`
    - Call `refreshSchedulerEvents()` or equivalent to update the view
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ] 2.6 Implement getCategoriesForEntriesByScope private helper
    - Accept `(entries: ScheduleEntry[], scope: BookingCategoryApplyScope): BookingCategory[]`
    - Iterate all categoryIds across entries, resolve via `bookingCategoriesService.getById()`
    - Include only categories whose `appliesTo` matches the scope
    - Deduplicate by category id using a Set
    - Skip unresolvable categoryIds silently
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ] 2.7 Implement panel tag helper methods
    - `getOrderCategories(order)`: filter `allScheduleEntries` by `workOrderReference === order.referenceNumber`, call `getCategoriesForEntriesByScope(entries, 'order')`
    - `getJobBookingSetCategories(job, order)`: filter entries by `jobId === job.id && workOrderReference === order.referenceNumber`, call with `'booking-set'`
    - `getEntryCategoriesForBooking(booking: JobBooking)`: find entry by `booking.entryId`, call with `'entry'`
    - `getEntryCategories(entry: ScheduleEntry)`: call `getCategoriesForEntriesByScope([entry], 'entry')`
    - _Requirements: 5.1, 6.1, 6.3, 7.1, 7.2_

  - [ ] 2.8 Add context menu state cleanup
    - In the existing context menu close handler: set `isCategoryFlyoutOpen = false` before nulling `eventContextMenu`
    - In `onEventContextMenu`: set `isCategoryFlyoutOpen = false` at the start before setting the new menu position
    - _Requirements: 10.1, 10.2, 10.3_

- [ ] 3. Checkpoint — Verify TypeScript compiles
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Add Category Flyout to Event Context Menu template
  - [ ] 4.1 Add "Categories" button with flyout toggle to the context menu
    - File: `webapp/src/app/features/service-planner/service-planner.component.html`
    - Add a `<button>` with `role="menuitem"`, `aria-haspopup="true"`, `[attr.aria-expanded]="isCategoryFlyoutOpen"`, click handler `toggleCategoryFlyout($event)`
    - Display text "Categories" with a chevron or category icon
    - Place it before the "Cancel" (delete) button in the context menu
    - _Requirements: 1.1, 11.1_

  - [ ] 4.2 Add the flyout sub-menu with category checkbox items
    - Conditionally render the flyout `@if (isCategoryFlyoutOpen)` as a nested div below the Categories button
    - Use `role="menu"` on the flyout container
    - Iterate `bookingCategories` with `@for`
    - Each item: `role="menuitemcheckbox"`, `[attr.aria-checked]="isContextCategoryApplied(category)"`, click calls `toggleContextCategory(category, $event)`
    - Display category color indicator (small circle/dot with `[style.background]="category.color"`) and category label text
    - _Requirements: 1.3, 1.4, 2.4, 11.2_

  - [ ] 4.3 Add "Manage categories" link at the bottom of the flyout
    - Add a button/link with text "Manage categories" at the end of the flyout items
    - Click handler calls `openCategoryManagement()`
    - Style with a top border separator matching existing context menu item styling
    - _Requirements: 1.5, 1.6_

- [ ] 5. Add Category Tags to Side Panel tiles
  - [ ] 5.1 Add order-level category tags to order card template
    - File: `webapp/src/app/features/service-planner/service-planner.component.html`
    - Inside the `#orderCard` template, after the vehicle/customer info area, add a tags container
    - Iterate `getOrderCategories(order)` with `@for`
    - Each tag: `<span class="service-planner__booking-category-tag" [style.--category-color]="category.color" [attr.aria-label]="category.label" [title]="category.label"></span>`
    - Only render the container `@if (getOrderCategories(order).length)`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 9.1, 9.2, 11.4_

  - [ ] 5.2 Add booking-set level category tags to job tile
    - Inside the job tile section (within the `@for (job of getJobsForOrder(order))` block), after the job title row
    - Iterate `getJobBookingSetCategories(job, order)` with `@for`
    - Same tag span pattern as order tags
    - Only render if categories exist
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ] 5.3 Add entry-level category tags to booking rows
    - Inside the booking row (within the `@for (booking of bookingSet.bookings)` block), after the resource name span
    - Iterate `getEntryCategoriesForBooking(booking)` with `@for`
    - Same tag span pattern
    - Only render if categories exist (requirement 7.4 — no tags when empty)
    - _Requirements: 7.1, 7.3, 7.4_

- [ ] 6. Add SCSS for category tag styling
  - [ ] 6.1 Add .service-planner__booking-category-tag styles
    - File: `webapp/src/app/features/service-planner/service-planner.component.scss`
    - Define the tag as a small colored dot/pill:
      ```scss
      .service-planner__booking-category-tag {
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--category-color, #8d8d8d);
        flex: 0 0 auto;
      }
      ```
    - Add a container class for inline layout with 4px gap:
      ```scss
      .service-planner__booking-category-tags {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        flex-wrap: wrap;
      }
      ```
    - _Requirements: 9.1, 9.3, 9.4, 11.5_

  - [ ] 6.2 Add flyout sub-menu styling
    - Style the flyout container with appropriate positioning (absolute, below the Categories button)
    - Style category items with the color dot, label, and check indicator
    - Match existing context menu styling (same background, font, padding)
    - _Requirements: 1.3, 1.4_

- [ ] 7. Checkpoint — Verify template renders and compiles
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 8. Write property-based tests for category assignment logic
  - [ ]* 8.1 Write property test: Toggle round-trip restores original state
    - **Property 1: Toggle idempotence — double toggle restores original state**
    - Generate random entries with random categoryIds, a random category, toggle on then off, assert categoryIds restored
    - **Validates: Requirements 3.2, 3.3**

  - [ ]* 8.2 Write property test: Scope resolution returns correct entries
    - **Property 2: Scope resolution correctness — affected entries match scope**
    - Generate entries with various bookingSetId/workOrderReference, pick a scope, assert getCategoryAffectedEntries returns the correct subset
    - **Validates: Requirements 4.1, 4.2, 4.3**

  - [ ]* 8.3 Write property test: isContextCategoryApplied reflects actual data
    - **Property 3: Applied state consistency**
    - Generate entries with known categoryIds, assert isContextCategoryApplied matches manual all-check
    - **Validates: Requirements 2.2, 2.3**

  - [ ]* 8.4 Write property test: getCategoriesForEntriesByScope filters and deduplicates correctly
    - **Property 4: Category scope filtering and deduplication**
    - Generate entries with mixed-scope categoryIds, assert only matching scope returned, no duplicates
    - **Validates: Requirements 8.1, 8.2, 8.3**

  - [ ]* 8.5 Write property test: Toggle correctly adds or removes category
    - **Property 5: Toggle add/remove correctness**
    - Generate partially/fully applied states, toggle once, assert all-present or all-absent
    - **Validates: Requirements 3.2, 3.3**

- [ ]* 9. Write unit tests for UI interactions and accessibility
  - [ ]* 9.1 Test flyout toggle behavior
    - Verify clicking "Categories" toggles isCategoryFlyoutOpen
    - Verify flyout resets on context menu close
    - Verify flyout resets when new context menu opens
    - _Requirements: 1.2, 10.1, 10.2, 10.3_

  - [ ]* 9.2 Test accessibility attributes
    - Verify aria-haspopup and aria-expanded on Categories button
    - Verify role="menuitemcheckbox" and aria-checked on category items
    - Verify aria-label on category tags
    - _Requirements: 11.1, 11.2, 11.4_

  - [ ]* 9.3 Test navigation to category management
    - Verify openCategoryManagement closes menu and navigates to /booking-categories
    - _Requirements: 1.5, 1.6_

- [ ] 10. Final checkpoint — Verify full build passes
  - Ensure all tests pass, ask the user if questions arise.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "2.8"] },
    { "id": 2, "tasks": ["3"] },
    { "id": 3, "tasks": ["4.1", "4.2", "4.3", "5.1", "5.2", "5.3", "6.1", "6.2"] },
    { "id": 4, "tasks": ["7"] },
    { "id": 5, "tasks": ["8.1", "8.2", "8.3", "8.4", "8.5", "9.1", "9.2", "9.3"] },
    { "id": 6, "tasks": ["10"] }
  ]
}
```

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- This spec depends on booking-categories-crud being completed first (BookingCategoriesService, BookingCategory model, categoryIds on ScheduleEntry)
- The implementation modifies the existing ServicePlannerComponent rather than creating new components
- Property tests use `fast-check` library for random input generation (minimum 100 iterations each)
- The context menu already has an established styling pattern — new items should match existing inline styles
