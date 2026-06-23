# Requirements Document

## Introduction

This document specifies the requirements for the Booking Categories CRUD feature in the Service Planner application. Booking categories are labels/tags assigned to schedule entries (bookings) to classify and visually distinguish them. The feature provides full lifecycle management of categories including creation, reading, updating, and deletion, backed by localStorage persistence. It includes a list view for browsing all categories and a detail card view for editing individual categories.

## Glossary

- **BookingCategoriesService**: The Angular injectable service (providedIn: root) responsible for managing the lifecycle of booking categories and persisting them to localStorage.
- **BookingCategoriesListComponent**: The Angular standalone component that displays all booking categories in a filterable, editable list/grid at route `/booking-categories`.
- **BookingCategoryCardComponent**: The Angular standalone component that displays and allows editing of a single booking category at route `/booking-categories/:categoryId`.
- **BookingCategory**: The data model interface representing a single category with properties: id, label, color, tagBackgroundColor, tagTextColor, appliesTo, description, and isSystem.
- **BookingCategoryApplyScope**: A TypeScript union type (`'entry' | 'booking-set' | 'order'`) indicating which level of the scheduling hierarchy the category applies to.
- **System_Category**: A BookingCategory with `isSystem: true` that represents a built-in default category which cannot be deleted.
- **User_Category**: A BookingCategory without `isSystem: true` (or `isSystem: false/undefined`) that was created by the user and can be freely modified and deleted.
- **LocalStorage_Store**: The browser localStorage entry under key `service-planner.booking-categories.v1` used to persist the categories array as JSON.
- **App_Shell**: The application shell responsible for route registration, title management, breadcrumbs, and navigation chrome (back button, action ribbon).
- **Carbon_Design_System**: The IBM Carbon Design System component library (`carbon-components-angular`) used for UI elements.

## Requirements

### Requirement 1: Category Data Model

**User Story:** As a developer, I want a well-defined data model for booking categories, so that the application has a consistent interface for category data across all components and services.

#### Acceptance Criteria

1. THE BookingCategory interface SHALL define the following required properties: id (string), label (string), color (string), appliesTo (BookingCategoryApplyScope)
2. THE BookingCategory interface SHALL define the following optional properties: tagBackgroundColor (string), tagTextColor (string), description (string), isSystem (boolean)
3. THE BookingCategoryApplyScope type SHALL be a union of exactly three string literals: 'entry', 'booking-set', 'order'
4. THE ScheduleEntry interface SHALL include an optional categoryIds property of type string array

### Requirement 2: Default System Categories

**User Story:** As a service planner user, I want pre-configured system categories available on first use, so that I can immediately categorize bookings without manual setup.

#### Acceptance Criteria

1. THE BookingCategoriesService SHALL provide exactly five default system categories: Warranty (purple/#8A3FFC, order), Waiting for parts (yellow/#F1C21B, order), Customer priority (red/#DA1E28, order), Diagnosis (blue/#0F62FE, booking-set), Internal (green/#198038, entry)
2. WHEN localStorage contains no persisted categories THEN THE BookingCategoriesService SHALL initialize with the default system categories
3. WHEN localStorage contains invalid JSON under the storage key THEN THE BookingCategoriesService SHALL fall back to the default system categories
4. WHEN localStorage contains an empty array under the storage key THEN THE BookingCategoriesService SHALL fall back to the default system categories

### Requirement 3: Category Persistence

**User Story:** As a user, I want my category changes to persist across browser sessions, so that I do not lose my customizations when I close or refresh the browser.

#### Acceptance Criteria

1. THE BookingCategoriesService SHALL persist all categories to localStorage under key 'service-planner.booking-categories.v1' as a JSON-serialized array
2. WHEN a category is created THEN THE BookingCategoriesService SHALL persist the updated categories array to localStorage immediately
3. WHEN a category is updated THEN THE BookingCategoriesService SHALL persist the updated categories array to localStorage immediately
4. WHEN a category is deleted THEN THE BookingCategoriesService SHALL persist the updated categories array to localStorage immediately
5. WHEN the service initializes THEN THE BookingCategoriesService SHALL restore categories from localStorage if valid data exists
6. WHEN localStorage is unavailable (e.g., server-side rendering) THEN THE BookingCategoriesService SHALL operate with in-memory default categories without throwing errors

### Requirement 4: Category Retrieval

**User Story:** As a component developer, I want to retrieve categories by id or as a full list, so that I can display category data in the UI.

#### Acceptance Criteria

1. WHEN getAll is called THEN THE BookingCategoriesService SHALL return a shallow copy of every category in the collection
2. WHEN getById is called with an existing category id THEN THE BookingCategoriesService SHALL return a shallow copy of the matching category
3. WHEN getById is called with a non-existent id THEN THE BookingCategoriesService SHALL return undefined
4. THE BookingCategoriesService SHALL return copies (not references) so that external mutations do not affect the internal state

### Requirement 5: Category Creation

**User Story:** As a user, I want to create new custom categories, so that I can organize bookings with labels specific to my workflow.

#### Acceptance Criteria

1. WHEN createNewCategory is called THEN THE BookingCategoriesService SHALL generate a new category with a unique id, default label 'New category', a color selected from a predefined palette, appliesTo set to 'entry', and an empty description
2. WHEN createNewCategory is called THEN THE BookingCategoriesService SHALL append the new category to the end of the categories array
3. WHEN createNewCategory is called THEN THE BookingCategoriesService SHALL return a shallow copy of the newly created category
4. THE BookingCategoriesService SHALL generate unique category ids using a timestamp-based scheme (e.g., 'cat-{timestamp}')

### Requirement 6: Category Update

**User Story:** As a user, I want to edit category properties, so that I can customize labels, colors, and scopes to match my needs.

#### Acceptance Criteria

1. WHEN update is called with a valid id and partial changes THEN THE BookingCategoriesService SHALL merge the changes into the existing category
2. WHEN update is called with a non-existent id THEN THE BookingCategoriesService SHALL return undefined and make no changes to the collection
3. WHEN update is called THEN THE BookingCategoriesService SHALL return a shallow copy of the updated category
4. THE BookingCategoriesService SHALL preserve any properties not included in the partial changes object

### Requirement 7: Category Deletion

**User Story:** As a user, I want to delete categories I no longer need, so that my category list stays relevant and uncluttered.

#### Acceptance Criteria

1. WHEN delete is called with the id of a User_Category THEN THE BookingCategoriesService SHALL remove that category from the collection
2. WHEN delete is called with the id of a System_Category THEN THE BookingCategoriesService SHALL not remove the category and the collection SHALL remain unchanged
3. WHEN delete is called with a non-existent id THEN THE BookingCategoriesService SHALL make no changes to the collection

### Requirement 8: Categories List View

**User Story:** As a user, I want to see all my booking categories in an organized list, so that I can quickly browse, search, and manage them.

#### Acceptance Criteria

1. WHEN the user navigates to /booking-categories THEN THE BookingCategoriesListComponent SHALL display all categories in a list using the GenericListComponent
2. THE BookingCategoriesListComponent SHALL display columns for: label (text input), color (color cell), appliesTo (select dropdown), and description (text input)
3. WHEN the user types in the search field THEN THE BookingCategoriesListComponent SHALL filter visible categories by matching the search term against label, description, scope label, and color values (case-insensitive)
4. WHEN the user clicks the 'Add category' toolbar action THEN THE BookingCategoriesListComponent SHALL invoke createNewCategory on the service and display the new category in the list
5. WHEN the user triggers the 'launch' row action on a category THEN THE BookingCategoriesListComponent SHALL navigate to /booking-categories/:categoryId
6. WHEN the user selects one or more non-system categories and triggers the 'Delete' toolbar action THEN THE BookingCategoriesListComponent SHALL delete the selected categories via the service

### Requirement 9: Inline Editing in List View

**User Story:** As a user, I want to quickly edit category properties directly in the list, so that I can make changes without navigating to a separate form.

#### Acceptance Criteria

1. WHEN the user activates inline editing mode via the 'Edit' toolbar action THEN THE BookingCategoriesListComponent SHALL enable cell-level editing on list rows
2. WHEN a user changes a cell value (label, color, appliesTo, or description) THEN THE BookingCategoriesListComponent SHALL persist the change immediately via the update method on the service
3. WHEN the user triggers the 'Save' toolbar action THEN THE BookingCategoriesListComponent SHALL deactivate inline editing mode

### Requirement 10: Category Card View

**User Story:** As a user, I want a detailed card view for each category, so that I can see and edit all properties including tag color settings and icon selection.

#### Acceptance Criteria

1. WHEN the user navigates to /booking-categories/:categoryId with a valid id THEN THE BookingCategoryCardComponent SHALL load and display the category data
2. WHEN the user navigates to /booking-categories/:categoryId with an invalid or non-existent id THEN THE BookingCategoryCardComponent SHALL redirect to /booking-categories
3. THE BookingCategoryCardComponent SHALL display editable fields for: label, appliesTo (select), description, and tag color selection
4. WHEN the user modifies the label or description on a System_Category THEN THE BookingCategoryCardComponent SHALL allow the change
5. WHEN the category is a System_Category THEN THE BookingCategoryCardComponent SHALL lock (disable) the color and appliesTo fields to prevent modification

### Requirement 11: Tag Color Configuration

**User Story:** As a user, I want to choose from predefined colors or set custom tag colors, so that my categories are visually distinctive and meet accessibility needs.

#### Acceptance Criteria

1. THE BookingCategoryCardComponent SHALL offer a set of predefined color options: Blue, Cyan, Magenta, Purple, Red, Teal, Green, Yellow, Orange
2. WHEN the user selects a predefined color THEN THE BookingCategoryCardComponent SHALL set the category color and derive tag background and text colors from the preset
3. WHEN the user selects 'Custom' color mode THEN THE BookingCategoryCardComponent SHALL display input fields for custom tag background hex and custom tag text hex
4. WHEN custom tag colors are configured THEN THE BookingCategoryCardComponent SHALL display a live preview of the tag with the custom background and text colors
5. WHEN the contrast ratio between custom tag background and text is below 4.5:1 THEN THE BookingCategoryCardComponent SHALL display a contrast warning to the user

### Requirement 12: Category Save and Navigation

**User Story:** As a user, I want to save my category edits and navigate back to the list, so that my changes persist and I can return to manage other categories.

#### Acceptance Criteria

1. WHEN the user clicks the save button on the card view THEN THE BookingCategoryCardComponent SHALL persist all current category property values via the service update method
2. WHEN the user clicks save-and-close THEN THE BookingCategoryCardComponent SHALL persist changes and navigate back to /booking-categories
3. WHEN the user clicks the back/close button THEN THE BookingCategoryCardComponent SHALL navigate to /booking-categories

### Requirement 13: App Shell Integration

**User Story:** As a user, I want the booking categories feature integrated into the application navigation, so that I can access it from the main interface.

#### Acceptance Criteria

1. THE App_Shell SHALL register route '/booking-categories' mapping to BookingCategoriesListComponent
2. THE App_Shell SHALL register route '/booking-categories/:categoryId' mapping to BookingCategoryCardComponent
3. WHEN the user is on the list view THEN THE App_Shell SHALL display the title 'Booking categories'
4. WHEN the user is on the card view THEN THE App_Shell SHALL display the title 'Category'
5. WHEN the user clicks the back button on the card view THEN THE App_Shell SHALL navigate to /booking-categories
6. WHEN the user clicks the back button on the list view THEN THE App_Shell SHALL navigate to /service-planner

### Requirement 14: Accessibility

**User Story:** As a user with assistive technology, I want the booking categories feature to be fully accessible, so that I can manage categories using a keyboard and screen reader.

#### Acceptance Criteria

1. THE BookingCategoriesListComponent SHALL support full keyboard navigation through the list rows and toolbar actions
2. THE BookingCategoryCardComponent SHALL associate form labels with their inputs using the 'for' attribute or aria-labelledby
3. WHEN the contrast warning is displayed THEN THE BookingCategoryCardComponent SHALL use an appropriate ARIA live region or role="alert" to announce the warning to screen readers
4. THE BookingCategoryCardComponent color selection dropdown SHALL be operable via keyboard (Enter/Space to open, arrow keys to navigate, Escape to close)
5. THE BookingCategoriesListComponent SHALL provide appropriate aria-label attributes on interactive elements to convey their purpose to screen readers
