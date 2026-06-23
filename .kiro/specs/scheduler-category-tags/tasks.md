# Implementation Plan: Scheduler Category Tags

## Overview

This plan implements category tag rendering on the custom scheduler's event tiles. The work centers on the `CustomSchedulerComponent` — adding width calculation methods, a greedy tag fitting algorithm, and template/style changes to render colored category pills. The `ServicePlannerComponent` gets a simple binding to pass categories from the service.

**Prerequisite**: The `booking-categories-crud` spec must be complete (providing `BookingCategory` model, `BookingCategoriesService`, and `categoryIds` on `ScheduleEntry`).

**Language**: TypeScript (Angular 19+)

## Tasks

- [ ] 1. Add constants and input to CustomSchedulerComponent
  - [ ] 1.1 Add width calculation constants and bookingCategories input
    - Add constants at the top of `custom-scheduler.component.ts`: `EVENT_FULL_TAG_MIN_WIDTH = 360`, `EVENT_ICON_TAG_MIN_WIDTH = 150`, `EVENT_CONTENT_MAX_WIDTH = 120`, `EVENT_CONTENT_PADDING = 40`, `EVENT_CONTENT_MAX_RESERVE = 160`
    - Add `@Input() bookingCategories: BookingCategory[] = []` to the component class
    - Import `BookingCategory` from the schedule model (or wherever booking-categories-crud places it)
    - _Requirements: 1.1_

- [ ] 2. Implement core width calculation methods
  - [ ] 2.1 Implement estimateTextWidth and getEventContentReserveWidth
    - Add `estimateTextWidth(text: string, pxPerChar = 7.25): number` method
    - Add `getEventContentReserveWidth(event: SchedulerEvent): number` method that:
      - Gets job description, detail, and customer/vehicle text widths via estimateTextWidth
      - Takes the max, adds EVENT_CONTENT_PADDING
      - Caps at min(EVENT_CONTENT_MAX_RESERVE, eventWidth)
      - Ensures at least 120px
      - Ensures at most eventWidth - 60
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 14.1_

  - [ ] 2.2 Implement getEventAvailableTagWidth
    - Add `getEventAvailableTagWidth(event: SchedulerEvent): number` returning `max(eventWidth - contentReserve, 0)`
    - _Requirements: 5.1, 5.2_

  - [ ] 2.3 Implement getStatusTagWidth and getCategoryTagWidth
    - Add `getStatusTagWidth(event: SchedulerEvent, withLabel: boolean): number` using formula: `max(16 + 16 + (withLabel ? 4 + labelWidth : 0), 32)`
    - Add `getCategoryTagWidth(category: BookingCategory, withLabel: boolean): number` using formula: `max(16 + 16 + (withLabel ? 4 + labelWidth : 0), 24)`
    - _Requirements: 6.1, 6.2, 7.1, 7.2, 7.3, 7.4_

  - [ ]* 2.4 Write property tests for width calculations (Properties 2, 3, 4)
    - **Property 2: Content reserve width bounds**
    - **Property 3: Available tag width is non-negative and correctly derived**
    - **Property 4: Category tag width formula and minimum**
    - **Validates: Requirements 4.5, 4.6, 4.7, 5.1, 5.2, 7.1, 7.2, 7.3, 7.4**

- [ ] 3. Implement category resolution and greedy fit algorithm
  - [ ] 3.1 Implement getEventCategories
    - Add `getEventCategories(event: SchedulerEvent): BookingCategory[]` that:
      - Reads `event.meta?.entry?.categoryIds`
      - Maps each ID to matching BookingCategory from `this.bookingCategories`
      - Filters out unmatched IDs
      - Preserves categoryIds order
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ] 3.2 Implement getMaxFittingCategoryCount
    - Add `getMaxFittingCategoryCount(categories: BookingCategory[], availableWidth: number, withLabel: boolean): number`
    - Iterate categories in order, accumulate tag widths + 2px spacing (0 before first)
    - Stop when next tag would exceed available width
    - Return count of fitting tags
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 14.4_

  - [ ]* 3.3 Write property tests for resolution and greedy fit (Properties 1, 5)
    - **Property 1: Category resolution correctness and order preservation**
    - **Property 5: Greedy fit count is maximal**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 8.1, 8.2, 8.3, 8.4**

- [ ] 4. Implement visible categories and display mode logic
  - [ ] 4.1 Implement getVisibleEventCategories
    - Add `getVisibleEventCategories(event: SchedulerEvent): BookingCategory[]` that:
      - Returns empty if event width < EVENT_ICON_TAG_MIN_WIDTH
      - Allocates status tag width from available tag width
      - Computes fitting counts for full-label and icon-only modes
      - Selects mode that shows more categories (ties → full-label)
      - Returns prefix slice of resolved categories
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 6.3, 6.4, 6.5_

  - [ ] 4.2 Implement canShowEventCategoryLabels
    - Add `canShowEventCategoryLabels(event: SchedulerEvent): boolean` that:
      - Returns false if shouldShowEventTagIconOnly is true
      - Returns false if event width < EVENT_FULL_TAG_MIN_WIDTH
      - Returns true only if full-label count >= icon-only count and > 0
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ]* 4.3 Write property tests for visible categories and mode selection (Properties 6, 7, 8)
    - **Property 6: Visible categories mode selection maximizes count**
    - **Property 7: Display mode thresholds are respected**
    - **Property 8: Visible categories are always a prefix of resolved categories**
    - **Validates: Requirements 9.3, 9.4, 9.5, 9.6, 10.1, 10.2, 10.3, 10.4, 12.2**

- [ ] 5. Checkpoint - Verify core logic
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Add template rendering for category tags
  - [ ] 6.1 Update CustomSchedulerComponent template to render category tags
    - In the event tile tag area (after the existing status tag), add an `ng-container` iterating `getVisibleEventCategories(event)`
    - Render each category as a `.scheduler-event__category-tag` span containing:
      - A `.scheduler-event__category-dot` span with `[style.background-color]="category.color"` and `aria-hidden="true"`
      - A `.scheduler-event__category-label` span (conditional on `canShowEventCategoryLabels(event)`) with `[style.color]="category.tagTextColor || category.color"`
    - Set `[style.background-color]` on the tag to `category.tagBackgroundColor` or derive from `category.color`
    - Add `[title]="category.label"` and `[attr.aria-label]="category.label"` for accessibility
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 12.1, 12.2, 12.3, 12.4, 15.2, 15.3_

  - [ ] 6.2 Update event tile aria-label to include category information
    - Modify `getEventTileAriaLabel(event)` to append category labels (comma-separated) to the aria-label string
    - _Requirements: 15.1, 15.4_

- [ ] 7. Add SCSS styles for category tags
  - [ ] 7.1 Add category tag styles to scheduler SCSS
    - Add `.scheduler-event__category-tag` styles: inline-flex, center-aligned, gap 4px, padding 0 8px, border-radius 12px, height 20px, font-size 11px, whitespace nowrap, margin-left 2px (0 for first-child)
    - Add `.scheduler-event__category-dot` styles: 8px × 8px circle, flex-shrink 0
    - Add `.scheduler-event__category-label` styles: overflow hidden, text-overflow ellipsis, max-width 80px
    - _Requirements: 11.1, 11.2, 12.3_

- [ ] 8. Wire ServicePlannerComponent to pass categories
  - [ ] 8.1 Add bookingCategories binding in ServicePlannerComponent
    - Add a getter `get schedulerBookingCategories(): BookingCategory[]` that returns `this.bookingCategoriesService.getAll()`
    - Inject `BookingCategoriesService` if not already injected
    - Bind `[bookingCategories]="schedulerBookingCategories"` on the `<app-custom-scheduler>` element in the template
    - _Requirements: 1.2, 1.3_

- [ ] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- This spec depends on `booking-categories-crud` being complete — the `BookingCategory` interface, `BookingCategoriesService`, and `categoryIds` field on `ScheduleEntry` must exist before implementation begins
- The existing `getEventWidth`, `shouldShowEventTag`, `shouldShowEventTagIconOnly`, `getEventTagLabel`, `getEventJobDescription`, `getEventDetail`, and `getEventCustomerVehicleDetail` methods are already on the component and will be reused
- All new methods are pure calculations (no DOM queries, no side effects) making them straightforward to unit test

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3"] },
    { "id": 2, "tasks": ["3.1", "3.2", "2.4"] },
    { "id": 3, "tasks": ["4.1", "4.2", "3.3"] },
    { "id": 4, "tasks": ["4.3"] },
    { "id": 5, "tasks": ["6.1", "6.2", "7.1", "8.1"] },
    { "id": 6, "tasks": ["9"] }
  ]
}
```
