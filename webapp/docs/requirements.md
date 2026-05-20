# Service Planner Requirements

## 1. Application Scope

The application supports automotive service-workshop workflows from transaction intake through appointment selection, workorder planning, resource scheduling, resource-view management, and order summary views.

The primary business domain is a workshop/service planner where workorders are scheduled onto resources such as mechanics, advisors, bays, drivers, devices, and courtesy cars.

## 2. Core Domain Concepts

### 2.1 Workorders

- The system shall represent a workorder as a customer/service order with:
  - reference number
  - vehicle
  - customer
  - jobs
  - appointment start/end
  - workflow state
  - status
- The system shall support the following workorder workflow states:
  - `request`
  - `offer`
  - `preparation`
  - `checkin`
  - `execution`
  - `handover`
  - `followup`
- The workorder workflow state shall describe the overall business stage of the order.

### 2.2 Workorder Items

- The system shall support workorder items.
- Workorder items shall include jobs and activities.
- Jobs shall represent productive workshop tasks such as tyre change, battery replacement, calibration, or similar services.
- Activities shall represent operational planning tasks such as:
  - Check-In
  - Handover
  - Mobility Service
- Activities shall be handled as a type of schedulable workorder item.
- The system shall allow future item categories to be added without changing the business distinction between workflow state and item status.

### 2.3 Workorder Item Status

- Each workorder item shall have a planner/item status:
  - `scheduled`
  - `started`
  - `completed`
- The item status shall be displayed on planner tiles as:
  - a tag
  - a left-border color
- The default status colors shall be:
  - scheduled: yellow/orange
  - started: blue
  - completed: green
- Exact color values may be updated later.

### 2.4 Workflow-State Rules

- When a workorder is in `request`, `offer`, or `preparation`, no item shall be in `started` state.
- When a workorder is in `checkin`, Check-In and Mobility may become `started` after vehicle check-in by an advisor.
- Vehicle check-in prompts/actions are expected to come from another module and are not part of the planner for now.
- When a workorder is in `execution`, job statuses may be scheduled, started, or completed based on mechanic time-clock actions.
- Time-clock actions are expected to come from a separate Time Clock module.
- When a workorder is in `handover`, jobs and Check-In may be completed, while Handover may be scheduled, started, or completed.
- When a workorder is in `followup`, most workorder items should be completed.

## 3. Resource Model

- The system shall support the following resource types:
  - mechanic
  - bay
  - advisor
  - driver
  - device
- Each resource shall have:
  - ID
  - name
  - type
  - qualifications
  - optional group ID
  - optional avatar URL
- Resources shall be grouped by resource type or business grouping.
- Resource groups shall be displayed as collapsible groups in the scheduler.

## 4. Resource Views

- The system shall support saved resource views.
- A resource view shall contain:
  - label
  - resource IDs
  - optional value
  - optional grouped children
- The Resource View dropdown shall filter bookable resources.
- Resource views and selected resource types shall act as booking filters.
- If a resource is not in the selected resource view, it shall not be bookable.
- If a resource type is not selected, resources of that type shall not be bookable.
- The Resource View dropdown shall appear in the scheduler corner.
- The Resource View dropdown shall be inline with the month selector row.
- The Resource View dropdown shall have a label: `Resource views`.
- The Resource View dropdown menu shall render above page content and shall not be clipped.
- Opening one scheduler dropdown shall close the other scheduler dropdown.
- The advanced combobox action shall be labeled `Edit`.
- The `Edit` action shall open a generic list page of resource views.
- Opening a resource view from the list shall open the resources in that view.
- Closing the resource views page shall return to the planner context from which it was opened:
  - full planner
  - workflow planner
- Adding/removing resources in a view shall update:
  - the view page
  - the resource count
  - planner resource visibility/bookability
- Resource views shall be shared through a resource view service used by the planner dropdown, resource-view list, and resource-view editor.
- The resource view list shall use the generic list component and support opening/editing existing views.
- Resource-view navigation shall preserve the planner return context through query parameters.
- The resource view editor shall support adding resources through the resource catalog.
- The resource view editor shall merge newly added catalog resources into existing view rows without duplicating resources by ID.
- Resource catalog selection shall be carried through navigation state and a catalog selection service.

## 5. Scheduler Contexts

### 5.1 Full Planner Context

- The full planner shall show the wider resource schedule.
- The full planner shall allow planning across resources and orders.
- Book Next/Previous actions shall operate on the corresponding order only.
- The full planner shall use the selected resource view as the visible and bookable resource pool.
- The full planner shall support opening and closing the right order panel.
- The full planner shall preserve row height in availability-only mode.
- The full planner shall support scheduler event click, move, resize, drag/drop, resource-view filtering, and resource-type filtering.

### 5.2 Workflow Context

- The workflow planner shall focus on one active workorder.
- The active workorder shall be resolved from:
  - selected panel order
  - route active order
  - current workflow order
- Manual drag/drop one-by-one shall not collapse unselected resource rows.
- Full-order auto booking shall collapse visible rows to the booked resources.
- Quick View full-order scheduling shall also collapse visible rows to booked resources.
- Undo in workflow context shall not affect other orders.
- The workflow planner shall load the active workorder from the route order ID when available.
- The workflow planner shall align its visible date range to the active order appointment or Quick View selection.
- The workflow planner shall keep the current active order detailed in availability-only mode.
- The workflow planner shall keep rows pinned after resource-level undo so the row does not disappear immediately.

## 6. Scheduling and Booking Rules

### 6.1 General Booking

- The system shall schedule workorder items as schedule entries.
- A schedule entry shall include:
  - ID
  - job/activity ID
  - resource ID
  - start/end
  - optional title
  - optional color
  - kind
  - workorder reference
  - workorder item status
  - workorder item category
- The scheduler shall prevent booking a resource over an occupied time range.
- Occupied time shall include:
  - another order
  - another job
  - another activity
  - lunch
  - resource downtime
  - training
  - meetings
  - other unavailability
- Schedule entries shall be persisted through the schedule repository.
- Assigning a schedule entry shall create a planner event with resource, time, title, color, job metadata, order metadata, and schedule entry metadata.
- Unassigning a schedule entry shall remove the corresponding planner event and local schedule entry.
- Rescheduling a schedule entry shall update both repository data and planner event data.
- Check-In and Handover activity durations shall be normalized to 30 minutes by the schedule repository.
- Booking eligibility shall be limited by selected resource view, selected resource type filters, and resource qualification/requirement matching where applicable.

### 6.2 Check-In, Jobs, Handover, Mobility

- Check-In shall always be before the first scheduled job.
- No job shall start before Check-In is complete.
- Handover shall be scheduled after the last job.
- Check-In duration shall be 30 minutes.
- Handover duration shall be 30 minutes.
- Mobility/Courtesy Car shall run from Check-In end to Handover end.
- Mobility duration shall be derived from the order schedule and shall not be treated as an independent fixed duration.
- Dropping Check-In or Handover shall use fixed 30-minute duration regardless of drag duration.
- Dropping a job before Check-In completion shall shift the job to start after Check-In while preserving duration.
- Dropping Handover before the latest job end shall shift Handover after the latest job.
- Dropping Mobility shall snap Mobility to the Check-In-end to Handover-end span when both endpoints are booked.
- When Check-In or Handover changes, existing Mobility booking shall synchronize to the updated span.
- Appointment start/end shall synchronize from Check-In start to Handover end when an order is planned.

### 6.3 Auto Booking

- The system shall support Book First Availability.
- The system shall support Book Next.
- The system shall support Book Previous.
- Book First/Next/Previous shall schedule the selected/current order only.
- Book First/Next/Previous shall scroll the scheduler to the proposed/confirmed booking position.
- Book Next shall become enabled when an order has a proposal/booking state that can advance.
- Book Previous shall become available after moving forward through proposal history.
- Proposal state shall be tracked per order.
- Auto booking shall respect:
  - selected resource view
  - selected resource types
  - resource qualifications
  - existing bookings
  - unavailability
  - Check-In/job/Handover/Mobility sequencing
- Auto booking shall clear/rebuild current bookings for the active order when creating a new proposal.
- Auto booking shall create job entries plus Check-In, Handover, and Mobility activity entries.
- Auto booking shall track the latest created entry IDs for undo and resource-collapse behavior.
- Auto booking shall set the scheduler scroll target to the created booking set.
- Book Next shall use proposal history and search after the current proposal end.
- Book Previous shall restore the previous proposal for the same order.
- Auto booking shall show a scheduling error when required resources cannot be found.

### 6.4 Cross-Resource Snap

- Some jobs may require multiple resource types.
- If one required resource is booked for a job, dropping another resource type for the same job shall snap to the same start/end.
- Example: if a mechanic is booked for a job and the job is dropped on a bay, the bay booking shall match the mechanic booking duration.
- Cross-resource snap shall work in full planner and workflow contexts.
- Moving or resizing one booking for a multi-resource job shall synchronize sibling bookings for the same job/resource set where applicable.
- Activity bookings shall not be synchronized as same-job mechanical siblings.

### 6.5 Manual Drag/Drop

- Dragging a job tile shall drag only that job tile, not the parent order card.
- Dragging an activity tile shall drag only that activity tile, not the parent order card.
- Drag events from jobs and activities shall stop propagation to the order card.
- Manual drag/drop in workflow context shall keep unselected resources visible.
- Dragging an order card shall pass order ID and order drop type to the scheduler.
- Dragging a job shall pass job ID, order ID, FRU/duration, drop type, and resource type metadata.
- Dragging an activity shall pass activity ID, order ID, FRU/duration, drop type, and resource type metadata.
- Dropping on a non-eligible resource shall be ignored.
- Scheduler drag/drop shall calculate start/end from horizontal timeline position and target resource from vertical row position.
- Scheduler drag previews shall snap horizontally to the configured slot duration.
- Scheduler row highlighting shall show the current drop-target resource row.

### 6.6 Move, Resize, and Booking Detail Editing

- Existing planner events shall be movable on the scheduler timeline.
- Existing planner events shall be resizable from left and right handles.
- Moving an event shall update repository schedule entry times and synchronize same-job siblings when applicable.
- Resizing an event shall update repository schedule entry times and synchronize same-job siblings when applicable.
- Clicking a planner event shall open a booking details modal.
- Booking details modal shall show order, resource, vehicle, customer, contact, date/time, and additional required resource information.
- Saving booking details shall update resource assignment and start/end time.
- Deleting booking details shall unassign/remove the selected booking.
- Booking details date/time fields shall use Carbon date/time controls.

## 7. Undo Requirements

- The system shall support resource-level undo from the right panel.
- Resource-level undo shall remove only the selected booking.
- In workflow context, resource-level undo shall pin/keep the resource row visible to avoid immediate row collapse.
- The system shall support global/ribbon undo.
- If a latest auto-proposal set exists, global undo shall remove that latest set.
- In workflow context, global undo shall scope the latest set to the active order only.
- If no latest auto-proposal set exists, global undo shall undo the latest booking scoped to the active order in workflow context.
- Undo in workflow context shall not touch bookings from other orders.
- Undo shall remove the booking from the schedule repository, planner events, local schedule entries, and latest-auto-booking tracking.
- Undo shall hide auto-proposal state when the latest proposal set has no remaining tracked entries.

## 8. Productive and Non-Productive Rendering

### 8.1 Productive Time

- Productive time shall represent order/job/activity bookings.
- Productive time shall have an order and a job/activity.
- Productive bookings shall render as planner booking tiles in details mode.
- Productive bookings shall not be duplicated as unavailability blocks.
- Productive booking tiles shall derive order reference, sequence count, status, title, time range, and duration from schedule event metadata.
- Productive bookings shall render as compact occupied-duration bars in availability-only mode unless they belong to the active/current order.

### 8.2 Non-Productive Time

- Non-productive time shall represent resource unavailability without an order/job.
- Examples include:
  - lunch
  - training
  - team meeting
  - calibration downtime
  - cleaning
  - other downtime
- Non-productive blocks shall render as grey availability/unavailability blocks.
- Non-productive detail and duration shall show when details are enabled.
- Lunch and calibration shall take the full row height.
- Non-productive blocks shall be supplied through unavailability data rather than schedule entries.
- Non-productive blocks shall display title/reason plus time range and duration when details are enabled.

### 8.3 Details Toggle

- The planner shall support Details ON and Details OFF / Availability-only views.
- Details ON:
  - productive bookings render full details
  - non-productive bookings render grey detail tiles
- Details OFF:
  - current active order remains detailed
  - other productive bookings render as compact occupied bars
  - non-productive bookings render as grey bars
- Compact productive bars shall use `#E9ECF5`.
- Non-productive details-off bars shall use Carbon layer-01: `var(--Layer-layer-01,#F4F4F4)`.
- Details toggle state shall be controlled from the right panel.
- Details-off rendering shall use detailed event/order ID lists so the active order remains expanded while unrelated productive bookings become compact.

## 9. Planner Tile Requirements

- Planner tile second line shall display:
  - time range
  - duration
- Format example: `11:30 - 12:00 | 30min`.
- Duration shall omit zero units:
  - `30min`
  - `1hr`
  - `1hr 30min`
- Status tags shall align to the top-right of tiles.
- Detailed booking tiles shall have a shadow.
- Compact availability bars shall not have a shadow.
- Grouped order + job tiles shall have one combined shadow, not individual shadows per job segment.
- Grouped order strip shall use Carbon layer-accent-01: `var(--Layer-layer-accent-01,#E0E0E0)`.
- Grouped order strip shall have a dark left border: `2px solid #808080`.
- Grouped order number text shall be `14px`.
- Planner tiles shall use workorder item status to display `Scheduled`, `Started`, or `Completed` tags.
- Planner tiles shall support icon-only tags for narrow tiles and full tag labels for wider tiles.
- Activity and job tiles shall use separate status/category metadata.
- Contiguous bookings for the same order/resource shall render a grouped order run header.
- Grouped order runs shall show order reference and visible-job count.
- Grouped order run shadows shall be rendered once for the grouped booking set.

## 10. Scheduler Timeline and Borders

- Day boundary lines shall render as 1px.
- The first hour slot line of each day shall not render on top of the day boundary line.
- The scheduler shall avoid doubled borders at day boundaries.
- Sticky date/day cells shall have `16px` left padding.
- Timeline borders shall use consistent Carbon subtle border styling.
- Scheduler shall render a sticky month bar above the date/hour header.
- Scheduler shall render a sticky resource corner containing Resource View dropdown, Resource Type dropdown, resource search input, and right-pane toggle button.
- Scheduler header scroll shall synchronize horizontally with scheduler body scroll.
- Scheduler shall use a fixed resource column width and horizontal timeline width calculated from visible days/hours.
- Scheduler shall support configurable slot duration through planner settings.
- Scheduler shall scroll to a selected event when `scrollToEventId` changes.

## 11. Resource Group Behavior

- Group headers shall render for groups included by current view/type/search filters.
- Selecting or unselecting a resource checkbox shall not remove the group header.
- Resource checkboxes shall represent selection state and shall not control row visibility.
- Group chevrons shall expand/collapse resource rows only.
- Group chevrons shall not remove group headers.
- If a group is excluded by selected resource view or resource type filters, its header shall be removed.
- Resource type dropdown shall allow selecting/unselecting resource type groups.
- Resource type dropdown shall have a clear/reset action that restores all resource types.
- Resource type dropdown label shall show all resource types or selected count.
- Resource search shall filter resources by resource label and group label.
- Resource row checkboxes shall emit selection changes to the planner without changing planner row visibility by themselves.
- Each resource group may toggle between “See selected” and “See all” when selected resources exist in that group.
- Logged-in advisor resource may be promoted to a personal Calendar group when the setting is enabled.

## 12. Right Panel Requirements

- The right panel shall display orders, jobs, activities, booking status, and resource assignments.
- Job tiles shall be draggable independently.
- Activity tiles shall be draggable independently.
- Activity tiles shall have dividers between them like job tiles.
- Booked resources shall show resource name and `BOOKED`.
- Pending requirements shall show requirement label and `PENDING`.
- Resource-level undo shall be available for booked items where applicable.
- The right panel shall include a booking details toggle with ON/OFF state.
- The right panel shall include an order search field.
- Current implemented order panel search filters order cards by order reference/ID, vehicle license plate, and customer name.
- The right panel shall display order reference, vehicle/license plate, customer name, order FRU/duration, and scheduled/not scheduled state.
- Job tiles shall show job title, FRU/duration or scheduled state, requirements, booked resource names, and pending resource labels.
- Activity tiles shall show activity title, FRU/duration or scheduled state, booked resource names, and pending activity resource label.
- Per-order Book First, Book Previous, and Book Next actions shall be available from the right panel.
- Book First button shall be disabled when the order is fully scheduled or scheduling error state applies.
- The right panel shall support clearing selected panel order state.

## 13. Quick View Requirements

- Quick View shall show available appointment slots for a workorder.
- Quick View selection shall store:
  - order ID
  - Check-In start
  - Handover end
- Selecting a Quick View slot shall:
  - persist appointment start/end
  - remove existing schedule entries for the order
  - create Check-In, jobs, Handover, and Mobility entries
  - update planner selection state
- Returning to workflow planner from Quick View shall apply the selected full-order schedule.
- Quick View full-order scheduling shall collapse planner resources to booked resources in workflow context.

## 14. Appointment Selection Requirements

- The system shall support an appointment selection route for an order.
- Appointment selection shall integrate with appointment synchronization so order appointment start/end can be saved and reused.
- Appointment selections shall be available to planner/quick-view flows.

## 15. Resource Catalog Requirements

- The system shall support a resource catalog page.
- The resource catalog shall list resource groups and resources.
- The resource catalog shall support group-specific routes.
- The resource catalog shall allow selecting resources for resource-view editing workflows.

## 16. Generic List Requirements

- The system shall provide a reusable generic list component.
- The generic list shall support:
  - columns
  - sorting metadata
  - toolbar actions
  - row actions
  - edit/delete/save/add-style actions
- Resource views shall use a generic list page.

## 17. Transaction and Order Summary Requirements

- The system shall support transaction list/offer routes.
- The system shall support transaction summary.
- The system shall support order summary.
- Summary routes shall work with SSR/server rendering.

## 18. Navigation and Layout

- The application shall include:
  - app shell
  - menu bar
  - action ribbon
  - top panel
  - footer
  - page title/breadcrumb components
  - stepper component
- Header menus and action-ribbon overlays shall render above page content.
- Job details modal overlays shall not show app header or action ribbon inside the overlay.
- The footer shall have a top shadow.
- The right pane opener shall match the specified open/closed ghost button styling.

## 19. Server-Side Rendering

- The application shall support SSR routes for:
  - transaction summary
  - order summary
  - appointment selection
  - quick view
  - workflow service planner
  - resource view editor
  - resource catalog
  - resource catalog group
- The `/service-planner` route shall not throw `NotFoundError` if a prerendered file is missing.
- The server shall check for a prerendered service-planner index.
- If unavailable, the server shall check for the browser index.
- If neither exists, the server shall fall through to Angular SSR.

## 20. Mock Data and Test Scenarios

- Mock data shall include orders suitable for planner validation, including orders `6500–6509`.
- Order `6500` shall be unbooked by default and available for planning/testing.
- Check-In and Handover seeded durations shall be 30 minutes.
- Seeded jobs shall start after Check-In.
- Seeded Handover shall start after the last job.
- Seeded Mobility/Courtesy Car shall run from Check-In end to Handover end.
- Seeded productive bookings shall not overlap lunch.
- Mechanics and advisors shall have lunch.
- Scenario mechanic/advisor and Kelly Hanson shall have lunch.
- Lunch shall be one hour: `12:00–13:00`.

## 21. Validation Requirements

- Production build should pass with:
  - `npm run build`
