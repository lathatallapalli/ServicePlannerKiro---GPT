import { Component, OnInit, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ComboBoxModule, DatePickerModule, InputModule, SearchModule, SelectModule, TimePickerModule, TimePickerSelectModule, ToggleModule } from 'carbon-components-angular';
import { CustomSchedulerComponent } from '../../shared/components/scheduler/custom/custom-scheduler.component';
import { JobTile, JobBooking, ActivityTile } from './components/jobs-panel/jobs-panel.component';
import { SchedulerResource, SchedulerEvent, SchedulerGroup, EventMovePayload, EventResizePayload, EventDropPayload, EventClickPayload, EventContextMenuPayload, ResourceSelectionChangePayload, ResourceTypeSelectionChangePayload } from '../../shared/components/scheduler/scheduler.interface';
import { ResourceRepository } from '../../core/services/resource.repository';
import { ScheduleRepository } from '../../core/services/schedule.repository';
import { WorkOrderRepository } from '../../core/services/work-order.repository';
import { PlannerSettingsService } from './services/planner-settings.service';
import { AutoSchedulerService } from './services/auto-scheduler.service';
import { ResourceViewsService } from './services/resource-views.service';
import { forkJoin } from 'rxjs';
import { MOCK_UNAVAILABILITY } from '../../core/services/mock/mock-data';
import { UnavailabilityBlock } from '../../core/models/availability.model';
import { ScheduleEntry } from '../../core/models/schedule.model';
import { JobResourceRequirement } from '../../core/models/job.model';
import { Resource } from '../../core/models/resource.model';
import { ResourceFavoriteView } from './services/planner-settings.service';
import { AppointmentSyncService } from '../../core/services/appointment-sync.service';
import { QuickViewSelection, QuickViewSelectionService } from '../quick-view/quick-view-selection.service';

const MINUTES_PER_FRU = 60;

interface BookingSet {
  id: string;
  summary: string;
  bookings: JobBooking[];
}

@Component({
  selector: 'app-service-planner',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ComboBoxModule,
    DatePickerModule,
    InputModule,
    SearchModule,
    SelectModule,
    TimePickerModule,
    TimePickerSelectModule,
    ToggleModule,
    CustomSchedulerComponent,
  ],
  templateUrl: './service-planner.component.html',
  styleUrl: './service-planner.component.scss',
})
export class ServicePlannerComponent implements OnInit {
  private readonly loggedInAdvisorResourceId = 'advisor-ted-phillips';
  private readonly personalCalendarGroup: SchedulerGroup = { id: 'group-personal-calendar', label: 'Calendar' };

  resources: SchedulerResource[] = [];
  events: SchedulerEvent[] = [];
  scheduleEntries: ScheduleEntry[] = [];
  groups: SchedulerGroup[] = [];
  allOrders: any[] = [];
  jobTiles: JobTile[] = [];
  activityTiles: ActivityTile[] = [
    { id: 'act-checkin',   title: 'Check-In',        resourceType: 'advisor', resourceLabel: 'Service Advisor', fru: 0.5, estimatedDurationMinutes: 30 },
    { id: 'act-handover',  title: 'Handover',         resourceType: 'advisor', resourceLabel: 'Service Advisor', fru: 0.5, estimatedDurationMinutes: 30 },
    { id: 'act-mobility',  title: 'Mobility Service', resourceType: 'driver',  resourceLabel: 'Courtesy Car',    fru: 1,    estimatedDurationMinutes: 60 },
  ];
  selectedResourceIds: string[] = [];
  pinnedVisibleResourceIds: string[] = [];
  selectedResourceTypeGroupIds: string[] = [];
  selectedBookingEvent: SchedulerEvent | null = null;
  eventContextMenu: { eventId: string; x: number; y: number } | null = null;
  bookingModalStartDate = '';
  bookingModalStartTime = '';
  bookingModalEndDate = '';
  bookingModalEndTime = '';
  bookingModalResourceId = '';
  bookingModalAdditionalResourceIds: Record<string, string> = {};
  scrollToEventId: string | null = null;
  isOrderPanelOpen = false;
  isPlannerReady = false;
  orderPanelSearch = '';
  orderPanelTab: 'pending' | 'scheduled' | 'all' = 'pending';
  selectedPanelOrderId = '';
  public schedulingError: string | null = null;
  public schedulingErrorTitle = 'Unable to book first availability';
  showBookingDetails = true;
  plannerMode: 'order' | 'full' = 'full';
  activeOrderId: string | null = null;
  hasPrevious = false;
  private proposalHistory: Date[] = [];   // searchFrom dates that produced results
  private currentProposalIndex = -1;
  private proposalEndHistory: Date[] = [];
  private proposalStateByOrder = new Map<string, { history: Date[]; endHistory: Date[]; index: number }>();
  private latestAutoBookingEntryIds = new Set<string>();
  private isAutoProposalVisible = false;
  unavailability: UnavailabilityBlock[] = MOCK_UNAVAILABILITY;

  viewStart = new Date('2024-04-15T09:00:00');
  viewEnd   = new Date('2024-04-19T21:00:00');
  private readonly appointmentDayEndHour = 18;
  private readonly lunchStartHour = 12;
  private readonly lunchEndHour = 13;

  get slotDurationMinutes(): number {
    return this.plannerSettings.slotDurationMinutes();
  }

  get isSettingsModalOpen(): boolean {
    return this.plannerSettings.isSettingsModalOpen();
  }

  get viewPersonalCalendarOnTop(): boolean {
    return this.plannerSettings.viewPersonalCalendarOnTop();
  }

  get optimizeAdvisorActivityBookingForPersonalCalendar(): boolean {
    return this.plannerSettings.optimizeAdvisorActivityBookingForPersonalCalendar();
  }

  get bookings(): JobBooking[] {
    return this.getPersistedBookingsFromEntries(this.scheduleEntries, this.allOrders);
  }

  /** After booking, only show resources that have at least one event */
  get filteredResources(): SchedulerResource[] {
    const resourcePool = this.resourcesForSelectedView;
    if (this.plannerMode === 'order' && this.isAutoProposalVisible) {
      const order = this.allOrders.find(candidate => candidate.id === this.activeOrderId || candidate.referenceNumber === this.activeOrderId);
      const bookedResourceIds = new Set(
        this.events
          .filter(event =>
            event.meta?.entry?.workOrderReference === order?.referenceNumber ||
            (event.meta as any)?.order?.id === order?.id
          )
          .map(event => event.resourceId)
      );
      for (const resourceId of this.pinnedVisibleResourceIds) {
        bookedResourceIds.add(resourceId);
      }
      if (bookedResourceIds.size) {
        return resourcePool.filter(resource => bookedResourceIds.has(resource.id));
      }
    }
    if (!this.isAutoProposalVisible) return resourcePool;
    const bookedResourceIds = new Set(this.events.map(e => e.resourceId));
    return resourcePool.filter(r => bookedResourceIds.has(r.id));
  }

  get fullPlannerResources(): SchedulerResource[] {
    return this.resourcesForSelectedView;
  }

  get visibleSchedulerResources(): SchedulerResource[] {
    const resources = this.plannerMode === 'full' ? this.fullPlannerResources : this.filteredResources;
    if (!this.viewPersonalCalendarOnTop) return resources;

    return resources.map(resource =>
      resource.id === this.loggedInAdvisorResourceId
        ? { ...resource, groupId: this.personalCalendarGroup.id, groupLabel: this.personalCalendarGroup.label }
        : resource
    );
  }

  get visibleSchedulerGroups(): SchedulerGroup[] {
    const resourceGroupIds = new Set(this.resourcesForSelectedView.map(resource => resource.groupId).filter(Boolean));
    const viewGroups = this.groups.filter(group => resourceGroupIds.has(group.id));
    if (!this.viewPersonalCalendarOnTop) return viewGroups;
    return [
      this.personalCalendarGroup,
      ...viewGroups.filter(group => group.id !== this.personalCalendarGroup.id),
    ];
  }

  get showSchedulerBookingDetails(): boolean {
    return this.showBookingDetails;
  }

  get visibleSchedulerEvents(): SchedulerEvent[] {
    return this.events;
  }

  get visibleSchedulerUnavailability(): UnavailabilityBlock[] {
    return this.unavailability;
  }

  get plannedBookingEventIds(): string[] {
    if (!this.showBookingDetails) {
      return this.events
        .filter(event => this.isEventForActiveWorkOrder(event))
        .map(event => event.id);
    }
    return this.bookings.map(booking => booking.entryId);
  }

  get detailedOrderIds(): string[] {
    if (!this.showBookingDetails) {
      const activeOrderId = this.getActiveWorkOrderId();
      const order = this.allOrders.find(candidate => candidate.id === activeOrderId || candidate.referenceNumber === activeOrderId);
      return [order?.id, order?.referenceNumber].filter((id): id is string => !!id);
    }
    const ids = new Set<string>();
    for (const booking of this.bookings) {
      const order = this.allOrders.find(candidate => candidate.jobs?.some((job: any) => job.id === booking.jobId));
      if (order?.id) ids.add(String(order.id));
      if (order?.referenceNumber) ids.add(String(order.referenceNumber));
    }
    return [...ids];
  }

  get selectedResourceView(): ResourceFavoriteView | null {
    return this.plannerSettings.selectedResourceView();
  }

  get resourceViews(): ResourceFavoriteView[] {
    return this.resourceViewsService.getAll();
  }

  get filteredPanelOrders(): any[] {
    const query = this.orderPanelSearch.trim().toLowerCase();
    const orders = this.plannerMode === 'order'
      ? this.allOrders.filter(order => order.id === this.activeOrderId || order.referenceNumber === this.activeOrderId)
      : this.allOrders;

    const tabFilteredOrders = this.isFullPlanner()
      ? orders.filter(order => {
        if (this.orderPanelTab === 'all') return true;
        const isScheduled = this.isOrderFullyScheduled(order);
        return this.orderPanelTab === 'scheduled' ? isScheduled : !isScheduled;
      })
      : orders;

    if (!query) return tabFilteredOrders;
    return tabFilteredOrders.filter(order =>
      [
        order.referenceNumber,
        order.id,
        order.vehicle?.licensePlate,
        order.customer?.name,
      ].filter(Boolean).join(' ').toLowerCase().includes(query)
    );
  }

  private get resourcesForSelectedView(): SchedulerResource[] {
    const activeView = this.plannerSettings.selectedResourceView();
    if (!activeView) return this.resources;

    const viewResourceIds = new Set(activeView.resourceIds);
    return this.resources.filter(resource => viewResourceIds.has(resource.id));
  }

  private get bookingEligibleResources(): SchedulerResource[] {
    const resourcesInView = this.resourcesForSelectedView;
    const groupsInView = new Set(resourcesInView.map(resource => resource.groupId).filter(Boolean));
    if (!this.selectedResourceTypeGroupIds.length || this.selectedResourceTypeGroupIds.every(groupId => groupsInView.has(groupId))) {
      return resourcesInView;
    }

    const selectedGroupIds = new Set(this.selectedResourceTypeGroupIds);
    return resourcesInView.filter(resource => resource.groupId && selectedGroupIds.has(resource.groupId));
  }

  constructor(
    private resourceRepo: ResourceRepository,
    private scheduleRepo: ScheduleRepository,
    private workOrderRepo: WorkOrderRepository,
    private plannerSettings: PlannerSettingsService,
    private resourceViewsService: ResourceViewsService,
    private autoScheduler: AutoSchedulerService,
    private appointmentSync: AppointmentSyncService,
    private quickViewSelection: QuickViewSelectionService,
    private route: ActivatedRoute,
    private router: Router,
  ) {
    // Watch the undo trigger — each increment means undo the last booking
    effect(() => {
      const trigger = this.plannerSettings.undoTrigger();
      if (trigger === 0) return; // skip initial value
      this.undoLastBooking();
    });
  }

  ngOnInit(): void {
    this.plannerMode = this.route.snapshot.paramMap.has('orderId') ? 'order' : 'full';
    this.activeOrderId = this.route.snapshot.paramMap.get('orderId') ?? null;
    this.showBookingDetails = this.plannerMode === 'full';
    this.plannerSettings.setResourceView(null);

    forkJoin({
      resources: this.resourceRepo.getAll(),
      groups:    this.resourceRepo.getGroups(),
      orders:    this.workOrderRepo.getAll(),
    }).subscribe(({ resources, groups, orders }) => {
      this.isPlannerReady = true;
      this.allOrders = orders;
      this.activeOrderId = this.resolveWorkOrderId(this.activeOrderId) ?? this.activeOrderId;
      const activeOrder = this.allOrders.find(order => order.id === this.activeOrderId || order.referenceNumber === this.activeOrderId);
      this.alignViewWindowToOrder(activeOrder);

      this.scheduleRepo.getEntries(this.viewStart, this.viewEnd).subscribe(entries => {
        this.scheduleEntries = entries;

      const tileSourceOrders = this.plannerMode === 'order'
        ? orders.filter((order: any) => order.id === this.activeOrderId || order.referenceNumber === this.activeOrderId)
        : orders;

      this.jobTiles = tileSourceOrders.flatMap((order: any) =>
        order.jobs
          .filter((j: any) => j.status === 'unscheduled')
          .map((job: any) => ({ workOrder: order, job }))
      );

      this.groups = groups.map(g => ({ id: g.id, label: g.name }));

      this.resources = resources.map(r => ({
        id: r.id,
        label: r.name,
        groupId: r.groupId,
        groupLabel: groups.find(g => g.id === r.groupId)?.name,
        meta: r,
      }));

      this.events = this.mapScheduleEntriesToEvents(entries);

      this.unavailability = [
        ...MOCK_UNAVAILABILITY,
      ];
      this.applyQuickViewSelection();
      this.scrollToActiveOrderBooking();
      });
    });
  }

  onEventMoved(payload: EventMovePayload): void {
    if (!this.isWithinAppointmentBookingHours(payload.start, payload.end)) return;

    this.scheduleRepo.reschedule(payload.eventId, payload.start, payload.end).subscribe(updated => {
      this.events = this.events.map(e =>
        e.id === payload.eventId
          ? { ...e, resourceId: payload.resourceId, start: updated.start, end: updated.end, meta: { ...(e.meta ?? {}), entry: { ...(e.meta?.entry as ScheduleEntry), ...updated } } }
          : e
      );
      this.updateScheduleEntry(payload.eventId, { ...updated, resourceId: payload.resourceId });
      if (this.isJobEvent(this.events.find(e => e.id === payload.eventId))) {
        this.syncJobSiblings(payload.eventId, updated.start, updated.end);
      }
      // If check-in or handover moved, sync mobility span
      const orderId = this.bookings.find(booking => booking.entryId === payload.eventId)?.orderId;
      this.syncMobilitySpan(orderId);
      this.syncOrderAppointmentFromBookings(orderId);
    });
  }

  onEventResized(payload: EventResizePayload): void {
    if (!this.isWithinAppointmentBookingHours(payload.start, payload.end)) return;

    this.scheduleRepo.reschedule(payload.eventId, payload.start, payload.end).subscribe(updated => {
      this.events = this.events.map(e =>
        e.id === payload.eventId
          ? { ...e, start: updated.start, end: updated.end, meta: { ...(e.meta ?? {}), entry: { ...(e.meta?.entry as ScheduleEntry), ...updated } } }
          : e
      );
      this.updateScheduleEntryTimes(payload.eventId, updated.start, updated.end);
      if (this.isJobEvent(this.events.find(e => e.id === payload.eventId))) {
        this.syncJobSiblings(payload.eventId, updated.start, updated.end);
      }
      const orderId = this.getOrderIdForEventId(payload.eventId);
      this.syncMobilitySpan(orderId);
      this.syncOrderAppointmentFromBookings(orderId);
    });
  }

  onEventClicked(payload: EventClickPayload): void {
    this.closeEventContextMenu();
    this.selectedBookingEvent = this.events.find(event => event.id === payload.eventId) ?? null;
    if (this.selectedBookingEvent) {
      this.initializeBookingModalState(this.selectedBookingEvent);
    }
  }

  onEventContextMenu(payload: EventContextMenuPayload): void {
    const event = this.events.find(candidate => candidate.id === payload.eventId);
    if (!this.isJobEvent(event)) return;
    this.eventContextMenu = { eventId: payload.eventId, x: payload.x, y: payload.y };
  }

  closeEventContextMenu(): void {
    this.eventContextMenu = null;
  }

  canSplitContextEvent(): boolean {
    const event = this.eventContextMenu
      ? this.events.find(candidate => candidate.id === this.eventContextMenu?.eventId)
      : undefined;
    return this.canSplitEvent(event);
  }

  splitContextEvent(): void {
    const eventId = this.eventContextMenu?.eventId;
    this.closeEventContextMenu();
    if (eventId) this.splitJobBookingSet(eventId);
  }

  openContextEventDetails(): void {
    const eventId = this.eventContextMenu?.eventId;
    this.closeEventContextMenu();
    if (eventId) this.onEventClicked({ eventId });
  }

  deleteContextEvent(): void {
    const event = this.eventContextMenu
      ? this.events.find(candidate => candidate.id === this.eventContextMenu?.eventId)
      : undefined;
    this.closeEventContextMenu();
    if (!event) return;
    this.selectedBookingEvent = event;
    this.deleteSelectedBooking();
  }

  onResourceSelectionChange(payload: ResourceSelectionChangePayload): void {
    const ids = new Set(this.selectedResourceIds);
    if (payload.selected) {
      ids.add(payload.resourceId);
    } else {
      ids.delete(payload.resourceId);
    }
    this.selectedResourceIds = [...ids];
    if (this.plannerMode === 'order') {
      this.isAutoProposalVisible = false;
    }
  }

  closeSettingsModal(): void {
    this.plannerSettings.closeSettings();
  }

  onViewPersonalCalendarOnTopChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.plannerSettings.setViewPersonalCalendarOnTop(checked);
  }

  onOptimizeAdvisorActivityBookingChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.plannerSettings.setOptimizeAdvisorActivityBookingForPersonalCalendar(checked);
  }

  onResourceTypeSelectionChange(payload: ResourceTypeSelectionChangePayload): void {
    this.selectedResourceTypeGroupIds = [...payload.groupIds];
  }

  onResourceViewChange(view: ResourceFavoriteView | null): void {
    this.plannerSettings.setResourceView(view);
  }

  openResourceViewList(_view?: ResourceFavoriteView | null): void {
    this.router.navigate(['/resource-views'], {
      queryParams: { returnTo: this.router.url },
    });
  }

  addResourceView(): void {
    const newView = this.resourceViewsService.createNewView();
    this.router.navigate(['/resource-catalog'], {
      queryParams: { returnTo: `/resource-views/${newView.value}/edit`, plannerReturnTo: this.router.url, listReturnTo: '/resource-views' },
      state: { resourceView: newView },
    });
  }

  isFullPlanner(): boolean {
    return this.plannerMode === 'full';
  }

  toggleOrderPanel(): void {
    this.isOrderPanelOpen = !this.isOrderPanelOpen;
  }

  onOrderPanelSearch(value: string): void {
    this.orderPanelSearch = value;
  }

  selectOrderPanelTab(tab: 'pending' | 'scheduled' | 'all'): void {
    this.orderPanelTab = tab;
  }

  clearOrderPanelSelection(): void {
    this.selectedPanelOrderId = '';
  }

  toggleBookingDetails(): void {
    this.showBookingDetails = !this.showBookingDetails;
  }

  onBookingDetailsToggle(checked: boolean): void {
    this.showBookingDetails = checked;
  }

  clearSchedulingError(): void {
    this.schedulingError = null;
  }

  private setSchedulingError(message: string): void {
    this.schedulingErrorTitle = 'Unable to book first availability';
    this.schedulingError = message;
  }

  closeBookingModal(): void {
    this.selectedBookingEvent = null;
    this.bookingModalAdditionalResourceIds = {};
  }

  deleteSelectedBooking(): void {
    const event = this.selectedBookingEvent;
    if (!event) return;
    const orderId = this.getOrderIdForEventId(event.id);

    this.scheduleRepo.unassign(event.id).subscribe(() => {
      this.events = this.events.filter(candidate => candidate.id !== event.id);
      this.scheduleEntries = this.scheduleEntries.filter(entry => entry.id !== event.id);
      this.latestAutoBookingEntryIds.delete(event.id);
      this.selectedBookingEvent = null;
      this.syncOrderAppointmentFromBookings(orderId);
    });
  }

  saveSelectedBooking(): void {
    const event = this.selectedBookingEvent;
    if (!event) return;

    const start = this.combineBookingDateTime(this.bookingModalStartDate, this.bookingModalStartTime);
    const end = this.combineBookingDateTime(this.bookingModalEndDate, this.bookingModalEndTime);
    if (!start || !end || end <= start) return;
    if (!this.isWithinAppointmentBookingHours(start, end)) return;

    const currentBooking = this.bookings.find(booking => booking.entryId === event.id);
    const orderId = currentBooking?.orderId;

    this.scheduleRepo.reschedule(event.id, start, end).subscribe(updated => {
      this.events = this.events.map(candidate =>
        candidate.id === event.id
          ? { ...candidate, start: updated.start, end: updated.end }
          : candidate
      );
      this.updateScheduleEntryTimes(event.id, updated.start, updated.end);
      if (this.isJobEvent(event)) {
        this.syncJobSiblings(event.id, updated.start, updated.end);
      }
      this.syncMobilitySpan(orderId);
      this.syncOrderAppointmentFromBookings(orderId);

      this.selectedBookingEvent = this.events.find(candidate => candidate.id === event.id) ?? null;
      if (this.selectedBookingEvent) this.initializeBookingModalState(this.selectedBookingEvent);
      this.closeBookingModal();
    });
  }

  private initializeBookingModalState(event: SchedulerEvent): void {
    this.bookingModalStartDate = this.toDateInputValue(event.start);
    this.bookingModalStartTime = this.toTimeInputValue(event.start);
    this.bookingModalEndDate = this.toDateInputValue(event.end);
    this.bookingModalEndTime = this.toTimeInputValue(event.end);
    this.bookingModalResourceId = event.resourceId;
    this.bookingModalAdditionalResourceIds = Object.fromEntries(
      this.getAdditionalRequiredResources(event).map(requirement => [
        requirement.key,
        this.getBookedResourceIdForRequirement(event, requirement) ?? '',
      ])
    );
  }

  private combineBookingDateTime(dateValue: string, timeValue: string): Date | null {
    if (!dateValue || !timeValue) return null;
    const combined = new Date(`${dateValue}T${timeValue}`);
    return Number.isNaN(combined.getTime()) ? null : combined;
  }

  private toDateInputValue(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private toTimeInputValue(date: Date): string {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  getBookingModalDateValue(value: string): Date[] {
    return value ? [new Date(`${value}T00:00:00`)] : [];
  }

  onBookingModalDateChange(target: 'start' | 'end', value: Date[]): void {
    const date = value?.[0];
    if (!date) return;
    if (target === 'start') {
      this.bookingModalStartDate = this.toDateInputValue(date);
    } else {
      this.bookingModalEndDate = this.toDateInputValue(date);
    }
  }

  onBookingModalTimeChange(target: 'start' | 'end', value: string): void {
    if (target === 'start') {
      this.bookingModalStartTime = value;
    } else {
      this.bookingModalEndTime = value;
    }
  }

  getBookingWorkstation(event: SchedulerEvent): string {
    const resource = this.resources.find(candidate => candidate.id === event.resourceId);
    return resource?.label ?? event.resourceId;
  }

  getBookingResource(event: SchedulerEvent): string {
    return this.getBookingWorkstation(event);
  }

  getBookingResourceTypeLabel(event: SchedulerEvent): string {
    return this.getRequirementForEvent(event)?.label ?? this.getResourceTypeLabel(event.resourceId);
  }

  getBookingResourceOptions(event: SchedulerEvent): SchedulerResource[] {
    const requirement = this.getRequirementForEvent(event);
    if (!requirement) return this.bookingEligibleResources;
    return this.bookingEligibleResources.filter(resource => this.schedulerResourceMatchesRequirement(resource, requirement));
  }

  getBookedResourceIdForAdditionalResource(event: SchedulerEvent, resourceType: string): string {
    const jobId = event.meta?.job?.id ?? event.meta?.entry?.jobId;
    const booking = this.bookings.find(candidate =>
      candidate.jobId === jobId &&
      candidate.entryId !== event.id &&
      candidate.resourceType === resourceType
    );
    if (booking) return this.events.find(candidate => candidate.id === booking.entryId)?.resourceId ?? '';

    return this.events.find(candidate =>
      candidate.id !== event.id &&
      this.isSameJobResourceEvent(event, candidate) &&
      (candidate.meta?.job?.id ?? candidate.meta?.entry?.jobId) === jobId &&
      (this.resources.find(resource => resource.id === candidate.resourceId)?.meta as Resource | undefined)?.type === resourceType
    )?.resourceId ?? '';
  }

  getAdditionalRequiredResources(event: SchedulerEvent): Array<{ key: string; label: string; requirement: JobResourceRequirement }> {
    const job = event.meta?.job;
    const requirements = job ? this.getSchedulingRequirements(job) : [];
    const jobId = job?.id ?? event.meta?.entry?.jobId;
    const scheduledSiblingRequirements = this.events
      .filter(candidate =>
        candidate.id !== event.id &&
        this.isSameJobResourceEvent(event, candidate) &&
        (candidate.meta?.job?.id ?? candidate.meta?.entry?.jobId) === jobId
      )
      .map(candidate => this.getScheduledRequirementFromEvent(candidate))
      .filter((requirement): requirement is JobResourceRequirement => !!requirement);
    const allRequirements = [...requirements, ...scheduledSiblingRequirements].filter((requirement, index, list) =>
      list.findIndex(candidate => candidate.resourceType === requirement.resourceType) === index
    );
    if (allRequirements.length <= 1) return [];

    const currentResourceType = (this.resources.find(resource => resource.id === event.resourceId)?.meta as Resource | undefined)?.type;
    return allRequirements
      .filter(requirement => requirement.resourceType !== currentResourceType)
      .map(requirement => ({
        key: requirement.resourceType,
        label: this.formatMissingRequirement(requirement),
        requirement,
      }));
  }

  getAdditionalResourceOptions(requirement: JobResourceRequirement): SchedulerResource[] {
    return this.bookingEligibleResources.filter(resource => this.schedulerResourceMatchesRequirement(resource, requirement));
  }

  private getBookedResourceIdForRequirement(
    event: SchedulerEvent,
    requirement: { requirement: JobResourceRequirement },
  ): string | null {
    const booking = this.bookings.find(candidate =>
      candidate.jobId === (event.meta?.job?.id ?? event.meta?.entry?.jobId) &&
      candidate.entryId !== event.id &&
      candidate.resourceType === requirement.requirement.resourceType
    );
    return booking?.entryId ? this.events.find(candidate => candidate.id === booking.entryId)?.resourceId ?? null : null;
  }

  private getRequirementForEvent(event: SchedulerEvent): JobResourceRequirement | null {
    const resourceType = (this.resources.find(resource => resource.id === event.resourceId)?.meta as Resource | undefined)?.type;
    const job = event.meta?.job;
    if (!resourceType) return null;
    return job
      ? this.getSchedulingRequirements(job).find(requirement => requirement.resourceType === resourceType) ?? this.getScheduledRequirementFromEvent(event)
      : this.getScheduledRequirementFromEvent(event);
  }

  private getScheduledRequirementFromEvent(event: SchedulerEvent): JobResourceRequirement | null {
    const resource = this.resources.find(candidate => candidate.id === event.resourceId)?.meta as Resource | undefined;
    if (!resource) return null;
    return {
      resourceType: resource.type,
      requiredQualifications: [],
      label: this.getResourceTypeLabel(event.resourceId),
    };
  }

  private isSameJobResourceEvent(source: SchedulerEvent, candidate: SchedulerEvent): boolean {
    return this.isJobEvent(source) && this.isJobEvent(candidate);
  }

  private isActivityEvent(event: SchedulerEvent): boolean {
    return this.isActivityScheduleEntry(event.meta?.entry);
  }

  private isJobEvent(event: SchedulerEvent | undefined): event is SchedulerEvent {
    return !!event && this.isJobScheduleEntry(event.meta?.entry);
  }

  private getResourceTypeLabel(resourceId: string): string {
    const resourceType = (this.resources.find(resource => resource.id === resourceId)?.meta as Resource | undefined)?.type;
    return resourceType ? resourceType.charAt(0).toUpperCase() + resourceType.slice(1) : 'Resource';
  }

  private schedulerResourceMatchesRequirement(resource: SchedulerResource, requirement: JobResourceRequirement): boolean {
    const rawResource = resource.meta as Resource | undefined;
    return !!rawResource && this.hasMatchingResource([rawResource], requirement);
  }

  getBookingOrder(event: SchedulerEvent): string {
    const order = this.findOrderForEvent(event);
    return order?.referenceNumber ?? order?.id ?? 'NA';
  }

  getBookingReferenceInfo(event: SchedulerEvent): string {
    return `${this.getBookingOrder(event)} • ${event.title}`;
  }

  getBookingVehicle(event: SchedulerEvent): string {
    return this.findOrderForEvent(event)?.vehicle?.licensePlate ?? 'NA';
  }

  getBookingCustomer(event: SchedulerEvent): string {
    return this.findOrderForEvent(event)?.customer?.name ?? 'NA';
  }

  getBookingCustomerEmail(event: SchedulerEvent): string {
    return this.findOrderForEvent(event)?.customer?.email ?? 'NA';
  }

  getBookingCustomerPhone(event: SchedulerEvent): string {
    return this.findOrderForEvent(event)?.customer?.phone ?? 'NA';
  }

  getOrderLabel(order: any): string {
    return order.referenceNumber ?? order.id;
  }

  getOrderFru(order: any): number {
    const jobsFru = (order.jobs ?? []).reduce((total: number, job: any) => total + this.getJobFru(job), 0);
    const activitiesFru = this.getActivitiesForOrder(order).reduce((total, activity) => total + this.getActivityFru(activity), 0);
    return jobsFru + activitiesFru;
  }

  public formatHours(hours: number): string {
    return hours % 1 === 0 ? String(hours) : hours.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  }

  isOrderFullyScheduled(order: any): boolean {
    const jobs = order.jobs ?? [];
    const jobsScheduled = jobs.length > 0 && jobs.every((job: any) => this.isJobScheduledForOrder(job, order));
    const activitiesScheduled = this.getActivitiesForOrder(order).every(activity => !!this.getActivityBooking(activity, order.id));
    return jobsScheduled && (activitiesScheduled || this.hasExistingScheduledEntriesForOrder(order));
  }

  onOrderDragStart(event: DragEvent, order: any): void {
    event.dataTransfer?.setData('orderId', order.id);
    event.dataTransfer?.setData('dropType', 'order');
    event.dataTransfer?.setData('application/json', JSON.stringify({ type: 'order', orderId: order.id }));
    event.dataTransfer?.setData('text/plain', order.id);
  }

  onJobDragStart(event: DragEvent, job: any, order: any): void {
    event.stopPropagation();
    event.dataTransfer?.setData('jobId', job.id);
    event.dataTransfer?.setData('orderId', order.id);
    event.dataTransfer?.setData('dropType', 'job');
    event.dataTransfer?.setData('fru', String(this.getJobFru(job)));
    event.dataTransfer?.setData('resourceType', job.requiredResourceType ?? '');
    event.dataTransfer?.setData('application/json', JSON.stringify({ type: 'job', jobId: job.id, orderId: order.id }));
    event.dataTransfer?.setData('text/plain', job.id);
  }

  onActivityDragStart(event: DragEvent, activity: ActivityTile, order: any): void {
    event.stopPropagation();
    event.dataTransfer?.setData('jobId', activity.id);
    event.dataTransfer?.setData('orderId', order.id);
    event.dataTransfer?.setData('dropType', 'activity');
    event.dataTransfer?.setData('fru', String(this.getActivityFru(activity)));
    event.dataTransfer?.setData('resourceType', activity.resourceType ?? '');
    event.dataTransfer?.setData('application/json', JSON.stringify({ type: 'activity', jobId: activity.id, orderId: order.id }));
    event.dataTransfer?.setData('text/plain', activity.id);
  }

  isBookFirstDisabled(orderId: string): boolean {
    const order = this.allOrders.find(candidate => candidate.id === orderId);
    return this.schedulingError === orderId || (!!order && this.isOrderFullyScheduled(order));
  }

  onBookFirstAvailabilityForOrder(order: any): void {
    this.selectedPanelOrderId = order.id;
    this.restoreProposalStateForOrder(order.id);
    const searchFrom = new Date(this.viewStart);
    this.applyProposal(searchFrom, true);
  }

  hasPreviousForOrder(orderId: string): boolean {
    return (this.proposalStateByOrder.get(orderId)?.index ?? -1) > 0;
  }

  onBookPreviousForOrder(order: any): void {
    this.selectedPanelOrderId = order.id;
    this.restoreProposalStateForOrder(order.id);
    this.onBookPrevious();
  }

  canNavigateAvailability(_orderId: string): boolean {
    return true;
  }

  onBookNextForOrder(order: any): void {
    this.selectedPanelOrderId = order.id;
    this.restoreProposalStateForOrder(order.id);
    if (this.currentProposalIndex < 0) {
      const scheduledEntries = this.getExistingScheduleEntriesForOrder(order);
      if (scheduledEntries.length) {
        const start = new Date(Math.min(...scheduledEntries.map(entry => entry.start.getTime())));
        const end = new Date(Math.max(...scheduledEntries.map(entry => entry.end.getTime())));
        this.proposalHistory = [start];
        this.proposalEndHistory = [end];
        this.currentProposalIndex = 0;
        this.applyProposal(new Date(end.getTime() + 15 * 60000), false);
        return;
      }
      this.applyProposal(new Date(this.viewStart.getTime() + 15 * 60000), true);
      return;
    }
    this.onBookNext();
  }

  isJobScheduled(job: any): boolean {
    return this.isJobScheduledForOrder(job, this.allOrders.find(order => order.jobs?.some((candidate: any) => candidate.id === job.id)));
  }

  private isJobScheduledForOrder(job: any, order: any): boolean {
    if (!order) return false;
    const requirements = this.getJobRequirements(job);
    return requirements.every(requirement =>
      !!this.getJobRequirementBooking(job, requirement) ||
      !!this.getExistingScheduleBookingForJob(job, order, requirement.resourceType)
    );
  }

  getJobFru(job: any): number {
    return Number(job.fru ?? job.durationFru ?? Math.max(0.25, (job.estimatedDurationMinutes ?? 0) / MINUTES_PER_FRU));
  }

  getJobRequirements(job: any): Array<{ label: string; resourceType?: string }> {
    const requirements = job.requirements ?? job.resourceRequirements;
    if (Array.isArray(requirements) && requirements.length) {
      return requirements.map((requirement: any) => ({
        label: requirement.label ?? requirement.resourceLabel ?? requirement.type ?? 'Resource',
        resourceType: requirement.resourceType ?? requirement.type,
      }));
    }
    return [{ label: 'Technician', resourceType: 'mechanic' }];
  }

  getJobRequirementBooking(job: any, requirement: { resourceType?: string }): JobBooking | undefined {
    const bookings = this.bookings.filter(booking => booking.jobId === job.id);
    const liveBooking = bookings.find(booking => !requirement.resourceType || booking.resourceType === requirement.resourceType);
    if (liveBooking) return liveBooking;

    const order = this.allOrders.find(candidate => candidate.jobs?.some((orderJob: any) => orderJob.id === job.id));
    return order ? this.getExistingScheduleBookingForJob(job, order, requirement.resourceType) : undefined;
  }

  getJobBookingSets(job: any, order: any): BookingSet[] {
    const liveBookings = this.bookings.filter(booking => booking.orderId === order.id && booking.jobId === job.id);
    const liveSets = this.groupBookingsByTime(liveBookings);
    if (liveSets.length) return liveSets;

    const entries = this.scheduleEntries.filter(entry =>
      entry.jobId === job.id &&
      entry.workOrderReference === order.referenceNumber &&
      this.isJobScheduleEntry(entry) &&
      (entry.kind === 'blocked-order' || entry.kind === 'scheduled')
    );
    return this.groupBookingsByTime(this.getPersistedBookingsFromEntries(entries, this.allOrders));
  }

  getJobPendingRequirements(job: any, bookingSets: BookingSet[]): Array<{ label: string; resourceType?: string }> {
    const bookedTypes = new Set(
      bookingSets.flatMap(set => set.bookings.map(booking => booking.resourceType).filter(Boolean))
    );
    return this.getJobRequirements(job).filter(requirement =>
      !requirement.resourceType || !bookedTypes.has(requirement.resourceType)
    );
  }

  private groupBookingsByTime(bookings: JobBooking[]): BookingSet[] {
    const groups = new Map<string, JobBooking[]>();
    for (const booking of bookings) {
      const entry = this.scheduleEntries.find(candidate => candidate.id === booking.entryId);
      if (!entry) continue;
      const key = booking.bookingSetId ?? this.getEntryBookingSetId(entry);
      const group = groups.get(key) ?? [];
      group.push(booking);
      groups.set(key, group);
    }

    return [...groups.entries()]
      .map(([id, group]) => ({
        id,
        summary: this.getBookingScheduleSummary(group[0]),
        bookings: group.sort((first, second) => this.compareBookingResources(first, second)),
      }))
      .sort((first, second) => this.getBookingSetStart(first) - this.getBookingSetStart(second));
  }

  private getBookingSetStart(set: BookingSet): number {
    const entry = this.scheduleEntries.find(candidate => candidate.id === set.bookings[0]?.entryId);
    return entry?.start.getTime() ?? 0;
  }

  private compareBookingResources(first: JobBooking, second: JobBooking): number {
    const order: Record<string, number> = {
      mechanic: 0,
      bay: 1,
      device: 2,
    };
    const firstOrder = order[first.resourceType] ?? 99;
    const secondOrder = order[second.resourceType] ?? 99;
    return firstOrder - secondOrder || first.resourceName.localeCompare(second.resourceName);
  }

  private isJobScheduleEntry(entry: ScheduleEntry | undefined): entry is ScheduleEntry {
    return !!entry &&
      entry.workorderItemCategory !== 'activity' &&
      !this.isActivityId(entry.jobId) &&
      !this.isActivityScheduleEntry(entry);
  }

  private getEntryBookingSetId(entry: ScheduleEntry): string {
    return entry.bookingSetId ?? `${entry.workOrderReference ?? ''}:${entry.jobId}:${entry.start.getTime()}-${entry.end.getTime()}`;
  }

  private getBookingSetEntries(entry: ScheduleEntry): ScheduleEntry[] {
    const bookingSetId = this.getEntryBookingSetId(entry);
    return this.scheduleEntries.filter(candidate =>
      this.isJobScheduleEntry(candidate) &&
      this.getEntryBookingSetId(candidate) === bookingSetId
    );
  }

  private canSplitEvent(event: SchedulerEvent | undefined): boolean {
    if (!this.isJobEvent(event)) return false;
    const duration = event.end.getTime() - event.start.getTime();
    return duration >= this.slotDurationMinutes * 2 * 60000;
  }

  private isActivityScheduleEntry(entry: ScheduleEntry | undefined): boolean {
    if (!entry) return false;
    const title = (entry.title ?? '').toLowerCase();
    return entry.workorderItemCategory === 'activity' ||
      this.isActivityId(entry.jobId) ||
      title.startsWith('check-in') ||
      title.startsWith('handover') ||
      title.startsWith('courtesy car');
  }

  canUndoBooking(booking: JobBooking): boolean {
    return this.bookings.some(candidate => candidate.entryId === booking.entryId) || this.scheduleEntries.some(entry => entry.id === booking.entryId);
  }

  getActivitiesForOrder(_order: any): ActivityTile[] {
    return this.activityTiles.map(activity => ({
      ...activity,
      id: this.getOrderActivityId(_order.id, activity.id),
      templateId: activity.id,
      orderId: _order.id,
    }));
  }

  getActivityBooking(activity: ActivityTile, _orderId: string): JobBooking | undefined {
    const activityTemplateId = this.getActivityTemplateId(activity.id);
    const liveBooking = this.bookings.find(booking =>
      booking.orderId === _orderId &&
      (booking.jobId === activity.id || this.getActivityTemplateId(booking.jobId) === activityTemplateId)
    );
    if (liveBooking) return liveBooking;

    const order = this.allOrders.find(candidate => candidate.id === _orderId);
    return order ? this.getExistingScheduleBookingForActivity(activity, order) : undefined;
  }

  getActivityFru(activity: ActivityTile): number {
    return activity.fru;
  }

  getBookingScheduleSummary(booking: JobBooking): string {
    const entry = this.scheduleEntries.find(candidate => candidate.id === booking.entryId);
    if (!entry) return '';
    return `${this.formatOrderScheduleDateTime(entry.start)} | ${this.formatDuration(entry.start, entry.end)}`;
  }

  scrollToBookingInAvailabilityView(order: any, booking: JobBooking): void {
    this.selectedPanelOrderId = order.id;
    this.showBookingDetails = false;
    this.scrollToEventId = null;
    queueMicrotask(() => {
      this.scrollToEventId = booking.entryId;
    });
  }

  private formatOrderScheduleDateTime(value: Date): string {
    const day = String(value.getDate()).padStart(2, '0');
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const year = value.getFullYear();
    const hours = String(value.getHours()).padStart(2, '0');
    const minutes = String(value.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  }

  private formatDuration(start: Date, end: Date): string {
    const totalMinutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours && minutes) return `${hours}hr ${minutes}min`;
    if (hours) return `${hours}hr`;
    return `${minutes}min`;
  }

  private hasExistingScheduledEntriesForOrder(order: any): boolean {
    const entries = this.getExistingScheduleEntriesForOrder(order);
    return entries.length > 0 && entries.every(entry => entry.kind === 'blocked-order' || entry.kind === 'scheduled');
  }

  private getExistingScheduleEntriesForOrder(order: any): ScheduleEntry[] {
    return this.scheduleEntries.filter(entry => entry.workOrderReference === order.referenceNumber);
  }

  private getPersistedBookingsFromEntries(entries: ScheduleEntry[], orders: any[]): JobBooking[] {
    return entries
      .filter(entry => entry.kind === 'scheduled' || entry.kind === 'blocked-order')
      .map((entry): JobBooking | null => {
        const order = entry.workOrderReference
          ? orders.find(candidate => candidate.referenceNumber === entry.workOrderReference || candidate.id === entry.workOrderReference)
          : orders.find(candidate => candidate.jobs?.some((job: any) => job.id === entry.jobId));
        if (!order) return null;

        const resource = this.resources.find(candidate => candidate.id === entry.resourceId);
        return {
          jobId: entry.jobId,
          resourceType: (resource?.meta as any)?.type ?? 'mechanic',
          resourceName: resource?.label ?? entry.resourceId,
          entryId: entry.id,
          orderId: order.id,
          bookingSetId: this.getEntryBookingSetId(entry),
        };
      })
      .filter((booking): booking is JobBooking => !!booking);
  }

  private mapScheduleEntriesToEvents(entries: ScheduleEntry[]): SchedulerEvent[] {
    const jobMap = new Map(
      this.allOrders.flatMap((order: any) => order.jobs.map((job: any) => [job.id, { job, order }]))
    );

    return entries.map(entry => {
      const found = jobMap.get(entry.jobId) as any;
      const order = found?.order ??
        this.allOrders.find(candidate => candidate.referenceNumber === entry.workOrderReference || candidate.id === entry.workOrderReference);
      return {
        id: entry.id,
        resourceId: entry.resourceId,
        start: entry.start,
        end: entry.end,
        title: entry.title ?? found?.job.title ?? entry.jobId,
        color: entry.color ?? '#4C68B1',
        meta: {
          job: found?.job,
          order,
          entry: {
            ...entry,
            workorderItemStatus: entry.workorderItemStatus ?? found?.job?.workorderItemStatus ?? 'scheduled',
            workorderItemCategory: entry.workorderItemCategory ?? found?.job?.workorderItemCategory ?? 'job',
          },
        } as any,
      };
    });
  }

  private upsertScheduleEntry(entry: ScheduleEntry): void {
    this.scheduleEntries = [
      ...this.scheduleEntries.filter(candidate => candidate.id !== entry.id),
      entry,
    ];
  }

  private updateScheduleEntryTimes(entryId: string, start: Date, end: Date): void {
    this.scheduleEntries = this.scheduleEntries.map(entry =>
      entry.id === entryId ? { ...entry, start, end } : entry
    );
  }

  private updateScheduleEntry(entryId: string, changes: Partial<ScheduleEntry>): void {
    this.scheduleEntries = this.scheduleEntries.map(entry =>
      entry.id === entryId ? { ...entry, ...changes } : entry
    );
  }

  private updateEventEntry(entryId: string, changes: Partial<ScheduleEntry>): void {
    this.events = this.events.map(event =>
      event.id === entryId
        ? { ...event, meta: { ...(event.meta ?? {}), entry: { ...(event.meta?.entry as ScheduleEntry), ...changes } } }
        : event
    );
  }

  private getOccupyingEntriesForProposal(targetOrder: any | undefined): ScheduleEntry[] {
    const targetReference = targetOrder?.referenceNumber;
    const liveEntries: ScheduleEntry[] = this.events.map(event => ({
      id: event.id,
      jobId: event.meta?.entry?.jobId ?? event.meta?.job?.id ?? event.id,
      resourceId: event.resourceId,
      start: event.start,
      end: event.end,
      title: event.title,
      color: event.color,
      kind: event.meta?.entry?.kind,
      workOrderReference: event.meta?.entry?.workOrderReference,
      workorderItemStatus: event.meta?.entry?.workorderItemStatus,
      workorderItemCategory: event.meta?.entry?.workorderItemCategory,
    }));

    const entriesById = new Map<string, ScheduleEntry>();
    [...this.scheduleEntries, ...liveEntries]
      .filter(entry => !targetReference || entry.workOrderReference !== targetReference)
      .forEach(entry => entriesById.set(entry.id, entry));

    return [...entriesById.values()];
  }

  private restoreProposalStateForOrder(orderId: string): void {
    const state = this.proposalStateByOrder.get(orderId);
    this.proposalHistory = state ? [...state.history] : [];
    this.proposalEndHistory = state ? [...state.endHistory] : [];
    this.currentProposalIndex = state?.index ?? -1;
    this.hasPrevious = this.currentProposalIndex > 0;
  }

  private saveProposalStateForOrder(orderId: string): void {
    this.proposalStateByOrder.set(orderId, {
      history: [...this.proposalHistory],
      endHistory: [...this.proposalEndHistory],
      index: this.currentProposalIndex,
    });
  }

  private clearExistingScheduleEntriesForOrder(order: any): void {
    const entries = this.getExistingScheduleEntriesForOrder(order);
    const entryIds = new Set(entries.map(entry => entry.id));
    if (entryIds.size === 0) return;

    entryIds.forEach(entryId => this.scheduleRepo.unassign(entryId).subscribe());
    this.scheduleEntries = this.scheduleEntries.filter(entry => !entryIds.has(entry.id));
    this.events = this.events.filter(event => !entryIds.has(event.id));
    this.unavailability = this.unavailability.filter(block =>
      !entries.some(entry =>
        block.kind === 'blocked-order' &&
        block.resourceId === entry.resourceId &&
        block.start.getTime() === entry.start.getTime() &&
        block.end.getTime() === entry.end.getTime()
      )
    );
    for (const entryId of entryIds) {
      this.latestAutoBookingEntryIds.delete(entryId);
    }
  }

  private getExistingScheduleBookingForJob(job: any, order: any, resourceType?: string): JobBooking | undefined {
    const entries = this.scheduleEntries.filter(entry =>
      entry.jobId === job.id &&
      entry.workOrderReference === order.referenceNumber &&
      (entry.kind === 'blocked-order' || entry.kind === 'scheduled')
    );
    if (!entries.length) return undefined;

    const entry = entries.find(candidate => {
      const resource = this.resources.find(item => item.id === candidate.resourceId);
      return !resourceType || (resource?.meta as any)?.type === resourceType;
    });
    if (!entry) return undefined;

    const resource = this.resources.find(item => item.id === entry.resourceId);
    return {
      jobId: job.id,
      resourceType: (resource?.meta as any)?.type ?? resourceType ?? 'mechanic',
      resourceName: resource?.label ?? entry.resourceId,
      entryId: entry.id,
      orderId: order.id,
    };
  }

  private getExistingScheduleBookingForActivity(activity: ActivityTile, order: any): JobBooking | undefined {
    const titlePrefixByActivity: Record<string, string> = {
      'act-checkin': 'check-in',
      'act-handover': 'handover',
      'act-mobility': 'courtesy car',
    };
    const titlePrefix = titlePrefixByActivity[this.getActivityTemplateId(activity.id)];
    if (!titlePrefix) return undefined;

    const entry = this.getExistingScheduleEntriesForOrder(order).find(candidate =>
      (candidate.kind === 'blocked-order' || candidate.kind === 'scheduled') &&
      (candidate.title ?? '').toLowerCase().startsWith(titlePrefix)
    );
    if (!entry) return undefined;

    const resource = this.resources.find(item => item.id === entry.resourceId);
    return {
      jobId: activity.id,
      resourceType: (resource?.meta as any)?.type ?? activity.resourceType,
      resourceName: resource?.label ?? entry.resourceId,
      entryId: entry.id,
      orderId: order.id,
    };
  }

  onEventDropped(payload: EventDropPayload): void {
    this.isAutoProposalVisible = false;
    const activeOrderId = payload.orderId ?? this.getOrderIdForJob(payload.jobId) ?? this.getActiveWorkOrderId() ?? undefined;
    const activityTemplateId = this.getActivityTemplateId(payload.jobId);
    let start = payload.start;
    let end = payload.end;
    if (this.isFixedDurationActivity(payload.jobId)) {
      end = new Date(start.getTime() + this.getActivityDurationMinutes(payload.jobId) * 60000);
    }
    if (!this.isActivityId(payload.jobId)) {
      const checkinEnd = this.getCheckinEndForOrder(activeOrderId);
      if (checkinEnd && start < checkinEnd) {
        const duration = end.getTime() - start.getTime();
        start = new Date(checkinEnd);
        end = new Date(start.getTime() + duration);
      }
    }
    if (activityTemplateId === 'act-handover') {
      const latestJobEnd = this.getLatestJobEndForOrder(activeOrderId);
      if (latestJobEnd && start < latestJobEnd) {
        start = new Date(latestJobEnd);
        end = new Date(start.getTime() + this.getActivityDurationMinutes('act-handover') * 60000);
      }
    }

    if (!this.bookingEligibleResources.some(resource => resource.id === payload.resourceId)) {
      return;
    }

    const droppedResource = this.resources.find(r => r.id === payload.resourceId);
    const droppedResourceType = payload.droppedResourceType ?? (droppedResource?.meta as any)?.type;
    const bookingResourceType = droppedResourceType ?? payload.resourceType ?? 'mechanic';
    const existingJobBooking = this.bookings.find(b =>
      b.jobId === payload.jobId &&
      (!activeOrderId || b.orderId === activeOrderId)
    );
    const bookingSetId = this.isActivityId(payload.jobId)
      ? undefined
      : existingJobBooking?.bookingSetId ?? `${activeOrderId ?? 'order'}:${payload.jobId}:${start.getTime()}-${end.getTime()}`;
    if (existingJobBooking) {
      const existingEvent = this.events.find(e => e.id === existingJobBooking.entryId);
      if (existingEvent) {
        start = existingEvent.start;
        end = existingEvent.end;
      }
    }

    // Business rule: mobility service spans from check-in end to handover end
    if (activityTemplateId === 'act-mobility') {
      const span = this.getMobilitySpan(activeOrderId);
      if (span) { start = span.start; end = span.end; }
    }

    if (!this.isWithinAppointmentBookingHours(start, end)) return;

    const entry = {
      id: `se-${Date.now()}`,
      jobId: payload.jobId,
      resourceId: payload.resourceId,
      start,
      end,
      title: this.getActivityTemplate(activityTemplateId)?.title,
      kind: 'scheduled' as const,
      workOrderReference: this.allOrders.find(candidate => candidate.id === activeOrderId)?.referenceNumber,
      workorderItemStatus: 'scheduled' as const,
      workorderItemCategory: this.isActivityId(payload.jobId) ? 'activity' as const : 'job' as const,
      bookingSetId,
    };

    this.scheduleRepo.assign(entry).subscribe(assigned => {
      const found = this.isActivityId(payload.jobId)
        ? undefined
        : this.allOrders.flatMap((o: any) => o.jobs).find((j: any) => j.id === payload.jobId);
      const resource = this.resources.find(r => r.id === payload.resourceId);
      const order = this.allOrders.find(candidate => candidate.id === activeOrderId);
      const activity = this.getActivityTemplate(activityTemplateId);

      // Add the event and booking first
      this.events = [...this.events, {
        id: assigned.id,
        resourceId: assigned.resourceId,
        start: assigned.start,
        end: assigned.end,
        title: found?.title ?? activity?.title ?? payload.jobId,
        color: '#4C68B1',
        meta: {
          job: found,
          order,
          entry: {
            ...assigned,
            workOrderReference: order?.referenceNumber,
            workorderItemStatus: 'scheduled',
            workorderItemCategory: this.isActivityId(payload.jobId) ? 'activity' : 'job',
          },
        } as any,
      }];

      this.upsertScheduleEntry(assigned);

      // Business rule: after check-in or handover is booked, sync mobility span if it exists
      if (activityTemplateId === 'act-checkin' || activityTemplateId === 'act-handover') {
        this.syncMobilitySpan(activeOrderId);
        this.syncOrderAppointmentFromBookings(activeOrderId);
      }

      // Business rule: when mobility is dropped, snap its span to check-in end→handover end if both booked
      if (activityTemplateId === 'act-mobility') {
        const span = this.getMobilitySpan(activeOrderId);
        if (span) {
          this.scheduleRepo.reschedule(assigned.id, span.start, span.end).subscribe(updated => {
            this.events = this.events.map(e =>
              e.id === assigned.id ? { ...e, start: updated.start, end: updated.end } : e
            );
            this.updateScheduleEntryTimes(assigned.id, updated.start, updated.end);
          });
        }
      }
    });
  }

  onUndoBooking(booking: JobBooking): void {
    const event = this.events.find(candidate => candidate.id === booking.entryId);
    if (event?.resourceId && this.plannerMode === 'order') {
      this.pinVisibleResource(event.resourceId);
    }
    this.scheduleRepo.unassign(booking.entryId).subscribe(() => {
      this.events = this.events.filter(e => e.id !== booking.entryId);
      this.scheduleEntries = this.scheduleEntries.filter(entry => entry.id !== booking.entryId);
      this.latestAutoBookingEntryIds.delete(booking.entryId);
      this.syncOrderAppointmentFromBookings(booking.orderId);
      if (this.latestAutoBookingEntryIds.size === 0) {
        this.isAutoProposalVisible = false;
      }
    });
  }

  private pinVisibleResource(resourceId: string): void {
    if (this.pinnedVisibleResourceIds.includes(resourceId)) return;
    this.pinnedVisibleResourceIds = [...this.pinnedVisibleResourceIds, resourceId];
  }

  /** Sync all other booked resources for the same job to the new start/end */
  private syncJobSiblings(movedEntryId: string, start: Date, end: Date): void {
    const movedEntry = this.scheduleEntries.find(entry => entry.id === movedEntryId);
    if (!this.isJobScheduleEntry(movedEntry)) return;

    const siblings = this.getBookingSetEntries(movedEntry).filter(entry => entry.id !== movedEntryId);

    siblings.forEach(sibling => {
      this.scheduleRepo.reschedule(sibling.id, start, end).subscribe(updated => {
        this.events = this.events.map(e =>
          e.id === sibling.id
            ? { ...e, start: updated.start, end: updated.end }
            : e
        );
        this.updateScheduleEntryTimes(sibling.id, updated.start, updated.end);
      });
    });
  }

  private splitJobBookingSet(eventId: string): void {
    const event = this.events.find(candidate => candidate.id === eventId);
    const entry = this.scheduleEntries.find(candidate => candidate.id === eventId) ?? event?.meta?.entry;
    if (!this.canSplitEvent(event) || !this.isJobScheduleEntry(entry)) return;

    const slotMs = this.slotDurationMinutes * 60000;
    const durationMs = entry.end.getTime() - entry.start.getTime();
    const midpoint = new Date(entry.start.getTime() + Math.round((durationMs / 2) / slotMs) * slotMs);
    if (midpoint <= entry.start || midpoint >= entry.end) return;

    const originalSetId = this.getEntryBookingSetId(entry);
    const splitSetId = `${originalSetId}:split:${Date.now()}`;
    const siblings = this.getBookingSetEntries(entry);

    siblings.forEach((sibling, index) => {
      const originalEnd = new Date(sibling.end);
      const originalStart = new Date(sibling.start);
      const normalizedSibling = { ...sibling, bookingSetId: originalSetId };

      this.scheduleRepo.reschedule(sibling.id, originalStart, midpoint).subscribe(updated => {
        const firstHalf = { ...updated, bookingSetId: originalSetId };
        this.events = this.events.map(candidate =>
          candidate.id === sibling.id
            ? {
                ...candidate,
                start: firstHalf.start,
                end: firstHalf.end,
                meta: { ...(candidate.meta ?? {}), entry: { ...(candidate.meta?.entry as ScheduleEntry), ...firstHalf } },
              }
            : candidate
        );
        this.updateScheduleEntry(sibling.id, firstHalf);

        const secondHalf: ScheduleEntry = {
          ...normalizedSibling,
          id: `split-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
          start: new Date(midpoint),
          end: originalEnd,
          bookingSetId: splitSetId,
        };

        this.scheduleRepo.assign(secondHalf).subscribe(assigned => {
          const assignedEntry = { ...assigned, bookingSetId: splitSetId };
          const sourceEvent = this.events.find(candidate => candidate.id === sibling.id) ?? event;
          if (!sourceEvent) return;
          this.events = [
            ...this.events,
            {
              ...sourceEvent,
              id: assignedEntry.id,
              title: sourceEvent.title,
              resourceId: assignedEntry.resourceId,
              start: assignedEntry.start,
              end: assignedEntry.end,
              meta: { ...(sourceEvent.meta ?? {}), entry: assignedEntry },
            },
          ];
          this.upsertScheduleEntry(assignedEntry);
          if (this.latestAutoBookingEntryIds.has(sibling.id)) {
            this.latestAutoBookingEntryIds.add(assignedEntry.id);
          }
        });
      });
    });
  }

  onBookFirstAvailability(): void {
    const searchFrom = new Date(this.viewStart.getFullYear(), this.viewStart.getMonth(),
                                this.viewStart.getDate(), 9, 30, 0, 0);
    // Reset history
    this.proposalHistory = [];
    this.proposalEndHistory = [];
    this.currentProposalIndex = -1;
    this.applyProposal(searchFrom, true);
  }

  onBookNext(): void {
    if (this.currentProposalIndex < 0) return;
    const currentProposalEnd = this.proposalEndHistory[this.currentProposalIndex]
      ?? this.proposalHistory[this.currentProposalIndex];
    // Advance by 15 min from the current proposal end to find the next distinct slot
    const nextSearchFrom = new Date(currentProposalEnd.getTime() + 15 * 60000);
    this.applyProposal(nextSearchFrom, false);
  }

  onBookPrevious(): void {
    if (this.currentProposalIndex <= 0) return;
    this.currentProposalIndex--;
    const searchFrom = this.proposalHistory[this.currentProposalIndex];
    this.clearCurrentBookings(this.getActiveWorkOrderId() ?? undefined);
    this.applyProposal(searchFrom, false, true);
  }

  private applyProposal(searchFrom: Date, resetHistory: boolean, isReplay = false): void {
    const targetWorkOrderId = this.getActiveWorkOrderId();
    const unscheduledTiles = this.jobTiles.filter(t => t.workOrder.id === targetWorkOrderId);
    const targetOrder = this.allOrders.find(order => order.id === targetWorkOrderId);
    const unscheduledJobs = unscheduledTiles.length
      ? unscheduledTiles.map(t => t.job)
      : targetOrder?.jobs ?? [];
    if (unscheduledJobs.length === 0) return;

    const rawResources = this.bookingEligibleResources.map(r => r.meta as Resource).filter(Boolean);
    const missingRequirements = this.getMissingRequirementsForResources(unscheduledJobs, rawResources, targetOrder);
    if (missingRequirements.length) {
      this.setSchedulingError(this.buildMissingResourceMessage(missingRequirements));
      return;
    }

    const existingEntries = this.getOccupyingEntriesForProposal(targetOrder);

    const result = this.autoScheduler.schedule({
      jobs: unscheduledJobs,
      resources: rawResources,
      existingEntries,
      unavailability: this.unavailability,
      searchFrom,
      dayStartHour: 9,
      dayEndHour: this.appointmentDayEndHour,
    });

    if (!result) return;

    const checkinStart = new Date(result.checkinStart);
    const checkinEnd = new Date(result.checkinEnd);
    const handoverStart = new Date(result.handoverStart);
    const handoverEnd = new Date(result.handoverEnd);

    const checkinAdvisor = rawResources.find((r: any) => r.id === result.checkinResourceId);
    const handoverAdvisor = rawResources.find((r: any) => r.id === result.handoverResourceId);
    const mobilityDriver = rawResources.find((r: any) => r.id === result.mobilityResourceId);

    if (!checkinAdvisor || !handoverAdvisor || !mobilityDriver) {
      this.setSchedulingError(this.buildMissingResourceMessage([
        ...(!checkinAdvisor ? ['Service Advisor for Check-In'] : []),
        ...(!handoverAdvisor ? ['Service Advisor for Handover'] : []),
        ...(!mobilityDriver ? ['Courtesy Car for Mobility Service'] : []),
      ]));
      return;
    }

    this.clearSchedulingError();

    if (targetOrder) this.clearExistingScheduleEntriesForOrder(targetOrder);
    this.clearCurrentBookings(targetWorkOrderId ?? undefined);

    // Track history
    if (!isReplay) {
      if (resetHistory) {
        this.proposalHistory = [searchFrom];
        this.proposalEndHistory = [new Date(result.handoverEnd)];
        this.currentProposalIndex = 0;
      } else {
        // Trim any forward history and append
        this.proposalHistory = this.proposalHistory.slice(0, this.currentProposalIndex + 1);
        this.proposalEndHistory = this.proposalEndHistory.slice(0, this.currentProposalIndex + 1);
        this.proposalHistory.push(searchFrom);
        this.proposalEndHistory.push(new Date(result.handoverEnd));
        this.currentProposalIndex = this.proposalHistory.length - 1;
      }
    }
    this.hasPrevious = this.currentProposalIndex > 0;
    if (targetWorkOrderId) this.saveProposalStateForOrder(targetWorkOrderId);
    this.latestAutoBookingEntryIds = new Set<string>();
    this.isAutoProposalVisible = true;

    // Apply job entries
    const scrollTargetEntryId = result.entries[0]?.id;
    result.entries.forEach(entry => {
      const persistedEntry = {
        ...entry,
        title: unscheduledJobs.find((j: any) => j.id === entry.jobId)?.title ?? entry.jobId,
        kind: 'scheduled' as const,
        workOrderReference: targetOrder?.referenceNumber,
        workorderItemStatus: 'scheduled' as const,
        workorderItemCategory: 'job' as const,
      };
      this.scheduleRepo.assign(persistedEntry).subscribe(assigned => {
        const job = unscheduledJobs.find((j: any) => j.id === assigned.jobId);
        const resource = this.resources.find(r => r.id === assigned.resourceId);
        const resourceType = (resource?.meta as any)?.type ?? 'mechanic';
        this.events = [...this.events, {
          id: assigned.id, resourceId: assigned.resourceId,
          start: assigned.start, end: assigned.end,
          title: job?.title ?? assigned.jobId, color: '#4C68B1',
          meta: {
            job,
            order: targetOrder,
            entry: {
              ...assigned,
              workOrderReference: targetOrder?.referenceNumber,
              workorderItemStatus: 'scheduled',
              workorderItemCategory: 'job',
            },
          } as any,
        }];
        this.upsertScheduleEntry(assigned);
        this.latestAutoBookingEntryIds.add(assigned.id);
        if (assigned.id === scrollTargetEntryId) {
          this.scrollToEventId = assigned.id;
        }
      });
    });

    this.bookActivity(this.getOrderActivityId(targetWorkOrderId, 'act-checkin'),  checkinAdvisor,  checkinStart,  checkinEnd, targetWorkOrderId ?? undefined);
    this.bookActivity(this.getOrderActivityId(targetWorkOrderId, 'act-handover'), handoverAdvisor, handoverStart, handoverEnd, targetWorkOrderId ?? undefined);
    this.bookActivity(this.getOrderActivityId(targetWorkOrderId, 'act-mobility'), mobilityDriver,  checkinEnd,  handoverEnd, targetWorkOrderId ?? undefined);
    if (targetWorkOrderId) {
      this.syncOrderAppointment(targetWorkOrderId, checkinStart, handoverStart, handoverEnd);
    }
  }

  private getActiveWorkOrderId(): string | null {
    return this.selectedPanelOrderId || this.activeOrderId || this.jobTiles[0]?.workOrder.id || null;
  }

  private alignViewWindowToOrder(order: any | undefined): void {
    const selection = order ? this.quickViewSelection.getSelection(order.id) : null;
    const anchor = selection?.checkinStart ?? order?.appointmentStart;
    if (!anchor) return;
    const start = new Date(anchor);
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diff);
    start.setHours(8, 0, 0, 0);
    this.viewStart = start;
    const end = new Date(start);
    end.setDate(start.getDate() + 4);
    end.setHours(21, 0, 0, 0);
    const appointmentEnd = selection?.handoverEnd ?? selection?.handoverStart ?? order?.appointmentEnd;
    if (appointmentEnd && new Date(appointmentEnd) > end) {
      end.setTime(new Date(appointmentEnd).getTime());
      end.setHours(21, 0, 0, 0);
    }
    this.viewEnd = end;
  }

  private applyQuickViewSelection(): void {
    const activeOrderId = this.getActiveWorkOrderId();
    if (!activeOrderId) return;
    const order = this.allOrders.find(candidate => candidate.id === activeOrderId || candidate.referenceNumber === activeOrderId);
    if (!order) return;
    const selection = this.quickViewSelection.getSelection(order.id);
    if (!selection) return;
    this.alignViewWindowToOrder(order);
    this.syncOrderAppointment(order.id, selection.checkinStart, selection.handoverStart ?? selection.handoverEnd, selection.handoverEnd);
    this.scheduleRepo.getEntries(this.viewStart, this.viewEnd).subscribe(entries => {
      this.scheduleEntries = entries;
      this.events = this.mapScheduleEntriesToEvents(entries);
      this.ensureQuickViewAppointmentActivityEntries(order, selection);
      if (this.plannerMode === 'order') {
        this.latestAutoBookingEntryIds = new Set(
          this.scheduleEntries
            .filter(entry => entry.workOrderReference === order.referenceNumber)
            .map(entry => entry.id)
        );
        this.isAutoProposalVisible = this.latestAutoBookingEntryIds.size > 0;
      }
      this.scrollToActiveOrderBooking();
    });
  }

  private ensureQuickViewAppointmentActivityEntries(order: any, selection: QuickViewSelection): void {
    const checkinStart = new Date(selection.checkinStart);
    const checkinEnd = new Date(checkinStart.getTime() + this.getActivityDurationMinutes('act-checkin') * 60000);
    const handoverStart = new Date(selection.handoverStart ?? selection.handoverEnd);
    const handoverEnd = new Date(selection.handoverEnd ?? handoverStart.getTime() + this.getActivityDurationMinutes('act-handover') * 60000);

    this.upsertAppointmentActivityEntry(order, 'act-checkin', 'Check-In', checkinStart, checkinEnd);
    this.upsertAppointmentActivityEntry(order, 'act-handover', 'Handover', handoverStart, handoverEnd);
  }

  private upsertAppointmentActivityEntry(order: any, activityTemplateId: string, title: string, start: Date, end: Date): void {
    if (!this.isWithinAppointmentBookingHours(start, end)) return;

    const existingEntry = this.scheduleEntries.find(entry =>
      entry.workOrderReference === order.referenceNumber && this.getActivityTemplateId(entry.jobId) === activityTemplateId
    );

    if (existingEntry) {
      if (existingEntry.start.getTime() === start.getTime() && existingEntry.end.getTime() === end.getTime()) return;
      this.scheduleRepo.reschedule(existingEntry.id, start, end).subscribe(updated => {
        this.updateScheduleEntryTimes(existingEntry.id, updated.start, updated.end);
        this.events = this.events.map(event =>
          event.id === existingEntry.id
            ? { ...event, start: updated.start, end: updated.end, meta: { ...(event.meta ?? {}), entry: { ...(event.meta?.entry as ScheduleEntry), ...updated } } }
            : event
        );
      });
      return;
    }

    const advisor = this.resources.find(resource => (resource.meta as Resource | undefined)?.type === 'advisor');
    if (!advisor) return;

    const entry: ScheduleEntry = {
      id: `appt-${activityTemplateId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      jobId: this.getOrderActivityId(order.id, activityTemplateId),
      resourceId: advisor.id,
      start,
      end,
      title,
      kind: 'scheduled',
      workOrderReference: order.referenceNumber,
      workorderItemStatus: 'scheduled',
      workorderItemCategory: 'activity',
    };

    this.scheduleRepo.assign(entry).subscribe(assigned => {
      this.upsertScheduleEntry(assigned);
      this.events = [...this.events, ...this.mapScheduleEntriesToEvents([assigned])];
      this.latestAutoBookingEntryIds.add(assigned.id);
      this.isAutoProposalVisible = this.plannerMode === 'order' || this.isAutoProposalVisible;
    });
  }

  private scrollToActiveOrderBooking(): void {
    if (this.plannerMode !== 'order') return;
    const activeOrderId = this.getActiveWorkOrderId();
    if (!activeOrderId) return;
    const firstBooking = this.events
      .filter(event => this.isEventForActiveWorkOrder(event))
      .sort((first, second) => first.start.getTime() - second.start.getTime())[0];
    if (!firstBooking) return;
    this.scrollToEventId = null;
    queueMicrotask(() => {
      this.scrollToEventId = firstBooking.id;
    });
  }

  private isEventForActiveWorkOrder(event: SchedulerEvent): boolean {
    const activeOrderId = this.getActiveWorkOrderId();
    if (!activeOrderId) return false;
    const order = this.findOrderForEvent(event);
    return order?.id === activeOrderId || order?.referenceNumber === activeOrderId;
  }

  private resolveWorkOrderId(orderIdOrReference: string | null): string | null {
    if (!orderIdOrReference) return null;
    const order = this.allOrders.find(candidate =>
      candidate.id === orderIdOrReference || candidate.referenceNumber === orderIdOrReference
    );
    return order?.id ?? null;
  }

  private getMissingRequirementsForResources(jobs: any[], resources: Resource[], order: any | undefined): string[] {
    const missing = new Set<string>();

    for (const job of jobs) {
      for (const requirement of this.getSchedulingRequirements(job)) {
        if (!this.hasMatchingResource(resources, requirement)) {
          missing.add(this.formatMissingRequirement(requirement));
        }
      }
    }

    for (const activity of order ? this.getActivitiesForOrder(order) : []) {
      if (!resources.some(resource => resource.type === activity.resourceType)) {
        missing.add(activity.resourceLabel);
      }
    }

    return [...missing];
  }

  private getSchedulingRequirements(job: any): JobResourceRequirement[] {
    if (job.resourceRequirements?.length) return job.resourceRequirements;
    return [{
      resourceType: job.requiredResourceType,
      requiredQualifications: job.requiredQualifications ?? [],
      label: job.requiredResourceType,
    }];
  }

  private hasMatchingResource(resources: Resource[], requirement: JobResourceRequirement): boolean {
    return resources.some(resource =>
      resource.type === requirement.resourceType &&
      requirement.requiredQualifications.every(qualification =>
        resource.qualifications.some(resourceQualification => resourceQualification.id === qualification.id)
      )
    );
  }

  private formatMissingRequirement(requirement: JobResourceRequirement): string {
    const qualifications = requirement.requiredQualifications.map(qualification => qualification.name).join(', ');
    const resourceType = requirement.label ?? requirement.resourceType.charAt(0).toUpperCase() + requirement.resourceType.slice(1);
    return qualifications ? `${resourceType} (${qualifications})` : resourceType;
  }

  private buildMissingResourceMessage(missingRequirements: string[]): string {
    const viewName = this.selectedResourceView?.label ?? 'selected view';
    return `${viewName} does not include: ${missingRequirements.join(', ')}. Add these resources to the view or choose another view.`;
  }

  private findOrderForEvent(event: SchedulerEvent): any | null {
    const metaOrder = (event.meta as any)?.order;
    if (metaOrder) return metaOrder;

    const booking = this.bookings.find(candidate => candidate.entryId === event.id);
    if (booking?.orderId) {
      return this.allOrders.find(order => order.id === booking.orderId || order.referenceNumber === booking.orderId) ?? null;
    }

    const reference = event.meta?.entry?.workOrderReference;
    if (reference) {
      return this.allOrders.find(order => order.referenceNumber === reference || order.id === reference) ?? null;
    }

    const jobId = event.meta?.job?.id ?? booking?.jobId;
    if (!jobId) return null;
    return this.allOrders.find(order => order.jobs?.some((job: any) => job.id === jobId)) ?? null;
  }

  private getOrderIdForJob(jobId: string): string | undefined {
    return this.allOrders.find(order => order.jobs?.some((job: any) => job.id === jobId))?.id;
  }

  private mergeBlockedAvailability(blocks: UnavailabilityBlock[]): UnavailabilityBlock[] {
    const sorted = [...blocks].sort((a, b) => {
      if (a.resourceId !== b.resourceId) return a.resourceId.localeCompare(b.resourceId);
      return a.start.getTime() - b.start.getTime();
    });

    const merged: UnavailabilityBlock[] = [];

    for (const block of sorted) {
      const previous = merged[merged.length - 1];
      const canMerge =
        previous &&
        previous.resourceId === block.resourceId &&
        previous.kind === 'blocked-order' &&
        block.kind === 'blocked-order' &&
        previous.end.getTime() >= block.start.getTime();

      if (canMerge) {
        previous.end = new Date(Math.max(previous.end.getTime(), block.end.getTime()));
        continue;
      }

      merged.push({ ...block, start: new Date(block.start), end: new Date(block.end) });
    }

    return merged;
  }

  private clearCurrentBookings(orderId?: string): void {
    const autoEntryIds = new Set(
      this.bookings
        .filter(booking => !orderId || booking.orderId === orderId)
        .map(booking => booking.entryId)
    );
    autoEntryIds.forEach(id => this.scheduleRepo.unassign(id).subscribe());
    this.events = this.events.filter(e => !autoEntryIds.has(e.id));
    this.scheduleEntries = this.scheduleEntries.filter(entry => !autoEntryIds.has(entry.id));
    for (const entryId of autoEntryIds) {
      this.latestAutoBookingEntryIds.delete(entryId);
    }
    if (this.latestAutoBookingEntryIds.size === 0) {
      this.isAutoProposalVisible = false;
    }
  }

  private bookActivity(activityId: string, resource: any, start: Date, end: Date, orderId?: string): void {
    const activityTemplateId = this.getActivityTemplateId(activityId);
    const activityTitle = this.getActivityTemplate(activityTemplateId)?.title ?? activityId;
    const order = this.allOrders.find(candidate => candidate.id === orderId);
    const normalizedEnd = this.isFixedDurationActivity(activityId)
      ? new Date(start.getTime() + this.getActivityDurationMinutes(activityId) * 60000)
      : end;
    if (!this.isWithinAppointmentBookingHours(start, normalizedEnd)) return;

    const entry = {
      id: `auto-act-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      jobId: activityId,
      resourceId: resource.id,
      start,
      end: normalizedEnd,
      title: activityTitle,
      kind: 'scheduled' as const,
      workOrderReference: order?.referenceNumber,
      workorderItemStatus: 'scheduled' as const,
      workorderItemCategory: 'activity' as const,
    };
    this.scheduleRepo.assign(entry).subscribe(assigned => {
      const schedulerResource = this.resources.find(r => r.id === resource.id);
      this.events = [...this.events, {
        id: assigned.id,
        resourceId: assigned.resourceId,
        start: assigned.start,
        end: assigned.end,
        title: activityTitle,
        color: '#4C68B1',
        meta: {
          job: undefined,
          order,
          entry: {
            ...assigned,
            workOrderReference: order?.referenceNumber,
            workorderItemStatus: 'scheduled',
            workorderItemCategory: 'activity',
          },
        } as any,
      }];
      this.upsertScheduleEntry(assigned);
      this.latestAutoBookingEntryIds.add(assigned.id);
    });
  }

  private getActivityDurationMinutes(activityId: string): number {
    const activity = this.getActivityTemplate(this.getActivityTemplateId(activityId));
    return (activity?.fru ?? 1) * MINUTES_PER_FRU;
  }

  private isFixedDurationActivity(activityId: string): boolean {
    const activityTemplateId = this.getActivityTemplateId(activityId);
    return activityTemplateId === 'act-checkin' || activityTemplateId === 'act-handover';
  }

  private isWithinAppointmentBookingHours(start: Date, end: Date): boolean {
    if (start.toDateString() !== end.toDateString()) return false;
    const cutoff = new Date(start);
    cutoff.setHours(this.appointmentDayEndHour, 0, 0, 0);
    return start < end && end <= cutoff && !this.overlapsLunchBreak(start, end);
  }

  private overlapsLunchBreak(start: Date, end: Date): boolean {
    const lunchStart = new Date(start);
    lunchStart.setHours(this.lunchStartHour, 0, 0, 0);
    const lunchEnd = new Date(start);
    lunchEnd.setHours(this.lunchEndHour, 0, 0, 0);
    return start < lunchEnd && lunchStart < end;
  }

  private getCheckinEndForOrder(orderId?: string): Date | null {
    const checkinActivityId = this.getOrderActivityId(orderId, 'act-checkin');
    const checkinBooking = this.bookings.find(booking =>
      this.getActivityTemplateId(booking.jobId) === 'act-checkin' &&
      (!orderId || booking.orderId === orderId || booking.jobId === checkinActivityId)
    );
    if (checkinBooking) {
      return this.events.find(event => event.id === checkinBooking.entryId)?.end ?? null;
    }

    const orderReference = this.getOrderReference(orderId);
    return this.events.find(event =>
      (!orderReference || event.meta?.entry?.workOrderReference === orderReference) &&
      this.getActivityTemplateId(event.meta?.entry?.jobId ?? '') === 'act-checkin'
    )?.end ?? null;
  }

  private getLatestJobEndForOrder(orderId?: string): Date | null {
    const jobBookings = this.bookings.filter(booking =>
      (!orderId || booking.orderId === orderId) &&
      this.isJobEvent(this.events.find(event => event.id === booking.entryId))
    );
    const bookedJobEvents = jobBookings
      .map(booking => this.events.find(event => event.id === booking.entryId))
      .filter((event): event is SchedulerEvent => !!event);
    const orderReference = this.getOrderReference(orderId);
    const existingJobEvents = this.events.filter(event =>
      (!orderReference || event.meta?.entry?.workOrderReference === orderReference) &&
      this.isJobEvent(event)
    );
    const jobEvents = [...bookedJobEvents, ...existingJobEvents];
    if (!jobEvents.length) return null;
    return new Date(Math.max(...jobEvents.map(event => event.end.getTime())));
  }

  private getOrderReference(orderId?: string): string | undefined {
    return this.allOrders.find(order => order.id === orderId || order.referenceNumber === orderId)?.referenceNumber;
  }

  private getOrderActivityId(orderId: string | undefined | null, activityTemplateId: string): string {
    return orderId ? `${orderId}:${activityTemplateId}` : activityTemplateId;
  }

  private getActivityTemplateId(activityId: string): string {
    return activityId.split(':').pop() ?? activityId;
  }

  private isActivityId(id: string): boolean {
    return this.getActivityTemplateId(id).startsWith('act-');
  }

  private getActivityTemplate(activityId: string): ActivityTile | undefined {
    const templateId = this.getActivityTemplateId(activityId);
    return this.activityTiles.find(activity => activity.id === templateId);
  }

  private isResourceFreeForActivity(
    resourceId: string, start: Date, end: Date, newEntries: any[]
  ): boolean {
    const overlaps = (a: Date, b: Date, c: Date, d: Date) => a < d && c < b;
    return !this.events.some(e => e.resourceId === resourceId && overlaps(start, end, e.start, e.end))
        && !newEntries.some((e: any) => e.resourceId === resourceId && overlaps(start, end, e.start, e.end))
        && !this.unavailability.some(u => u.resourceId === resourceId && overlaps(start, end, u.start, u.end));
  }

  /** Called by the ribbon Undo button — removes the most recently added booking */
  private undoLastBooking(): void {
    if (this.bookings.length === 0) return;

    if (this.latestAutoBookingEntryIds.size > 0) {
      const activeOrderId = this.plannerMode === 'order' ? this.getActiveWorkOrderId() : null;
      const entryIds = [...this.latestAutoBookingEntryIds].filter(entryId =>
        !activeOrderId || this.isScheduleEntryForOrder(entryId, activeOrderId)
      );
      entryIds.forEach(entryId => this.scheduleRepo.unassign(entryId).subscribe());
      const entryIdSet = new Set(entryIds);
      this.events = this.events.filter(e => !entryIdSet.has(e.id));
      this.scheduleEntries = this.scheduleEntries.filter(entry => !entryIdSet.has(entry.id));
      entryIds.forEach(entryId => this.latestAutoBookingEntryIds.delete(entryId));
      this.isAutoProposalVisible = false;
      return;
    }

    const activeOrderId = this.plannerMode === 'order' ? this.getActiveWorkOrderId() : null;
    const scopedBookings = activeOrderId
      ? this.bookings.filter(booking => booking.orderId === activeOrderId)
      : this.bookings;
    const last = scopedBookings[scopedBookings.length - 1];
    if (!last) return;
    this.onUndoBooking(last);
  }

  private isScheduleEntryForOrder(entryId: string, orderId: string): boolean {
    const booking = this.bookings.find(candidate => candidate.entryId === entryId);
    if (booking) return booking.orderId === orderId;
    const event = this.events.find(candidate => candidate.id === entryId);
    const eventOrder = (event?.meta as any)?.order;
    if (eventOrder?.id === orderId || eventOrder?.referenceNumber === orderId) return true;
    const entryReference = event?.meta?.entry?.workOrderReference;
    const order = this.allOrders.find(candidate => candidate.id === orderId || candidate.referenceNumber === orderId);
    return !!entryReference && !!order?.referenceNumber && entryReference === order.referenceNumber;
  }

  /** Returns the span [check-in end → handover end] if both are booked, else null */
  private getMobilitySpan(orderId?: string): { start: Date; end: Date } | null {
    const checkinActivityId = this.getOrderActivityId(orderId, 'act-checkin');
    const handoverActivityId = this.getOrderActivityId(orderId, 'act-handover');
    const checkinBooking  = this.bookings.find(b =>
      this.getActivityTemplateId(b.jobId) === 'act-checkin' &&
      (!orderId || b.orderId === orderId || b.jobId === checkinActivityId)
    );
    const handoverBooking = this.bookings.find(b =>
      this.getActivityTemplateId(b.jobId) === 'act-handover' &&
      (!orderId || b.orderId === orderId || b.jobId === handoverActivityId)
    );
    if (!checkinBooking || !handoverBooking) return null;

    const checkinEvent  = this.events.find(e => e.id === checkinBooking.entryId);
    const handoverEvent = this.events.find(e => e.id === handoverBooking.entryId);
    if (!checkinEvent || !handoverEvent) return null;

    return { start: checkinEvent.end, end: handoverEvent.end };
  }

  /** After check-in or handover moves, stretch the mobility event to match */
  private syncMobilitySpan(orderId?: string): void {
    const mobilityActivityId = this.getOrderActivityId(orderId, 'act-mobility');
    const mobilityBooking = this.bookings.find(b =>
      this.getActivityTemplateId(b.jobId) === 'act-mobility' &&
      (!orderId || b.orderId === orderId || b.jobId === mobilityActivityId)
    );
    if (!mobilityBooking) return;

    const span = this.getMobilitySpan(orderId);
    if (!span) return;

    this.scheduleRepo.reschedule(mobilityBooking.entryId, span.start, span.end).subscribe(updated => {
      this.events = this.events.map(e =>
        e.id === mobilityBooking.entryId
          ? { ...e, start: updated.start, end: updated.end }
          : e
      );
      this.updateScheduleEntryTimes(mobilityBooking.entryId, updated.start, updated.end);
    });
  }

  private syncOrderAppointmentFromBookings(orderId?: string): void {
    if (!orderId) return;
    const checkinBooking = this.bookings.find(booking =>
      this.getActivityTemplateId(booking.jobId) === 'act-checkin' && booking.orderId === orderId
    );
    const handoverBooking = this.bookings.find(booking =>
      this.getActivityTemplateId(booking.jobId) === 'act-handover' && booking.orderId === orderId
    );
    const checkinEvent = checkinBooking ? this.events.find(event => event.id === checkinBooking.entryId) : undefined;
    const handoverEvent = handoverBooking ? this.events.find(event => event.id === handoverBooking.entryId) : undefined;
    if (!checkinEvent || !handoverEvent) return;
    this.syncOrderAppointment(orderId, checkinEvent.start, handoverEvent.start, handoverEvent.end);
  }

  private getOrderIdForEventId(eventId: string): string | undefined {
    const booking = this.bookings.find(candidate => candidate.entryId === eventId);
    if (booking?.orderId) return booking.orderId;

    const event = this.events.find(candidate => candidate.id === eventId);
    const order = event ? this.findOrderForEvent(event) : null;
    return order?.id;
  }

  private syncOrderAppointment(orderId: string, checkinStart: Date, handoverStart: Date, handoverEnd?: Date): void {
    const resolvedHandoverEnd = handoverEnd ?? new Date(handoverStart.getTime() + 30 * 60000);
    this.quickViewSelection.setSelection({
      orderId,
      checkinStart: new Date(checkinStart),
      handoverStart: new Date(handoverStart),
      handoverEnd: new Date(resolvedHandoverEnd),
    });
    this.appointmentSync.updateAppointment(orderId, checkinStart, handoverStart).subscribe(savedOrder => {
      if (!savedOrder) return;
      this.allOrders = this.allOrders.map(order => order.id === savedOrder.id ? savedOrder : order);
    });
  }
}
