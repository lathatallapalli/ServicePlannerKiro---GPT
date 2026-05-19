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
import { ScheduleEntry } from '../../core/models/schedule.model';
import { DEMO_RESOURCE_VIEWS } from './data/resource-views.mock';
import { ResourceFavoriteView } from './services/planner-settings.service';

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
  resources: SchedulerResource[] = [];
  events: SchedulerEvent[] = [];
  scheduleEntries: ScheduleEntry[] = [];
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
  scrollToEventId: string | null = null;
  isOrderPanelOpen = false;
  isPlannerReady = false;
  orderPanelSearch = '';
  selectedPanelOrderId = '';
  schedulingError: string | null = null;
  showBookingDetails = true;
  plannerMode: 'order' | 'full' = 'full';
  activeOrderId: string | null = null;
  hasPrevious = false;
  readonly resourceViews = DEMO_RESOURCE_VIEWS;

  private proposalHistory: Date[] = [];   // searchFrom dates that produced results
  private currentProposalIndex = -1;
  private proposalEndHistory: Date[] = [];
  private proposalStateByOrder = new Map<string, { history: Date[]; endHistory: Date[]; index: number }>();
  private latestAutoBookingEntryIds = new Set<string>();
  private isAutoProposalVisible = false;
  unavailability: UnavailabilityBlock[] = MOCK_UNAVAILABILITY;

  viewStart = new Date('2024-04-15T09:00:00');
  viewEnd   = new Date('2024-04-19T21:00:00');

  get slotDurationMinutes(): number {
    return this.plannerSettings.slotDurationMinutes();
  }

  /** After booking, only show resources that have at least one event */
  get filteredResources(): SchedulerResource[] {
    const resourcePool = this.resourcesForSelectedView;
    if (this.plannerMode === 'order' && this.selectedResourceIds.length) {
      const selectedIds = new Set(this.selectedResourceIds);
      return resourcePool.filter(resource => selectedIds.has(resource.id));
    }
    if (!this.isAutoProposalVisible) return resourcePool;
    const bookedResourceIds = new Set(this.events.map(e => e.resourceId));
    return resourcePool.filter(r => bookedResourceIds.has(r.id));
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
    return this.bookings.map(booking => booking.entryId);
  }

  get detailedOrderIds(): string[] {
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

  get filteredPanelOrders(): any[] {
    const query = this.orderPanelSearch.trim().toLowerCase();
    const orders = this.plannerMode === 'order'
      ? this.allOrders.filter(order => order.id === this.activeOrderId || order.referenceNumber === this.activeOrderId)
      : this.allOrders;

    if (!query) return orders;
    return orders.filter(order =>
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
      this.scheduleEntries = entries;
      this.activeOrderId = this.resolveWorkOrderId(this.activeOrderId) ?? this.activeOrderId;

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

      const jobMap = new Map(
        orders.flatMap((o: any) => o.jobs.map((j: any) => [j.id, { job: j, order: o }]))
      );

      const mappedEvents: Array<SchedulerEvent | null> = entries.map(entry => {
        const found = jobMap.get(entry.jobId) as any;
        return {
          id: entry.id,
          resourceId: entry.resourceId,
          start: entry.start,
          end: entry.end,
          title: entry.title ?? found?.job.title ?? entry.jobId,
          color: entry.color ?? '#4C68B1',
          meta: { job: found?.job, order: found?.order, entry } as any,
        };
      });

      this.events = mappedEvents.filter((event): event is SchedulerEvent => event !== null);

      this.unavailability = [
        ...MOCK_UNAVAILABILITY,
        ...entries
          .filter(entry => entry.kind === 'blocked-order' && this.plannerMode !== 'order')
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
      this.syncMobilitySpan(this.bookings.find(booking => booking.entryId === payload.eventId)?.orderId);
    });
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
    });
  }

  onEventClicked(payload: EventClickPayload): void {
    this.selectedBookingEvent = this.events.find(event => event.id === payload.eventId) ?? null;
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

  isFullPlanner(): boolean {
    return this.plannerMode === 'full';
  }

  toggleOrderPanel(): void {
    this.isOrderPanelOpen = !this.isOrderPanelOpen;
  }

  onOrderPanelSearch(value: string): void {
    this.orderPanelSearch = value;
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

  closeBookingModal(): void {
    this.selectedBookingEvent = null;
  }

  deleteSelectedBooking(): void {
    const event = this.selectedBookingEvent;
    if (!event) return;

    this.scheduleRepo.unassign(event.id).subscribe(() => {
      this.events = this.events.filter(candidate => candidate.id !== event.id);
      this.bookings = this.bookings.filter(booking => booking.entryId !== event.id);
      this.latestAutoBookingEntryIds.delete(event.id);
      this.selectedBookingEvent = null;
    });
  }

  getBookingWorkstation(event: SchedulerEvent): string {
    const resource = this.resources.find(candidate => candidate.id === event.resourceId);
    return resource?.label ?? event.resourceId;
  }

  getBookingResource(event: SchedulerEvent): string {
    return this.getBookingWorkstation(event);
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
    return (order.jobs ?? []).reduce((total: number, job: any) => total + Number(job.fru ?? job.durationFru ?? 0), 0);
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
    event.dataTransfer?.setData('jobId', job.id);
    event.dataTransfer?.setData('orderId', order.id);
    event.dataTransfer?.setData('dropType', 'job');
    event.dataTransfer?.setData('durationMinutes', String(job.estimatedDurationMinutes ?? 60));
    event.dataTransfer?.setData('resourceType', job.requiredResourceType ?? '');
    event.dataTransfer?.setData('application/json', JSON.stringify({ type: 'job', jobId: job.id, orderId: order.id }));
    event.dataTransfer?.setData('text/plain', job.id);
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

  getBookingDateValue(date: Date): Date[] {
    return [date];
  }

  getBookingTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  getBookingMeridiem(date: Date): 'AM' | 'PM' {
    return date.getHours() >= 12 ? 'PM' : 'AM';
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
    return Number(job.fru ?? job.durationFru ?? 0);
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

  canUndoBooking(booking: JobBooking): boolean {
    return this.bookings.some(candidate => candidate.entryId === booking.entryId) || this.scheduleEntries.some(entry => entry.id === booking.entryId);
  }

  getActivitiesForOrder(_order: any): ActivityTile[] {
    return this.activityTiles;
  }

  getActivityBooking(activity: ActivityTile, _orderId: string): JobBooking | undefined {
    const liveBooking = this.bookings.find(booking => booking.jobId === activity.id && booking.orderId === _orderId);
    if (liveBooking) return liveBooking;

    const order = this.allOrders.find(candidate => candidate.id === _orderId);
    return order ? this.getExistingScheduleBookingForActivity(activity, order) : undefined;
  }

  getActivityFru(activity: ActivityTile): number {
    return Math.max(1, Math.round(activity.estimatedDurationMinutes / 15));
  }

  private hasExistingScheduledEntriesForOrder(order: any): boolean {
    const entries = this.getExistingScheduleEntriesForOrder(order);
    return entries.length > 0 && entries.every(entry => entry.kind === 'blocked-order' || entry.kind === 'scheduled');
  }

  private getExistingScheduleEntriesForOrder(order: any): ScheduleEntry[] {
    return this.scheduleEntries.filter(entry => entry.workOrderReference === order.referenceNumber);
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
    this.bookings = this.bookings.filter(booking => !entryIds.has(booking.entryId));
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
    const titlePrefix = titlePrefixByActivity[activity.id];
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
    let start = payload.start;
    let end = payload.end;

    // Business rule: if this job already has a booking, snap to that booking's timeslot
    const droppedResource = this.resources.find(r => r.id === payload.resourceId);
    const droppedResourceType = payload.droppedResourceType ?? (droppedResource?.meta as any)?.type;
    const bookingResourceType = droppedResourceType ?? payload.resourceType ?? 'mechanic';
    const existingJobBooking = this.bookings.find(b =>
      b.jobId === payload.jobId &&
      (!activeOrderId || b.orderId === activeOrderId)
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
      const span = this.getMobilitySpan(activeOrderId);
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
      const found = this.allOrders.flatMap((o: any) => o.jobs).find((j: any) => j.id === payload.jobId);
      const resource = this.resources.find(r => r.id === payload.resourceId);

      // Add the event and booking first
      this.events = [...this.events, {
        id: assigned.id,
        resourceId: assigned.resourceId,
        start: assigned.start,
        end: assigned.end,
        title: found?.title ?? payload.jobId,
        color: '#4C68B1',
        meta: {
          job: found,
          order: this.allOrders.find(order => order.id === activeOrderId),
          entry: assigned,
        } as any,
      }];

      this.bookings = [...this.bookings, {
        jobId: payload.jobId,
        resourceName: resource?.label ?? payload.resourceId,
        resourceType: bookingResourceType,
        entryId: assigned.id,
        orderId: activeOrderId,
      }];

      // Business rule: after check-in or handover is booked, sync mobility span if it exists
      if (payload.jobId === 'act-checkin' || payload.jobId === 'act-handover') {
        this.syncMobilitySpan(activeOrderId);
      }

      // Business rule: when mobility is dropped, snap its span to check-in→handover if both booked
      if (payload.jobId === 'act-mobility') {
        const span = this.getMobilitySpan(activeOrderId);
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
      this.scheduleEntries = this.scheduleEntries.filter(entry => entry.id !== booking.entryId);
      this.bookings = this.bookings.filter(b => b.entryId !== booking.entryId);
      this.latestAutoBookingEntryIds.delete(booking.entryId);
      if (this.latestAutoBookingEntryIds.size === 0) {
        this.isAutoProposalVisible = false;
      }
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

    const rawResources = this.resources.map(r => r.meta as any).filter(Boolean);
    const existingEntries = this.getOccupyingEntriesForProposal(targetOrder);

    const result = this.autoScheduler.schedule({
      jobs: unscheduledJobs,
      resources: rawResources,
      existingEntries,
      unavailability: this.unavailability,
      searchFrom,
      dayStartHour: 9,
      dayEndHour: 21,
    });

    if (!result) return;

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
      this.scheduleRepo.assign(entry).subscribe(assigned => {
        const job = unscheduledJobs.find((j: any) => j.id === assigned.jobId);
        const resource = this.resources.find(r => r.id === assigned.resourceId);
        const resourceType = (resource?.meta as any)?.type ?? 'mechanic';
        this.events = [...this.events, {
          id: assigned.id, resourceId: assigned.resourceId,
          start: assigned.start, end: assigned.end,
          title: job?.title ?? assigned.jobId, color: '#4C68B1',
          meta: { job, order: targetOrder, entry: { ...assigned, workOrderReference: targetOrder?.referenceNumber } } as any,
        }];
        this.bookings = [...this.bookings, {
          jobId: assigned.jobId, resourceName: resource?.label ?? assigned.resourceId,
          resourceType, entryId: assigned.id, orderId: targetWorkOrderId ?? undefined,
        }];
        this.latestAutoBookingEntryIds.add(assigned.id);
        if (assigned.id === scrollTargetEntryId) {
          this.scrollToEventId = assigned.id;
        }
      });
    });

    // Activities
    const checkinStart = new Date(result.checkinStart);
    const checkinEnd   = new Date(checkinStart.getTime() + 30 * 60000);
    const handoverStart = new Date(result.handoverEnd);
    const handoverEnd   = new Date(handoverStart.getTime() + 30 * 60000);

    const checkinAdvisor = rawResources.find((r: any) =>
      r.type === 'advisor' &&
      this.isResourceFreeForActivity(r.id, checkinStart, checkinEnd, result.entries)
    );
    const handoverAdvisor = rawResources.find((r: any) =>
      r.type === 'advisor' && r.id !== checkinAdvisor?.id &&
      this.isResourceFreeForActivity(r.id, handoverStart, handoverEnd, result.entries)
    ) ?? checkinAdvisor;
    const mobilityDriver = rawResources.find((r: any) => r.type === 'driver');

    if (checkinAdvisor)  this.bookActivity('act-checkin',  checkinAdvisor,  checkinStart,  checkinEnd, targetWorkOrderId ?? undefined);
    if (handoverAdvisor) this.bookActivity('act-handover', handoverAdvisor, handoverStart, handoverEnd, targetWorkOrderId ?? undefined);
    if (mobilityDriver)  this.bookActivity('act-mobility', mobilityDriver,  checkinStart,  handoverEnd, targetWorkOrderId ?? undefined);
  }

  private getActiveWorkOrderId(): string | null {
    return this.selectedPanelOrderId || this.activeOrderId || this.jobTiles[0]?.workOrder.id || null;
  }

  private resolveWorkOrderId(orderIdOrReference: string | null): string | null {
    if (!orderIdOrReference) return null;
    const order = this.allOrders.find(candidate =>
      candidate.id === orderIdOrReference || candidate.referenceNumber === orderIdOrReference
    );
    return order?.id ?? null;
  }

  private findOrderForEvent(event: SchedulerEvent): any | null {
    const jobId = event.meta?.job?.id ?? this.bookings.find(booking => booking.entryId === event.id)?.jobId;
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
    this.events   = this.events.filter(e => !autoEntryIds.has(e.id));
    this.bookings = [];
    this.latestAutoBookingEntryIds.clear();
    this.isAutoProposalVisible = false;
  }

  private bookActivity(activityId: string, resource: any, start: Date, end: Date, orderId?: string): void {
    const activityTitle = this.activityTiles.find(activity => activity.id === activityId)?.title ?? activityId;
    const order = this.allOrders.find(candidate => candidate.id === orderId);
    const entry = {
      id: `auto-act-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      jobId: activityId,
      resourceId: resource.id,
      start,
      end,
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
        meta: { job: undefined, order, entry: { ...assigned, workOrderReference: order?.referenceNumber } } as any,
      }];
      this.bookings = [...this.bookings, {
        jobId: activityId,
        resourceName: schedulerResource?.label ?? resource.name,
        resourceType: resource.type,
        entryId: assigned.id,
        orderId,
      }];
      this.latestAutoBookingEntryIds.add(assigned.id);
    });
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
  private getMobilitySpan(orderId?: string): { start: Date; end: Date } | null {
    const checkinBooking  = this.bookings.find(b => b.jobId === 'act-checkin' && (!orderId || b.orderId === orderId));
    const handoverBooking = this.bookings.find(b => b.jobId === 'act-handover' && (!orderId || b.orderId === orderId));
    if (!checkinBooking || !handoverBooking) return null;

    const checkinEvent  = this.events.find(e => e.id === checkinBooking.entryId);
    const handoverEvent = this.events.find(e => e.id === handoverBooking.entryId);
    if (!checkinEvent || !handoverEvent) return null;

    return { start: checkinEvent.start, end: handoverEvent.end };
  }

  /** After check-in or handover moves, stretch the mobility event to match */
  private syncMobilitySpan(orderId?: string): void {
    const mobilityBooking = this.bookings.find(b => b.jobId === 'act-mobility' && (!orderId || b.orderId === orderId));
    if (!mobilityBooking) return;

    const span = this.getMobilitySpan(orderId);
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
