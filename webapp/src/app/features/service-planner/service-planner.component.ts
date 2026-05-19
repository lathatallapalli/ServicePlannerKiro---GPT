import { Component, OnInit, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ComboBoxModule, DatePickerModule, InputModule, SearchModule, SelectModule, TimePickerModule, TimePickerSelectModule, ToggleModule } from 'carbon-components-angular';
import { CustomSchedulerComponent } from '../../shared/components/scheduler/custom/custom-scheduler.component';
import { JobTile, JobBooking, ActivityTile } from './components/jobs-panel/jobs-panel.component';
import { SchedulerResource, SchedulerEvent, SchedulerGroup, EventMovePayload, EventResizePayload, EventDropPayload, EventClickPayload, ResourceSelectionChangePayload } from '../../shared/components/scheduler/scheduler.interface';
import { ResourceRepository } from '../../core/services/resource.repository';
import { ScheduleRepository } from '../../core/services/schedule.repository';
import { WorkOrderRepository } from '../../core/services/work-order.repository';
import { PlannerSettingsService } from './services/planner-settings.service';
import { AutoSchedulerService } from './services/auto-scheduler.service';
import { forkJoin } from 'rxjs';
import { MOCK_UNAVAILABILITY } from '../../core/services/mock/mock-data';
import { UnavailabilityBlock } from '../../core/models/availability.model';
import { Resource } from '../../core/models/resource.model';
import { WorkOrder } from '../../core/models/work-order.model';
import { ScheduleEntry } from '../../core/models/schedule.model';
import { DEMO_RESOURCE_VIEWS } from './data/resource-views.mock';
import { ResourceFavoriteView } from './services/planner-settings.service';

interface PlannedActivity {
  id: string;
  resource: Resource;
  start: Date;
  end: Date;
}

interface ProposalState {
  history: Date[];
  endHistory: Date[];
  index: number;
}

@Component({
  selector: 'app-service-planner',
  standalone: true,
  host: {
    style: 'display:flex;flex:1 1 auto;width:100%;min-width:0;min-height:0;height:100%;overflow:hidden',
  },
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
  resources: SchedulerResource[] = [];
  events: SchedulerEvent[] = [];
  groups: SchedulerGroup[] = [];
  allOrders: any[] = [];
  jobTiles: JobTile[] = [];
  activityTiles: ActivityTile[] = [
    { id: 'act-checkin',   title: 'Check-In',        resourceType: 'advisor', resourceLabel: 'Service Advisor', estimatedDurationMinutes: 15 },
    { id: 'act-handover',  title: 'Handover',         resourceType: 'advisor', resourceLabel: 'Service Advisor', estimatedDurationMinutes: 15 },
    { id: 'act-mobility',  title: 'Mobility Service', resourceType: 'driver',  resourceLabel: 'Courtesy Car',    estimatedDurationMinutes: 60 },
  ];
  bookings: JobBooking[] = [];
  selectedResourceIds: string[] = [];
  selectedBookingEvent: SchedulerEvent | null = null;
  isOrderPanelOpen = false;
  isPlannerReady = false;
  orderPanelSearch = '';
  selectedPanelOrderId = '';
  schedulingError: string | null = null;
  hasPrevious = false;
  showBookingDetails = true;
  plannerMode: 'order' | 'full' = 'full';
  activeOrderId: string | null = null;
  resourceSearch = '';
  readonly months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Scheduling proposal history
  private proposalHistory: Date[] = [];   // searchFrom dates that produced results
  private currentProposalIndex = -1;
  private proposalEndHistory: Date[] = [];
  private latestAutoBookingEntryIds = new Set<string>();
  private autoBookingEntryIdsByOrder = new Map<string, Set<string>>();
  private proposalStateByOrder = new Map<string, ProposalState>();
  private pendingBookedOrderIds = new Set<string>();
  private manuallyPlannedEntryIds = new Set<string>();
  private currentSessionPlannedOrderIds = new Set<string>();
  private importedPlanningOrderIds = new Set<string>();
  private isAutoProposalVisible = false;
  unavailability: UnavailabilityBlock[] = MOCK_UNAVAILABILITY;
  readonly resourceViews = DEMO_RESOURCE_VIEWS;

  viewStart = new Date('2024-04-15T09:00:00');
  viewEnd   = new Date('2024-04-19T21:00:00');

  get slotDurationMinutes(): number {
    return this.plannerSettings.slotDurationMinutes();
  }

  /** After booking, only show resources that have at least one event */
  get filteredResources(): SchedulerResource[] {
    const resourcePool = this.resourcesForSelectedView;

    if (!this.isAutoProposalVisible) return resourcePool;
    const bookedResourceIds = new Set(this.events.map(e => e.resourceId));
    return resourcePool
      .filter(r => bookedResourceIds.has(r.id))
      .map(resource => ({ ...resource, hasQualificationMatch: false }));
  }

  get fullPlannerResources(): SchedulerResource[] {
    return this.resourcesForSelectedView;
  }

  get visibleSchedulerResources(): SchedulerResource[] {
    return this.plannerMode === 'full' ? this.fullPlannerResources : this.filteredResources;
  }

  get showSchedulerBookingDetails(): boolean {
    return this.showBookingDetails;
  }

  get plannedBookingEventIds(): string[] {
    const ids = new Set<string>(this.manuallyPlannedEntryIds);
    for (const entryIds of this.autoBookingEntryIdsByOrder.values()) {
      for (const id of entryIds) ids.add(id);
    }
    return [...ids];
  }

  get detailedOrderIds(): string[] {
    const ids = new Set<string>();
    for (const orderId of this.currentSessionPlannedOrderIds) {
      ids.add(orderId);
      const order = this.allOrders.find(candidate => candidate.id === orderId);
      if (order?.referenceNumber) ids.add(String(order.referenceNumber));
    }
    return [...ids];
  }

  private get resourcesForSelectedView(): SchedulerResource[] {
    const activeView = this.plannerSettings.selectedResourceView();
    if (!activeView) return this.resources;

    const viewResourceIds = new Set(activeView.resourceIds);
    return this.resources.filter(resource => viewResourceIds.has(resource.id));
  }

  isOrderBooked(orderId?: string | null): boolean {
    const resolvedOrderId = this.resolveWorkOrderId(orderId);
    if (!resolvedOrderId) return false;
    return this.hasOrderBookings(resolvedOrderId);
  }

  canPlanOrder(orderId?: string | null): boolean {
    const resolvedOrderId = this.resolveWorkOrderId(orderId);
    if (!resolvedOrderId) return false;
    return !this.isOrderFullyScheduled({ id: resolvedOrderId });
  }

  isBookFirstDisabled(orderId?: string | null): boolean {
    return !this.canPlanOrder(orderId) || this.isOrderBooked(orderId);
  }

  canNavigateAvailability(orderId?: string | null): boolean {
    const resolvedOrderId = this.resolveWorkOrderId(orderId);
    if (!resolvedOrderId) return false;
    const state = this.proposalStateByOrder.get(resolvedOrderId);
    return this.hasOrderBookings(resolvedOrderId) || (state?.index ?? -1) >= 0;
  }

  hasPreviousForOrder(orderId?: string | null): boolean {
    const resolvedOrderId = this.resolveWorkOrderId(orderId);
    if (!resolvedOrderId) return false;
    return (this.proposalStateByOrder.get(resolvedOrderId)?.index ?? -1) > 0;
  }

  get isActiveOrderBooked(): boolean {
    return this.isOrderBooked(this.activeOrderId);
  }

  get visibleJobTiles(): JobTile[] {
    if (this.plannerMode === 'full') return this.jobTiles;
    const activeWorkOrderId = this.getActiveWorkOrderId();
    return this.jobTiles.filter(tile => tile.workOrder.id === activeWorkOrderId);
  }

  get visibleActivityTiles(): ActivityTile[] {
    return this.getActivitiesForOrder(this.activeOrderId ?? this.selectedPanelOrderId);
  }

  get filteredPanelOrders(): any[] {
    const query = this.orderPanelSearch.trim().toLowerCase();
    return this.allOrders.filter(order => {
      const orderId = this.resolveWorkOrderId(order.id);
      if (!this.shouldShowOrderInPanel(order)) return false;
      const searchable = `${this.getOrderLabel(order)} ${order.customer?.name ?? ''} ${order.vehicle?.licensePlate ?? ''}`.toLowerCase();
      return !query || searchable.includes(query);
    });
  }

  get selectedResourceView(): ResourceFavoriteView | null {
    return this.plannerSettings.selectedResourceView();
  }

  private shouldShowOrderInPanel(order: any): boolean {
    const orderId = this.resolveWorkOrderId(order?.id) ?? order?.id;
    if (!orderId) return false;
    if (!this.isFullPlanner()) return orderId === this.activeOrderId;
    if (this.importedPlanningOrderIds.has(orderId)) return true;
    if (this.currentSessionPlannedOrderIds.has(orderId)) return true;
    return order.status === 'edit' && !this.isOrderFullyScheduled(order);
  }

  get selectedMonth(): number {
    return this.viewStart.getMonth();
  }

  constructor(
    private resourceRepo: ResourceRepository,
    private scheduleRepo: ScheduleRepository,
    private workOrderRepo: WorkOrderRepository,
    private plannerSettings: PlannerSettingsService,
    private autoScheduler: AutoSchedulerService,
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

    forkJoin({
      resources: this.resourceRepo.getAll(),
      groups:    this.resourceRepo.getGroups(),
      entries:   this.scheduleRepo.getEntries(this.viewStart, this.viewEnd),
      orders:    this.workOrderRepo.getAll(),
    }).subscribe(({ resources, groups, entries, orders }) => {
      this.isPlannerReady = true;
      this.allOrders = orders;
      this.activeOrderId = this.resolveWorkOrderId(this.activeOrderId) ?? this.activeOrderId;
      this.hydrateImportedPlanningOrders();

      const tileSourceOrders = this.plannerMode === 'order'
        ? orders.filter((order: WorkOrder) => order.id === this.activeOrderId)
        : orders;

      this.jobTiles = tileSourceOrders.flatMap((order: any) =>
        order.jobs
          .filter((j: any) => j.status === 'unscheduled')
          .map((job: any) => ({ workOrder: order, job }))
      );

      this.groups = groups.map(g => ({ id: g.id, label: g.name }));

      const resourcesWithMatches = this.getResourceMatchIds(resources, this.jobTiles, this.activityTiles);

      this.resources = resources.map(r => ({
        id: r.id,
        label: r.name,
        groupId: r.groupId,
        groupLabel: groups.find(g => g.id === r.groupId)?.name,
        hasQualificationMatch: !this.isAutoProposalVisible && resourcesWithMatches.has(r.id),
        meta: r,
      }));

      const jobMap = new Map(
        orders.flatMap((o: any) => o.jobs.map((j: any) => [j.id, { job: j, order: o }]))
      );

      const mappedEvents: Array<SchedulerEvent | null> = entries.map(entry => {
        const found = jobMap.get(entry.jobId) as any;
        const isBlockedOrder = entry.kind === 'blocked-order';

        if (isBlockedOrder && this.plannerMode === 'order') {
          return null;
        }

        return {
          id: entry.id,
          resourceId: entry.resourceId,
          start: entry.start,
          end: entry.end,
          title: isBlockedOrder
            ? (entry.workOrderReference ? `SOW${entry.workOrderReference}` : entry.title ?? 'Booked')
            : entry.title ?? found?.job.title ?? entry.jobId,
          color: entry.color ?? '#4C68B1',
          meta: { job: found?.job, entry, order: found?.order } as any,
        };
      });

      this.events = mappedEvents.filter((event): event is SchedulerEvent => event !== null);

      this.unavailability = this.plannerMode === 'full'
        ? MOCK_UNAVAILABILITY
        : [
            ...MOCK_UNAVAILABILITY,
            ...entries
              .filter(entry => entry.kind === 'blocked-order')
              .map(entry => ({
                resourceId: entry.resourceId,
                start: entry.start,
                end: entry.end,
                title: entry.title,
                color: entry.color,
                kind: 'blocked-order' as const,
                reason: 'Blocked by existing order',
              })),
          ];
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

  onResourceViewChange(view: ResourceFavoriteView | null): void {
    this.plannerSettings.setResourceView(view);
  }

  openResourceViewList(_view?: ResourceFavoriteView | null): void {
    this.router.navigate(['/resource-views'], {
      queryParams: { returnTo: this.router.url },
    });
  }

  addResourceView(): void {
    this.router.navigate(['/resource-views', 'new', 'edit'], {
      queryParams: { returnTo: this.router.url },
    });
  }

  openTransactionsList(): void {
    this.router.navigate(['/transactions', 'active']);
  }

  clearOrderPanelSelection(): void {
    this.selectedPanelOrderId = '';
  }

  onBookingDetailsToggle(checked: boolean): void {
    this.showBookingDetails = checked;
  }

  toggleBookingDetails(): void {
    this.showBookingDetails = !this.showBookingDetails;
  }

  clearSchedulingError(): void {
    this.schedulingError = null;
  }

  getOrderLabel(order: any): string {
    return order.referenceNumber ?? order.id;
  }

  getOrderSubtitle(order: any): string {
    return `${order.customer?.name ?? 'Unknown customer'} | ${order.vehicle?.licensePlate ?? 'No vehicle'}`;
  }

  getOrderJobCount(order: any): string {
    const count = order.jobs?.length ?? 0;
    return `${count} job${count === 1 ? '' : 's'}`;
  }

  getOrderFru(order: any): number {
    const minutes = (order.jobs ?? []).reduce((total: number, job: any) => total + (job.estimatedDurationMinutes ?? 0), 0);
    return Math.max(1, Math.round(minutes / 60));
  }

  getJobFru(job: any): number {
    return Math.max(1, Math.round((job.estimatedDurationMinutes ?? 60) / 60));
  }

  getActivityFru(activity: ActivityTile): number {
    return Math.max(1, Math.round(activity.estimatedDurationMinutes / 60));
  }

  getActivityBooking(activity: ActivityTile, orderId?: string | null): JobBooking | undefined {
    const resolvedOrderId = this.resolveWorkOrderId(orderId);
    const liveBooking = this.bookings.find(booking =>
      booking.jobId === activity.id && (!resolvedOrderId || booking.orderId === resolvedOrderId)
    );
    if (liveBooking) return liveBooking;

    if (!resolvedOrderId) return undefined;
    const order = this.allOrders.find(candidate => candidate.id === resolvedOrderId);
    const reference = order?.referenceNumber ?? resolvedOrderId;
    const activityMatch = activity.id === 'act-checkin'
      ? 'check-in'
      : activity.id === 'act-handover'
        ? 'handover'
        : 'courtesy car';
    const event = this.events.find(candidate => {
      const entry = candidate.meta?.entry as any;
      const entryReference = entry?.workOrderReference ? String(entry.workOrderReference) : undefined;
      return entry?.kind === 'blocked-order'
        && entryReference === String(reference)
        && String(candidate.title ?? entry.title ?? '').toLowerCase().includes(activityMatch);
    });
    if (!event) return undefined;

    const resource = this.resources.find(candidate => candidate.id === event.resourceId);
    return {
      jobId: activity.id,
      resourceType: activity.resourceType,
      resourceName: resource?.label ?? event.resourceId,
      entryId: event.id,
      orderId: resolvedOrderId,
    };
  }

  getActivitiesForOrder(orderOrId?: WorkOrder | string | null): ActivityTile[] {
    const order = typeof orderOrId === 'string' || !orderOrId
      ? this.allOrders.find(candidate => candidate.id === this.resolveWorkOrderId(orderOrId))
      : orderOrId;
    const reference = order?.referenceNumber ?? this.resolveWorkOrderId(typeof orderOrId === 'string' ? orderOrId : orderOrId?.id);
    const needsMobility = reference === '014826455';
    return this.activityTiles.filter(activity => activity.id !== 'act-mobility' || needsMobility);
  }

  getActiveActivityBooking(activity: ActivityTile): JobBooking | undefined {
    return this.getActivityBooking(activity, this.activeOrderId ?? this.selectedPanelOrderId);
  }

  getJobRequirements(job: any): Array<{ label: string; resourceType: string }> {
    const requirements = job.resourceRequirements?.length
      ? job.resourceRequirements
      : [{ label: job.requiredResourceType ?? 'Resource', resourceType: job.requiredResourceType ?? 'resource' }];

    return requirements.map((requirement: any) => ({
      label: requirement.label ?? this.toTitleCase(String(requirement.resourceType ?? 'Resource')),
      resourceType: requirement.resourceType ?? job.requiredResourceType ?? 'resource',
    }));
  }

  getJobRequirementBooking(job: any, requirement: { resourceType: string }): JobBooking | undefined {
    const liveBooking = this.bookings.find(booking => booking.jobId === job.id && booking.resourceType === requirement.resourceType);
    if (liveBooking) return liveBooking;

    if (job.status !== 'scheduled' && !job.assignedResourceId) return undefined;
    const assignedResource = this.resources.find(resource => resource.id === job.assignedResourceId);
    return {
      jobId: job.id,
      resourceType: requirement.resourceType,
      resourceName: assignedResource?.label ?? job.assignedResourceId ?? requirement.resourceType,
      entryId: job.id,
    };
  }

  isJobScheduled(job: any): boolean {
    if (job.status === 'scheduled') return true;
    const requirements = this.getJobRequirements(job);
    return requirements.every(requirement => !!this.getJobRequirementBooking(job, requirement));
  }

  isOrderFullyScheduled(order: any): boolean {
    const resolvedOrder = this.allOrders.find(candidate => candidate.id === this.resolveWorkOrderId(order?.id) || candidate.id === order?.id) ?? order;
    const jobs = resolvedOrder.jobs ?? [];
    const jobsScheduled = jobs.length > 0 && jobs.every((job: any) => this.isJobScheduled(job));
    const activitiesScheduled = this.getActivitiesForOrder(resolvedOrder).every(activity => !!this.getActivityBooking(activity, resolvedOrder.id));
    return jobsScheduled && activitiesScheduled;
  }

  canUndoBooking(booking: JobBooking): boolean {
    return this.bookings.some(current => current.entryId === booking.entryId);
  }

  private hasOrderBookings(orderId: string): boolean {
    const resolvedOrderId = this.resolveWorkOrderId(orderId) ?? orderId;
    const order = this.allOrders.find(candidate => candidate.id === resolvedOrderId);
    const hasScheduledJob = (order?.jobs ?? []).some((job: any) => this.isJobScheduled(job));
    const hasScheduledActivity = this.getActivitiesForOrder(resolvedOrderId).some(activity => !!this.getActivityBooking(activity, resolvedOrderId));
    return this.pendingBookedOrderIds.has(resolvedOrderId)
      || (this.autoBookingEntryIdsByOrder.get(resolvedOrderId)?.size ?? 0) > 0
      || this.bookings.some(booking => booking.orderId === resolvedOrderId)
      || hasScheduledJob
      || hasScheduledActivity;
  }

  private toTitleCase(value: string): string {
    return value.replace(/[-_]/g, ' ').replace(/\b\w/g, character => character.toUpperCase());
  }

  selectMonth(monthIndex: number): void {
    const newStart = new Date(this.viewStart);
    newStart.setMonth(monthIndex);
    newStart.setDate(1);
    newStart.setHours(9, 0, 0, 0);

    const newEnd = new Date(newStart);
    newEnd.setDate(newEnd.getDate() + 1);
    newEnd.setHours(19, 0, 0, 0);

    this.viewStart = newStart;
    this.viewEnd = newEnd;
  }

  onResourceSearch(event: Event): void {
    this.resourceSearch = (event.target as HTMLInputElement).value;
  }

  private getResourceMatchIds(resources: Resource[], jobTiles: JobTile[], activityTiles: ActivityTile[]): Set<string> {
    const matchIds = new Set<string>();

    for (const resource of resources) {
      const matchesJob = jobTiles.some(tile => {
        const requirements = tile.job.resourceRequirements?.length
          ? tile.job.resourceRequirements
          : [{ resourceType: tile.job.requiredResourceType, requiredQualifications: tile.job.requiredQualifications }];

        return requirements.some(req =>
          req.resourceType === resource.type &&
          req.requiredQualifications.every(qualification =>
            resource.qualifications.some(resourceQualification => resourceQualification.id === qualification.id)
          )
        );
      });

      const matchesActivity = activityTiles.some(activity => activity.resourceType === resource.type);

      if (matchesJob || matchesActivity) {
        matchIds.add(resource.id);
      }
    }

    return matchIds;
  }

  onEventMoved(payload: EventMovePayload): void {
    this.scheduleRepo.reschedule(payload.eventId, payload.start, payload.end).subscribe(updated => {
      this.events = this.events.map(e =>
        e.id === payload.eventId
          ? { ...e, resourceId: payload.resourceId, start: updated.start, end: updated.end }
          : e
      );
      // Sync all other resources booked for the same job
      this.syncJobSiblings(payload.eventId, updated.start, updated.end);
      // If check-in or handover moved, sync mobility span
      this.syncMobilitySpan();
      this.persistAppointmentDates();
    });
  }

  private hydrateImportedPlanningOrders(): void {
    const navigationState = this.router.getCurrentNavigation()?.extras.state
      ?? (typeof window !== 'undefined' ? window.history.state : undefined);
    const selectedOrderIds = navigationState?.selectedOrderIds;
    if (!Array.isArray(selectedOrderIds)) return;

    selectedOrderIds
      .map(orderId => this.resolveWorkOrderId(String(orderId)) ?? String(orderId))
      .filter(Boolean)
      .forEach(orderId => this.importedPlanningOrderIds.add(orderId));

    const firstOrderId = [...this.importedPlanningOrderIds][0];
    if (firstOrderId) {
      this.selectedPanelOrderId = firstOrderId;
      this.isOrderPanelOpen = true;
    }
  }

  onEventResized(payload: EventResizePayload): void {
    this.scheduleRepo.reschedule(payload.eventId, payload.start, payload.end).subscribe(updated => {
      this.events = this.events.map(e =>
        e.id === payload.eventId
          ? { ...e, start: updated.start, end: updated.end }
          : e
      );
      // Sync all other resources booked for the same job
      this.syncJobSiblings(payload.eventId, updated.start, updated.end);
      this.persistAppointmentDates();
    });
  }

  onEventClicked(payload: EventClickPayload): void {
    this.selectedBookingEvent = this.events.find(event => event.id === payload.eventId) ?? null;
  }

  openJobDetailsModal(job: any): void {
    const order = this.allOrders.find(candidate => candidate.jobs?.some((candidateJob: any) => candidateJob.id === job.id));
    const booking = this.bookings.find(candidate => candidate.jobId === job.id);
    const event = booking ? this.events.find(candidate => candidate.id === booking.entryId) : undefined;
    const start = event?.start ?? job.scheduledStart ?? this.viewStart;
    const end = event?.end ?? job.scheduledEnd ?? new Date(start.getTime() + (job.estimatedDurationMinutes ?? 60) * 60000);
    this.selectedBookingEvent = {
      id: event?.id ?? `job-details-${job.id}`,
      resourceId: event?.resourceId ?? job.assignedResourceId ?? '',
      start,
      end,
      title: job.title,
      color: '#4C68B1',
      meta: { job, order, entry: event?.meta?.entry ?? { id: job.id, jobId: job.id, title: job.title, workOrderReference: order?.referenceNumber } } as any,
    };
  }

  closeBookingModal(): void {
    this.selectedBookingEvent = null;
  }

  deleteSelectedBooking(): void {
    if (!this.selectedBookingEvent) return;
    const entryId = this.selectedBookingEvent.id;

    this.scheduleRepo.unassign(entryId).subscribe(() => {
      this.events = this.events.filter(event => event.id !== entryId);
      this.bookings = this.bookings.filter(booking => booking.entryId !== entryId);
      this.latestAutoBookingEntryIds.delete(entryId);
      this.selectedBookingEvent = null;
    });
  }

  getBookingReferenceInfo(event: SchedulerEvent): string {
    return event.meta?.job?.title
      ?? event.meta?.entry?.title
      ?? 'General Mechanical/Repair Work';
  }

  getBookingOrder(event: SchedulerEvent): string {
    const entryReference = event.meta?.entry?.workOrderReference;
    const order = (event.meta as any)?.order;
    const orderReference = order?.orderNumber ?? order?.reference ?? order?.id;
    const reference = entryReference ?? orderReference;

    if (!reference) return event.title || 'SOW123476';
    return String(reference).startsWith('SOW') ? String(reference) : `SOW${reference}`;
  }

  getBookingVehicle(event: SchedulerEvent): string {
    const order = (event.meta as any)?.order;
    return order?.vehicle?.registration
      ?? order?.vehicleRegistration
      ?? order?.vehicle?.licensePlate
      ?? 'KL 345 LP';
  }

  getBookingCustomer(event: SchedulerEvent): string {
    const order = (event.meta as any)?.order;
    return order?.customer?.name
      ?? order?.customerName
      ?? 'Szabo Jacob';
  }

  getBookingCustomerEmail(event: SchedulerEvent): string {
    const order = (event.meta as any)?.order;
    return order?.customer?.email
      ?? order?.customerEmail
      ?? 'szabo.jacob@example.com';
  }

  getBookingCustomerPhone(event: SchedulerEvent): string {
    const order = (event.meta as any)?.order;
    return order?.customer?.phone
      ?? order?.customerPhone
      ?? '+49 89 1234 5678';
  }

  getBookingResource(event: SchedulerEvent): string {
    return this.resources.find(resource => resource.id === event.resourceId)?.label ?? 'Electrician Mark';
  }

  getBookingWorkstation(event: SchedulerEvent): string {
    const order = (event.meta as any)?.order;
    return order?.workstation ?? order?.bay ?? 'PC Bay 3';
  }

  getBookingDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    }).format(date);
  }

  getBookingDateValue(date: Date): Date[] {
    return [date];
  }

  getBookingTime(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }

  getBookingMeridiem(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: true,
    }).formatToParts(date).find(part => part.type === 'dayPeriod')?.value ?? 'AM';
  }

  onResourceSelectionChange(payload: ResourceSelectionChangePayload): void {
    this.schedulingError = null;
    const selected = new Set(this.selectedResourceIds);
    if (payload.selected) {
      selected.add(payload.resourceId);
    } else {
      selected.delete(payload.resourceId);
    }
    this.selectedResourceIds = [...selected];
  }

  onOrderDragStart(event: DragEvent, order: any): void {
    const firstJob = (order.jobs ?? []).find((job: any) => !this.isJobScheduled(job)) ?? order.jobs?.[0];
    const totalMinutes = (order.jobs ?? []).reduce((total: number, job: any) => total + (job.estimatedDurationMinutes ?? 0), 0) || 60;
    event.dataTransfer?.setData('dropType', 'order');
    event.dataTransfer?.setData('orderId', order.id);
    event.dataTransfer?.setData('jobId', firstJob?.id ?? `order-${order.id}`);
    event.dataTransfer?.setData('durationMinutes', totalMinutes.toString());
    event.dataTransfer?.setData('resourceType', firstJob?.requiredResourceType ?? firstJob?.resourceRequirements?.[0]?.resourceType ?? 'mechanic');
  }

  onJobDragStart(event: DragEvent, job: any, order: any): void {
    event.stopPropagation();
    const requirement = job.resourceRequirements?.[0];
    event.dataTransfer?.setData('dropType', 'job');
    event.dataTransfer?.setData('orderId', order.id);
    event.dataTransfer?.setData('jobId', job.id);
    event.dataTransfer?.setData('durationMinutes', String(job.estimatedDurationMinutes ?? 60));
    event.dataTransfer?.setData('resourceType', requirement?.resourceType ?? job.requiredResourceType ?? 'mechanic');
  }

  onEventDropped(payload: EventDropPayload): void {
    this.isAutoProposalVisible = false;
    this.showBookingDetails = false;
    if (payload.dropType === 'order' && payload.orderId) {
      const orderId = this.resolveWorkOrderId(payload.orderId) ?? payload.orderId;
      this.selectedPanelOrderId = orderId;
      this.schedulingError = null;
      this.resetProposalState(orderId);
      this.pendingBookedOrderIds.add(orderId);
      this.currentSessionPlannedOrderIds.add(orderId);
      this.applyProposal(payload.start, true, false, orderId);
      return;
    }

    let start = payload.start;
    let end = payload.end;
    const targetOrderId = this.resolveWorkOrderId(this.selectedPanelOrderId || this.activeOrderId);

    // Business rule: if this job already has a booking, snap to that booking's timeslot
    const existingJobBooking = this.bookings.find(b =>
      b.jobId === payload.jobId && (!targetOrderId || !b.orderId || b.orderId === targetOrderId)
    );
    if (existingJobBooking) {
      const existingEvent = this.events.find(e => e.id === existingJobBooking.entryId);
      if (existingEvent) {
        start = existingEvent.start;
        end = existingEvent.end;
      }
    }

    // Business rule: mobility service spans from check-in start to handover end
    if (payload.jobId === 'act-mobility') {
      const span = this.getMobilitySpan(targetOrderId);
      if (span) { start = span.start; end = span.end; }
    }

    const entry = {
      id: `se-${Date.now()}`,
      jobId: payload.jobId,
      resourceId: payload.resourceId,
      start,
      end,
    };

    this.scheduleRepo.assign(entry).subscribe(assigned => {
      const foundOrder = this.allOrders.find((order: any) => order.jobs?.some((job: any) => job.id === payload.jobId))
        ?? this.allOrders.find((order: any) => order.id === targetOrderId);
      const found = foundOrder?.jobs?.find((job: any) => job.id === payload.jobId);
      const resource = this.resources.find(r => r.id === payload.resourceId);
      const resourceType = payload.resourceType ?? (resource?.meta as any)?.type ?? 'mechanic';

      // Add the event and booking first
      this.events = [...this.events, {
        id: assigned.id,
        resourceId: assigned.resourceId,
        start: assigned.start,
        end: assigned.end,
        title: found?.title ?? payload.jobId,
        color: '#4C68B1',
        meta: { job: found, order: foundOrder, entry: assigned } as any,
      }];
      this.manuallyPlannedEntryIds.add(assigned.id);

      this.bookings = [...this.bookings, {
        jobId: payload.jobId,
        resourceName: resource?.label ?? payload.resourceId,
        resourceType,
        entryId: assigned.id,
        orderId: this.resolveWorkOrderId(foundOrder?.id ?? targetOrderId) ?? undefined,
      }];
      const plannedOrderId = this.resolveWorkOrderId(foundOrder?.id ?? targetOrderId);
      if (plannedOrderId) this.currentSessionPlannedOrderIds.add(plannedOrderId);

      // Business rule: after check-in or handover is booked, sync mobility span if it exists
      if (payload.jobId === 'act-checkin' || payload.jobId === 'act-handover') {
        this.syncMobilitySpan(targetOrderId);
        this.persistAppointmentDates();
      }

      // Business rule: when mobility is dropped, snap its span to check-in→handover if both booked
      if (payload.jobId === 'act-mobility') {
        const span = this.getMobilitySpan(targetOrderId);
        if (span) {
          this.scheduleRepo.reschedule(assigned.id, span.start, span.end).subscribe(updated => {
            this.events = this.events.map(e =>
              e.id === assigned.id ? { ...e, start: updated.start, end: updated.end } : e
            );
          });
        }
      }
    });
  }

  onUndoBooking(booking: JobBooking): void {
    this.scheduleRepo.unassign(booking.entryId).subscribe(() => {
      this.events = this.events.filter(e => e.id !== booking.entryId);
      this.bookings = this.bookings.filter(b => b.entryId !== booking.entryId);
      this.latestAutoBookingEntryIds.delete(booking.entryId);
      this.manuallyPlannedEntryIds.delete(booking.entryId);
      if (booking.orderId) {
        this.getAutoBookingSet(booking.orderId).delete(booking.entryId);
        if (!this.hasOrderBookings(booking.orderId)) {
          this.pendingBookedOrderIds.delete(booking.orderId);
        }
      }
      this.isAutoProposalVisible = this.hasAnyAutoBookings();
    });
  }

  /** Sync all other booked resources for the same job to the new start/end */
  private syncJobSiblings(movedEntryId: string, start: Date, end: Date): void {
    // Find which job this entry belongs to
    const movedBooking = this.bookings.find(b => b.entryId === movedEntryId);
    if (!movedBooking) return;

    // Find all other bookings for the same job
    const siblings = this.bookings.filter(
      b => b.jobId === movedBooking.jobId && b.entryId !== movedEntryId
    );

    siblings.forEach(sibling => {
      this.scheduleRepo.reschedule(sibling.entryId, start, end).subscribe(updated => {
        this.events = this.events.map(e =>
          e.id === sibling.entryId
            ? { ...e, start: updated.start, end: updated.end }
            : e
        );
      });
    });
  }

  onBookFirstAvailability(): void {
    this.schedulingError = null;
    const searchFrom = new Date(this.viewStart.getFullYear(), this.viewStart.getMonth(),
                                this.viewStart.getDate(), 9, 30, 0, 0);
    this.showBookingDetails = false;
    const activeOrderId = this.getActiveWorkOrderId();
    if (!this.canPlanOrder(activeOrderId)) return;
    if (activeOrderId) this.resetProposalState(activeOrderId);
    if (activeOrderId) this.pendingBookedOrderIds.add(activeOrderId);
    if (activeOrderId) this.currentSessionPlannedOrderIds.add(activeOrderId);
    this.applyProposal(searchFrom, true);
  }

  onBookFirstAvailabilityForOrder(order: any): void {
    if (!order?.id) return;
    this.selectedPanelOrderId = order.id;
    this.schedulingError = null;
    const searchFrom = new Date(this.viewStart.getFullYear(), this.viewStart.getMonth(),
                                this.viewStart.getDate(), 9, 30, 0, 0);
    this.showBookingDetails = false;
    const resolvedOrderId = this.resolveWorkOrderId(order.id);
    if (!this.canPlanOrder(resolvedOrderId)) return;
    if (resolvedOrderId) this.resetProposalState(resolvedOrderId);
    if (resolvedOrderId) this.pendingBookedOrderIds.add(resolvedOrderId);
    if (resolvedOrderId) this.currentSessionPlannedOrderIds.add(resolvedOrderId);
    this.applyProposal(searchFrom, true, false, order.id);
  }

  onBookNext(): void {
    const targetOrderId = this.getActiveWorkOrderId(this.selectedPanelOrderId || undefined);
    if (!targetOrderId) return;
    const state = this.getProposalState(targetOrderId);
    if (state.index < 0) return;
    this.schedulingError = null;
    const currentProposalStart = state.history[state.index];
    // Advance by one slot so Book Next keeps walking future availability instead of jumping by whole appointment spans.
    const nextSearchFrom = new Date(currentProposalStart.getTime() + 15 * 60000);
    this.applyProposal(nextSearchFrom, false, false, targetOrderId);
  }

  onBookNextForOrder(order: any): void {
    if (!order?.id) return;
    this.selectedPanelOrderId = order.id;
    this.onBookNext();
  }

  onBookPrevious(): void {
    const targetOrderId = this.getActiveWorkOrderId(this.selectedPanelOrderId || undefined);
    if (!targetOrderId) return;
    const state = this.getProposalState(targetOrderId);
    if (state.index <= 0) return;
    this.schedulingError = null;
    state.index--;
    this.syncLegacyProposalState(targetOrderId);
    const searchFrom = state.history[state.index];
    this.clearCurrentBookings(targetOrderId);
    this.applyProposal(searchFrom, false, true, targetOrderId);
  }

  onBookPreviousForOrder(order: any): void {
    if (!order?.id) return;
    this.selectedPanelOrderId = order.id;
    this.onBookPrevious();
  }

  private applyProposal(searchFrom: Date, resetHistory: boolean, isReplay = false, targetOrderId?: string): void {
    const targetWorkOrderId = this.getActiveWorkOrderId(targetOrderId);
    const proposalState = this.getProposalState(targetWorkOrderId);
    const targetOrder = this.allOrders.find(order => order.id === targetWorkOrderId);
    const unscheduledTiles = this.jobTiles.filter(t => t.workOrder.id === targetWorkOrderId);
    const unscheduledJobs = unscheduledTiles.map(t => t.job);
    const hasMissingActivities = targetWorkOrderId
      ? this.getActivitiesForOrder(targetWorkOrderId).some(activity => !this.getActivityBooking(activity, targetWorkOrderId))
      : false;
    if (unscheduledJobs.length === 0 && !hasMissingActivities) {
      if (targetWorkOrderId) this.pendingBookedOrderIds.delete(targetWorkOrderId);
      return;
    }
    this.schedulingError = null;

    const selectedIds = new Set(this.selectedResourceIds);
    const activeView = this.plannerSettings.selectedResourceView();
    const viewResourceIds = activeView ? new Set(activeView.resourceIds) : null;
    const orderRequirementTypes = new Set<string>([
      ...unscheduledJobs.flatMap((job: any) =>
        (job.resourceRequirements?.length
          ? job.resourceRequirements
          : [{ resourceType: job.requiredResourceType }]
        ).map((requirement: any) => requirement.resourceType)
      ),
      ...this.getActivitiesForOrder(targetWorkOrderId).map(activity => activity.resourceType),
    ]);
    const rawResources = this.resources
      .filter(resource => {
        const meta = resource.meta as any;
        return !viewResourceIds
          || viewResourceIds.has(resource.id)
          || orderRequirementTypes.has(meta?.type);
      })
      .map(r => r.meta as any)
      .filter(Boolean);

    const existingEntries = this.getExistingEntriesForProposal(targetWorkOrderId);
    const result = unscheduledJobs.length > 0
      ? this.autoScheduler.schedule({
          jobs: unscheduledJobs,
          resources: rawResources,
          preferredResourceIds: this.selectedResourceIds,
          existingEntries,
          unavailability: this.unavailability,
          searchFrom,
          dayStartHour: 9,
          dayEndHour: 21,
        })
      : this.getActivityOnlyProposal(targetOrder, searchFrom, existingEntries);

    if (!result) {
      if (targetWorkOrderId) this.pendingBookedOrderIds.delete(targetWorkOrderId);
      this.schedulingError = selectedIds.size > 0
        ? 'The selected resources plus available alternatives cannot satisfy the full order.'
        : 'No available qualified resources can satisfy the full order.';
      return;
    }

    const plannedActivities = this.getPlannedActivities(result, rawResources, this.selectedResourceIds, targetWorkOrderId);
    if (!plannedActivities) {
      if (targetWorkOrderId) this.pendingBookedOrderIds.delete(targetWorkOrderId);
      const requiredActivities = this.getActivitiesForOrder(targetWorkOrderId).map(activity => activity.resourceLabel).join(', ');
      this.schedulingError = selectedIds.size > 0
        ? `The selected resources plus available alternatives cannot satisfy every required activity (${requiredActivities}) without conflicts or unavailable time. No part of the order was booked.`
        : `No available resources can satisfy every required activity (${requiredActivities}) without conflicts or unavailable time. No part of the order was booked.`;
      return;
    }

    // Clear previous auto-bookings before applying new proposal
    this.clearCurrentBookings(targetWorkOrderId ?? undefined);
    if (targetWorkOrderId) this.pendingBookedOrderIds.add(targetWorkOrderId);
    if (targetWorkOrderId) this.currentSessionPlannedOrderIds.add(targetWorkOrderId);

    // Track history
    if (!isReplay) {
      if (resetHistory) {
        proposalState.history = [searchFrom];
        proposalState.endHistory = [new Date(result.handoverEnd)];
        proposalState.index = 0;
      } else {
        // Trim any forward history and append
        proposalState.history = proposalState.history.slice(0, proposalState.index + 1);
        proposalState.endHistory = proposalState.endHistory.slice(0, proposalState.index + 1);
        proposalState.history.push(searchFrom);
        proposalState.endHistory.push(new Date(result.handoverEnd));
        proposalState.index = proposalState.history.length - 1;
      }
    }
    this.syncLegacyProposalState(targetWorkOrderId);
    this.latestAutoBookingEntryIds = this.getAutoBookingSet(targetWorkOrderId);
    this.isAutoProposalVisible = true;

    // Apply job entries
    result.entries.forEach(entry => {
      this.scheduleRepo.assign(entry).subscribe(assigned => {
        const job = unscheduledJobs.find(j => j.id === assigned.jobId);
        const resource = this.resources.find(r => r.id === assigned.resourceId);
        const resourceType = (resource?.meta as any)?.type ?? 'mechanic';
        this.events = [...this.events, {
          id: assigned.id, resourceId: assigned.resourceId,
          start: assigned.start, end: assigned.end,
          title: job?.title ?? assigned.jobId, color: '#4C68B1',
          meta: { job, order: unscheduledTiles.find(tile => tile.job.id === assigned.jobId)?.workOrder, entry: assigned } as any,
        }];
        this.bookings = [...this.bookings, {
          jobId: assigned.jobId, resourceName: resource?.label ?? assigned.resourceId,
          resourceType, entryId: assigned.id, orderId: targetWorkOrderId ?? undefined,
        }];
        this.trackAutoBooking(targetWorkOrderId, assigned.id);
        this.persistAppointmentDates();
      });
    });

    plannedActivities.forEach(activity => {
      this.bookActivity(activity.id, activity.resource, activity.start, activity.end, targetWorkOrderId);
    });
  }

  private persistAppointmentDates(): void {
    if (this.plannerMode !== 'order') return;
    const orderId = this.activeOrderId;
    if (!orderId) return;

    const checkinBooking = this.bookings.find(booking => booking.jobId === 'act-checkin');
    const handoverBooking = this.bookings.find(booking => booking.jobId === 'act-handover');
    const checkinEvent = checkinBooking ? this.events.find(event => event.id === checkinBooking.entryId) : undefined;
    const handoverEvent = handoverBooking ? this.events.find(event => event.id === handoverBooking.entryId) : undefined;
    if (!checkinEvent && !handoverEvent) return;

    const existingOrder = this.allOrders.find((order: WorkOrder) => order.id === orderId || order.referenceNumber === orderId) as WorkOrder | undefined;
    if (!existingOrder) return;

    const updatedOrder: WorkOrder = {
      ...existingOrder,
      appointmentStart: checkinEvent?.start ?? existingOrder.appointmentStart,
      appointmentEnd: handoverEvent?.end ?? existingOrder.appointmentEnd,
    };

    this.workOrderRepo.update(updatedOrder).subscribe(savedOrder => {
      this.allOrders = this.allOrders.map(order => order.id === savedOrder.id ? savedOrder : order);
    });
  }

  private clearPersistedAppointmentDates(): void {
    if (this.plannerMode !== 'order') return;
    const orderId = this.activeOrderId;
    if (!orderId) return;

    const existingOrder = this.allOrders.find((order: WorkOrder) => order.id === orderId || order.referenceNumber === orderId) as WorkOrder | undefined;
    if (!existingOrder) return;

    const updatedOrder: WorkOrder = {
      ...existingOrder,
      appointmentStart: undefined,
      appointmentEnd: undefined,
    };

    this.workOrderRepo.update(updatedOrder).subscribe(savedOrder => {
      this.allOrders = this.allOrders.map(order => order.id === savedOrder.id ? savedOrder : order);
    });
  }

  private getActiveWorkOrderId(targetOrderId?: string): string | null {
    if (targetOrderId) return this.resolveWorkOrderId(targetOrderId);
    if (this.activeOrderId) return this.resolveWorkOrderId(this.activeOrderId);
    return this.plannerMode === 'full' ? this.jobTiles[0]?.workOrder.id ?? null : null;
  }

  private resolveWorkOrderId(orderIdOrReference?: string | null): string | null {
    if (!orderIdOrReference) return null;
    const order = this.allOrders.find((candidate: WorkOrder) =>
      candidate.id === orderIdOrReference || candidate.referenceNumber === orderIdOrReference
    );
    return order?.id ?? null;
  }

  private getExistingEntriesForProposal(targetOrderId?: string | null): ScheduleEntry[] {
    const ignoredEntryIds = targetOrderId ? this.getAutoBookingSet(targetOrderId) : this.latestAutoBookingEntryIds;
    return this.events
      .filter(event => !ignoredEntryIds.has(event.id))
      .map(event => ({
        id: event.id,
        jobId: event.meta?.entry?.jobId ?? event.meta?.job?.id ?? event.id,
        resourceId: event.resourceId,
        start: event.start,
        end: event.end,
      }));
  }

  private getActivityOnlyProposal(
    order: WorkOrder | undefined,
    searchFrom: Date,
    existingEntries: ScheduleEntry[],
  ): { entries: ScheduleEntry[]; checkinStart: Date; handoverEnd: Date } | null {
    const reference = order?.referenceNumber;
    const orderEntries = this.events.filter(event => {
      const entry = event.meta?.entry as any;
      return entry?.kind === 'blocked-order'
        && (!reference || String(entry.workOrderReference) === String(reference));
    });
    const firstStart = orderEntries.length
      ? new Date(Math.min(...orderEntries.map(event => event.start.getTime())))
      : new Date(searchFrom);
    const lastEnd = orderEntries.length
      ? new Date(Math.max(...orderEntries.map(event => event.end.getTime())))
      : new Date(searchFrom.getTime() + 60 * 60000);
    return {
      entries: existingEntries,
      checkinStart: firstStart,
      handoverEnd: lastEnd,
    };
  }

  private getProposalState(orderId?: string | null): ProposalState {
    const resolvedOrderId = this.resolveWorkOrderId(orderId) ?? orderId ?? '__default';
    let state = this.proposalStateByOrder.get(resolvedOrderId);
    if (!state) {
      state = { history: [], endHistory: [], index: -1 };
      this.proposalStateByOrder.set(resolvedOrderId, state);
    }
    return state;
  }

  private resetProposalState(orderId?: string | null): void {
    const resolvedOrderId = this.resolveWorkOrderId(orderId) ?? orderId ?? '__default';
    this.proposalStateByOrder.set(resolvedOrderId, { history: [], endHistory: [], index: -1 });
    this.syncLegacyProposalState(resolvedOrderId);
  }

  private syncLegacyProposalState(orderId?: string | null): void {
    const state = this.getProposalState(orderId);
    this.proposalHistory = state.history;
    this.proposalEndHistory = state.endHistory;
    this.currentProposalIndex = state.index;
    this.hasPrevious = state.index > 0;
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

  /** Remove all auto-generated bookings (keeps manually dragged ones) */
  private clearCurrentBookings(targetOrderId?: string): void {
    const resolvedOrderId = this.resolveWorkOrderId(targetOrderId ?? this.selectedPanelOrderId ?? this.activeOrderId);
    const autoEntryIds = new Set(
      resolvedOrderId ? this.getAutoBookingSet(resolvedOrderId) : this.latestAutoBookingEntryIds
    );
    if (autoEntryIds.size === 0) {
      this.isAutoProposalVisible = false;
      this.clearPersistedAppointmentDates();
      if (resolvedOrderId) this.pendingBookedOrderIds.delete(resolvedOrderId);
      return;
    }

    autoEntryIds.forEach(id => this.scheduleRepo.unassign(id).subscribe());
    this.events   = this.events.filter(e => !autoEntryIds.has(e.id));
    this.bookings = this.bookings.filter(booking => !autoEntryIds.has(booking.entryId));
    autoEntryIds.forEach(id => this.manuallyPlannedEntryIds.delete(id));
    if (resolvedOrderId) {
      this.autoBookingEntryIdsByOrder.set(resolvedOrderId, new Set<string>());
      this.latestAutoBookingEntryIds = this.getAutoBookingSet(resolvedOrderId);
      this.pendingBookedOrderIds.delete(resolvedOrderId);
    } else {
      this.latestAutoBookingEntryIds.clear();
      this.autoBookingEntryIdsByOrder.clear();
    }
    this.isAutoProposalVisible = this.hasAnyAutoBookings();
    this.clearPersistedAppointmentDates();
  }

  private getAutoBookingSet(orderId: string | null): Set<string> {
    if (!orderId) return this.latestAutoBookingEntryIds;
    const resolvedOrderId = this.resolveWorkOrderId(orderId) ?? orderId;
    let entryIds = this.autoBookingEntryIdsByOrder.get(resolvedOrderId);
    if (!entryIds) {
      entryIds = new Set<string>();
      this.autoBookingEntryIdsByOrder.set(resolvedOrderId, entryIds);
    }
    return entryIds;
  }

  private trackAutoBooking(orderId: string | null, entryId: string): void {
    if (!orderId) {
      this.latestAutoBookingEntryIds.add(entryId);
      return;
    }
    const entryIds = this.getAutoBookingSet(orderId);
    entryIds.add(entryId);
    this.latestAutoBookingEntryIds = entryIds;
  }

  private hasAnyAutoBookings(): boolean {
    if (this.latestAutoBookingEntryIds.size > 0) return true;
    return [...this.autoBookingEntryIdsByOrder.values()].some(entryIds => entryIds.size > 0);
  }

  private bookActivity(activityId: string, resource: any, start: Date, end: Date, orderId?: string | null): void {
    const activityTitle = this.activityTiles.find(activity => activity.id === activityId)?.title ?? activityId;
    const resolvedOrderId = this.resolveWorkOrderId(orderId ?? this.selectedPanelOrderId ?? this.activeOrderId);
    const order = this.allOrders.find(candidate => candidate.id === resolvedOrderId);
    const entry = {
      id: `auto-act-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      jobId: activityId,
      resourceId: resource.id,
      start,
      end,
      title: activityTitle,
      color: '#4C68B1',
      workOrderReference: order?.referenceNumber,
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
        meta: { entry: assigned, order } as any,
      }];
      this.bookings = [...this.bookings, {
        jobId: activityId,
        resourceName: schedulerResource?.label ?? resource.name,
        resourceType: resource.type,
        entryId: assigned.id,
        orderId: resolvedOrderId ?? undefined,
      }];
      this.trackAutoBooking(resolvedOrderId, assigned.id);
      this.persistAppointmentDates();
    });
  }

  private getPlannedActivities(
    result: { entries: any[]; checkinStart: Date; handoverEnd: Date },
    resources: Resource[],
    preferredResourceIds: string[],
    orderId?: string | null,
  ): PlannedActivity[] | null {
    const preferredIds = new Set(preferredResourceIds);
    const sortedResources = [...resources].sort((a, b) =>
      Number(preferredIds.has(b.id)) - Number(preferredIds.has(a.id))
    );
    const checkinEnd = new Date(result.checkinStart);
    const checkinDuration = this.activityTiles.find(activity => activity.id === 'act-checkin')?.estimatedDurationMinutes ?? 15;
    const handoverDuration = this.activityTiles.find(activity => activity.id === 'act-handover')?.estimatedDurationMinutes ?? 15;
    const checkinStart = new Date(checkinEnd.getTime() - checkinDuration * 60000);
    const dayStart = new Date(checkinStart);
    dayStart.setHours(9, 0, 0, 0);

    if (checkinStart < dayStart) {
      checkinStart.setTime(dayStart.getTime());
      checkinEnd.setTime(checkinStart.getTime() + checkinDuration * 60000);
    }

    const handoverStart = new Date(result.handoverEnd);
    const handoverEnd = new Date(handoverStart.getTime() + handoverDuration * 60000);
    const plannedEntries = [...result.entries];

    const checkinAdvisor = sortedResources.find(resource =>
      resource.type === 'advisor' &&
      this.isResourceFreeForActivity(resource.id, checkinStart, checkinEnd, plannedEntries)
    );
    if (!checkinAdvisor) return null;

    const checkinEntry = {
      resourceId: checkinAdvisor.id,
      start: checkinStart,
      end: checkinEnd,
    };
    plannedEntries.push(checkinEntry);

    const handoverAdvisor = sortedResources.find(resource =>
      resource.type === 'advisor' &&
      resource.id !== checkinAdvisor.id &&
      this.isResourceFreeForActivity(resource.id, handoverStart, handoverEnd, plannedEntries)
    ) ?? (
      this.isResourceFreeForActivity(checkinAdvisor.id, handoverStart, handoverEnd, plannedEntries)
        ? checkinAdvisor
        : undefined
    );
    if (!handoverAdvisor) return null;

    const handoverEntry = {
      resourceId: handoverAdvisor.id,
      start: handoverStart,
      end: handoverEnd,
    };
    plannedEntries.push(handoverEntry);

    const plannedActivities: PlannedActivity[] = [
      { id: 'act-checkin', resource: checkinAdvisor, start: checkinStart, end: checkinEnd },
      { id: 'act-handover', resource: handoverAdvisor, start: handoverStart, end: handoverEnd },
    ];

    const needsMobility = this.getActivitiesForOrder(orderId ?? this.selectedPanelOrderId ?? this.activeOrderId)
      .some(activity => activity.id === 'act-mobility');
    if (needsMobility) {
      const mobilityDriver = sortedResources.find(resource =>
        resource.type === 'driver' &&
        this.isResourceFreeForActivity(resource.id, checkinStart, handoverEnd, plannedEntries)
      );
      if (!mobilityDriver) return null;
      plannedActivities.push({ id: 'act-mobility', resource: mobilityDriver, start: checkinStart, end: handoverEnd });
    }

    return plannedActivities;
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
      const entryIds = [...this.latestAutoBookingEntryIds];
      entryIds.forEach(entryId => this.scheduleRepo.unassign(entryId).subscribe());
      this.events = this.events.filter(e => !this.latestAutoBookingEntryIds.has(e.id));
      this.bookings = this.bookings.filter(b => !this.latestAutoBookingEntryIds.has(b.entryId));
      this.latestAutoBookingEntryIds.clear();
      this.isAutoProposalVisible = false;
      return;
    }

    const last = this.bookings[this.bookings.length - 1];
    this.onUndoBooking(last);
  }

  /** Returns the span [check-in start → handover end] if both are booked, else null */
  private getMobilitySpan(orderId?: string | null): { start: Date; end: Date } | null {
    const resolvedOrderId = this.resolveWorkOrderId(orderId);
    const checkinBooking  = this.bookings.find(b =>
      b.jobId === 'act-checkin' && (!resolvedOrderId || b.orderId === resolvedOrderId)
    );
    const handoverBooking = this.bookings.find(b =>
      b.jobId === 'act-handover' && (!resolvedOrderId || b.orderId === resolvedOrderId)
    );
    if (!checkinBooking || !handoverBooking) return null;

    const checkinEvent  = this.events.find(e => e.id === checkinBooking.entryId);
    const handoverEvent = this.events.find(e => e.id === handoverBooking.entryId);
    if (!checkinEvent || !handoverEvent) return null;

    return { start: checkinEvent.start, end: handoverEvent.end };
  }

  /** After check-in or handover moves, stretch the mobility event to match */
  private syncMobilitySpan(orderId?: string | null): void {
    const resolvedOrderId = this.resolveWorkOrderId(orderId);
    const mobilityBooking = this.bookings.find(b =>
      b.jobId === 'act-mobility' && (!resolvedOrderId || b.orderId === resolvedOrderId)
    );
    if (!mobilityBooking) return;

    const span = this.getMobilitySpan(resolvedOrderId);
    if (!span) return;

    this.scheduleRepo.reschedule(mobilityBooking.entryId, span.start, span.end).subscribe(updated => {
      this.events = this.events.map(e =>
        e.id === mobilityBooking.entryId
          ? { ...e, start: updated.start, end: updated.end }
          : e
      );
    });
  }
}
