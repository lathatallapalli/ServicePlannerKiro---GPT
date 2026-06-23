# Implementation Plan: Booking Categories CRUD

## Overview

This plan implements the Booking Categories CRUD feature incrementally: data model first, then service, then list view, card view, and finally app shell integration. Each step produces compilable code that builds on the previous step. The implementation uses Angular 19+ standalone components with Carbon Design System styling.

## Tasks

- [ ] 1. Create data model and service
  - [x] 1.1 Create the BookingCategory model and ApplyScope type
    - Create `webapp/src/app/core/models/booking-category.model.ts`
    - Define `BookingCategoryApplyScope` as `'entry' | 'booking-set' | 'order'`
    - Define `BookingCategory` interface with required fields (id, label, color, appliesTo) and optional fields (tagBackgroundColor, tagTextColor, description, isSystem)
    - _Requirements: 1.1, 1.2, 1.3_

  - [-] 1.2 Create the BookingCategoriesService with localStorage persistence
    - Create `webapp/src/app/features/booking-categories/booking-categories.service.ts`
    - Implement `@Injectable({ providedIn: 'root' })` service
    - Storage key: `service-planner.booking-categories.v1`
    - Implement `loadFromStorage()`: parse localStorage JSON, fall back to defaults if missing/invalid/empty
    - Implement `persist()`: serialize categories to localStorage
    - Implement `getDefaultCategories()`: return 5 system categories (Warranty/#8A3FFC/order, Waiting for parts/#F1C21B/order, Customer priority/#DA1E28/order, Diagnosis/#0F62FE/booking-set, Internal/#198038/entry)
    - Handle localStorage unavailability gracefully (try/catch)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.5, 3.6_

  - [~] 1.3 Implement CRUD methods on BookingCategoriesService
    - `getAll()`: return shallow copy array (spread each item)
    - `getById(id)`: find by id, return shallow copy or undefined
    - `createNewCategory()`: generate id as `cat-${Date.now()}`, set defaults (label: 'New category', appliesTo: 'entry', color from palette rotation, description: ''), append, persist, return copy
    - `update(id, changes)`: find by id, merge changes (spread), persist, return copy; return undefined if not found
    - `delete(id)`: find by id, skip if isSystem or not found, remove from array, persist
    - All return methods return shallow copies (not references)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 3.2, 3.3, 3.4_

  - [ ]* 1.4 Write property tests for BookingCategoriesService
    - **Property 1: Persistence round-trip**
    - **Property 2: Immutability of returned values**
    - **Property 3: Create appends with unique ID and defaults**
    - **Property 4: Update merges and preserves unchanged properties**
    - **Property 5: System categories cannot be deleted**
    - **Property 6: User categories can be deleted**
    - **Validates: Requirements 3.1, 3.5, 4.1, 4.2, 4.4, 5.1, 5.2, 5.4, 6.1, 6.4, 7.1, 7.2**

- [~] 2. Checkpoint - Verify model and service compile
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Create BookingCategoriesListComponent
  - [~] 3.1 Scaffold the list component files
    - Create `webapp/src/app/features/booking-categories/booking-categories-list.component.ts`
    - Create `webapp/src/app/features/booking-categories/booking-categories-list.component.html`
    - Create `webapp/src/app/features/booking-categories/booking-categories-list.component.scss`
    - Standalone component importing `CommonModule`, `GenericListComponent`
    - Inject `BookingCategoriesService` and `Router`
    - _Requirements: 8.1_

  - [~] 3.2 Implement list columns and data binding
    - Define columns: label (sortable, filterable), color (with formatter), appliesTo (with formatter mapping scope to display label), description
    - Map `getAll()` result to row data on init
    - Implement search filtering: match term against label, description, appliesTo display label, and color (case-insensitive)
    - _Requirements: 8.2, 8.3_

  - [~] 3.3 Implement toolbar actions and row actions
    - Add toolbar action: click triggers `createNewCategory()` and refreshes list
    - Edit toolbar action: enables inline editing mode (set editableCell)
    - Save toolbar action: deactivates inline editing
    - Delete toolbar action: delete selected non-system categories via service, refresh list
    - Row action 'launch': navigate to `/booking-categories/${row.id}`
    - Handle selection changes to enable/disable Delete button
    - _Requirements: 8.4, 8.5, 8.6, 9.1, 9.2, 9.3_

  - [ ]* 3.4 Write property test for search filtering
    - **Property 7: Search filter correctness**
    - **Validates: Requirements 8.3**

- [ ] 4. Create BookingCategoryCardComponent
  - [~] 4.1 Scaffold the card component files
    - Create `webapp/src/app/features/booking-categories/booking-category-card.component.ts`
    - Create `webapp/src/app/features/booking-categories/booking-category-card.component.html`
    - Create `webapp/src/app/features/booking-categories/booking-category-card.component.scss`
    - Standalone component importing `CommonModule`, `FormsModule`, Carbon components as needed
    - Inject `BookingCategoriesService`, `ActivatedRoute`, `Router`
    - _Requirements: 10.1_

  - [~] 4.2 Implement category loading and redirect logic
    - Read `categoryId` from route params
    - Load category via `getById(categoryId)`
    - If category not found, redirect to `/booking-categories`
    - Populate local form state from loaded category
    - _Requirements: 10.1, 10.2_

  - [~] 4.3 Implement form fields with system category restrictions
    - Label input (always editable)
    - AppliesTo select dropdown with options: entry, booking-set, order (disabled for system categories)
    - Description textarea (always editable)
    - Color section (disabled for system categories)
    - _Requirements: 10.3, 10.4, 10.5_

  - [~] 4.4 Implement color selection with predefined palette and custom mode
    - Define predefined color palette (Blue, Cyan, Magenta, Purple, Red, Teal, Green, Yellow, Orange) with derived tagBackground and tagText colors
    - Radio/dropdown selection for predefined colors
    - Custom mode: show hex inputs for tagBackgroundColor and tagTextColor
    - Live tag preview showing label with background/text colors
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [~] 4.5 Implement contrast ratio calculation and warning
    - Create utility function `computeContrastRatio(bg: string, text: string): number`
    - Parse hex colors to RGB, compute relative luminance, compute ratio
    - Display warning when ratio < 4.5:1
    - Use ARIA live region (role="alert") for warning accessibility
    - _Requirements: 11.5, 14.3_

  - [~] 4.6 Implement save, save-and-close, and back/close navigation
    - Save button: call `service.update(id, formState)` to persist
    - Save & Close button: persist then navigate to `/booking-categories`
    - Back/Close button: navigate to `/booking-categories` without saving
    - _Requirements: 12.1, 12.2, 12.3_

  - [ ]* 4.7 Write property test for contrast ratio calculation
    - **Property 8: Contrast ratio warning accuracy**
    - **Validates: Requirements 11.5**

- [~] 5. Checkpoint - Verify list and card components compile
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. App shell integration
  - [~] 6.1 Register routes in app.routes.ts
    - Add route `{ path: 'booking-categories', component: BookingCategoriesListComponent }`
    - Add route `{ path: 'booking-categories/:categoryId', component: BookingCategoryCardComponent }`
    - Add necessary imports
    - _Requirements: 13.1, 13.2_

  - [~] 6.2 Update App shell for title and navigation
    - Add page detection signals: `isBookingCategoriesListPage`, `isBookingCategoryCardPage`
    - In `updateShellForUrl()`: set title 'Booking categories' for list, 'Category' for card
    - In `closeCurrentSubpage()`: list → navigate to `/service-planner`; card → navigate to `/booking-categories`
    - _Requirements: 13.3, 13.4, 13.5, 13.6_

- [ ] 7. Accessibility pass
  - [~] 7.1 Ensure keyboard navigation and ARIA attributes
    - Verify GenericListComponent provides keyboard navigation for list rows (already built-in)
    - Add `aria-label` attributes to interactive elements in list toolbar
    - Add `for`/`aria-labelledby` associations on card form inputs
    - Ensure color dropdown is keyboard-operable (Enter/Space to open, arrows to navigate, Escape to close)
    - _Requirements: 14.1, 14.2, 14.4, 14.5_

- [~] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The project uses TypeScript throughout with Angular 19+ standalone components
- The GenericListComponent already exists and provides table rendering, search, selection, toolbar/row actions, and inline editing capabilities
- Reference demo branch commit 47ae584 for implementation patterns during execution
- `fast-check` should be installed for property-based tests (if not already in devDependencies)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["1.4"] },
    { "id": 4, "tasks": ["3.1"] },
    { "id": 5, "tasks": ["3.2", "3.3"] },
    { "id": 6, "tasks": ["3.4"] },
    { "id": 7, "tasks": ["4.1"] },
    { "id": 8, "tasks": ["4.2", "4.3"] },
    { "id": 9, "tasks": ["4.4", "4.5", "4.6"] },
    { "id": 10, "tasks": ["4.7"] },
    { "id": 11, "tasks": ["6.1", "6.2"] },
    { "id": 12, "tasks": ["7.1"] }
  ]
}
```
