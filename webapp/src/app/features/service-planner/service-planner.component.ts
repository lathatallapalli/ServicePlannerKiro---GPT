import { Component, HostListener, OnDestroy, OnInit, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ComboBoxModule, ContextMenuModule, DatePickerModule, InputModule, SearchModule, SelectModule, TimePickerModule, TimePickerSelectModule, ToggleModule } from 'carbon-components-angular';
import { CustomSchedulerComponent } from '../../shared/components/scheduler/custom/custom-scheduler.component';
import { JobTile, JobBooking, ActivityTile } from './components/jobs-panel/jobs-panel.component';
import { SchedulerResource, SchedulerEvent, SchedulerGroup, SchedulerCapacityBlock, EventMovePayload, EventResizePayload, EventDropPayload, EventClickPayload, EventContextMenuPayload, OrderFocusPayload, ResourceSelectionChangePayload, ResourceTypeSelectionChangePayload, SchedulerInvalidDropRange, SchedulerInvalidCapacityResource, SchedulerDropVisualContext, SchedulerTimeRangePayload, SchedulerBookedResourceFilterContext, SchedulerResourceSlotContextMenuPayload } from '../../shared/components/scheduler/scheduler.interface';
import { ResourceRepository } from '../../core/services/resource.repository';
import { ScheduleRepository } from '../../core/services/schedule.repository';
import { WorkOrderRepository } from '../../core/services/work-order.repository';
import { PlannerSettingsService, PlannerViewMode } from './services/planner-settings.service';
import { AutoScheduleResult, AutoSchedulerService } from './services/auto-scheduler.service';
import { ResourceViewsService } from './services/resource-views.service';
import { MOCK_UNAVAILABILITY } from '../../core/services/mock/mock-data';
import { UnavailabilityBlock } from '../../core/models/availability.model';
import { BookingCategory } from '../../core/models/booking-category.model';
import { ScheduleEntry } from '../../core/models/schedule.model';
import { JobResourceRequirement, WorkorderItemStatus } from '../../core/models/job.model';
import { Resource, ResourceType } from '../../core/models/resource.model';
import { ResourceFavoriteView } from './services/planner-settings.service';
import { AppointmentSyncService } from '../../core/services/appointment-sync.service';
import { QuickViewSelectionService } from '../quick-view/quick-view-selection.service';
import { BookingCategoriesService } from '../booking-categories/booking-categories.service';

const MINUTES_PER_FRU = 60;

interface BookingSet {
  id: string;
  summary: string;
  bookings: JobBooking[];
}

type SearchMatchType = 'order-header' | 'job' | 'activity' | 'booking-resource';

interface PanelSearchMatch {
  type: SearchMatchType;
  orderId: string;
  jobId?: string;
  activityId?: string;
  bookingEntryId?: string;
}

interface SearchHighlightPart {
  text: string;
  isMatch: boolean;
}

interface PlannerMonthDay {
  date: Date;
  isCurrentMonth: boolean;
  isPast: boolean;
  isToday: boolean;
  isSelected: boolean;
  bookingCount: number;
  availability: MonthResourceAvailability[];
}

interface MonthResourceAvailability {
  type: ResourceType;
  label: string;
  shortLabel: string;
  availableMinutes: number;
  totalMinutes: number;
  percentage: number;
  status: 'good' | 'medium' | 'low';
}

interface MonthPreviewResource {
  resource: SchedulerResource;
  events: SchedulerEvent[];
  unavailable: UnavailabilityBlock[];
}

type MonthPreviewResourceRow =
  | { kind: 'heading'; id: string; label: string }
  | ({ kind: 'resource' } & MonthPreviewResource);

interface AutoBookingRangeNotice {
  title: string;
  message: string;
  targetDate: Date;
  targetEventId?: string;
}

type WorkOrderItemKind = 'job' | 'activity';
type SchedulingRole = 'start-boundary' | 'work' | 'end-boundary' | 'span';
type CanonicalWorkOrderItemStatus = Exclude<WorkorderItemStatus, 'started'>;
type OrderPlanningState = 'unscheduled' | 'partiallyScheduled' | 'reserved' | 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
type OrderPanelGroup = 'pending' | 'reserved' | 'scheduled' | 'in-progress' | 'completed';

interface NormalizedWorkOrderItem {
  id: string;
  orderId: string;
  title: string;
  kind: WorkOrderItemKind;
  source: any | ActivityTile;
  templateId?: string;
  executionStatus: CanonicalWorkOrderItemStatus;
}

type WorkOrderActivityTile = ActivityTile & { workOrderItemId?: string; templateId?: string };

interface ManualDragContext {
  kind: 'job' | 'activity' | 'order';
  orderId?: string;
  itemId?: string;
  entryId?: string;
  activityTemplateId?: string;
  durationMinutes: number;
  requirements: JobResourceRequirement[];
  anchoredStart?: Date;
  anchoredEnd?: Date;
  pointerOffsetMinutes?: number;
}

type ManualPlanInvalidReasonCode =
  | 'outside-working-hours'
  | 'resource-mismatch'
  | 'resource-unavailable'
  | 'vehicle-unavailable'
  | 'required-resource-unavailable'
  | 'before-checkin'
  | 'after-handover'
  | 'checkin-after-job'
  | 'checkin-after-handover'
  | 'handover-before-job'
  | 'handover-before-checkin'
  | 'mobility-fixed-span'
  | 'capacity-overbooked';

interface ManualPlanInvalidReason {
  code: ManualPlanInvalidReasonCode;
  detail?: string;
}

interface ManualPlanValidationResult {
  valid: boolean;
  reasons: ManualPlanInvalidReason[];
}

interface SelectedResourceConstraintContext {
  requiredResourceIds: string[];
  hasRelevantSelection: boolean;
}

@Component({
  selector: 'app-service-planner',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ComboBoxModule,
    ContextMenuModule,
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
export class ServicePlannerComponent implements OnInit, OnDestroy {
  private get loggedInAdvisorResourceId(): string {
    return this.selectedResourceView?.personalCalendarResourceId
      ?? this.getDefaultPersonalCalendarResourceId(this.selectedResourceView?.demoLocationId);
  }

  private getDefaultPersonalCalendarResourceId(demoLocationId?: string): string {
    switch (demoLocationId) {
      case 'klagenfurt':
        return 'klg-advisor-jeff';
      case 'vienna':
        return 'vie-advisor-frank-reynold';
      default:
        return 'advisor-ted-phillips';
    }
  }

  private readonly monthCapacityPreferenceKey = 'service-planner.month-capacity-visible';
  private readonly personalCalendarGroup: SchedulerGroup = { id: 'group-personal-calendar', label: 'Calendar' };

  resources: SchedulerResource[] = [];
  events: SchedulerEvent[] = [];
  capacityBlocks: SchedulerCapacityBlock[] = [];
  scheduleEntries: ScheduleEntry[] = [];
  allScheduleEntries: ScheduleEntry[] = [];
  monthPreviewEntries: ScheduleEntry[] = [];
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
  isCategoryFlyoutOpen = false;
  resourceSlotContextMenu: SchedulerResourceSlotContextMenuPayload | null = null;
  blockTimeModalOpen = false;
  blockTimeResourceId = '';
  blockTimeStartDate = '';
  blockTimeStartTime = '';
  blockTimeEndDate = '';
  blockTimeEndTime = '';
  blockTimeTitle = '';
  blockTimeDescription = '';
  blockTimeEditingEntryId: string | null = null;
  blockTimeCategoryIds: string[] = [];
  bookingModalStartDate = '';
  bookingModalStartTime = '';
  bookingModalEndDate = '';
  bookingModalEndTime = '';
  bookingModalResourceId = '';
  bookingModalAdditionalResourceIds: Record<string, string> = {};
  scrollToEventId: string | null = null;
  scrollToEventIds: string[] = [];
  scrollToEventPulse = true;
  scrollToEventRequestId = 0;
  isOrderPanelOpen = false;
  orderPanelWidth = 378;
  private readonly minOrderPanelWidth = 378;
  private readonly maxOrderPanelWidth = 640;
  private orderPanelResizeStartX = 0;
  private orderPanelResizeStartWidth = 378;
  private isResizingOrderPanel = false;
  isPlannerReady = false;
  orderPanelSearch = '';
  bookingSearchQuery = '';
  activeSearchResultIndex = 0;
  expandedOrderIds = new Set<string>();
  searchRevealedOrderIds = new Set<string>();
  collapsedOrderGroups = new Set<OrderPanelGroup>();
  expandedEmptyOrderGroups = new Set<OrderPanelGroup>();
  expandedEmptySearchOrderGroups = new Set<OrderPanelGroup>();
  selectedPanelOrderId = '';
  focusedPlanningOrderId = '';
  fullPlannerOrderOnlyId = '';
  public schedulingError: string | null = null;
  public schedulingErrorTitle = 'Unable to book first availability';
  autoBookingRangeNotice: AutoBookingRangeNotice | null = null;
  showBookingDetails = true;
  showMonthCapacity = false;
  isMonthViewDropdownOpen = false;
  isMonthGroupDropdownOpen = false;
  plannerMode: 'order' | 'full' = 'full';
  activeOrderId: string | null = null;
  hasPrevious = false;
  private proposalHistory: Date[] = [];   // searchFrom dates that produced results
  private currentProposalIndex = -1;
  private proposalEndHistory: Date[] = [];
  private proposalStateByOrder = new Map<string, { history: Date[]; endHistory: Date[]; index: number }>();
  private latestAutoBookingEntryIds = new Set<string>();
  private isAutoProposalVisible = false;
  private isReplacingFocusedOrderBookings = false;
  manualDragContext: ManualDragContext | null = null;
  manualResizeContext: ManualDragContext | null = null;
  autoBookingWindow: SchedulerTimeRangePayload | null = null;
  manualResizeResourceId: string | null = null;
  unavailability: UnavailabilityBlock[] = MOCK_UNAVAILABILITY;

  private readonly mockCurrentTime = new Date('2024-04-15T09:00:00');
  private readonly freeViewWindowDays = 10;
  private readonly freeViewLazyLoadDays = 5;
  private currentPlannerTime = new Date('2024-04-15T09:15:00');
  private currentPlannerTimeTimer: ReturnType<typeof setInterval> | null = null;
  viewStart = new Date('2024-04-15T09:00:00');
  viewEnd   = new Date('2024-04-15T21:00:00');
  selectedMonthPreviewDate: Date | null = null;
  private nextViewModeAnchor: Date | null = null;
  private isFreeTimelineLoading = false;
  private previousPlannerViewMode: PlannerViewMode = 'day';

  get plannerCurrentTime(): Date {
    return this.currentPlannerTime;
  }

  get slotDurationMinutes(): number {
    return this.plannerSettings.slotDurationMinutes();
  }

  get plannerViewMode(): PlannerViewMode {
    return this.plannerSettings.viewMode();
  }

  get monthOverviewDays(): PlannerMonthDay[] {
    const monthStart = new Date(this.viewStart.getFullYear(), this.viewStart.getMonth(), 1);
    const gridStart = new Date(monthStart);
    const startDay = gridStart.getDay();
    gridStart.setDate(gridStart.getDate() - (startDay === 0 ? 6 : startDay - 1));
    gridStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(this.viewStart.getFullYear(), this.viewStart.getMonth() + 1, 0);
    const gridEnd = new Date(monthEnd);
    const endDay = gridEnd.getDay();
    gridEnd.setDate(gridEnd.getDate() + (endDay === 0 ? 0 : 7 - endDay));
    gridEnd.setHours(0, 0, 0, 0);
    const dayCount = Math.max(7, Math.round((gridEnd.getTime() - gridStart.getTime()) / 86400000) + 1);

    return Array.from({ length: dayCount }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const dayStart = this.getDayBoundary(date, 0, 0);
      const dayEnd = this.getDayBoundary(date, 23, 59);
      dayEnd.setSeconds(59, 999);
      const dayEvents = this.events.filter(event => event.start <= dayEnd && event.end >= dayStart);
      const todayStart = this.getDayBoundary(this.mockCurrentTime, 0, 0);

      return {
        date,
        isCurrentMonth: date.getMonth() === this.viewStart.getMonth(),
        isPast: dayStart < todayStart,
        isToday: this.isSameCalendarDay(date, this.mockCurrentTime),
        isSelected: this.selectedMonthPreviewDate ? this.isSameCalendarDay(date, this.selectedMonthPreviewDate) : false,
        bookingCount: dayEvents.length,
        availability: this.getMonthResourceAvailability(date, this.getScheduleEntriesForDay(date)),
      };
    });
  }

  getMonthAvailabilityTitle(item: MonthResourceAvailability): string {
    return `${item.label}: ${item.percentage}% available (${this.formatDurationHours(item.availableMinutes)} of ${this.formatDurationHours(item.totalMinutes)})`;
  }

  get monthOverviewTitle(): string {
    return this.viewStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }

  get monthPreviewTitle(): string {
    return this.selectedMonthPreviewDate
      ? this.selectedMonthPreviewDate.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
      : '';
  }

  get monthPreviewAvailability(): MonthResourceAvailability[] {
    return this.selectedMonthPreviewDate
      ? this.getMonthResourceAvailability(this.selectedMonthPreviewDate, this.getMonthPreviewEntriesForSelectedDate())
      : [];
  }

  get monthPreviewResources(): MonthPreviewResourceRow[] {
    if (!this.selectedMonthPreviewDate) return [];
    const dayStart = this.getDayBoundary(this.selectedMonthPreviewDate, 9, 0);
    const dayEnd = this.getDayBoundary(this.selectedMonthPreviewDate, 21, 0);
    const previewEvents = this.mapScheduleEntriesToEvents(this.getMonthPreviewEntriesForSelectedDate());
    const rows: MonthPreviewResourceRow[] = [];
    const groupedResources = new Map<string, { label: string; resources: SchedulerResource[] }>();

    this.visibleSchedulerResources.forEach(resource => {
      const groupId = resource.groupId ?? this.getMonthPreviewResourceTypeLabel(resource);
      const group = groupedResources.get(groupId) ?? {
        label: resource.groupLabel ?? this.getMonthPreviewResourceTypeLabel(resource),
        resources: [],
      };
      group.resources.push(resource);
      groupedResources.set(groupId, group);
    });

    const orderedGroupIds = [
      ...this.visibleSchedulerGroups.map(group => group.id),
      ...Array.from(groupedResources.keys()).filter(groupId => !this.visibleSchedulerGroups.some(group => group.id === groupId)),
    ];

    orderedGroupIds.forEach(groupId => {
      const group = groupedResources.get(groupId);
      if (!group) return;
      rows.push({ kind: 'heading', id: `heading:${groupId}`, label: group.label });

      group.resources.forEach(resource => {
      rows.push({
        kind: 'resource',
        resource,
        events: previewEvents
          .filter(event => event.resourceId === resource.id && event.start < dayEnd && event.end > dayStart)
          .sort((first, second) => first.start.getTime() - second.start.getTime()),
        unavailable: this.unavailability
          .filter(block => block.resourceId === resource.id && block.start < dayEnd && block.end > dayStart)
          .sort((first, second) => first.start.getTime() - second.start.getTime()),
      });
      });
    });

    return rows;
  }

  get isMonthPreviewDateInVisibleMonth(): boolean {
    return !!this.selectedMonthPreviewDate
      && this.selectedMonthPreviewDate.getMonth() === this.viewStart.getMonth()
      && this.selectedMonthPreviewDate.getFullYear() === this.viewStart.getFullYear();
  }

  get plannerNavigationTitle(): string {
    if (this.plannerViewMode === 'week') {
      return `${this.formatShortDate(this.viewStart)} - ${this.formatShortDate(this.viewEnd)}`;
    }
    if (this.plannerViewMode === 'free') return 'Full calendar';
    return this.formatLongDate(this.viewStart);
  }

  get plannerNavigationMeta(): string {
    if (this.plannerViewMode === 'week') {
      return `Calendar week ${this.getCalendarWeek(this.viewStart)}`;
    }
    if (this.plannerViewMode === 'free') return 'Free view';
    return this.viewStart.toLocaleDateString('en-GB', { weekday: 'long' });
  }

  goToPreviousPlannerPeriod(): void {
    this.shiftPlannerWindow(-1);
  }

  goToNextPlannerPeriod(): void {
    this.shiftPlannerWindow(1);
  }

  goToPreviousMonth(): void {
    this.shiftPlannerWindow(-1);
  }

  goToNextMonth(): void {
    this.shiftPlannerWindow(1);
  }

  selectMonthPreviewDay(date: Date): void {
    this.selectedMonthPreviewDate = new Date(date);
    this.loadMonthPreviewEntries();
  }

  closeMonthPreview(): void {
    this.selectedMonthPreviewDate = null;
    this.monthPreviewEntries = [];
  }

  openSelectedMonthPreviewInDayView(): void {
    if (!this.selectedMonthPreviewDate) return;
    this.nextViewModeAnchor = new Date(this.selectedMonthPreviewDate);
    this.plannerSettings.setViewMode('day');
  }

  showSelectedMonthPreviewInCalendar(): void {
    if (!this.selectedMonthPreviewDate) return;
    this.setViewWindowForMode('month', new Date(this.selectedMonthPreviewDate));
    this.reloadScheduleEntries();
  }

  getMonthPreviewEventStyle(event: SchedulerEvent): Record<string, string> {
    return this.getMonthPreviewRangeStyle(event.start, event.end);
  }

  getMonthPreviewUnavailabilityStyle(block: UnavailabilityBlock): Record<string, string> {
    return this.getMonthPreviewRangeStyle(block.start, block.end);
  }

  getMonthPreviewEventLabel(event: SchedulerEvent): string {
    return event.title || event.meta?.entry?.title || 'Booking';
  }

  getMonthPreviewResourceRowId(row: MonthPreviewResourceRow): string {
    return row.kind === 'heading' ? row.id : row.resource.id;
  }

  private getMonthPreviewResourceTypeLabel(resource: SchedulerResource): string {
    const rawResource = resource.meta as Resource | undefined;
    return rawResource?.type ? `${this.formatResourceType(rawResource.type)}s` : 'Resources';
  }

  private getMonthResourceAvailability(day: Date, entries: ScheduleEntry[] = this.scheduleEntries): MonthResourceAvailability[] {
    const dayStart = this.getDayBoundary(day, 9, 0);
    const dayEnd = this.getDayBoundary(day, 21, 0);

    // Use filtered resources (same as day/week view) based on selected view + type groups
    const filteredResources = this.visibleResourcePool;

    // Dynamically determine resource types from filtered resources
    const typeMap = new Map<ResourceType, { label: string; shortLabel: string }>();
    const shortLabels: Record<ResourceType, string> = {
      mechanic: 'M', advisor: 'S', driver: 'C', bay: 'B', device: 'D',
    };
    const fullLabels: Record<ResourceType, string> = {
      mechanic: 'Mechanics', advisor: 'Service Advisors', driver: 'Courtesy Cars', bay: 'Bays', device: 'Devices',
    };
    for (const resource of filteredResources) {
      const rawResource = resource.meta as Resource | undefined;
      if (!rawResource) continue;
      if (!typeMap.has(rawResource.type)) {
        typeMap.set(rawResource.type, {
          label: fullLabels[rawResource.type] ?? rawResource.type,
          shortLabel: shortLabels[rawResource.type] ?? rawResource.type.charAt(0).toUpperCase(),
        });
      }
    }

    // Determine type order from visible scheduler groups
    const typeOrder: ResourceType[] = [];
    for (const group of this.visibleSchedulerGroups) {
      const groupResource = filteredResources.find(r => r.groupId === group.id);
      const groupType = (groupResource?.meta as Resource | undefined)?.type;
      if (groupType && !typeOrder.includes(groupType)) typeOrder.push(groupType);
    }

    return [...typeMap.entries()]
      .sort(([a], [b]) => {
        const indexA = typeOrder.indexOf(a);
        const indexB = typeOrder.indexOf(b);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
      })
      .map(([type, { label, shortLabel }]) => {
      const resources = filteredResources.filter(resource => {
        const rawResource = resource.meta as Resource | undefined;
        return rawResource?.type === type;
      });
      const totalMinutes = resources.length * this.getRangeMinutes(dayStart, dayEnd);
      const usedMinutes = resources.reduce((sum, resource) =>
        sum + this.getMonthResourceUsedMinutes(resource.id, dayStart, dayEnd, entries),
      0);
      const availableMinutes = Math.max(0, totalMinutes - usedMinutes);
      const percentage = totalMinutes > 0 ? Math.round((availableMinutes / totalMinutes) * 100) : 0;

      return {
        type,
        label,
        shortLabel,
        availableMinutes,
        totalMinutes,
        percentage,
        status: this.getMonthAvailabilityStatus(percentage),
      };
    });
  }

  private getMonthResourceUsedMinutes(resourceId: string, dayStart: Date, dayEnd: Date, entries: ScheduleEntry[]): number {
    const entryMinutes = entries
      .filter(entry => entry.kind !== 'day-capacity' && entry.resourceId === resourceId)
      .reduce((sum, entry) => sum + this.getClippedRangeMinutes(entry.start, entry.end, dayStart, dayEnd), 0);
    const unavailableMinutes = this.unavailability
      .filter(block => block.resourceId === resourceId)
      .reduce((sum, block) => sum + this.getClippedRangeMinutes(block.start, block.end, dayStart, dayEnd), 0);
    const capacityMinutes = entries
      .filter(entry => entry.kind === 'day-capacity' && entry.resourceId === resourceId)
      .reduce((sum, entry) => sum + this.getClippedRangeMinutes(entry.start, entry.end, dayStart, dayEnd), 0);

    return entryMinutes + unavailableMinutes + capacityMinutes;
  }

  private getClippedRangeMinutes(start: Date, end: Date, clipStart: Date, clipEnd: Date): number {
    const clippedStart = Math.max(start.getTime(), clipStart.getTime());
    const clippedEnd = Math.min(end.getTime(), clipEnd.getTime());
    return Math.max(0, Math.round((clippedEnd - clippedStart) / 60000));
  }

  private getRangeMinutes(start: Date, end: Date): number {
    return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  }

  private getMonthAvailabilityStatus(percentage: number): MonthResourceAvailability['status'] {
    if (percentage >= 60) return 'good';
    if (percentage >= 30) return 'medium';
    return 'low';
  }

  private formatDurationHours(minutes: number): string {
    const hours = minutes / 60;
    return `${Number.isInteger(hours) ? hours.toFixed(0) : hours.toFixed(1)}h`;
  }

  formatAvailableHours(minutes: number): string {
    const hours = minutes / 60;
    if (Number.isInteger(hours)) return `${hours}h free`;
    return `${hours.toFixed(1)}h free`;
  }

  formatAvailableHoursShort(minutes: number): string {
    const hours = minutes / 60;
    if (Number.isInteger(hours)) return `${hours}h`;
    return `${hours.toFixed(1)}h`;
  }

  getTotalFreeHours(): string {
    const totalFree = this.monthPreviewAvailability.reduce((sum, item) => sum + item.availableMinutes, 0);
    const hours = totalFree / 60;
    if (Number.isInteger(hours)) return `${hours}h`;
    return `${hours.toFixed(1)}h`;
  }

  onMonthDayDragOver(event: DragEvent, day: any): void {
    if (day.isPast) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }

  onMonthDayDragLeave(event: DragEvent): void {
    // No-op for now, could clear visual feedback
  }

  onMonthDayDrop(event: DragEvent, day: any): void {
    event.preventDefault();
    if (day.isPast) return;

    const orderId = event.dataTransfer?.getData('orderId');
    if (!orderId) return;

    const order = this.allOrders.find((o: any) => o.id === orderId || o.referenceNumber === orderId);
    if (!order) return;

    // Use the same logic as day-capacity drop but without a specific dropped resource
    // Find the best resource for each job requirement from the visible pool
    const targetDate = new Date(day.date);
    targetDate.setHours(9, 0, 0, 0);

    // Create a synthetic payload and route to the order day capacity handler
    const payload: any = {
      dropType: 'order',
      dropMode: 'day-capacity',
      orderId: order.id,
      resourceId: this.getBestResourceForMonthDrop(order),
      date: targetDate,
      start: targetDate,
      end: new Date(targetDate.getTime() + 12 * 60 * 60000),
    };

    if (!payload.resourceId) {
      this.setSchedulingError('No compatible resource available.', 'Capacity block not possible');
      return;
    }

    this.onEventDropped(payload);
    this.selectMonthPreviewDay(day.date);
  }

  private getBestResourceForMonthDrop(order: any): string | null {
    const jobs: any[] = order.jobs ?? [];
    const rawResources = this.visibleResourcePool.map(r => r.meta as Resource).filter(Boolean);

    // Find a resource that matches the first job's primary requirement
    for (const job of jobs) {
      if (this.isActivityId(job.id) || job.workorderItemCategory === 'activity') continue;
      const requirements = this.getSchedulingRequirements(job);
      if (!requirements.length) continue;
      const primaryReq = requirements[0];
      const match = rawResources.find(r =>
        r.type === primaryReq.resourceType &&
        primaryReq.requiredQualifications.every(q => r.qualifications.some(rq => rq.id === q.id))
      );
      if (match) return match.id;
    }
    return rawResources[0]?.id ?? null;
  }

  get manualDropSnapMinutes(): number {
    return this.getManualInteractionSnapMinutes();
  }

  private getManualInteractionSnapMinutes(): number {
    if (this.slotDurationMinutes <= 30) return this.slotDurationMinutes;
    return Math.max(15, this.slotDurationMinutes / 2);
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
    return this.getPersistedBookingsFromEntries(this.allScheduleEntries, this.allOrders);
  }

  get filteredResources(): SchedulerResource[] {
    return this.visibleResourcePool;
  }

  get fullPlannerResources(): SchedulerResource[] {
    return this.visibleResourcePool;
  }

  private getFullPlannerVisibleResources(): SchedulerResource[] {
    const focusedOrder = this.getFullPlannerFocusedOrder();
    if (!focusedOrder) return this.fullPlannerResources;

    const bookedResourceIds = new Set(
      this.allScheduleEntries
        .filter(entry => this.isEntryForOrder(entry, focusedOrder))
        .map(entry => entry.resourceId)
    );
    if (!bookedResourceIds.size) return this.fullPlannerResources;

    return this.fullPlannerResources.filter(resource => bookedResourceIds.has(resource.id));
  }

  private getFullPlannerFocusedOrder(): any | null {
    if (this.plannerMode !== 'full' || !this.fullPlannerOrderOnlyId) return null;
    const order = this.allOrders.find(candidate => candidate.id === this.fullPlannerOrderOnlyId || candidate.referenceNumber === this.fullPlannerOrderOnlyId) ?? null;
    return order && this.hasPlannerBookingsForOrder(order) ? order : null;
  }

  get visibleSchedulerResources(): SchedulerResource[] {
    const resources = this.visibleResourcePool;
    if (!this.viewPersonalCalendarOnTop) return resources;

    return resources.map(resource =>
      resource.id === this.loggedInAdvisorResourceId
        ? { ...resource, groupId: this.personalCalendarGroup.id, groupLabel: this.personalCalendarGroup.label }
        : resource
    );
  }

  get schedulerBookedResourceFilterContext(): SchedulerBookedResourceFilterContext | null {
    const focusedOrder = this.getBookedFilterFocusedOrder();
    if (!focusedOrder) return null;
    const resourceIds = this.getBookedResourceIdsForOrder(focusedOrder);
    if (!resourceIds.length) return null;
    const source = this.plannerMode === 'order' ? 'global' : 'focused-order';
    return {
      contextKey: `${source}:${focusedOrder.id}`,
      active: true,
      source,
      resourceIds,
    };
  }

  private getBookedFilterFocusedOrder(): any | null {
    if (this.plannerMode === 'order') {
      if (!this.activeOrderId) return null;
      const order = this.allOrders.find(candidate => candidate.id === this.activeOrderId || candidate.referenceNumber === this.activeOrderId) ?? null;
      return order && this.hasPlannerBookingsForOrder(order) ? order : null;
    }
    return this.getFullPlannerFocusedOrder();
  }

  private getBookedResourceIdsForOrder(order: any): string[] {
    const resourceIds = new Set<string>();
    this.events
      .filter(event => this.isEventForOrder(event, order))
      .forEach(event => resourceIds.add(event.resourceId));
    this.capacityBlocks
      .filter(block => this.isEntryForOrder(block.meta?.entry as ScheduleEntry | undefined, order))
      .forEach(block => resourceIds.add(block.resourceId));
    this.allScheduleEntries
      .filter(entry => this.isEntryForOrder(entry, order))
      .forEach(entry => resourceIds.add(entry.resourceId));
    return [...resourceIds];
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

  get visibleSchedulerCapacityBlocks(): SchedulerCapacityBlock[] {
    return this.capacityBlocks;
  }

  get bookingCategories() {
    return this.bookingCategoriesService.getAll();
  }

  getBookingEventCategories(event: SchedulerEvent): BookingCategory[] {
    const ids = event.meta?.entry?.categoryIds ?? [];
    if (!ids.length) return [];
    return ids
      .map(id => this.bookingCategoriesService.getById(id))
      .filter((category): category is BookingCategory => !!category);
  }

  get visibleSchedulerUnavailability(): UnavailabilityBlock[] {
    return this.unavailability;
  }

  get manualDropInvalidRanges(): SchedulerInvalidDropRange[] {
    const context = this.manualResizeContext ?? this.manualDragContext;
    if (!context) return [];
    const ranges = this.buildManualDropInvalidRanges(context);
    return this.manualResizeResourceId
      ? ranges.filter(range => range.resourceId === this.manualResizeResourceId)
      : ranges;
  }

  get manualResizeInvalidHint(): string {
    const context = this.manualResizeContext;
    if (!context || !this.manualResizeResourceId) return '';
    const resource = this.resources.find(candidate => candidate.id === this.manualResizeResourceId);
    if (!resource) return '';
    const previewRange = this.manualDropInvalidRanges.find(range => range.resourceId === this.manualResizeResourceId);
    if (previewRange?.reason) return previewRange.reason;
    if (!context.anchoredStart || !context.anchoredEnd) return '';
    const validation = this.validateManualPlacement(context, resource, context.anchoredStart, context.anchoredEnd);
    return this.formatManualPlanValidationMessage(validation);
  }

  get manualCapacityInvalidResources(): SchedulerInvalidCapacityResource[] {
    const context = this.manualDragContext;
    if (!context) return [];
    const invalidResources: SchedulerInvalidCapacityResource[] = [];

    for (const resource of this.visibleSchedulerResources) {
      for (const { start } of this.getVisibleWorkingDayRanges()) {
        const validation = this.validateManualCapacityPlacement(context, resource, start);
        if (!validation.valid) invalidResources.push({ resourceId: resource.id, date: start });
      }
    }

    return invalidResources;
  }

  get manualDropVisualContext(): SchedulerDropVisualContext | null {
    if (this.manualResizeContext) {
      return {
        durationMinutes: this.manualResizeContext.durationMinutes,
        anchoredStart: this.manualResizeContext.anchoredStart,
        anchoredEnd: this.manualResizeContext.anchoredEnd,
        pointerOffsetMinutes: this.manualResizeContext.pointerOffsetMinutes,
      };
    }
    if (!this.manualDragContext) return null;
    return {
      durationMinutes: this.manualDragContext.durationMinutes,
      anchoredStart: this.manualDragContext.anchoredStart,
      anchoredEnd: this.manualDragContext.anchoredEnd,
      pointerOffsetMinutes: this.manualDragContext.pointerOffsetMinutes,
    };
  }

  get plannedBookingEventIds(): string[] {
    if (!this.showBookingDetails) {
      const focusedOrder = this.getFocusedPlanningOrder();
      if (!focusedOrder) return [];
      return this.events
        .filter(event => this.isEventForOrder(event, focusedOrder))
        .map(event => event.id);
    }
    return this.bookings.map(booking => booking.entryId);
  }

  get detailedOrderIds(): string[] {
    if (!this.showBookingDetails) {
      const order = this.getFocusedPlanningOrder();
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
    const orders = this.getPanelBaseOrders();

    if (!query) return orders;
    return orders.filter(order => this.doesOrderMatchPanelQuery(order, query));
  }

  private getPanelBaseOrders(): any[] {
    const orders = this.plannerMode === 'order'
      ? this.allOrders.filter(order => order.id === this.activeOrderId || order.referenceNumber === this.activeOrderId)
      : this.allOrders;
    const demoLocationId = this.selectedResourceView?.demoLocationId;
    return demoLocationId
      ? orders.filter(order => order.demoLocationId === demoLocationId)
      : orders.filter(order => !order.demoLocationId);
  }

  private getPanelSearchOrders(): any[] {
    const query = this.bookingSearchQuery.trim().toLowerCase();
    if (!query) return this.filterOrdersByCurrentPlannerScope(this.getPanelBaseOrders());

    const matchedOrderIds = new Set(this.panelSearchMatches.map(match => match.orderId));
    return this.getPanelBaseOrders().filter(order => matchedOrderIds.has(order.id));
  }

  private filterOrdersByCurrentPlannerScope(orders: any[]): any[] {
    const range = this.getCurrentPlannerScopeRange();
    if (!range) return orders;
    return orders.filter(order => this.isOrderRelevantToRange(order, range.start, range.end));
  }

  private filterOrdersBySearchScope(orders: any[]): any[] {
    const range = this.getCurrentPlannerScopeRange();
    if (!range) return orders;
    return orders.filter(order => !this.isOrderPlanned(order) || this.isOrderRelevantToRange(order, range.start, range.end));
  }

  private getCurrentPlannerScopeRange(): { start: Date; end: Date } | null {
    if (this.plannerViewMode === 'month') {
      if (!this.selectedMonthPreviewDate) return null;
      const start = new Date(this.selectedMonthPreviewDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(this.selectedMonthPreviewDate);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    if (this.plannerViewMode === 'free') return null;
    return { start: this.viewStart, end: this.viewEnd };
  }

  private isOrderRelevantToRange(order: any, start: Date, end: Date): boolean {
    return this.events.some(event =>
      this.isEventForOrder(event, order) && this.doRangesOverlap(event.start, event.end, start, end)
    ) || this.allScheduleEntries.some(entry =>
      this.isEntryForOrder(entry, order) && this.doRangesOverlap(entry.start, entry.end, start, end)
    ) || this.doesOrderAppointmentOverlapRange(order, start, end)
      || this.doesQuickViewSelectionOverlapRange(order, start, end);
  }

  private doesOrderAppointmentOverlapRange(order: any, rangeStart: Date, rangeEnd: Date): boolean {
    if (!order?.appointmentStart) return false;
    const start = new Date(order.appointmentStart);
    const end = order.appointmentEnd ? new Date(order.appointmentEnd) : start;
    return this.doRangesOverlap(start, end, rangeStart, rangeEnd);
  }

  private doesQuickViewSelectionOverlapRange(order: any, rangeStart: Date, rangeEnd: Date): boolean {
    const selection = this.quickViewSelection.getSelection(order.id);
    if (!selection) return false;
    const checkinStart = selection.checkinStart ? new Date(selection.checkinStart) : null;
    const handoverStart = selection.handoverStart ? new Date(selection.handoverStart) : null;
    const handoverEnd = selection.handoverEnd ? new Date(selection.handoverEnd) : null;
    if (checkinStart && handoverEnd) return this.doRangesOverlap(checkinStart, handoverEnd, rangeStart, rangeEnd);
    return [checkinStart, handoverStart, handoverEnd].some(date => !!date && this.doRangesOverlap(date, date, rangeStart, rangeEnd));
  }

  private doRangesOverlap(start: Date, end: Date, rangeStart: Date, rangeEnd: Date): boolean {
    const normalizedEnd = end.getTime() > start.getTime() ? end : new Date(start.getTime() + 1);
    return start < rangeEnd && normalizedEnd > rangeStart;
  }

  private doesOrderMatchPanelQuery(order: any, query: string): boolean {
    return [
      order.referenceNumber,
      order.id,
      order.vehicle?.licensePlate,
      order.customer?.name,
    ].filter(Boolean).join(' ').toLowerCase().includes(query);
  }

  get isSearchActive(): boolean {
    return this.bookingSearchQuery.trim().length > 0;
  }

  get panelSearchMatches(): PanelSearchMatch[] {
    const query = this.bookingSearchQuery.trim().toLowerCase();
    if (!query) return [];
    return this.filterOrdersBySearchScope(this.getPanelBaseOrders()).flatMap(order => this.getSearchMatchesForOrder(order, query));
  }

  get searchMatchCount(): number {
    return this.panelSearchMatches.length;
  }

  get activeSearchMatchPosition(): number {
    return this.searchMatchCount ? Math.min(this.activeSearchResultIndex + 1, this.searchMatchCount) : 0;
  }

  get visiblePanelOrders(): any[] {
    return this.isSearchActive ? this.getPanelSearchOrders() : this.filteredPanelOrders;
  }

  get visibleScheduledOrders(): any[] {
    const orders = this.isSearchActive
      ? this.getPanelSearchOrders()
      : this.filterOrdersByCurrentPlannerScope(this.getPanelBaseOrders());
    return orders.filter(order => this.getOrderPlanningState(order) === 'scheduled');
  }

  get visibleReservedOrders(): any[] {
    const orders = this.isSearchActive
      ? this.getPanelSearchOrders()
      : this.filterOrdersByCurrentPlannerScope(this.getPanelBaseOrders());
    return orders.filter(order => this.getOrderPlanningState(order) === 'reserved');
  }

  get reservedSectionCount(): number {
    return this.visibleReservedOrders.length;
  }

  get visibleScheduledBlocks(): ScheduleEntry[] {
    const query = this.bookingSearchQuery.trim().toLowerCase();
    return this.allScheduleEntries
      .filter(entry => entry.kind === 'resource-block')
      .filter(entry => this.isEntryInCurrentPlannerWindow(entry))
      .filter(entry => !query || this.includesQuery([
        entry.title,
        entry.description,
        this.getResourceLabel(entry.resourceId),
        ...(entry.categoryIds ?? []).map(id => this.bookingCategoriesService.getById(id)?.label),
      ], query))
      .sort((first, second) => first.start.getTime() - second.start.getTime());
  }

  get scheduledSectionCount(): number {
    return this.visibleScheduledOrders.length + this.visibleScheduledBlocks.length;
  }

  get scheduledSectionCountLabel(): string {
    if (this.visibleScheduledBlocks.length) return this.isSearchActive ? 'Results' : 'Items';
    return this.isSearchActive ? 'Results' : 'Orders';
  }

  findBlockOnPlanner(entry: ScheduleEntry): void {
    this.focusPlannerEvent(entry.id, { pulse: true });
  }

  undoBlockBooking(entry: ScheduleEntry): void {
    this.scheduleRepo.unassign(entry.id).subscribe(() => {
      this.removeScheduleEntriesById([entry.id]);
    });
  }

  getResourceLabel(resourceId: string): string {
    return this.resources.find(resource => resource.id === resourceId)?.label ?? resourceId;
  }

  getBlockScheduleSummary(entry: ScheduleEntry): string {
    return `${this.formatOrderScheduleDateTime(entry.start)} | ${this.formatDuration(entry.start, entry.end)}`;
  }

  getBlockNotesLabel(entry: ScheduleEntry): string {
    return entry.description?.trim() || 'No notes';
  }

  private isEntryInCurrentPlannerWindow(entry: ScheduleEntry): boolean {
    return entry.start < this.viewEnd && entry.end > this.viewStart;
  }

  get visibleInProgressOrders(): any[] {
    const orders = this.isSearchActive
      ? this.getPanelSearchOrders()
      : this.filterOrdersByCurrentPlannerScope(this.getPanelBaseOrders());
    return orders.filter(order => this.getOrderPlanningState(order) === 'in-progress');
  }

  get visibleCompletedOrders(): any[] {
    const orders = this.isSearchActive
      ? this.getPanelSearchOrders()
      : this.filterOrdersByCurrentPlannerScope(this.getPanelBaseOrders());
    return orders.filter(order => this.getOrderPlanningState(order) === 'completed');
  }

  get visiblePendingOrders(): any[] {
    const orders = this.isSearchActive ? this.getPanelSearchOrders() : this.getPanelBaseOrders();
    return orders.filter(order => !this.isOrderPlanned(order));
  }

  get emptyOrderSectionMessage(): string {
    return this.isSearchActive ? 'No Results' : 'No Orders';
  }
  private get resourcesForSelectedView(): SchedulerResource[] {
    const activeView = this.plannerSettings.selectedResourceView();
    if (!activeView) return this.resources.filter(resource => !(resource.meta as Resource | undefined)?.demoLocationId);

    const viewResourceIds = new Set(activeView.resourceIds);
    const viewLocationId = activeView.demoLocationId;
    return this.resources.filter(resource => {
      if (!viewResourceIds.has(resource.id)) return false;
      const resourceLocationId = (resource.meta as Resource | undefined)?.demoLocationId;
      return viewLocationId ? resourceLocationId === viewLocationId : !resourceLocationId;
    });
  }

  private get visibleResourcePool(): SchedulerResource[] {
    const resourcesInView = this.resourcesForSelectedView;
    if (!this.selectedResourceTypeGroupIds.length) return [];

    const selectedGroupIds = new Set(this.selectedResourceTypeGroupIds);
    return resourcesInView.filter(resource => {
      if (this.viewPersonalCalendarOnTop && resource.id === this.loggedInAdvisorResourceId && selectedGroupIds.has(this.personalCalendarGroup.id)) {
        return true;
      }
      return !!resource.groupId && selectedGroupIds.has(resource.groupId);
    });
  }

  private get bookingEligibleResources(): SchedulerResource[] {
    return this.visibleResourcePool;
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
    private bookingCategoriesService: BookingCategoriesService,
    private route: ActivatedRoute,
    private router: Router,
  ) {
    // Watch the undo trigger - each increment means undo the last booking
    effect(() => {
      const trigger = this.plannerSettings.undoTrigger();
      if (trigger === 0) return; // skip initial value
      this.undoLastBooking();
    });
    effect(() => {
      const mode = this.plannerSettings.viewMode();
      const isLeavingMonthView = this.previousPlannerViewMode === 'month' && mode !== 'month';
      const anchor = this.nextViewModeAnchor ?? (isLeavingMonthView ? this.mockCurrentTime : (this.isPlannerReady ? this.viewStart : this.mockCurrentTime));
      this.nextViewModeAnchor = null;
      if (mode === 'month') {
        this.isOrderPanelOpen = false;
        this.selectedMonthPreviewDate = new Date(this.mockCurrentTime);
      }
      this.setViewWindowForMode(mode, anchor);
      this.previousPlannerViewMode = mode;
      if (this.isPlannerReady) {
        this.reloadScheduleEntries();
      }
    });
  }

  ngOnInit(): void {
    this.startPlannerClock();
    this.restoreMonthCapacityPreference();
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
      this.applyDefaultResourceViewForOrder(activeOrder);
      this.alignViewWindowToOrder(activeOrder, this.plannerViewMode);

      this.scheduleRepo.getEntries(this.viewStart, this.viewEnd).subscribe(visibleEntries => {
      const tileSourceOrders = this.plannerMode === 'order'
        ? orders.filter((order: any) => order.id === this.activeOrderId || order.referenceNumber === this.activeOrderId)
        : orders;

      this.jobTiles = tileSourceOrders.flatMap((order: any) =>
        order.jobs
          .filter((j: any) => j.status === 'unscheduled' && this.getSchedulingRole(j) === 'work')
          .map((job: any) => ({ workOrder: order, job }))
      );

      this.groups = groups.map(g => ({ id: g.id, label: g.name }));
      if (!this.selectedResourceTypeGroupIds.length) {
        this.selectedResourceTypeGroupIds = this.getDefaultResourceTypeGroupIds();
      } else if (this.viewPersonalCalendarOnTop && !this.selectedResourceTypeGroupIds.includes(this.personalCalendarGroup.id)) {
        this.selectedResourceTypeGroupIds = [this.personalCalendarGroup.id, ...this.selectedResourceTypeGroupIds];
      }

      this.resources = resources.map(r => ({
        id: r.id,
        label: r.name,
        groupId: r.groupId,
        groupLabel: groups.find(g => g.id === r.groupId)?.name,
        displayTags: r.displayTags,
        meta: r,
      }));
      this.updatePlannerResourceContext();

      this.applyScheduleEntries(visibleEntries);
      this.loadMonthPreviewEntries();

      this.unavailability = [
        ...MOCK_UNAVAILABILITY,
      ];
      this.expandFirstVisibleOrder();
      this.applyQuickViewSelection();
      this.scrollToActiveOrderBooking();
      });
    });
  }

  private applyDefaultResourceViewForOrder(order: any | undefined): void {
    if (this.plannerMode !== 'order' || !order?.demoLocationId) return;
    const locationView = this.resourceViewsService.getAll().find(view => view.demoLocationId === order.demoLocationId);
    if (locationView) this.plannerSettings.setResourceView(locationView);
  }

  onEventMoved(payload: EventMovePayload): void {
    const event = this.events.find(candidate => candidate.id === payload.eventId);
    const capacityBlock = this.capacityBlocks.find(candidate => candidate.id === payload.eventId);
    if (!event && capacityBlock) {
      this.onCapacityBlockMoved(payload, capacityBlock);
      return;
    }
    const resource = this.resources.find(candidate => candidate.id === payload.resourceId);
    const context = event ? this.buildPlacedEventDragContext(event) : null;
    if (context && resource) {
      const validation = payload.dropMode === 'day-capacity'
        ? this.validateManualCapacityPlacement(context, resource, payload.date ?? payload.start)
        : this.validateManualPlacement(context, resource, payload.start, payload.end);
      if (!validation.valid) {
        this.showManualPlanValidationError('Move not possible', validation);
        this.clearManualInteractionState();
        return;
      }
    }

    if (event && payload.dropMode === 'day-capacity') {
      this.onScheduledEventMovedToCapacity(payload, event);
      return;
    }

    this.clearSchedulingError();
    this.clearManualInteractionState();
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

  private onScheduledEventMovedToCapacity(payload: EventMovePayload, event: SchedulerEvent): void {
    const entry = event.meta?.entry ?? this.scheduleEntries.find(candidate => candidate.id === payload.eventId);
    if (!entry) return;
    const durationMinutes = Math.max(1, Math.round(payload.durationMinutes ?? (event.end.getTime() - event.start.getTime()) / 60000));
    const start = this.getDayCapacityStart(payload.date ?? payload.start);
    const end = new Date(start.getTime() + durationMinutes * 60000);
    const updatedEntry: ScheduleEntry = {
      ...entry,
      resourceId: payload.resourceId,
      start,
      end,
      kind: 'day-capacity',
      workorderItemStatus: entry.workorderItemStatus ?? 'scheduled',
    };

    this.clearSchedulingError();
    this.clearManualInteractionState();
    this.scheduleRepo.unassign(payload.eventId).subscribe(() => {
      this.scheduleRepo.assign(updatedEntry).subscribe(assigned => {
        const normalized: ScheduleEntry = { ...updatedEntry, ...assigned, kind: 'day-capacity', resourceId: payload.resourceId };
        this.upsertAllScheduleEntries([normalized]);
        this.scheduleEntries = [
          ...this.scheduleEntries.filter(candidate => candidate.id !== payload.eventId),
          normalized,
        ];
        this.events = this.events.filter(candidate => candidate.id !== payload.eventId);
        this.capacityBlocks = [
          ...this.capacityBlocks.filter(candidate => candidate.id !== payload.eventId),
          this.mapScheduleEntryToCapacityBlock(normalized),
        ];
        // Sync booking set siblings to day capacity
        this.syncCapacityBlockSiblings(entry, normalized, 'day-capacity');
      });
    });
  }

  private onCapacityBlockMoved(payload: EventMovePayload, block: SchedulerCapacityBlock): void {
    const entry = block.meta?.entry ?? this.scheduleEntries.find(candidate => candidate.id === payload.eventId);
    if (!entry) return;
    const resource = this.resources.find(candidate => candidate.id === payload.resourceId);
    const context = this.buildCapacityBlockDragContext(block);
    if (context && resource) {
      const validation = payload.dropMode === 'day-capacity'
        ? this.validateManualCapacityPlacement(context, resource, payload.date ?? payload.start)
        : this.validateManualPlacement(context, resource, payload.start, payload.end);
      if (!validation.valid) {
        this.showManualPlanValidationError('Move not possible', validation);
        this.clearManualInteractionState();
        return;
      }
    }
    const start = payload.dropMode === 'day-capacity'
      ? this.getDayCapacityStart(payload.date ?? payload.start)
      : payload.start;
    const durationMinutes = Math.max(1, Math.round(payload.durationMinutes ?? block.durationMinutes));
    const end = payload.dropMode === 'day-capacity'
      ? new Date(start.getTime() + durationMinutes * 60000)
      : payload.end;
    const nextKind = payload.dropMode === 'day-capacity' ? 'day-capacity' as const : 'scheduled' as const;
    const updatedEntry: ScheduleEntry = {
      ...entry,
      resourceId: payload.resourceId,
      start,
      end,
      kind: nextKind,
      workorderItemStatus: entry.workorderItemStatus ?? 'scheduled',
    };

    this.clearSchedulingError();
    this.clearManualInteractionState();
    this.scheduleRepo.unassign(payload.eventId).subscribe(() => {
      this.scheduleRepo.assign(updatedEntry).subscribe(assigned => {
        const normalized: ScheduleEntry = { ...updatedEntry, ...assigned, kind: nextKind, resourceId: payload.resourceId };
        this.upsertAllScheduleEntries([normalized]);
        this.scheduleEntries = [
          ...this.scheduleEntries.filter(candidate => candidate.id !== payload.eventId),
          normalized,
        ];
        if (nextKind === 'day-capacity') {
          this.events = this.events.filter(candidate => candidate.id !== payload.eventId);
          this.capacityBlocks = [
            ...this.capacityBlocks.filter(candidate => candidate.id !== payload.eventId),
            this.mapScheduleEntryToCapacityBlock(normalized),
          ];
        } else {
          this.capacityBlocks = this.capacityBlocks.filter(candidate => candidate.id !== payload.eventId);
          this.events = [
            ...this.events.filter(candidate => candidate.id !== payload.eventId),
            this.mapScheduleEntryToEvent(normalized),
          ];
        }
        // Sync booking set siblings (bay, device, etc.)
        this.syncCapacityBlockSiblings(entry, normalized, nextKind);
      });
    });
  }

  private syncCapacityBlockSiblings(originalEntry: ScheduleEntry, movedEntry: ScheduleEntry, nextKind: 'day-capacity' | 'scheduled'): void {
    const bookingSetId = this.getEntryBookingSetId(originalEntry);
    const siblings = this.allScheduleEntries.filter(entry =>
      entry.id !== movedEntry.id &&
      this.isJobScheduleEntry(entry) &&
      this.getEntryBookingSetId(entry) === bookingSetId
    );

    for (const sibling of siblings) {
      const updatedSibling: ScheduleEntry = {
        ...sibling,
        start: movedEntry.start,
        end: movedEntry.end,
        kind: nextKind,
        workorderItemStatus: nextKind === 'day-capacity' ? 'reserved' : 'scheduled',
      };

      this.scheduleRepo.unassign(sibling.id).subscribe(() => {
        this.scheduleRepo.assign(updatedSibling).subscribe(assigned => {
          const normalizedSibling: ScheduleEntry = { ...updatedSibling, ...assigned, kind: nextKind };
          this.upsertAllScheduleEntries([normalizedSibling]);
          this.scheduleEntries = [
            ...this.scheduleEntries.filter(e => e.id !== sibling.id),
            normalizedSibling,
          ];
          if (nextKind === 'day-capacity') {
            this.events = this.events.filter(e => e.id !== sibling.id);
            this.capacityBlocks = [
              ...this.capacityBlocks.filter(b => b.id !== sibling.id),
              this.mapScheduleEntryToCapacityBlock(normalizedSibling),
            ];
          } else {
            this.capacityBlocks = this.capacityBlocks.filter(b => b.id !== sibling.id);
            this.events = [
              ...this.events.filter(e => e.id !== sibling.id),
              this.mapScheduleEntryToEvent(normalizedSibling),
            ];
          }
        });
      });
    }
  }

  onSchedulerEventDragStarted(eventId: string, pointerOffsetMinutes = 0): void {
    const event = this.events.find(candidate => candidate.id === eventId);
    const capacityBlock = this.capacityBlocks.find(candidate => candidate.id === eventId);
    this.manualDragContext = event
      ? this.buildPlacedEventDragContext(event)
      : capacityBlock
        ? this.buildCapacityBlockDragContext(capacityBlock)
        : null;
    if (this.manualDragContext) {
      this.manualDragContext.pointerOffsetMinutes = pointerOffsetMinutes;
    }
  }

  onSchedulerEventDragEnded(_eventId: string): void {
    this.clearManualInteractionState();
  }

  onSchedulerEventResizeStarted(eventId: string): void {
    const event = this.events.find(candidate => candidate.id === eventId);
    this.manualResizeContext = event ? this.buildPlacedEventDragContext(event) : null;
    this.manualResizeResourceId = event?.resourceId ?? null;
  }

  onSchedulerEventResizeEnded(_eventId: string): void {
    this.clearManualInteractionState();
  }

  onEventResized(payload: EventResizePayload): void {
    const event = this.events.find(candidate => candidate.id === payload.eventId);
    const resource = event ? this.resources.find(candidate => candidate.id === event.resourceId) : undefined;
    const context = event ? this.buildPlacedEventDragContext(event) : null;
    if (context && resource) {
      const validation = this.validateManualPlacement(context, resource, payload.start, payload.end);
      if (!validation.valid) {
        this.showManualPlanValidationError('Resize not possible', validation);
        this.clearManualInteractionState();
        return;
      }
    }

    this.clearSchedulingError();
    this.clearManualInteractionState();
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
    });
  }

  onEventClicked(payload: EventClickPayload): void {
    this.closeEventContextMenu();
    const event = this.events.find(candidate => candidate.id === payload.eventId) ?? null;
    if (event?.meta?.entry?.kind === 'resource-block') {
      this.openBlockTimeModal(event.resourceId, event.start, event.end, event.meta.entry);
      return;
    }
    this.selectedBookingEvent = event;
    if (this.selectedBookingEvent) {
      this.initializeBookingModalState(this.selectedBookingEvent);
    }
  }

  onOrderFocusRequested(payload: OrderFocusPayload): void {
    const event = this.events.find(candidate => candidate.id === payload.eventId);
    if (event?.meta?.entry?.kind === 'resource-block') {
      this.revealBlockInPanel(event.id);
      return;
    }
    const capacityBlock = this.capacityBlocks.find(candidate => candidate.id === payload.eventId);
    const eventOrder = event
      ? this.findOrderForEvent(event)
      : capacityBlock
        ? this.findOrderForScheduleEntry(capacityBlock.meta?.entry as ScheduleEntry)
        : null;
    const order = eventOrder ?? this.allOrders.find(candidate =>
      candidate.id === payload.orderId || candidate.referenceNumber === payload.orderId
    );
    if (!order) return;

    this.revealOrderInPanel(order);
    this.setFocusedPlanningOrder(order);
  }

  private revealBlockInPanel(entryId: string): void {
    this.collapsedOrderGroups = new Set([...this.collapsedOrderGroups].filter(group => group !== 'scheduled'));
    this.expandedEmptyOrderGroups = new Set([...this.expandedEmptyOrderGroups, 'scheduled']);
    this.expandedEmptySearchOrderGroups = new Set([...this.expandedEmptySearchOrderGroups, 'scheduled']);
    queueMicrotask(() => {
      document.getElementById(`order-panel-block-${entryId}`)?.scrollIntoView({ block: 'center', inline: 'nearest' });
    });
  }

  isPanelOrderFocused(order: any): boolean {
    return this.selectedPanelOrderId === order.id;
  }
  onEventContextMenu(payload: EventContextMenuPayload): void {
    const event = this.events.find(candidate => candidate.id === payload.eventId);
    if (!event) return;
    this.closeResourceSlotContextMenu();
    this.eventContextMenu = { eventId: payload.eventId, x: payload.x, y: payload.y };
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeEventContextMenu();
    this.closeResourceSlotContextMenu();
  }

  closeEventContextMenu(): void {
    this.eventContextMenu = null;
    this.isCategoryFlyoutOpen = false;
  }

  closeResourceSlotContextMenu(): void {
    this.resourceSlotContextMenu = null;
  }

  onResourceSlotContextMenu(payload: SchedulerResourceSlotContextMenuPayload): void {
    this.closeEventContextMenu();
    this.resourceSlotContextMenu = payload;
  }

  openBlockTimeFromContext(): void {
    const context = this.resourceSlotContextMenu;
    this.closeResourceSlotContextMenu();
    if (!context) return;
    this.openBlockTimeModal(context.resourceId, context.start, context.end);
  }

  getResourceSlotContextMenuTitle(): string {
    return this.resourceSlotContextMenu?.source === 'selection'
      ? 'Block selected time'
      : 'Block this slot';
  }

  getResourceSlotContextMenuDetail(): string {
    const context = this.resourceSlotContextMenu;
    if (!context) return '';
    return `${this.getResourceLabel(context.resourceId)} · ${this.formatOrderScheduleDateTime(context.start)} | ${this.formatDuration(context.start, context.end)}`;
  }

  private openBlockTimeModal(resourceId: string, start: Date, end: Date, entry?: ScheduleEntry): void {
    this.blockTimeResourceId = resourceId;
    this.blockTimeStartDate = this.toDateInputValue(start);
    this.blockTimeStartTime = this.toTimeInputValue(start);
    this.blockTimeEndDate = this.toDateInputValue(end);
    this.blockTimeEndTime = this.toTimeInputValue(end);
    this.blockTimeTitle = entry?.title ?? 'Blocked time';
    this.blockTimeDescription = entry?.description ?? '';
    this.blockTimeEditingEntryId = entry?.id ?? null;
    this.blockTimeCategoryIds = entry?.categoryIds ? [...entry.categoryIds] : [];
    this.blockTimeModalOpen = true;
  }

  closeBlockTimeModal(): void {
    this.blockTimeModalOpen = false;
    this.blockTimeEditingEntryId = null;
    this.blockTimeCategoryIds = [];
  }

  toggleBlockTimeCategory(categoryId: string): void {
    const ids = new Set(this.blockTimeCategoryIds);
    if (ids.has(categoryId)) {
      ids.delete(categoryId);
    } else {
      ids.add(categoryId);
    }
    this.blockTimeCategoryIds = [...ids];
  }

  isBlockTimeCategorySelected(categoryId: string): boolean {
    return this.blockTimeCategoryIds.includes(categoryId);
  }

  saveBlockTime(): void {
    const start = this.combineBookingDateTime(this.blockTimeStartDate, this.blockTimeStartTime);
    const end = this.combineBookingDateTime(this.blockTimeEndDate, this.blockTimeEndTime);
    if (!this.blockTimeResourceId || !start || !end || end <= start || !this.blockTimeTitle.trim()) return;
    if (!this.isResourceBlockPlacementValid(this.blockTimeResourceId, start, end)) {
      this.setSchedulingError('Choose a free time inside working hours for this resource.', 'Block time not possible');
      return;
    }

    const entry: ScheduleEntry = {
      id: this.blockTimeEditingEntryId ?? `block-${Date.now()}`,
      jobId: 'resource-block',
      resourceId: this.blockTimeResourceId,
      start,
      end,
      title: this.blockTimeTitle.trim(),
      description: this.blockTimeDescription.trim(),
      kind: 'resource-block',
      color: '#6F6F6F',
      workorderItemStatus: 'scheduled',
      categoryIds: this.blockTimeCategoryIds.length ? [...this.blockTimeCategoryIds] : undefined,
    };

    if (this.blockTimeEditingEntryId) {
      this.scheduleRepo.update(this.blockTimeEditingEntryId, entry).subscribe(updated => {
        const normalized: ScheduleEntry = { ...entry, ...updated, kind: 'resource-block' };
        this.updateScheduleEntry(normalized.id, normalized);
        this.events = this.events.map(event => event.id === normalized.id ? this.mapScheduleEntryToEvent(normalized) : event);
        this.closeBlockTimeModal();
        this.clearSchedulingError();
      });
      return;
    }

    this.scheduleRepo.assign(entry).subscribe(assigned => {
      const normalized: ScheduleEntry = { ...entry, ...assigned, kind: 'resource-block' };
      this.upsertScheduleEntry(normalized);
      this.events = [...this.events, this.mapScheduleEntryToEvent(normalized)];
      this.closeBlockTimeModal();
      this.clearSchedulingError();
    });
  }

  private isResourceBlockPlacementValid(resourceId: string, start: Date, end: Date): boolean {
    const dayStart = new Date(start);
    dayStart.setHours(9, 0, 0, 0);
    const dayEnd = new Date(start);
    dayEnd.setHours(21, 0, 0, 0);
    if (start < dayStart || end > dayEnd) return false;
    const overlapsEvent = this.events.some(event => event.id !== this.blockTimeEditingEntryId && event.resourceId === resourceId && event.start < end && event.end > start);
    const overlapsBlock = this.capacityBlocks.some(block => block.resourceId === resourceId && block.date.toDateString() === start.toDateString());
    const overlapsUnavailable = this.unavailability.some(block => block.resourceId === resourceId && block.start < end && block.end > start);
    return !overlapsEvent && !overlapsBlock && !overlapsUnavailable;
  }

  toggleCategoryFlyout(event: Event): void {
    event.stopPropagation();
    this.isCategoryFlyoutOpen = !this.isCategoryFlyoutOpen;
  }

  openCategoryManagement(): void {
    this.closeEventContextMenu();
    this.router.navigate(['/booking-categories']);
  }

  getContextEvent(): SchedulerEvent | undefined {
    return this.eventContextMenu
      ? this.events.find(candidate => candidate.id === this.eventContextMenu?.eventId)
      : undefined;
  }

  isContextCategoryApplied(category: BookingCategory): boolean {
    const event = this.getContextEvent();
    if (!event) return false;
    const affectedEntries = this.getCategoryAffectedEntries(event, category);
    return affectedEntries.length > 0 && affectedEntries.every(entry => entry.categoryIds?.includes(category.id));
  }

  toggleContextCategory(category: BookingCategory, domEvent?: Event): void {
    domEvent?.stopPropagation();
    const event = this.getContextEvent();
    if (!event) return;
    const affectedEntries = this.getCategoryAffectedEntries(event, category);
    if (!affectedEntries.length) return;

    const remove = affectedEntries.every(entry => entry.categoryIds?.includes(category.id));
    for (const entry of affectedEntries) {
      const currentIds = new Set(entry.categoryIds ?? []);
      if (remove) {
        currentIds.delete(category.id);
      } else {
        currentIds.add(category.id);
      }
      const categoryIds = [...currentIds];
      this.scheduleRepo.update(entry.id, { categoryIds }).subscribe(updated => {
        this.updateScheduleEntry(entry.id, { categoryIds: updated.categoryIds ?? categoryIds });
        this.updateEventEntry(entry.id, { categoryIds: updated.categoryIds ?? categoryIds });
        this.updateCapacityBlockEntry(entry.id, { categoryIds: updated.categoryIds ?? categoryIds });
      });
    }
  }

  private getCategoryAffectedEntries(event: SchedulerEvent, category: BookingCategory): ScheduleEntry[] {
    const entry = event.meta?.entry ?? this.allScheduleEntries.find(candidate => candidate.id === event.id);
    if (!entry) return [];
    if (category.appliesTo === 'entry' || entry.kind === 'resource-block') return [entry];
    if (category.appliesTo === 'booking-set') return this.getBookingSetEntries(entry);

    const order = this.findOrderForEvent(event);
    if (!order) return [entry];
    return this.allScheduleEntries.filter(candidate => this.isEntryForOrder(candidate, order));
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

  getContextEventCustomerEmail(): string {
    return this.getContextEventOrder()?.customer?.email ?? '';
  }

  getContextEventCustomerPhone(): string {
    return this.getContextEventOrder()?.customer?.phone ?? '';
  }

  copyContextCustomerEmail(): void {
    const email = this.getContextEventCustomerEmail();
    this.closeEventContextMenu();
    if (email) this.copyTextToClipboard(email);
  }

  copyContextCustomerPhone(): void {
    const phone = this.getContextEventCustomerPhone();
    this.closeEventContextMenu();
    if (phone) this.copyTextToClipboard(phone);
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
    this.updatePlannerResourceContext();
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
    if (checked && !this.selectedResourceTypeGroupIds.includes(this.personalCalendarGroup.id)) {
      this.selectedResourceTypeGroupIds = [this.personalCalendarGroup.id, ...this.selectedResourceTypeGroupIds];
    } else if (!checked) {
      this.selectedResourceTypeGroupIds = this.selectedResourceTypeGroupIds.filter(groupId => groupId !== this.personalCalendarGroup.id);
    }
    this.retainVisibleResourceSelection();
    this.updatePlannerResourceContext();
  }

  onOptimizeAdvisorActivityBookingChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.plannerSettings.setOptimizeAdvisorActivityBookingForPersonalCalendar(checked);
  }

  onResourceTypeSelectionChange(payload: ResourceTypeSelectionChangePayload): void {
    this.selectedResourceTypeGroupIds = [...payload.groupIds];
    this.retainVisibleResourceSelection();
    this.updatePlannerResourceContext();
    if (this.plannerMode === 'order') {
      this.isAutoProposalVisible = false;
    }
  }

  onResourceViewChange(view: ResourceFavoriteView | null): void {
    this.plannerSettings.setResourceView(view);
    this.retainVisibleResourceSelection();
    this.updatePlannerResourceContext();
    if (this.plannerMode === 'order') {
      this.isAutoProposalVisible = false;
    }
  }

  onMonthResourceViewChange(event: Event): void {
    const label = (event.target as HTMLSelectElement).value;
    const view = label ? this.resourceViews.find(v => v.label === label) ?? null : null;
    this.onResourceViewChange(view);
  }

  onMonthResourceTypeChange(event: Event): void {
    const groupId = (event.target as HTMLSelectElement).value;
    this.selectedResourceTypeGroupIds = groupId ? [groupId] : this.getDefaultResourceTypeGroupIds();
    this.updatePlannerResourceContext();
  }

  onMonthResourceTypeMultiChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const selected = Array.from(select.selectedOptions).map(opt => opt.value);
    this.selectedResourceTypeGroupIds = selected.length ? selected : this.getDefaultResourceTypeGroupIds();
    this.updatePlannerResourceContext();
  }

  toggleMonthViewDropdown(): void {
    this.isMonthViewDropdownOpen = !this.isMonthViewDropdownOpen;
    this.isMonthGroupDropdownOpen = false;
  }

  toggleMonthGroupDropdown(): void {
    this.isMonthGroupDropdownOpen = !this.isMonthGroupDropdownOpen;
    this.isMonthViewDropdownOpen = false;
  }

  selectMonthResourceView(view: ResourceFavoriteView | null): void {
    this.isMonthViewDropdownOpen = false;
    this.onResourceViewChange(view);
  }

  toggleMonthGroupSelection(groupId: string, event: Event): void {
    event.stopPropagation();
    const current = [...this.selectedResourceTypeGroupIds];
    const index = current.indexOf(groupId);
    if (index >= 0) {
      current.splice(index, 1);
    } else {
      current.push(groupId);
    }
    this.selectedResourceTypeGroupIds = current.length ? current : this.getDefaultResourceTypeGroupIds();
    this.updatePlannerResourceContext();
  }

  clearMonthGroupSelection(event: Event): void {
    event.stopPropagation();
    this.selectedResourceTypeGroupIds = this.getDefaultResourceTypeGroupIds();
    this.updatePlannerResourceContext();
  }

  get monthSelectedGroupLabel(): string {
    const visibleGroups = this.visibleSchedulerGroups;
    const selectedVisibleCount = visibleGroups.filter(g => this.selectedResourceTypeGroupIds.includes(g.id)).length;
    if (selectedVisibleCount === visibleGroups.length || selectedVisibleCount === 0) return 'All resource types';
    if (selectedVisibleCount === 1) {
      const selectedGroup = visibleGroups.find(g => this.selectedResourceTypeGroupIds.includes(g.id));
      return selectedGroup?.label ?? 'Resource types';
    }
    return `${selectedVisibleCount} types selected`;
  }

  get areAllMonthResourceTypesSelected(): boolean {
    const visibleGroups = this.visibleSchedulerGroups;
    const selectedVisibleCount = visibleGroups.filter(g => this.selectedResourceTypeGroupIds.includes(g.id)).length;
    return selectedVisibleCount === visibleGroups.length;
  }

  private retainVisibleResourceSelection(): void {
    const visibleResourceIds = new Set(this.visibleResourcePool.map(resource => resource.id));
    this.selectedResourceIds = this.selectedResourceIds.filter(resourceId => visibleResourceIds.has(resourceId));
  }

  private updatePlannerResourceContext(): void {
    this.plannerSettings.setResourceContext({
      resourceView: this.selectedResourceView,
      selectedResourceTypeGroupIds: this.selectedResourceTypeGroupIds,
      selectedResourceIds: this.selectedResourceIds,
      viewPersonalCalendarOnTop: this.viewPersonalCalendarOnTop,
      personalCalendarResourceId: this.loggedInAdvisorResourceId,
      personalCalendarGroupId: this.personalCalendarGroup.id,
    });
  }

  ngOnDestroy(): void {
    if (this.currentPlannerTimeTimer) clearInterval(this.currentPlannerTimeTimer);
  }

  private startPlannerClock(): void {
    this.currentPlannerTime = new Date('2024-04-15T09:15:00');
    if (this.currentPlannerTimeTimer) clearInterval(this.currentPlannerTimeTimer);
    this.currentPlannerTimeTimer = setInterval(() => {
      this.currentPlannerTime = new Date(this.currentPlannerTime.getTime() + 60000);
    }, 60000);
  }

  private getDefaultResourceTypeGroupIds(): string[] {
    const groupIds = this.groups.map(group => group.id);
    return this.viewPersonalCalendarOnTop
      ? [this.personalCalendarGroup.id, ...groupIds]
      : groupIds;
  }

  openResourceViewList(_view?: ResourceFavoriteView | null): void {
    this.router.navigate(['/resource-views'], {
      queryParams: { returnTo: this.router.url, selectedViewValue: this.selectedResourceView?.value },
    });
  }

  addResourceView(): void {
    const newView = this.resourceViewsService.createNewView();
    const plannerReturnTo = this.router.url;
    const editorReturnParams = new URLSearchParams({ returnTo: '/resource-views', plannerReturnTo });
    if (this.selectedResourceView?.value) editorReturnParams.set('selectedViewValue', this.selectedResourceView.value);

    this.router.navigate(['/resource-catalog'], {
      queryParams: {
        returnTo: `/resource-views/${newView.value}/edit?${editorReturnParams.toString()}`,
        plannerReturnTo,
        selectedViewValue: this.selectedResourceView?.value,
      },
      state: { resourceView: newView },
    });
  }

  isFullPlanner(): boolean {
    return this.plannerMode === 'full';
  }

  toggleOrderPanel(): void {
    this.isOrderPanelOpen = !this.isOrderPanelOpen;
  }

  startOrderPanelResize(event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isResizingOrderPanel = true;
    this.orderPanelResizeStartX = event.clientX;
    this.orderPanelResizeStartWidth = this.orderPanelWidth;
  }

  @HostListener('document:pointermove', ['$event'])
  onOrderPanelResizeMove(event: PointerEvent): void {
    if (!this.isResizingOrderPanel) return;
    event.preventDefault();
    const delta = this.orderPanelResizeStartX - event.clientX;
    this.orderPanelWidth = Math.min(this.maxOrderPanelWidth, Math.max(this.minOrderPanelWidth, this.orderPanelResizeStartWidth + delta));
  }

  @HostListener('document:pointerup')
  @HostListener('document:pointercancel')
  stopOrderPanelResize(): void {
    this.isResizingOrderPanel = false;
  }

  onOrderPanelSearch(value: string): void {
    const previousQuery = this.bookingSearchQuery.trim();
    this.orderPanelSearch = value;
    this.bookingSearchQuery = value;
    this.activeSearchResultIndex = 0;
    this.searchRevealedOrderIds = new Set<string>();
    if (!previousQuery && value.trim()) {
      this.expandedOrderIds = new Set<string>();
    }
  }

  clearBookingSearch(): void {
    this.orderPanelSearch = '';
    this.bookingSearchQuery = '';
    this.activeSearchResultIndex = 0;
    this.searchRevealedOrderIds = new Set<string>();
  }

  previousSearchResult(): void {
    if (!this.searchMatchCount) return;
    this.activeSearchResultIndex = (this.activeSearchResultIndex - 1 + this.searchMatchCount) % this.searchMatchCount;
    this.revealActiveSearchMatch();
  }

  nextSearchResult(): void {
    if (!this.searchMatchCount) return;
    this.activeSearchResultIndex = (this.activeSearchResultIndex + 1) % this.searchMatchCount;
    this.revealActiveSearchMatch();
  }

  toggleOrderExpanded(orderId: string, event?: Event): void {
    event?.stopPropagation();
    const ids = new Set(this.expandedOrderIds);
    if (ids.has(orderId)) {
      ids.delete(orderId);
    } else {
      ids.add(orderId);
    }
    this.expandedOrderIds = ids;
  }

  toggleOrderGroup(group: OrderPanelGroup): void {
    const orderCount = this.getVisibleOrdersForPanelGroup(group).length;
    if (orderCount === 0) {
      const sourceGroups = this.isSearchActive ? this.expandedEmptySearchOrderGroups : this.expandedEmptyOrderGroups;
      const expandedEmptyGroups = new Set(sourceGroups);
      if (expandedEmptyGroups.has(group)) {
        expandedEmptyGroups.delete(group);
      } else {
        expandedEmptyGroups.add(group);
      }
      if (this.isSearchActive) {
        this.expandedEmptySearchOrderGroups = expandedEmptyGroups;
      } else {
        this.expandedEmptyOrderGroups = expandedEmptyGroups;
      }
      return;
    }

    const groups = new Set(this.collapsedOrderGroups);
    if (groups.has(group)) {
      groups.delete(group);
    } else {
      groups.add(group);
    }
    this.collapsedOrderGroups = groups;
  }

  isOrderGroupCollapsed(group: OrderPanelGroup): boolean {
    const orderCount = this.getVisibleOrdersForPanelGroup(group).length;
    if (this.isSearchActive) {
      return orderCount === 0 && !this.expandedEmptySearchOrderGroups.has(group);
    }
    if (orderCount === 0) return !this.expandedEmptyOrderGroups.has(group);
    return this.collapsedOrderGroups.has(group);
  }

  private getVisibleOrdersForPanelGroup(group: OrderPanelGroup): any[] {
    if (group === 'reserved') return this.visibleReservedOrders;
    if (group === 'scheduled') return [...this.visibleScheduledOrders, ...this.visibleScheduledBlocks];
    if (group === 'in-progress') return this.visibleInProgressOrders;
    if (group === 'completed') return this.visibleCompletedOrders;
    return this.visiblePendingOrders;
  }

  private expandFirstVisibleOrder(): void {
    if (this.expandedOrderIds.size || this.visiblePanelOrders.length === 0) return;
    this.expandedOrderIds = new Set([this.visiblePanelOrders[0].id]);
  }

  clearOrderPanelSelection(): void {
    this.selectedPanelOrderId = '';
  }

  toggleBookingDetails(): void {
    this.showBookingDetails = !this.showBookingDetails;
  }

  viewOnlyOrderOnPlanner(order: any, event?: Event): void {
    event?.stopPropagation();
    if (!this.hasPlannerBookingsForOrder(order)) return;
    const isActive = this.fullPlannerOrderOnlyId === order.id;
    this.fullPlannerOrderOnlyId = isActive ? '' : order.id;
    this.selectedPanelOrderId = order.id;
    this.setFocusedPlanningOrder(isActive ? null : order);
    this.showBookingDetails = isActive;
    if (!isActive) {
      this.expandedOrderIds = new Set([order.id]);
    }
  }

  findOrderOnPlanner(order: any, event?: Event): void {
    event?.stopPropagation();
    if (!this.canFindOrderOnPlanner(order)) return;
    const focusIds = this.getPlannerFocusEntryIdsForOrder(order);
    if (!focusIds.length) return;
    this.selectedPanelOrderId = order.id;
    this.setFocusedPlanningOrder(order);
    this.expandedOrderIds = new Set([...this.expandedOrderIds, order.id]);
    this.focusPlannerEvents(focusIds, { pulse: true });
  }

  isFullPlannerOrderOnly(order: any): boolean {
    return this.fullPlannerOrderOnlyId === order.id;
  }

  isWorkflowOrderFocusActive(order: any): boolean {
    return this.plannerMode === 'order' && (order.id === this.activeOrderId || order.referenceNumber === this.activeOrderId);
  }

  isOrderFocusButtonActive(order: any): boolean {
    return this.isWorkflowOrderFocusActive(order) || this.isFullPlannerOrderOnly(order);
  }

  isOrderFocusButtonDisabled(order: any): boolean {
    return this.isWorkflowOrderFocusActive(order) || !this.canViewOnlyOrderOnPlanner(order);
  }

  getOrderFocusButtonLabel(order: any): string {
    if (this.isWorkflowOrderFocusActive(order)) return 'Workflow planner is already focused on this order';
    if (!this.canViewOnlyOrderOnPlanner(order)) return 'No bookings to show on planner';
    return this.isFullPlannerOrderOnly(order) ? 'Show all orders on planner' : 'View only this order on planner';
  }

  canViewOnlyOrderOnPlanner(order: any): boolean {
    return this.hasPlannerBookingsForOrder(order);
  }

  canFindOrderOnPlanner(order: any): boolean {
    return (!this.fullPlannerOrderOnlyId || this.fullPlannerOrderOnlyId === order.id) && this.hasPlannerBookingsForOrder(order);
  }

  getOrderFindButtonLabel(order: any): string {
    if (this.fullPlannerOrderOnlyId && this.fullPlannerOrderOnlyId !== order.id) return 'Show all orders to find this order on planner';
    if (!this.hasPlannerBookingsForOrder(order)) return 'No bookings to find on planner';
    return 'Find order on planner';
  }

  private getPlannerFocusEntryIdsForOrder(order: any): string[] {
    const visibleIds = this.events
      .filter(event => this.isEventForOrder(event, order))
      .sort((first, second) => first.start.getTime() - second.start.getTime())
      .map(event => event.id);
    if (visibleIds.length) return visibleIds;

    return this.allScheduleEntries
      .filter(entry => this.isEntryForOrder(entry, order))
      .sort((first, second) => first.start.getTime() - second.start.getTime())
      .map(entry => entry.id);
  }

  onBookingDetailsToggle(checked: boolean): void {
    this.showBookingDetails = checked;
  }

  toggleMonthCapacity(): void {
    this.showMonthCapacity = !this.showMonthCapacity;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.monthCapacityPreferenceKey, this.showMonthCapacity ? 'true' : 'false');
    }
  }

  private restoreMonthCapacityPreference(): void {
    if (typeof localStorage === 'undefined') return;
    const savedPreference = localStorage.getItem(this.monthCapacityPreferenceKey);
    this.showMonthCapacity = savedPreference === 'true';
  }

  onAutoBookingWindowSelected(range: SchedulerTimeRangePayload): void {
    if (range.resourceId) {
      this.openBlockTimeModal(range.resourceId, new Date(range.start), new Date(range.end));
      this.clearSchedulingError();
      return;
    }
    this.autoBookingWindow = { start: new Date(range.start), end: new Date(range.end) };
    this.clearSchedulingError();
  }

  clearAutoBookingWindow(): void {
    this.autoBookingWindow = null;
  }

  clearSchedulingError(): void {
    this.schedulingError = null;
  }

  clearAutoBookingRangeNotice(): void {
    this.autoBookingRangeNotice = null;
  }

  goToAutoBookingRangeNoticeTarget(): void {
    const notice = this.autoBookingRangeNotice;
    if (!notice) return;
    this.setViewWindowForMode(this.plannerViewMode, notice.targetDate);
    this.autoBookingRangeNotice = null;
    this.reloadScheduleEntries(notice.targetEventId);
  }

  private setSchedulingError(message: string, title = 'Unable to book first availability'): void {
    this.schedulingErrorTitle = title;
    this.schedulingError = message;
  }

  focusPlannerEvent(eventId: string, options: { openDetails?: boolean; pulse?: boolean } = {}): void {
    queueMicrotask(() => {
      this.scrollToEventId = eventId;
      this.scrollToEventIds = [];
      this.scrollToEventPulse = options.pulse ?? true;
      this.scrollToEventRequestId++;
      if (options.openDetails) {
        this.onEventClicked({ eventId });
      }
    });
  }

  private focusPlannerEvents(eventIds: string[], options: { pulse?: boolean } = {}): void {
    const uniqueEventIds = [...new Set(eventIds.filter(Boolean))];
    if (!uniqueEventIds.length) return;
    if (uniqueEventIds.length === 1) {
      this.focusPlannerEvent(uniqueEventIds[0], options);
      return;
    }
    queueMicrotask(() => {
      this.scrollToEventId = null;
      this.scrollToEventIds = uniqueEventIds;
      this.scrollToEventPulse = options.pulse ?? true;
      this.scrollToEventRequestId++;
    });
  }

  private shouldSuppressAutoBookingFocusPulse(): boolean {
    return this.plannerMode === 'order' || !!this.fullPlannerOrderOnlyId;
  }

  private showManualPlanValidationError(title: string, validation: ManualPlanValidationResult): void {
    this.setSchedulingError(this.formatManualPlanValidationMessage(validation), title);
  }

  private formatManualPlanValidationMessage(validation: ManualPlanValidationResult): string {
    const messages = validation.reasons.map(reason => this.getManualPlanReasonMessage(reason));
    const uniqueMessages = [...new Set(messages)].slice(0, 2);
    return uniqueMessages.length ? uniqueMessages.join(' ') : 'This placement is not available.';
  }

  private getManualPlanReasonMessage(reason: ManualPlanInvalidReason): string {
    switch (reason.code) {
      case 'outside-working-hours':
        return 'Choose a time inside working hours.';
      case 'resource-mismatch':
        return reason.detail ? `Choose a compatible ${reason.detail} resource.` : 'Choose a compatible resource.';
      case 'resource-unavailable':
        return 'The target resource is unavailable or already booked.';
      case 'vehicle-unavailable':
        return 'This vehicle already has a job scheduled at this time.';
      case 'required-resource-unavailable':
        return reason.detail ? `A required ${reason.detail} is not available at this time.` : 'A required resource is not available at this time.';
      case 'before-checkin':
        return 'Jobs must start after Check-In is complete.';
      case 'after-handover':
        return 'Jobs must finish before Handover starts.';
      case 'checkin-after-job':
        return 'Check-In must finish before scheduled jobs.';
      case 'checkin-after-handover':
        return 'Check-In must finish before Handover.';
      case 'handover-before-job':
        return 'Handover must start after scheduled jobs are finished.';
      case 'handover-before-checkin':
        return 'Handover must start after Check-In is complete.';
      case 'mobility-fixed-span':
        return 'Mobility must keep the Check-In to Handover time span.';
      case 'capacity-overbooked':
        return 'This day capacity does not have enough free time.';
    }
  }

  closeBookingModal(): void {
    this.selectedBookingEvent = null;
    this.bookingModalAdditionalResourceIds = {};
  }

  deleteSelectedBooking(): void {
    const event = this.selectedBookingEvent;
    if (!event) return;
    const removedEntry = event.meta?.entry as ScheduleEntry | undefined;

    this.scheduleRepo.unassign(event.id).subscribe(() => {
      this.removeScheduleEntriesById([event.id]);
      this.latestAutoBookingEntryIds.delete(event.id);
      this.refreshWorkOrderItemStatusForEntry(removedEntry);
      this.selectedBookingEvent = null;
    });
  }

  saveSelectedBooking(): void {
    const event = this.selectedBookingEvent;
    if (!event) return;

    const start = this.combineBookingDateTime(this.bookingModalStartDate, this.bookingModalStartTime);
    const end = this.combineBookingDateTime(this.bookingModalEndDate, this.bookingModalEndTime);
    if (!start || !end || end <= start) return;

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

  onBlockTimeDateChange(target: 'start' | 'end', value: Date[]): void {
    const date = value?.[0];
    if (!date) return;
    if (target === 'start') {
      this.blockTimeStartDate = this.toDateInputValue(date);
    } else {
      this.blockTimeEndDate = this.toDateInputValue(date);
    }
  }

  onBlockTimeChange(target: 'start' | 'end', value: string): void {
    if (target === 'start') {
      this.blockTimeStartTime = value;
    } else {
      this.blockTimeEndTime = value;
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

  private getScheduledRequirementFromEntry(entry: ScheduleEntry): JobResourceRequirement | null {
    const resource = this.resources.find(candidate => candidate.id === entry.resourceId)?.meta as Resource | undefined;
    if (!resource) return null;
    return {
      resourceType: resource.type,
      requiredQualifications: [],
      label: this.getResourceTypeLabel(entry.resourceId),
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
    return `${this.getBookingOrder(event)} - ${event.title}`;
  }

  getBookingSegmentInfo(event: SchedulerEvent): string {
    const segmentDuration = this.formatDuration(event.start, event.end);
    if (!this.isJobEvent(event)) return segmentDuration;
    const relatedSegments = this.getRelatedSplitEvents(event);
    if (relatedSegments.length <= 1) return segmentDuration;
    const segmentIndex = relatedSegments.findIndex(candidate => candidate.id === event.id);
    const segmentLabel = segmentIndex >= 0 ? `Segment ${segmentIndex + 1} of ${relatedSegments.length}` : 'Split segment';
    return `${segmentLabel} - ${segmentDuration}`;
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
    return this.getWorkOrderItems(order).reduce((total, item) => total + this.getWorkOrderItemFru(item), 0);
  }

  getRemainingOrderFru(order: any): number {
    return this.getWorkOrderItems(order).reduce((total, item) => {
      const status = this.getEffectiveWorkOrderItemStatus(order, item);
      return status === 'unscheduled' ? total + this.getWorkOrderItemFru(item) : total;
    }, 0);
  }

  public formatHours(hours: number): string {
    return hours % 1 === 0 ? String(hours) : hours.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  }

  isOrderFullyScheduled(order: any): boolean {
    return this.getOrderPlanningState(order) === 'scheduled';
  }

  getOrderPlanningStateLabel(order: any): string {
    const state = this.getOrderPlanningState(order);
    if (state === 'unscheduled') return `${this.formatHours(this.getOrderFru(order))} hrs`;
    if (state === 'partiallyScheduled') return `${this.formatHours(this.getRemainingOrderFru(order))} hrs`;
    return this.getStatusLabel(state);
  }

  getOrderPlanningStateBackground(order: any): string {
    const state = this.getOrderPlanningState(order);
    return state === 'unscheduled' || state === 'partiallyScheduled'
      ? 'white'
      : this.getStatusBackground(state);
  }

  getOrderPlanningStateColor(order: any): string {
    const state = this.getOrderPlanningState(order);
    return state === 'unscheduled' || state === 'partiallyScheduled'
      ? '#161616'
      : this.getStatusColor(state);
  }

  getOrderPlanningStateOutline(order: any): string {
    const state = this.getOrderPlanningState(order);
    return state === 'unscheduled' || state === 'partiallyScheduled'
      ? '1px solid #000'
      : this.getStatusOutline(state);
  }

  getJobExecutionStatusLabel(order: any, job: any): string {
    const status = this.getJobExecutionStatus(order, job);
    return status === 'unscheduled' ? `${this.formatHours(this.getJobFru(job))} hrs` : this.getStatusLabel(status);
  }

  getJobExecutionStatusBackground(order: any, job: any): string {
    return this.getStatusBackground(this.getJobExecutionStatus(order, job));
  }

  getJobExecutionStatusColor(order: any, job: any): string {
    return this.getStatusColor(this.getJobExecutionStatus(order, job));
  }

  getJobExecutionStatusOutline(order: any, job: any): string {
    return this.getStatusOutline(this.getJobExecutionStatus(order, job));
  }

  getActivityExecutionStatusLabel(order: any, activity: ActivityTile): string {
    const status = this.getActivityExecutionStatus(order, activity);
    return status === 'unscheduled' ? `${this.formatHours(this.getActivityFru(activity))} hrs` : this.getStatusLabel(status);
  }

  getActivityExecutionStatusBackground(order: any, activity: ActivityTile): string {
    return this.getStatusBackground(this.getActivityExecutionStatus(order, activity));
  }

  getActivityExecutionStatusColor(order: any, activity: ActivityTile): string {
    return this.getStatusColor(this.getActivityExecutionStatus(order, activity));
  }

  getActivityExecutionStatusOutline(order: any, activity: ActivityTile): string {
    return this.getStatusOutline(this.getActivityExecutionStatus(order, activity));
  }

  private isOrderPlanned(order: any): boolean {
    return ['reserved', 'scheduled', 'in-progress', 'completed'].includes(this.getOrderPlanningState(order));
  }

  private getOrderPlanningState(order: any): OrderPlanningState {
    const items = this.getWorkOrderItems(order).filter(item => item.executionStatus !== 'cancelled');
    if (!items.length) return 'unscheduled';

    const statuses = items.map(item => this.getEffectiveWorkOrderItemStatus(order, item));
    if (statuses.length > 0 && statuses.every(status => status === 'completed')) return 'completed';
    if (statuses.some(status => status === 'in-progress')) return 'in-progress';
    if (statuses.every(status => status === 'scheduled' || status === 'completed')) return 'scheduled';
    if (statuses.every(status => status === 'reserved' || status === 'scheduled' || status === 'completed')) return 'reserved';
    if (statuses.some(status => status === 'scheduled' || status === 'completed' || status === 'reserved')) return 'partiallyScheduled';
    return 'unscheduled';
  }

  private getJobExecutionStatus(order: any, job: any): CanonicalWorkOrderItemStatus {
    const item = this.getWorkOrderJobItems(order).find(candidate => candidate.id === job.id);
    return item ? this.getEffectiveWorkOrderItemStatus(order, item) : this.getCanonicalWorkOrderItemStatus(job.workorderItemStatus ?? job.status);
  }

  private getActivityExecutionStatus(order: any, activity: ActivityTile): CanonicalWorkOrderItemStatus {
    const item = this.getWorkOrderActivityItems(order).find(candidate => candidate.id === activity.id || candidate.templateId === this.getActivityTemplateId(activity.id));
    const activitySource = activity as ActivityTile & { workorderItemStatus?: WorkorderItemStatus; status?: WorkorderItemStatus };
    return item ? this.resolveActivityItemStatus(order, item) : this.getCanonicalWorkOrderItemStatus(activitySource.workorderItemStatus ?? activitySource.status);
  }

  private getStatusLabel(status: CanonicalWorkOrderItemStatus | OrderPlanningState): string {
    if (status === 'partiallyScheduled') return 'Partially scheduled';
    if (status === 'in-progress') return 'In progress';
    return `${status.charAt(0).toUpperCase()}${status.slice(1)}`;
  }

  private getStatusBackground(status: CanonicalWorkOrderItemStatus | OrderPlanningState): string {
    if (status === 'scheduled') return '#FFE8BF';
    if (status === 'reserved') return '#E8DAFF';
    if (status === 'partiallyScheduled') return '#E0E0E0';
    if (status === 'in-progress') return '#D0E2FF';
    if (status === 'completed') return '#DEFBE6';
    if (status === 'cancelled') return '#FFF1F1';
    return 'white';
  }

  private getStatusColor(status: CanonicalWorkOrderItemStatus | OrderPlanningState): string {
    if (status === 'scheduled') return '#D38700';
    if (status === 'reserved') return '#6929C4';
    if (status === 'partiallyScheduled') return '#525252';
    if (status === 'in-progress') return '#0F62FE';
    if (status === 'completed') return '#198038';
    if (status === 'cancelled') return '#DA1E28';
    return '#161616';
  }

  private getStatusOutline(status: CanonicalWorkOrderItemStatus | OrderPlanningState): string {
    return status === 'unscheduled' ? '1px solid #000' : '0';
  }

  private getWorkOrderItems(order: any): NormalizedWorkOrderItem[] {
    return [
      ...this.getWorkOrderJobItems(order),
      ...this.getWorkOrderActivityItems(order),
    ];
  }

  private getWorkOrderJobItems(order: any): NormalizedWorkOrderItem[] {
    return this.getJobsForOrder(order)
      .filter((job: any) => (job.workorderItemCategory ?? 'job') !== 'activity')
      .map((job: any) => ({
        id: job.id,
        orderId: order.id,
        title: job.title,
        kind: 'job' as const,
        source: job,
        executionStatus: this.getCanonicalWorkOrderItemStatus(job.workorderItemStatus ?? job.status),
      }));
  }

  getJobsForOrder(order: any): any[] {
    return (order.jobs ?? []).filter((job: any) => this.getSchedulingRole(job) === 'work');
  }

  private getSchedulingRole(item: any): SchedulingRole {
    const templateId = this.getActivityTemplateId(item.templateId ?? item.id ?? '');
    if (templateId === 'act-checkin') return 'start-boundary';
    if (templateId === 'act-handover') return 'end-boundary';
    if (templateId === 'act-mobility') return 'span';
    return 'work';
  }

  private getWorkOrderActivityItems(order: any): NormalizedWorkOrderItem[] {
    return (order.jobs ?? [])
      .filter((job: any) => job.workorderItemCategory === 'activity' || this.isActivityId(job.id))
      .map((activity: any) => {
        const templateId = this.getActivityTemplateId(activity.templateId ?? activity.id);
        return {
          id: activity.id,
          orderId: order.id,
          title: activity.title,
          kind: 'activity' as const,
          source: activity,
          templateId,
          executionStatus: this.getCanonicalWorkOrderItemStatus(activity.workorderItemStatus ?? activity.status),
        };
      })
      .sort((first: NormalizedWorkOrderItem, second: NormalizedWorkOrderItem) =>
        this.getActivityDisplayOrder(first.templateId) - this.getActivityDisplayOrder(second.templateId)
      );
  }

  private getActivityDisplayOrder(templateId?: string): number {
    if (templateId === 'act-checkin') return 0;
    if (templateId === 'act-handover') return 1;
    if (templateId === 'act-mobility') return 2;
    return 3;
  }

  private isWorkOrderItemScheduled(order: any, item: NormalizedWorkOrderItem): boolean {
    return this.hasWorkOrderItemAllocation(order, item);
  }

  private getEffectiveWorkOrderItemStatus(order: any, item: NormalizedWorkOrderItem): CanonicalWorkOrderItemStatus {
    if (item.kind === 'activity') return this.resolveActivityItemStatus(order, item);
    const explicitStatus = this.getCanonicalWorkOrderItemStatus(item.source?.workorderItemStatus ?? item.source?.status ?? item.executionStatus);
    if (explicitStatus !== 'unscheduled') return explicitStatus;
    if (!this.hasWorkOrderItemAllocation(order, item)) return 'unscheduled';
    return this.isWorkOrderItemOnlyDayCapacity(order, item) ? 'reserved' : 'scheduled';
  }

  private resolveActivityItemStatus(order: any, item: NormalizedWorkOrderItem): CanonicalWorkOrderItemStatus {
    const explicitStatus = this.getCanonicalWorkOrderItemStatus(item.source?.workorderItemStatus ?? item.source?.status ?? item.executionStatus);
    if (explicitStatus !== 'unscheduled') return explicitStatus;

    const entryStatus = this.getActivityScheduleEntryStatus(order, item);
    if (entryStatus !== 'unscheduled') return entryStatus;

    if (!this.hasWorkOrderItemAllocation(order, item)) return 'unscheduled';
    return this.isWorkOrderItemOnlyDayCapacity(order, item) ? 'reserved' : 'scheduled';
  }

  private getActivityScheduleEntryStatus(order: any, item: NormalizedWorkOrderItem): CanonicalWorkOrderItemStatus {
    const templateId = item.templateId ?? this.getActivityTemplateId(item.id);
    const entry = this.getExistingScheduleEntriesForOrder(order).find(candidate =>
      candidate.jobId === item.id || this.getActivityTemplateId(candidate.jobId) === templateId
    );
    return this.getCanonicalWorkOrderItemStatus(entry?.workorderItemStatus);
  }

  private hasWorkOrderItemAllocation(order: any, item: NormalizedWorkOrderItem): boolean {
    return item.kind === 'activity'
      ? !!this.getActivityBooking(this.toActivityTile(item.source), order.id)
      : this.isJobScheduledForOrder(item.source, order);
  }

  private isWorkOrderItemOnlyDayCapacity(order: any, item: NormalizedWorkOrderItem): boolean {
    const jobId = item.id;
    const orderRef = order.referenceNumber;
    const entries = this.allScheduleEntries.filter(entry =>
      (entry.jobId === jobId || this.getActivityTemplateId(entry.jobId) === this.getActivityTemplateId(jobId)) &&
      entry.workOrderReference === orderRef
    );
    return entries.length > 0 && entries.every(entry => entry.workorderItemStatus === 'reserved');
  }

  private getCanonicalWorkOrderItemStatus(status: unknown): CanonicalWorkOrderItemStatus {
    if (status === 'completed') return 'completed';
    if (status === 'in-progress' || status === 'started') return 'in-progress';
    if (status === 'cancelled') return 'cancelled';
    if (status === 'scheduled') return 'scheduled';
    if (status === 'reserved') return 'reserved';
    return 'unscheduled';
  }

  private getWorkOrderItemFru(item: NormalizedWorkOrderItem): number {
    return item.kind === 'activity'
      ? this.getActivityFru(this.toActivityTile(item.source))
      : this.getJobFru(item.source);
  }

  private toActivityTile(activity: any): WorkOrderActivityTile {
    const templateId = this.getActivityTemplateId(activity.templateId ?? activity.id);
    const template = this.getActivityTemplate(templateId);
    return {
      id: activity.id,
      workOrderItemId: activity.id,
      templateId,
      title: activity.title ?? template?.title ?? templateId,
      resourceType: activity.requiredResourceType ?? activity.resourceType ?? template?.resourceType ?? 'advisor',
      resourceLabel: activity.resourceLabel ?? activity.resourceRequirements?.[0]?.label ?? template?.resourceLabel ?? 'Resource',
      fru: Number(activity.fru ?? template?.fru ?? Math.max(0.25, (activity.estimatedDurationMinutes ?? template?.estimatedDurationMinutes ?? 0) / MINUTES_PER_FRU)),
      estimatedDurationMinutes: activity.estimatedDurationMinutes ?? template?.estimatedDurationMinutes ?? 30,
    };
  }

  onOrderDragStart(event: DragEvent, order: any): void {
    this.manualDragContext = this.buildOrderDragContext(order);
    this.setManualDragPointerOffset(event);
    this.registerManualDragEnd();
    event.dataTransfer?.setData('orderId', order.id);
    event.dataTransfer?.setData('dropType', 'order');
    event.dataTransfer?.setData('application/json', JSON.stringify({ type: 'order', orderId: order.id }));
    event.dataTransfer?.setData('text/plain', order.id);
  }

  onJobDragStart(event: DragEvent, job: any, order: any): void {
    event.stopPropagation();
    this.manualDragContext = this.buildJobDragContext(job, order);
    this.setManualDragPointerOffset(event);
    this.registerManualDragEnd();
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
    const activityItem = activity as WorkOrderActivityTile;
    const workOrderItemId = activityItem.workOrderItemId ?? activity.id;
    this.manualDragContext = this.buildActivityDragContext(activity, order);
    this.setManualDragPointerOffset(event);
    this.registerManualDragEnd();
    event.dataTransfer?.setData('jobId', workOrderItemId);
    event.dataTransfer?.setData('orderId', order.id);
    event.dataTransfer?.setData('dropType', 'activity');
    event.dataTransfer?.setData('fru', String(this.getActivityFru(activity)));
    event.dataTransfer?.setData('resourceType', activity.resourceType ?? '');
    event.dataTransfer?.setData('application/json', JSON.stringify({ type: 'activity', jobId: workOrderItemId, orderId: order.id }));
    event.dataTransfer?.setData('text/plain', workOrderItemId);
  }

  isBookFirstDisabled(orderId: string): boolean {
    const order = this.allOrders.find(candidate => candidate.id === orderId);
    return this.schedulingError === orderId || (!!order && (this.isOrderFullyScheduled(order) || this.isOrderAutoBookingLocked(order)));
  }

  onBookFirstAvailabilityForOrder(order: any): void {
    this.selectedPanelOrderId = order.id;
    this.setFocusedPlanningOrder(order);
    this.restoreProposalStateForOrder(order.id);

    // If the order has reserved (day-capacity) entries, use reserved day as search start
    // and reserved resources as preferred
    const reservedEntries = this.getExistingScheduleEntriesForOrder(order)
      .filter(entry => entry.workorderItemStatus === 'reserved');
    if (reservedEntries.length) {
      const reservedDay = new Date(Math.min(...reservedEntries.map(e => e.start.getTime())));
      reservedDay.setHours(9, 0, 0, 0);
      const preferredResourceIds = [...new Set(reservedEntries.map(e => e.resourceId))];
      this.applyProposal(this.getBookableSearchStart(reservedDay), true, false, {
        orderId: order.id,
        preferredResourceIds,
      });
      return;
    }

    const searchFrom = this.getBookableSearchStart(this.viewStart);
    this.applyProposal(searchFrom, true);
  }

  hasPreviousForOrder(orderId: string): boolean {
    const order = this.allOrders.find(candidate => candidate.id === orderId || candidate.referenceNumber === orderId);
    if (order && this.isOrderAutoBookingLocked(order)) return false;
    return (this.proposalStateByOrder.get(orderId)?.index ?? -1) > 0;
  }

  onBookPreviousForOrder(order: any): void {
    this.restoreProposalStateForOrder(order.id);
    if (this.currentProposalIndex <= 0) return;
    this.currentProposalIndex--;
    const searchFrom = this.proposalHistory[this.currentProposalIndex];
    this.applyProposal(searchFrom, false, true, { orderId: order.id, revealOrder: false });
  }

  canNavigateAvailability(orderId: string): boolean {
    const order = this.allOrders.find(candidate => candidate.id === orderId || candidate.referenceNumber === orderId);
    if (!order || this.isOrderAutoBookingLocked(order)) return false;
    if ((this.proposalStateByOrder.get(orderId)?.index ?? -1) >= 0) return true;
    const entries = this.getExistingScheduleEntriesForOrder(order);
    return entries.some(entry => entry.workorderItemStatus !== 'reserved' && entry.kind !== 'day-capacity');
  }

  private isOrderAutoBookingLocked(order: any): boolean {
    return ['in-progress', 'completed', 'cancelled'].includes(this.getOrderPlanningState(order));
  }

  onBookNextForOrder(order: any): void {
    this.restoreProposalStateForOrder(order.id);
    if (this.currentProposalIndex < 0) {
      const scheduledEntries = this.getExistingScheduleEntriesForOrder(order);
      if (scheduledEntries.length) {
        const start = new Date(Math.min(...scheduledEntries.map(entry => entry.start.getTime())));
        const end = new Date(Math.max(...scheduledEntries.map(entry => entry.end.getTime())));
        this.proposalHistory = [start];
        this.proposalEndHistory = [end];
        this.currentProposalIndex = 0;
        this.applyProposal(this.getBookableSearchStart(new Date(end.getTime() + 15 * 60000)), false, false, { orderId: order.id, revealOrder: false });
        return;
      }
      this.applyProposal(this.getBookableSearchStart(new Date(this.viewStart.getTime() + 15 * 60000)), true, false, { orderId: order.id, revealOrder: false });
      return;
    }
    const currentProposalEnd = this.proposalEndHistory[this.currentProposalIndex]
      ?? this.proposalHistory[this.currentProposalIndex];
    const nextSearchFrom = this.getBookableSearchStart(new Date(currentProposalEnd.getTime() + 15 * 60000));
    this.applyProposal(nextSearchFrom, false, false, { orderId: order.id, revealOrder: false });
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

    const entries = this.allScheduleEntries.filter(entry =>
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
      const entry = this.allScheduleEntries.find(candidate => candidate.id === booking.entryId);
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
    const entry = this.allScheduleEntries.find(candidate => candidate.id === set.bookings[0]?.entryId);
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
    return this.allScheduleEntries.filter(candidate =>
      this.isJobScheduleEntry(candidate) &&
      this.getEntryBookingSetId(candidate) === bookingSetId
    );
  }

  private getRelatedSplitEvents(event: SchedulerEvent): SchedulerEvent[] {
    const entry = this.scheduleEntries.find(candidate => candidate.id === event.id) ?? event.meta?.entry;
    if (!this.isJobScheduleEntry(entry)) return [event];
    const splitRootId = this.getSplitRootId(entry);
    return this.events
      .filter(candidate => {
        const candidateEntry = this.scheduleEntries.find(scheduleEntry => scheduleEntry.id === candidate.id) ?? candidate.meta?.entry;
        return this.isJobScheduleEntry(candidateEntry) && this.getSplitRootId(candidateEntry) === splitRootId;
      })
      .sort((first, second) => first.start.getTime() - second.start.getTime() || first.resourceId.localeCompare(second.resourceId));
  }

  private getSplitRootId(entry: ScheduleEntry): string {
    const entryAny = entry as ScheduleEntry & { splitRootId?: string; splitParentBookingSetId?: string };
    if (entryAny.splitRootId) return entryAny.splitRootId;
    if (entryAny.splitParentBookingSetId) return entryAny.splitParentBookingSetId;
    const bookingSetId = this.getEntryBookingSetId(entry);
    return bookingSetId.includes(':split:') ? bookingSetId.split(':split:')[0] : bookingSetId;
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
    return this.bookings.some(candidate => candidate.entryId === booking.entryId) || this.allScheduleEntries.some(entry => entry.id === booking.entryId);
  }

  isBookingCompleted(booking: JobBooking): boolean {
    const entry = this.allScheduleEntries.find(candidate => candidate.id === booking.entryId);
    return this.getCanonicalWorkOrderItemStatus(entry?.workorderItemStatus) === 'completed';
  }

  isBookingReserved(booking: JobBooking): boolean {
    const entry = this.allScheduleEntries.find(candidate => candidate.id === booking.entryId);
    return entry?.workorderItemStatus === 'reserved';
  }

  isActivityCompleted(order: any, activity: ActivityTile): boolean {
    return this.getActivityExecutionStatus(order, activity) === 'completed';
  }

  getActivitiesForOrder(order: any): ActivityTile[] {
    return this.getWorkOrderActivityItems(order).map(item => this.toActivityTile(item.source));
  }

  private hasOrderActivity(order: any, activityTemplateId: string): boolean {
    return this.getWorkOrderActivityItems(order).some(item => item.templateId === activityTemplateId);
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
    return Number(activity.fru ?? Math.max(0.25, (activity.estimatedDurationMinutes ?? 0) / MINUTES_PER_FRU));
  }

  getBookingScheduleSummary(booking: JobBooking): string {
    const entry = this.allScheduleEntries.find(candidate => candidate.id === booking.entryId);
    if (!entry) return '';
    if (entry.workorderItemStatus === 'reserved') {
      return `${this.formatOrderScheduleDate(entry.start)} | ${this.formatDuration(entry.start, entry.end)}`;
    }
    return `${this.formatOrderScheduleDateTime(entry.start)} | ${this.formatDuration(entry.start, entry.end)}`;
  }

  getOrderCategories(order: any): BookingCategory[] {
    const entries = this.allScheduleEntries.filter(entry => this.isEntryForOrder(entry, order));
    return this.getCategoriesForEntriesByScope(entries, 'order');
  }

  getBookingSetCategories(bookingSet: BookingSet): BookingCategory[] {
    const bookingEntryIds = new Set(bookingSet.bookings.map(booking => booking.entryId));
    const entries = this.allScheduleEntries.filter(entry =>
      bookingEntryIds.has(entry.id) || this.getEntryBookingSetId(entry) === bookingSet.id
    );
    return this.getCategoriesForEntriesByScope(entries, 'booking-set');
  }

  getJobBookingSetCategories(job: any, order: any): BookingCategory[] {
    const categoriesById = new Map<string, BookingCategory>();
    for (const bookingSet of this.getJobBookingSets(job, order)) {
      for (const category of this.getBookingSetCategories(bookingSet)) {
        categoriesById.set(category.id, category);
      }
    }
    return [...categoriesById.values()];
  }

  getEntryCategoriesForBooking(booking: JobBooking): BookingCategory[] {
    const entry = this.allScheduleEntries.find(candidate => candidate.id === booking.entryId);
    return entry ? this.getEntryCategories(entry) : [];
  }

  getEntryCategories(entry: ScheduleEntry): BookingCategory[] {
    if (!entry.categoryIds?.length) return [];
    return this.getCategoriesForEntriesByScope([entry], 'entry');
  }

  getBookingCategoriesForBooking(booking: JobBooking): BookingCategory[] {
    return this.getEntryCategoriesForBooking(booking);
  }

  private getCategoriesForEntriesByScope(entries: ScheduleEntry[], scope: BookingCategory['appliesTo']): BookingCategory[] {
    const categoriesById = new Map<string, BookingCategory>();
    for (const entry of entries) {
      for (const categoryId of entry.categoryIds ?? []) {
        if (categoriesById.has(categoryId)) continue;
        const category = this.bookingCategoriesService.getById(categoryId);
        if (category?.appliesTo === scope) categoriesById.set(category.id, category);
      }
    }
    return [...categoriesById.values()];
  }

  scrollToBookingInAvailabilityView(order: any, booking: JobBooking): void {
    this.selectedPanelOrderId = order.id;
    this.setFocusedPlanningOrder(order);
    const entry = this.allScheduleEntries.find(candidate => candidate.id === booking.entryId);
    if (entry && (entry.start >= this.viewEnd || entry.end <= this.viewStart)) {
      this.setViewWindowForMode(this.plannerViewMode, entry.start);
      this.scheduleRepo.getEntries(this.viewStart, this.viewEnd).subscribe(entries => {
        this.applyScheduleEntries(entries);
        this.focusPlannerEvent(booking.entryId);
      });
      return;
    }
    this.focusPlannerEvent(booking.entryId);
  }

  openBookingFromSearch(order: any, booking: JobBooking): void {
    this.selectedPanelOrderId = order.id;
    this.setFocusedPlanningOrder(order);
    this.focusPlannerEvent(booking.entryId, { openDetails: true });
  }

  isOrderExpanded(order: any): boolean {
    return this.expandedOrderIds.has(order.id);
  }

  shouldShowOrderDetails(order: any): boolean {
    if (this.plannerMode === 'order' && (order.id === this.activeOrderId || order.referenceNumber === this.activeOrderId)) return true;
    if (!this.isSearchActive) return this.isOrderExpanded(order);
    return this.isOrderExpanded(order) || this.isOrderSearchRevealed(order) || this.getSearchMatchesForOrder(order).some(match => match.type !== 'order-header');
  }

  shouldShowJobForSearch(order: any, job: any): boolean {
    if (!this.isSearchActive || this.isOrderExpanded(order)) return true;
    return this.getSearchMatchesForOrder(order).some(match =>
      (match.type === 'job' && match.jobId === job.id) ||
      (match.type === 'booking-resource' && match.jobId === job.id)
    );
  }

  shouldShowActivityForSearch(order: any, activity: ActivityTile): boolean {
    if (!this.isSearchActive || this.isOrderExpanded(order)) return true;
    return this.getSearchMatchesForOrder(order).some(match =>
      (match.type === 'activity' && match.activityId === activity.id) ||
      (match.type === 'booking-resource' && match.activityId === activity.id)
    );
  }

  shouldShowJobsSection(order: any): boolean {
    if (!this.isSearchActive || this.isOrderExpanded(order)) return true;
    return this.getSearchMatchesForOrder(order).some(match => match.type === 'job' || (match.type === 'booking-resource' && !!match.jobId));
  }

  shouldShowActivitySection(order: any): boolean {
    if (!this.isSearchActive || this.isOrderExpanded(order)) return true;
    return this.getSearchMatchesForOrder(order).some(match => match.type === 'activity' || (match.type === 'booking-resource' && !!match.activityId));
  }

  private isOrderSearchRevealed(order: any): boolean {
    return this.searchRevealedOrderIds.has(order.id);
  }

  getSearchHighlightParts(value: unknown): SearchHighlightPart[] {
    const text = String(value ?? '');
    const query = this.bookingSearchQuery.trim();
    if (!query) return [{ text, isMatch: false }];

    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const parts: SearchHighlightPart[] = [];
    let cursor = 0;
    let index = lowerText.indexOf(lowerQuery, cursor);

    while (index >= 0) {
      if (index > cursor) {
        parts.push({ text: text.slice(cursor, index), isMatch: false });
      }
      parts.push({ text: text.slice(index, index + query.length), isMatch: true });
      cursor = index + query.length;
      index = lowerText.indexOf(lowerQuery, cursor);
    }

    if (cursor < text.length) {
      parts.push({ text: text.slice(cursor), isMatch: false });
    }

    return parts.length ? parts : [{ text, isMatch: false }];
  }

  getOrderSearchSummary(order: any): string {
    const jobs = this.getWorkOrderJobItems(order);
    const scheduledJobs = jobs.filter(item => this.getEffectiveWorkOrderItemStatus(order, item) === 'scheduled').length;
    const pendingJobs = Math.max(0, jobs.length - scheduledJobs);
    const activities = this.getWorkOrderActivityItems(order);
    const scheduledActivities = activities.filter(item => this.getEffectiveWorkOrderItemStatus(order, item) === 'scheduled').length;
    return `${jobs.length} jobs | ${scheduledJobs} booked | ${pendingJobs} pending | ${scheduledActivities}/${activities.length} activities`;
  }

  private revealActiveSearchMatch(): void {
    const match = this.panelSearchMatches[this.activeSearchResultIndex];
    if (!match) return;
    this.selectedPanelOrderId = match.orderId;
    this.searchRevealedOrderIds = new Set([...this.searchRevealedOrderIds, match.orderId]);
    queueMicrotask(() => {
      document.getElementById(`order-panel-card-${match.orderId}`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  }

  private getSearchMatchesForOrder(order: any, query = this.bookingSearchQuery.trim().toLowerCase()): PanelSearchMatch[] {
    if (!query) return [];
    const matches: PanelSearchMatch[] = [];
    if (this.includesQuery([
      order.referenceNumber,
      order.vehicle?.licensePlate,
      order.customer?.name,
    ], query)) {
      matches.push({ type: 'order-header', orderId: order.id });
    }

    for (const job of this.getJobsForOrder(order)) {
      if (this.includesQuery([job.title], query)) {
        matches.push({ type: 'job', orderId: order.id, jobId: job.id });
      }
      for (const bookingSet of this.getJobBookingSets(job, order)) {
        for (const booking of bookingSet.bookings) {
          if (this.includesQuery([booking.resourceName, bookingSet.summary], query)) {
            matches.push({ type: 'booking-resource', orderId: order.id, jobId: job.id, bookingEntryId: booking.entryId });
          }
        }
      }
    }

    for (const activity of this.getActivitiesForOrder(order)) {
      if (this.includesQuery([activity.title, activity.resourceLabel], query)) {
        matches.push({ type: 'activity', orderId: order.id, activityId: activity.id });
      }
      const booking = this.getActivityBooking(activity, order.id);
      if (booking && this.includesQuery([booking.resourceName, this.getBookingScheduleSummary(booking)], query)) {
        matches.push({ type: 'booking-resource', orderId: order.id, activityId: activity.id, bookingEntryId: booking.entryId });
      }
    }

    return matches;
  }

  private includesQuery(values: unknown[], query: string): boolean {
    return [
      ...values,
    ].filter(Boolean).join(' ').toLowerCase().includes(query);
  }

  private formatOrderScheduleDateTime(value: Date): string {
    const day = String(value.getDate()).padStart(2, '0');
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const year = value.getFullYear();
    const hours = String(value.getHours()).padStart(2, '0');
    const minutes = String(value.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  }

  private formatOrderScheduleDate(value: Date): string {
    const day = String(value.getDate()).padStart(2, '0');
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const year = value.getFullYear();
    return `${day}.${month}.${year}`;
  }

  private formatDuration(start: Date, end: Date): string {
    const totalMinutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours && minutes) return `${hours}hr ${minutes}min`;
    if (hours) return `${hours}hr`;
    return `${minutes}min`;
  }

  private getExistingScheduleEntriesForOrder(order: any): ScheduleEntry[] {
    return this.allScheduleEntries.filter(entry => entry.workOrderReference === order.referenceNumber);
  }

  private hasPlannerBookingsForOrder(order: any): boolean {
    return this.allScheduleEntries.some(entry => this.isEntryForOrder(entry, order));
  }

  private getPersistedBookingsFromEntries(entries: ScheduleEntry[], orders: any[]): JobBooking[] {
    return entries
      .filter(entry => entry.kind === 'scheduled' || entry.kind === 'blocked-order' || entry.kind === 'day-capacity')
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
    return entries
      .filter(entry => entry.kind !== 'day-capacity')
      .map(entry => this.mapScheduleEntryToEvent(entry));
  }

  private applyScheduleEntries(entries: ScheduleEntry[]): void {
    this.scheduleEntries = entries;
    this.upsertAllScheduleEntries(entries);
    this.events = this.mapScheduleEntriesToEvents(entries);
    this.capacityBlocks = this.mapScheduleEntriesToCapacityBlocks(entries);
    this.loadFullOrderEntries(entries);
  }

  private loadFullOrderEntries(visibleEntries: ScheduleEntry[]): void {
    const orderReferences = new Set(
      visibleEntries
        .map(entry => entry.workOrderReference)
        .filter((ref): ref is string => !!ref)
    );
    for (const orderRef of orderReferences) {
      this.scheduleRepo.getEntriesForOrder(orderRef).subscribe(orderEntries => {
        this.upsertAllScheduleEntries(orderEntries);
      });
    }
  }

  private getFreeViewWindowStart(anchor: Date): Date {
    const start = new Date(anchor);
    start.setHours(9, 0, 0, 0);
    return start;
  }

  private getFreeViewWindowEnd(start: Date): Date {
    const end = new Date(start);
    end.setDate(start.getDate() + this.freeViewWindowDays - 1);
    end.setHours(21, 0, 0, 0);
    return end;
  }

  private getFreeViewLazyRange(direction: 'previous' | 'next'): { start: Date; end: Date } {
    if (direction === 'next') {
      const start = new Date(this.viewEnd);
      start.setDate(start.getDate() + 1);
      start.setHours(9, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + this.freeViewLazyLoadDays - 1);
      end.setHours(21, 0, 0, 0);
      return { start, end };
    }

    const end = new Date(this.viewStart);
    end.setDate(end.getDate() - 1);
    end.setHours(21, 0, 0, 0);
    const start = new Date(end);
    start.setDate(end.getDate() - this.freeViewLazyLoadDays + 1);
    start.setHours(9, 0, 0, 0);
    return { start, end };
  }

  private upsertAllScheduleEntries(entries: ScheduleEntry[]): void {
    if (!entries.length) return;
    const entriesById = new Map(this.allScheduleEntries.map(entry => [entry.id, entry]));
    entries.forEach(entry => entriesById.set(entry.id, entry));
    this.allScheduleEntries = [...entriesById.values()];
  }

  private removeScheduleEntriesById(entryIds: Iterable<string>): ScheduleEntry[] {
    const ids = new Set(entryIds);
    if (!ids.size) return [];
    const removedEntries = this.allScheduleEntries.filter(entry => ids.has(entry.id));
    this.allScheduleEntries = this.allScheduleEntries.filter(entry => !ids.has(entry.id));
    this.scheduleEntries = this.scheduleEntries.filter(entry => !ids.has(entry.id));
    this.events = this.events.filter(event => !ids.has(event.id));
    this.capacityBlocks = this.capacityBlocks.filter(block => !ids.has(block.id));
    this.clearOrderOnlyIfNoBookingsRemain();
    return removedEntries;
  }

  private clearOrderOnlyIfNoBookingsRemain(): void {
    if (!this.fullPlannerOrderOnlyId) return;
    if (this.isReplacingFocusedOrderBookings) return;
    const order = this.allOrders.find(candidate => candidate.id === this.fullPlannerOrderOnlyId || candidate.referenceNumber === this.fullPlannerOrderOnlyId);
    if (!order || !this.hasPlannerBookingsForOrder(order)) this.fullPlannerOrderOnlyId = '';
  }

  private mapScheduleEntriesToCapacityBlocks(entries: ScheduleEntry[]): SchedulerCapacityBlock[] {
    return entries
      .filter(entry => entry.kind === 'day-capacity')
      .map(entry => this.mapScheduleEntryToCapacityBlock(entry));
  }

  private mapScheduleEntryToEvent(entry: ScheduleEntry): SchedulerEvent {
    const order = this.findOrderForScheduleEntry(entry);
    const job = order?.jobs?.find((candidate: any) => candidate.id === entry.jobId);
    const isActivity = entry.workorderItemCategory === 'activity' || this.isActivityId(entry.jobId);

    return {
      id: entry.id,
      resourceId: entry.resourceId,
      start: entry.start,
      end: entry.end,
      title: entry.title ?? job?.title ?? entry.jobId,
      color: entry.color ?? '#4C68B1',
      meta: {
        job,
        order,
        entry: {
          ...entry,
          workOrderReference: entry.workOrderReference ?? order?.referenceNumber,
          workorderItemStatus: entry.workorderItemStatus ?? job?.workorderItemStatus ?? 'scheduled',
          workorderItemCategory: entry.workorderItemCategory ?? job?.workorderItemCategory ?? (isActivity ? 'activity' : 'job'),
        },
      } as any,
    };
  }

  private mapScheduleEntryToCapacityBlock(entry: ScheduleEntry): SchedulerCapacityBlock {
    const order = this.findOrderForScheduleEntry(entry);
    const job = order?.jobs?.find((candidate: any) => candidate.id === entry.jobId);
    const durationMinutes = Math.max(1, Math.round((entry.end.getTime() - entry.start.getTime()) / 60000));
    const date = new Date(entry.start);
    date.setHours(0, 0, 0, 0);

    return {
      id: entry.id,
      resourceId: entry.resourceId,
      date,
      durationMinutes,
      title: entry.title ?? job?.title ?? entry.jobId,
      color: entry.color ?? '#4C68B1',
      meta: {
        job,
        order,
        entry: {
          ...entry,
          workOrderReference: entry.workOrderReference ?? order?.referenceNumber,
          workorderItemStatus: entry.workorderItemStatus ?? job?.workorderItemStatus ?? 'scheduled',
          workorderItemCategory: entry.workorderItemCategory ?? job?.workorderItemCategory ?? 'job',
        },
      } as any,
    };
  }

  private findOrderForScheduleEntry(entry: ScheduleEntry): any | null {
    if (entry.workOrderReference) {
      const order = this.allOrders.find(candidate =>
        candidate.referenceNumber === entry.workOrderReference || candidate.id === entry.workOrderReference
      );
      if (order) return order;
    }

    const activityOrderId = this.getOrderIdFromActivityJobId(entry.jobId);
    if (activityOrderId) {
      const order = this.allOrders.find(candidate =>
        candidate.id === activityOrderId || candidate.referenceNumber === activityOrderId
      );
      if (order) return order;
    }

    return this.allOrders.find(candidate =>
      candidate.jobs?.some((job: any) => job.id === entry.jobId)
    ) ?? null;
  }

  private getOrderIdFromActivityJobId(jobId: string | undefined): string | null {
    if (!jobId?.includes(':act-')) return null;
    return jobId.split(':act-')[0] || null;
  }

  private upsertScheduleEntry(entry: ScheduleEntry): void {
    this.upsertAllScheduleEntries([entry]);
    this.scheduleEntries = [
      ...this.scheduleEntries.filter(candidate => candidate.id !== entry.id),
      entry,
    ];
    this.refreshWorkOrderItemStatusForEntry(entry);
  }

  private updateScheduleEntryTimes(entryId: string, start: Date, end: Date): void {
    this.allScheduleEntries = this.allScheduleEntries.map(entry =>
      entry.id === entryId ? { ...entry, start, end } : entry
    );
    this.scheduleEntries = this.scheduleEntries.map(entry =>
      entry.id === entryId ? { ...entry, start, end } : entry
    );
  }

  private updateScheduleEntry(entryId: string, changes: Partial<ScheduleEntry>): void {
    this.allScheduleEntries = this.allScheduleEntries.map(entry =>
      entry.id === entryId ? { ...entry, ...changes } : entry
    );
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

  private updateCapacityBlockEntry(entryId: string, changes: Partial<ScheduleEntry>): void {
    this.capacityBlocks = this.capacityBlocks.map(block =>
      block.id === entryId
        ? { ...block, meta: { ...(block.meta ?? {}), entry: { ...(block.meta?.entry as ScheduleEntry), ...changes } } }
        : block
    );
  }

  private refreshWorkOrderItemStatusForEntry(entry: ScheduleEntry | undefined): void {
    if (!entry) return;
    const order = this.findOrderForScheduleEntry(entry);
    if (!order) return;
    const category = entry.workorderItemCategory ?? (this.isActivityScheduleEntry(entry) ? 'activity' : 'job');
    if (!this.hasRemainingEntryForWorkOrderItem(order, entry, category)) {
      this.setWorkOrderItemExecutionStatus(order, entry.jobId, category, 'unscheduled');
    } else {
      const status = entry.workorderItemStatus === 'reserved' ? 'reserved' : 'scheduled';
      this.setWorkOrderItemExecutionStatus(order, entry.jobId, category, status);
    }
  }

  private refreshWorkOrderItemStatusesForEntries(entries: ScheduleEntry[]): void {
    entries.forEach(entry => this.refreshWorkOrderItemStatusForEntry(entry));
  }

  private hasRemainingEntryForWorkOrderItem(order: any, entry: ScheduleEntry, category: 'job' | 'activity'): boolean {
    return this.allScheduleEntries.some(candidate => {
      const candidateCategory = candidate.workorderItemCategory ?? (this.isActivityScheduleEntry(candidate) ? 'activity' : 'job');
      if (candidateCategory !== category) return false;
      if (category === 'activity') {
        return this.getActivityTemplateId(candidate.jobId) === this.getActivityTemplateId(entry.jobId) && candidate.workOrderReference === order.referenceNumber;
      }
      return candidate.jobId === entry.jobId && this.findOrderForScheduleEntry(candidate)?.id === order.id;
    });
  }

  private setWorkOrderItemExecutionStatus(order: any, itemId: string, category: 'job' | 'activity', status: CanonicalWorkOrderItemStatus): void {
    const templateId = this.getActivityTemplateId(itemId);
    order.jobs = (order.jobs ?? []).map((job: any) => {
      const isTarget = category === 'activity'
        ? this.getActivityTemplateId(job.templateId ?? job.id) === templateId
        : job.id === itemId;
      return isTarget ? { ...job, status, workorderItemStatus: status } : job;
    });
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
    this.removeScheduleEntriesById(entryIds);
    this.refreshWorkOrderItemStatusesForEntries(entries);
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
    const entries = this.allScheduleEntries.filter(entry =>
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
    if (payload.dropMode === 'day-capacity') {
      this.onDayCapacityDropped(payload, activeOrderId);
      return;
    }
    if (payload.dropType === 'order' && activeOrderId) {
      this.clearManualInteractionState();
      this.selectedPanelOrderId = activeOrderId;
      this.restoreProposalStateForOrder(activeOrderId);
      this.applyProposal(payload.start, true, false, {
        orderId: activeOrderId,
        preferredResourceIds: [payload.resourceId],
        scrollToFirstEntry: false,
      });
      return;
    }

    const activityTemplateId = this.getActivityTemplateId(payload.jobId);
    let start = payload.start;
    let end = payload.end;
    if (this.isFixedDurationActivity(payload.jobId)) {
      end = new Date(start.getTime() + this.getActivityDurationMinutes(payload.jobId) * 60000);
    }

    if (!this.bookingEligibleResources.some(resource => resource.id === payload.resourceId)) {
      this.setSchedulingError('Choose a compatible resource.', 'Schedule not possible');
      this.clearManualInteractionState();
      return;
    }

    const droppedResource = this.resources.find(r => r.id === payload.resourceId);
    if (!droppedResource) {
      this.setSchedulingError('Choose a compatible resource.', 'Schedule not possible');
      this.clearManualInteractionState();
      return;
    }
    const droppedResourceType = payload.droppedResourceType ?? (droppedResource?.meta as any)?.type;
    const bookingResourceType = droppedResourceType ?? payload.resourceType ?? 'mechanic';
    if (this.hasExistingManualBookingForResourceType(payload.jobId, activeOrderId, bookingResourceType)) {
      this.setSchedulingError(`${this.formatResourceType(bookingResourceType)} is already booked for this job.`, 'Schedule not possible');
      this.clearManualInteractionState();
      return;
    }
    const existingJobBooking = this.bookings.find(b =>
      b.jobId === payload.jobId &&
      (!activeOrderId || b.orderId === activeOrderId)
    );
    // For split jobs, each part gets its own booking set and timing.
    // Only anchor to existing booking for non-split multi-resource jobs.
    const isSplitJob = this.isJobSplit(payload.jobId, activeOrderId);
    const bookingSetId = this.isActivityId(payload.jobId)
      ? undefined
      : isSplitJob
        ? `${activeOrderId ?? 'order'}:${payload.jobId}:${start.getTime()}-${end.getTime()}`
        : existingJobBooking?.bookingSetId ?? `${activeOrderId ?? 'order'}:${payload.jobId}:${start.getTime()}-${end.getTime()}`;
    if (existingJobBooking && !isSplitJob) {
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

    const validationContext = this.buildManualDropContextForPayload(payload, activeOrderId, start, end);
    if (validationContext) {
      const validation = this.validateManualPlacement(validationContext, droppedResource, start, end);
      if (!validation.valid) {
        this.showManualPlanValidationError('Schedule not possible', validation);
        this.clearManualInteractionState();
        return;
      }
    }

    this.clearSchedulingError();
    this.clearManualInteractionState();
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

      // Business rule: when mobility is dropped, snap its span to check-in end -> handover end if both booked
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

  private onDayCapacityDropped(payload: EventDropPayload, activeOrderId: string | undefined): void {
    if (payload.dropType === 'order') {
      this.onOrderDayCapacityDropped(payload, activeOrderId);
      return;
    }

    const droppedResource = this.resources.find(r => r.id === payload.resourceId);
    if (!droppedResource || !this.bookingEligibleResources.some(resource => resource.id === payload.resourceId)) {
      this.setSchedulingError('Choose a compatible resource.', 'Capacity block not possible');
      this.clearManualInteractionState();
      return;
    }

    const droppedResourceType = payload.droppedResourceType ?? (droppedResource?.meta as any)?.type;
    const bookingResourceType = droppedResourceType ?? payload.resourceType ?? 'mechanic';
    const durationMinutes = Math.max(1, Math.round(payload.durationMinutes ?? (payload.end.getTime() - payload.start.getTime()) / 60000));
    const start = this.getDayCapacityStart(payload.date ?? payload.start);
    const end = new Date(start.getTime() + durationMinutes * 60000);
    const validationContext = this.buildManualDropContextForPayload(payload, activeOrderId, start, end);
    if (validationContext) {
      const validation = this.validateManualCapacityPlacement(validationContext, droppedResource, start);
      if (!validation.valid) {
        this.showManualPlanValidationError('Capacity block not possible', validation);
        this.clearManualInteractionState();
        return;
      }
    }

    if (this.hasExistingManualBookingForResourceType(payload.jobId, activeOrderId, bookingResourceType)) {
      this.setSchedulingError(`${this.formatResourceType(bookingResourceType)} is already booked for this job.`, 'Capacity block not possible');
      this.clearManualInteractionState();
      return;
    }

    const activityTemplateId = this.getActivityTemplateId(payload.jobId);
    const order = this.allOrders.find(candidate => candidate.id === activeOrderId);
    const found = this.isActivityId(payload.jobId)
      ? undefined
      : this.allOrders.flatMap((candidate: any) => candidate.jobs).find((job: any) => job.id === payload.jobId);
    const activity = this.getActivityTemplate(activityTemplateId);
    const bookingSetId = this.isActivityId(payload.jobId)
      ? undefined
      : `${activeOrderId ?? 'order'}:${payload.jobId}:capacity:${start.getTime()}-${end.getTime()}`;

    const entry: ScheduleEntry = {
      id: `se-cap-${Date.now()}`,
      jobId: payload.jobId,
      resourceId: payload.resourceId,
      start,
      end,
      title: activity?.title ?? found?.title,
      color: '#4C68B1',
      kind: 'day-capacity',
      workOrderReference: order?.referenceNumber,
      workorderItemStatus: 'scheduled',
      workorderItemCategory: this.isActivityId(payload.jobId) ? 'activity' : 'job',
      bookingSetId,
    };

    this.clearSchedulingError();
    this.clearManualInteractionState();
    this.scheduleRepo.assign(entry).subscribe(assigned => {
      const normalizedEntry = {
        ...assigned,
        kind: 'day-capacity' as const,
        workOrderReference: assigned.workOrderReference ?? order?.referenceNumber,
        workorderItemStatus: assigned.workorderItemStatus ?? 'scheduled' as const,
        workorderItemCategory: assigned.workorderItemCategory ?? (this.isActivityId(payload.jobId) ? 'activity' as const : 'job' as const),
      };
      this.upsertScheduleEntry(normalizedEntry);
      this.capacityBlocks = [
        ...this.capacityBlocks.filter(block => block.id !== normalizedEntry.id),
        this.mapScheduleEntryToCapacityBlock(normalizedEntry),
      ];
    });
  }

  private getDayCapacityStart(value: Date): Date {
    const start = new Date(value);
    start.setHours(9, 0, 0, 0);
    return start;
  }

  private onOrderDayCapacityDropped(payload: EventDropPayload, activeOrderId: string | undefined): void {
    const order = this.allOrders.find(candidate => candidate.id === activeOrderId);
    if (!order) {
      this.setSchedulingError('Order not found.', 'Capacity block not possible');
      this.clearManualInteractionState();
      return;
    }

    const droppedResource = this.resources.find(r => r.id === payload.resourceId);
    if (!droppedResource || !this.bookingEligibleResources.some(resource => resource.id === payload.resourceId)) {
      this.setSchedulingError('Choose a compatible resource.', 'Capacity block not possible');
      this.clearManualInteractionState();
      return;
    }

    const rawDroppedResource = droppedResource.meta as Resource | undefined;
    if (!rawDroppedResource) {
      this.setSchedulingError('Resource not available.', 'Capacity block not possible');
      this.clearManualInteractionState();
      return;
    }

    const dayStart = this.getDayCapacityStart(payload.date ?? payload.start);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(21, 0, 0, 0);

    // Gather all jobs and activities for this order
    const jobs: any[] = order.jobs ?? [];
    const rawResources = this.bookingEligibleResources.map(r => r.meta as Resource).filter(Boolean);

    // Check that dropped resource matches at least one requirement
    const allRequirements = jobs.flatMap((job: any) => this.getSchedulingRequirements(job));
    const droppedResourceMatchesAny = allRequirements.some(req =>
      rawDroppedResource.type === req.resourceType &&
      req.requiredQualifications.every(q => rawDroppedResource.qualifications.some(rq => rq.id === q.id))
    );
    if (!droppedResourceMatchesAny) {
      this.setSchedulingError(`${rawDroppedResource.name} is not compatible with any job in this order.`, 'Capacity block not possible');
      this.clearManualInteractionState();
      return;
    }

    // Track capacity consumed during this operation
    const capacityConsumed = new Map<string, number>(); // resourceId → minutes consumed in this batch

    const getAvailableMinutes = (resourceId: string): number => {
      const usedMinutes = this.getMonthResourceUsedMinutes(resourceId, dayStart, dayEnd, this.scheduleEntries);
      const batchConsumed = capacityConsumed.get(resourceId) ?? 0;
      return Math.max(0, 720 - usedMinutes - batchConsumed);
    };

    const consumeCapacity = (resourceId: string, minutes: number): void => {
      capacityConsumed.set(resourceId, (capacityConsumed.get(resourceId) ?? 0) + minutes);
    };

    // Track consecutive resource preferences per type+qualification
    const consecutiveResourceByKey = new Map<string, string>();

    // Find best resource for a requirement
    const findBestResource = (requirement: JobResourceRequirement, durationMinutes: number, preferredId?: string): Resource | null => {
      // Try preferred (dropped) resource first
      if (preferredId) {
        const preferred = rawResources.find(r => r.id === preferredId);
        if (preferred &&
          preferred.type === requirement.resourceType &&
          requirement.requiredQualifications.every(q => preferred.qualifications.some(rq => rq.id === q.id)) &&
          getAvailableMinutes(preferred.id) >= durationMinutes
        ) {
          return preferred;
        }
      }
      // Try consecutive (same resource as last job for this type)
      const key = `${requirement.resourceType}:${requirement.requiredQualifications.map(q => q.id).sort().join(',')}`;
      const consecutiveId = consecutiveResourceByKey.get(key);
      if (consecutiveId) {
        const consecutive = rawResources.find(r => r.id === consecutiveId);
        if (consecutive && getAvailableMinutes(consecutive.id) >= durationMinutes) {
          return consecutive;
        }
      }
      // Find any compatible resource with capacity
      const candidates = rawResources
        .filter(r =>
          r.type === requirement.resourceType &&
          requirement.requiredQualifications.every(q => r.qualifications.some(rq => rq.id === q.id))
        )
        .sort((a, b) => getAvailableMinutes(b.id) - getAvailableMinutes(a.id));
      return candidates.find(r => getAvailableMinutes(r.id) >= durationMinutes) ?? null;
    };

    // Build capacity entries for each job
    const entriesToBook: ScheduleEntry[] = [];
    const warnings: string[] = [];

    for (const job of jobs) {
      if (this.isActivityId(job.id) || job.workorderItemCategory === 'activity') continue;
      const requirements = this.getSchedulingRequirements(job);
      const durationMinutes = (job.estimatedDurationMinutes ?? job.fru * 60) || 60;
      const bookingSetId = `${order.id}:${job.id}:capacity:${dayStart.getTime()}`;
      let primaryBooked = false;

      for (const requirement of requirements) {
        const resource = findBestResource(requirement, durationMinutes, rawDroppedResource.id);
        if (resource) {
          consumeCapacity(resource.id, durationMinutes);
          const key = `${requirement.resourceType}:${requirement.requiredQualifications.map(q => q.id).sort().join(',')}`;
          consecutiveResourceByKey.set(key, resource.id);
          entriesToBook.push({
            id: `se-cap-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            jobId: job.id,
            resourceId: resource.id,
            start: dayStart,
            end: new Date(dayStart.getTime() + durationMinutes * 60000),
            title: job.title,
            color: '#4C68B1',
            kind: 'day-capacity',
            workOrderReference: order.referenceNumber,
            workorderItemStatus: 'reserved',
            workorderItemCategory: 'job',
            bookingSetId,
          });
          if (resource.type === requirements[0]?.resourceType) primaryBooked = true;
        } else {
          if (requirement === requirements[0]) {
            // Primary resource not available — can't book this job at all
            warnings.push(`${job.title}: no ${this.formatMissingRequirement(requirement)} with capacity.`);
          } else if (primaryBooked) {
            // Secondary resource not available — warn but keep primary
            warnings.push(`${job.title}: ${this.formatMissingRequirement(requirement)} could not be reserved.`);
          }
        }
      }
    }

    // Book activities (Check-In, Handover, Mobility)
    const activityDefs: Array<{ templateId: string; resourceType: ResourceType; label: string }> = [];
    if (this.hasOrderActivity(order, 'act-checkin')) {
      activityDefs.push({ templateId: 'act-checkin', resourceType: 'advisor', label: 'Check-In' });
    }
    if (this.hasOrderActivity(order, 'act-handover')) {
      activityDefs.push({ templateId: 'act-handover', resourceType: 'advisor', label: 'Handover' });
    }
    if (this.hasOrderActivity(order, 'act-mobility')) {
      activityDefs.push({ templateId: 'act-mobility', resourceType: 'driver', label: 'Mobility Service' });
    }

    for (const actDef of activityDefs) {
      const activityId = this.getOrderActivityId(order.id, actDef.templateId);
      const durationMinutes = this.getActivityDurationMinutes(activityId);
      const requirement: JobResourceRequirement = { resourceType: actDef.resourceType, requiredQualifications: [], label: actDef.label };
      const resource = findBestResource(requirement, durationMinutes);
      if (resource) {
        consumeCapacity(resource.id, durationMinutes);
        entriesToBook.push({
          id: `se-cap-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          jobId: activityId,
          resourceId: resource.id,
          start: dayStart,
          end: new Date(dayStart.getTime() + durationMinutes * 60000),
          title: actDef.label,
          color: '#4C68B1',
          kind: 'day-capacity',
          workOrderReference: order.referenceNumber,
          workorderItemStatus: 'reserved',
          workorderItemCategory: 'activity',
        });
      } else {
        warnings.push(`${actDef.label}: no ${actDef.resourceType} with capacity.`);
      }
    }

    if (!entriesToBook.length) {
      this.setSchedulingError('No resources with sufficient capacity for this day.', 'Capacity block not possible');
      this.clearManualInteractionState();
      return;
    }

    this.clearSchedulingError();
    this.clearManualInteractionState();

    if (warnings.length) {
      this.setSchedulingError(warnings.join(' '), 'Partial booking');
    }

    // Persist all entries
    for (const entry of entriesToBook) {
      this.scheduleRepo.assign(entry).subscribe(assigned => {
        const normalizedEntry = {
          ...assigned,
          kind: 'day-capacity' as const,
          workOrderReference: assigned.workOrderReference ?? order.referenceNumber,
          workorderItemStatus: assigned.workorderItemStatus ?? 'reserved' as const,
          workorderItemCategory: assigned.workorderItemCategory ?? 'job' as const,
        };
        this.upsertScheduleEntry(normalizedEntry);
        this.capacityBlocks = [
          ...this.capacityBlocks.filter(block => block.id !== normalizedEntry.id),
          this.mapScheduleEntryToCapacityBlock(normalizedEntry),
        ];
      });
    }
  }


  onUndoBooking(booking: JobBooking): void {
    const event = this.events.find(candidate => candidate.id === booking.entryId);
    const capacityBlock = this.capacityBlocks.find(candidate => candidate.id === booking.entryId);
    const removedEntry = (event?.meta?.entry ?? capacityBlock?.meta?.entry) as ScheduleEntry | undefined;
    const orderToReveal = removedEntry ? this.findOrderForScheduleEntry(removedEntry) : null;
    const resourceId = event?.resourceId ?? capacityBlock?.resourceId;
    if (resourceId && this.plannerMode === 'order') {
      this.pinVisibleResource(resourceId);
    }
    this.scheduleRepo.unassign(booking.entryId).subscribe(() => {
      this.removeScheduleEntriesById([booking.entryId]);
      this.latestAutoBookingEntryIds.delete(booking.entryId);
      this.refreshWorkOrderItemStatusForEntry(removedEntry);
      if (this.latestAutoBookingEntryIds.size === 0) {
        this.isAutoProposalVisible = false;
      }
      this.revealOrderInPanel(orderToReveal);
    });
  }

  onUndoOrderBooking(order: any): void {
    const targetOrder = this.allOrders.find(candidate => candidate.id === order.id || candidate.referenceNumber === order.referenceNumber) ?? order;
    const orderEntryIds = new Set(this.allScheduleEntries
      .filter(entry => this.isEntryForOrder(entry, targetOrder))
      .map(entry => entry.id));
    if (orderEntryIds.size === 0) return;

    orderEntryIds.forEach(entryId => this.scheduleRepo.unassign(entryId).subscribe());
    const removedEntries = this.removeScheduleEntriesById(orderEntryIds);
    orderEntryIds.forEach(entryId => this.latestAutoBookingEntryIds.delete(entryId));
    this.refreshWorkOrderItemStatusesForEntries(removedEntries);
    if (this.latestAutoBookingEntryIds.size === 0) {
      this.isAutoProposalVisible = false;
    }
    this.revealOrderInPanel(targetOrder);
  }

  private revealOrderInPanel(order: any | null | undefined): void {
    if (!order) return;
    this.selectedPanelOrderId = order.id;
    this.expandedOrderIds = new Set([...this.expandedOrderIds, order.id]);
    const state = this.getOrderPlanningState(order);
    const targetGroup: OrderPanelGroup = state === 'reserved' || state === 'scheduled' || state === 'in-progress' || state === 'completed'
      ? state
      : 'pending';
    this.collapsedOrderGroups = new Set([...this.collapsedOrderGroups].filter(group => group !== targetGroup));
    if (this.isFullPlanner() && !this.isOrderPanelOpen) {
      this.isOrderPanelOpen = true;
    }

    setTimeout(() => {
      document.getElementById(`order-panel-card-${order.id}`)?.scrollIntoView({ block: 'center', inline: 'nearest' });
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
      const normalizedSibling = { ...sibling, bookingSetId: originalSetId, splitRootId: originalSetId };

      this.scheduleRepo.reschedule(sibling.id, originalStart, midpoint).subscribe(updated => {
        const firstHalf = { ...updated, bookingSetId: originalSetId, splitRootId: originalSetId, splitSequence: 1 };
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
          splitRootId: originalSetId,
          splitParentBookingSetId: originalSetId,
          splitSequence: 2,
        };

        this.scheduleRepo.assign(secondHalf).subscribe(assigned => {
          const assignedEntry = {
            ...assigned,
            bookingSetId: splitSetId,
            splitRootId: originalSetId,
            splitParentBookingSetId: originalSetId,
            splitSequence: 2,
          };
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
    const searchFrom = this.getBookableSearchStart(new Date(this.viewStart.getFullYear(), this.viewStart.getMonth(),
                                this.viewStart.getDate(), 9, 30, 0, 0));
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
    const nextSearchFrom = this.getBookableSearchStart(new Date(currentProposalEnd.getTime() + 15 * 60000));
    this.applyProposal(nextSearchFrom, false);
  }

  onBookPrevious(): void {
    if (this.currentProposalIndex <= 0) return;
    this.currentProposalIndex--;
    const searchFrom = this.proposalHistory[this.currentProposalIndex];
    this.clearCurrentBookings(this.getActiveWorkOrderId() ?? undefined);
    this.applyProposal(searchFrom, false, true);
  }

  private applyProposal(
    searchFrom: Date,
    resetHistory: boolean,
    isReplay = false,
    options: { orderId?: string; preferredResourceIds?: string[]; scrollToFirstEntry?: boolean; revealOrder?: boolean } = {},
  ): void {
    searchFrom = this.getBookableSearchStart(searchFrom);
    const targetWorkOrderId = options.orderId ?? this.getActiveWorkOrderId();
    const unscheduledTiles = this.jobTiles.filter(t => t.workOrder.id === targetWorkOrderId);
    const targetOrder = this.allOrders.find(order => order.id === targetWorkOrderId);
    const unscheduledJobs = unscheduledTiles.length
      ? unscheduledTiles.map(t => t.job)
      : targetOrder ? this.getJobsForOrder(targetOrder) : [];
    if (unscheduledJobs.length === 0) return;

    const rawResources = this.bookingEligibleResources.map(r => r.meta as Resource).filter(Boolean);
    const selectedResourceConstraint = this.getSelectedResourceConstraintContext(
      unscheduledJobs,
      rawResources,
      options.preferredResourceIds ?? [],
      targetOrder,
    );
    const requiredResourceIds = selectedResourceConstraint.requiredResourceIds;
    const selectedResourceErrors = this.getSelectedResourceConstraintErrors(unscheduledJobs, rawResources, requiredResourceIds, targetOrder);
    if (selectedResourceErrors.length) {
      this.setSchedulingError(selectedResourceErrors.join(' '));
      return;
    }
    const missingRequirements = this.getMissingRequirementsForResources(unscheduledJobs, rawResources, targetOrder);
    if (missingRequirements.length) {
      this.setSchedulingError(this.buildMissingResourceMessage(missingRequirements));
      return;
    }

    const existingEntries = this.getOccupyingEntriesForProposal(targetOrder);

    const result = this.autoScheduler.schedule({
      jobs: unscheduledJobs,
      resources: rawResources,
      preferredResourceIds: options.preferredResourceIds ?? [],
      preferredActivityResourceIds: this.getPreferredAdvisorActivityResourceIds(rawResources),
      requiredResourceIds,
      existingEntries,
      unavailability: this.unavailability,
      searchFrom,
      dayStartHour: 9,
      dayEndHour: 21,
      requiresMobility: this.requiresMobility(targetOrder),
      bookingWindow: this.autoBookingWindow ?? undefined,
    });

    if (!result) {
      this.setSchedulingError(this.autoBookingWindow
        ? 'Schedule not possible within selected time range.'
        : selectedResourceConstraint.hasRelevantSelection
          ? 'Schedule not possible with the selected resources. Change the selection or choose another availability.'
          : 'Schedule not possible with the visible resources. Add resources to the view/type filter or choose another availability.');
      return;
    }

    const unbookedSelectedResourceNames = this.getUnbookedRequiredResourceNames(requiredResourceIds, result, rawResources);
    if (unbookedSelectedResourceNames.length) {
      this.setSchedulingError(`Schedule not possible with selected resources: ${unbookedSelectedResourceNames.join(', ')} could not be booked.`);
      return;
    }

    const checkinStart = new Date(result.checkinStart);
    const checkinEnd = new Date(result.checkinEnd);
    const handoverStart = new Date(result.handoverStart);
    const handoverEnd = new Date(result.handoverEnd);
    const currentViewMode = this.plannerViewMode;
    const visibleRangeAtProposal = { start: new Date(this.viewStart), end: new Date(this.viewEnd) };

    const checkinAdvisor = rawResources.find((r: any) => r.id === result.checkinResourceId);
    const handoverAdvisor = rawResources.find((r: any) => r.id === result.handoverResourceId);
    const mobilityDriver = rawResources.find((r: any) => r.id === result.mobilityResourceId);
    const needsMobility = this.requiresMobility(targetOrder);

    if (!checkinAdvisor || !handoverAdvisor || (needsMobility && !mobilityDriver)) {
      this.setSchedulingError(this.buildMissingResourceMessage([
        ...(!checkinAdvisor ? ['Service Advisor for Check-In'] : []),
        ...(!handoverAdvisor ? ['Service Advisor for Handover'] : []),
        ...(needsMobility && !mobilityDriver ? ['Courtesy Car for Mobility Service'] : []),
      ]));
      return;
    }

    this.clearSchedulingError();

    const isReplacingFocusedOrder = !!targetOrder && this.fullPlannerOrderOnlyId === targetOrder.id;
    this.isReplacingFocusedOrderBookings = isReplacingFocusedOrder;
    if (targetOrder) this.clearExistingScheduleEntriesForOrder(targetOrder);
    this.clearCurrentBookings(targetWorkOrderId ?? undefined);
    this.isReplacingFocusedOrderBookings = false;

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
    const shouldScrollToFirstEntry = options.scrollToFirstEntry ?? true;
    const scrollTargetEntryId = shouldScrollToFirstEntry ? result.entries[0]?.id : undefined;
    this.autoBookingRangeNotice = this.buildAutoBookingRangeNotice(result, visibleRangeAtProposal, currentViewMode, scrollTargetEntryId);
    const proposalFocusIds: string[] = [];
    const expectedProposalFocusCount = result.entries.length
      + (targetOrder && this.hasOrderActivity(targetOrder, 'act-checkin') ? 1 : 0)
      + (targetOrder && this.hasOrderActivity(targetOrder, 'act-handover') ? 1 : 0)
      + (targetOrder && needsMobility && mobilityDriver ? 1 : 0);
    const focusInRangeProposal = (): void => {
      if (!shouldScrollToFirstEntry || this.autoBookingRangeNotice) return;
      if (proposalFocusIds.length !== expectedProposalFocusCount) return;
      this.focusPlannerEvents(proposalFocusIds, { pulse: !this.shouldSuppressAutoBookingFocusPulse() });
    };
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
        proposalFocusIds.push(assigned.id);
        focusInRangeProposal();
      });
    });

    if (targetOrder) {
      if (this.hasOrderActivity(targetOrder, 'act-checkin')) {
        this.bookActivity(this.getOrderActivityId(targetWorkOrderId, 'act-checkin'), checkinAdvisor, checkinStart, checkinEnd, targetWorkOrderId ?? undefined, assigned => {
          proposalFocusIds.push(assigned.id);
          focusInRangeProposal();
        });
      }
      if (this.hasOrderActivity(targetOrder, 'act-handover')) {
        this.bookActivity(this.getOrderActivityId(targetWorkOrderId, 'act-handover'), handoverAdvisor, handoverStart, handoverEnd, targetWorkOrderId ?? undefined, assigned => {
          proposalFocusIds.push(assigned.id);
          focusInRangeProposal();
        });
      }
      if (needsMobility && mobilityDriver) {
        this.bookActivity(this.getOrderActivityId(targetWorkOrderId, 'act-mobility'), mobilityDriver, checkinEnd, handoverEnd, targetWorkOrderId ?? undefined, assigned => {
          proposalFocusIds.push(assigned.id);
          focusInRangeProposal();
        });
      }
    }
    if (targetWorkOrderId) {
      this.syncOrderAppointment(targetWorkOrderId, checkinStart, handoverEnd);
    }
    if (options.revealOrder !== false) this.revealOrderInPanel(targetOrder);
  }

  private getActiveWorkOrderId(): string | null {
    return this.selectedPanelOrderId || this.activeOrderId || this.jobTiles[0]?.workOrder.id || null;
  }

  private getPreferredAdvisorActivityResourceIds(resources: Resource[]): string[] {
    if (!this.optimizeAdvisorActivityBookingForPersonalCalendar || !this.viewPersonalCalendarOnTop) return [];
    const advisorId = this.loggedInAdvisorResourceId;
    return resources.some(resource => resource.id === advisorId && resource.type === 'advisor') ? [advisorId] : [];
  }

  private setFocusedPlanningOrder(order: any | null | undefined): void {
    this.focusedPlanningOrderId = order?.id ?? '';
  }

  private getFocusedPlanningOrder(): any | null {
    const focusedOrderId = this.plannerMode === 'order'
      ? this.activeOrderId
      : this.getFullPlannerFocusedOrder()?.id ?? this.focusedPlanningOrderId;
    if (!focusedOrderId) return null;
    return this.allOrders.find(candidate => candidate.id === focusedOrderId || candidate.referenceNumber === focusedOrderId) ?? null;
  }

  private isEventForOrder(event: SchedulerEvent, order: any): boolean {
    return event.meta?.entry?.workOrderReference === order.referenceNumber
      || (event.meta as any)?.order?.id === order.id
      || (event.meta as any)?.order?.referenceNumber === order.referenceNumber;
  }

  private alignViewWindowToOrder(order: any | undefined, mode: PlannerViewMode = this.plannerViewMode): void {
    const selection = order ? this.quickViewSelection.getSelection(order.id) : null;
    const anchor = selection?.checkinStart ?? order?.appointmentStart;
    this.setViewWindowForMode(mode, anchor ? new Date(anchor) : this.viewStart);
  }

  private setViewWindowForMode(mode: PlannerViewMode, anchor: Date): void {
    const start = new Date(anchor);
    start.setHours(9, 0, 0, 0);
    const end = new Date(start);
    if (mode === 'free') {
      const windowStart = this.getFreeViewWindowStart(anchor);
      this.viewStart = windowStart;
      this.viewEnd = this.getFreeViewWindowEnd(windowStart);
      return;
    }
    if (mode === 'week') {
      const day = start.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      start.setDate(start.getDate() + diff);
      start.setHours(9, 0, 0, 0);
      end.setTime(start.getTime());
      end.setDate(start.getDate() + 4);
    } else if (mode === 'month') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setFullYear(start.getFullYear(), start.getMonth() + 1, 0);
    } else {
      this.moveToNearestWorkday(start, 1);
      end.setTime(start.getTime());
    }
    end.setHours(21, 0, 0, 0);
    this.viewStart = start;
    this.viewEnd = end;
  }

  private buildAutoBookingRangeNotice(
    result: AutoScheduleResult,
    visibleRange: { start: Date; end: Date },
    mode: PlannerViewMode,
    targetEventId?: string,
  ): AutoBookingRangeNotice | null {
    if (mode === 'month') return null;

    const scheduledDates = [
      result.checkinStart,
      result.checkinEnd,
      result.handoverStart,
      result.handoverEnd,
      ...result.entries.flatMap(entry => [entry.start, entry.end]),
    ].map(date => new Date(date));

    const outsideDates = scheduledDates.filter(date =>
      date < visibleRange.start || date > visibleRange.end
    );
    if (!outsideDates.length) return null;

    outsideDates.sort((first, second) => first.getTime() - second.getTime());
    const targetDate = new Date(outsideDates[0]);
    const periodLabel = mode === 'week' || mode === 'free' ? 'week' : 'day';
    const targetLabel = mode === 'week' || mode === 'free'
      ? 'next available week'
      : outsideDates.some(date => !this.isSameCalendarDay(date, visibleRange.start))
        ? 'next available day'
        : 'next available time period';

    return {
      title: 'Auto booking adjusted',
      message: `Part of this order could not be scheduled in the current ${periodLabel} and was placed in the ${targetLabel}.`,
      targetDate,
      targetEventId,
    };
  }

  private shiftPlannerWindow(direction: -1 | 1): void {
    this.autoBookingRangeNotice = null;
    const anchor = new Date(this.viewStart);
    if (this.plannerViewMode === 'free') {
      this.loadAdjacentFreeTimeline(direction < 0 ? 'previous' : 'next');
      return;
    }
    if (this.plannerViewMode === 'week') {
      anchor.setDate(anchor.getDate() + direction * 7);
    } else if (this.plannerViewMode === 'month') {
      anchor.setMonth(anchor.getMonth() + direction);
    } else {
      this.moveToAdjacentWorkday(anchor, direction);
    }
    this.setViewWindowForMode(this.plannerViewMode, anchor);
    this.reloadScheduleEntries();
  }

  private reloadScheduleEntries(focusEventId?: string): void {
    this.scheduleRepo.getEntries(this.viewStart, this.viewEnd).subscribe(entries => {
      this.applyScheduleEntries(entries);
      if (focusEventId) {
        this.focusPlannerEvent(focusEventId);
      }
    });
  }

  private loadAdjacentFreeTimeline(direction: 'previous' | 'next'): void {
    if (this.isFreeTimelineLoading) return;
    this.isFreeTimelineLoading = true;
    const range = this.getFreeViewLazyRange(direction);
    this.scheduleRepo.getEntries(range.start, range.end).subscribe({
      next: entries => {
        const nextStart = direction === 'previous' ? range.start : this.viewStart;
        const nextEnd = direction === 'next' ? range.end : this.viewEnd;
        this.viewStart = nextStart;
        this.viewEnd = nextEnd;
        this.applyScheduleEntries([...entries, ...this.scheduleEntries]);
      },
      complete: () => {
        this.isFreeTimelineLoading = false;
      },
      error: () => {
        this.isFreeTimelineLoading = false;
      },
    });
  }

  private loadMonthPreviewEntries(): void {
    if (!this.selectedMonthPreviewDate) {
      this.monthPreviewEntries = [];
      return;
    }
    const dayStart = this.getDayBoundary(this.selectedMonthPreviewDate, 0, 0);
    const dayEnd = this.getDayBoundary(this.selectedMonthPreviewDate, 23, 59);
    dayEnd.setSeconds(59, 999);
    this.scheduleRepo.getEntries(dayStart, dayEnd).subscribe(entries => {
      this.monthPreviewEntries = entries;
    });
  }

  private getMonthPreviewEntriesForSelectedDate(): ScheduleEntry[] {
    if (!this.selectedMonthPreviewDate) return [];
    return this.getScheduleEntriesForDay(this.selectedMonthPreviewDate, this.monthPreviewEntries);
  }

  private getScheduleEntriesForDay(day: Date, additionalEntries: ScheduleEntry[] = []): ScheduleEntry[] {
    const dayStart = this.getDayBoundary(day, 0, 0);
    const dayEnd = this.getDayBoundary(day, 23, 59);
    dayEnd.setSeconds(59, 999);
    const byId = new Map<string, ScheduleEntry>();

    [...additionalEntries, ...this.scheduleEntries]
      .filter(entry => entry.start <= dayEnd && entry.end >= dayStart)
      .forEach(entry => byId.set(entry.id, entry));

    return Array.from(byId.values());
  }


  private getMonthPreviewRangeStyle(start: Date, end: Date): Record<string, string> {
    if (!this.selectedMonthPreviewDate) return {};
    const dayStart = this.getDayBoundary(this.selectedMonthPreviewDate, 9, 0);
    const dayEnd = this.getDayBoundary(this.selectedMonthPreviewDate, 21, 0);
    const clippedStart = Math.max(start.getTime(), dayStart.getTime());
    const clippedEnd = Math.min(end.getTime(), dayEnd.getTime());
    const totalMs = dayEnd.getTime() - dayStart.getTime();
    const left = ((clippedStart - dayStart.getTime()) / totalMs) * 100;
    const width = Math.max(((clippedEnd - clippedStart) / totalMs) * 100, 2);
    return {
      left: `${left}%`,
      width: `${width}%`,
    };
  }

  private getDayBoundary(date: Date, hour: number, minute: number): Date {
    const boundary = new Date(date);
    boundary.setHours(hour, minute, 0, 0);
    return boundary;
  }

  private isSameCalendarDay(first: Date, second: Date): boolean {
    return first.getFullYear() === second.getFullYear() &&
      first.getMonth() === second.getMonth() &&
      first.getDate() === second.getDate();
  }

  private moveToAdjacentWorkday(date: Date, direction: -1 | 1): void {
    do {
      date.setDate(date.getDate() + direction);
    } while (!this.isWorkday(date));
  }

  private moveToNearestWorkday(date: Date, direction: -1 | 1): void {
    while (!this.isWorkday(date)) {
      date.setDate(date.getDate() + direction);
    }
  }

  private isWorkday(date: Date): boolean {
    const day = date.getDay();
    return day >= 1 && day <= 5;
  }

  private isSameCalendarWeek(first: Date, second: Date): boolean {
    return first.getFullYear() === second.getFullYear() &&
      this.getCalendarWeek(first) === this.getCalendarWeek(second);
  }

  private getCalendarWeek(date: Date): number {
    const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = target.getUTCDay() || 7;
    target.setUTCDate(target.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
    return Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  private formatShortDate(date: Date): string {
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }

  private formatLongDate(date: Date): string {
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  private applyQuickViewSelection(): void {
    const activeOrderId = this.getActiveWorkOrderId();
    if (!activeOrderId) return;
    const order = this.allOrders.find(candidate => candidate.id === activeOrderId || candidate.referenceNumber === activeOrderId);
    if (!order) return;
    const selection = this.quickViewSelection.getSelection(order.id);
    if (!selection?.checkinStart || !selection.handoverEnd) return;
    this.alignViewWindowToOrder(order, this.plannerViewMode);
    this.syncOrderAppointment(order.id, selection.checkinStart, selection.handoverEnd);
    this.scheduleRepo.getEntries(this.viewStart, this.viewEnd).subscribe(entries => {
      this.applyScheduleEntries(entries);
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

  private scrollToActiveOrderBooking(): void {
    if (this.plannerMode !== 'order') return;
    const activeOrderId = this.getActiveWorkOrderId();
    if (!activeOrderId) return;
    const firstBooking = this.events
      .filter(event => this.isEventForActiveWorkOrder(event))
      .sort((first, second) => first.start.getTime() - second.start.getTime())[0];
    if (!firstBooking) return;
    this.focusPlannerEvent(firstBooking.id);
  }

  private getBookableSearchStart(candidate: Date): Date {
    return candidate < this.currentPlannerTime ? new Date(this.currentPlannerTime) : new Date(candidate);
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

  private getSelectedResourceConstraintContext(
    jobs: any[],
    resources: Resource[],
    additionalResourceIds: string[],
    order: any | undefined,
  ): SelectedResourceConstraintContext {
    const visibleResourceIds = new Set(resources.map(resource => resource.id));
    const requirements = [
      ...jobs.flatMap(job => this.getSchedulingRequirements(job)),
      ...this.getRequiredActivityRequirements(order, resources),
    ];
    const relevantSelectedResourceIds = this.selectedResourceIds.filter(resourceId => {
      const resource = resources.find(candidate => candidate.id === resourceId);
      return !!resource && requirements.some(requirement => this.hasMatchingResource([resource], requirement));
    });
    const requiredResourceIds = [...new Set([...relevantSelectedResourceIds, ...additionalResourceIds])]
      .filter(resourceId => visibleResourceIds.has(resourceId));

    return {
      requiredResourceIds,
      hasRelevantSelection: relevantSelectedResourceIds.length > 0 || additionalResourceIds.some(resourceId => visibleResourceIds.has(resourceId)),
    };
  }

  private getSelectedResourceConstraintErrors(
    jobs: any[],
    resources: Resource[],
    requiredResourceIds: string[],
    order: any | undefined,
  ): string[] {
    if (!requiredResourceIds.length) return [];

    const requiredResources = requiredResourceIds
      .map(resourceId => resources.find(resource => resource.id === resourceId))
      .filter((resource): resource is Resource => !!resource);
    const errors: string[] = [];
    const requirements = [
      ...jobs.flatMap(job => this.getSchedulingRequirements(job)),
      ...this.getRequiredActivityRequirements(order, resources),
    ];

    for (const resource of requiredResources) {
      if (!requirements.some(requirement => this.hasMatchingResource([resource], requirement))) {
        errors.push(`${resource.name} cannot satisfy any requirement for this booking.`);
      }
    }

    for (const requirement of requirements) {
      const selectedMatches = requiredResources.filter(resource => this.hasMatchingResource([resource], requirement));
      const visibleMatches = resources.filter(resource => this.hasMatchingResource([resource], requirement));
      if (selectedMatches.length > visibleMatches.length) {
        errors.push(`Too many selected resources for ${this.formatMissingRequirement(requirement)}.`);
      }
    }

    return [...new Set(errors)];
  }

  private getUnbookedRequiredResourceNames(requiredResourceIds: string[], result: any, resources: Resource[]): string[] {
    const bookedResourceIds = new Set<string>([
      result.checkinResourceId,
      result.handoverResourceId,
      result.mobilityResourceId,
      ...result.entries.map((entry: ScheduleEntry) => entry.resourceId),
    ].filter(Boolean));

    return requiredResourceIds
      .filter(resourceId => !bookedResourceIds.has(resourceId))
      .map(resourceId => resources.find(resource => resource.id === resourceId)?.name ?? resourceId);
  }

  private getRequiredActivityRequirements(order: any | undefined, resources: Resource[]): JobResourceRequirement[] {
    const requirements: JobResourceRequirement[] = [];
    if (!order) return requirements;
    if (this.hasOrderActivity(order, 'act-checkin')) {
      requirements.push({ resourceType: 'advisor', requiredQualifications: [], label: 'Service Advisor for Check-In' });
    }
    if (this.hasOrderActivity(order, 'act-handover')) {
      requirements.push({ resourceType: 'advisor', requiredQualifications: [], label: 'Service Advisor for Handover' });
    }
    if (this.hasOrderActivity(order, 'act-mobility') && resources.some(resource => resource.type === 'driver')) {
      requirements.push({ resourceType: 'driver', requiredQualifications: [], label: 'Courtesy Car for Mobility Service' });
    }
    return requirements;
  }

  private requiresMobility(order: any | undefined): boolean {
    return !!order && this.hasOrderActivity(order, 'act-mobility');
  }

  private getSchedulingRequirements(job: any): JobResourceRequirement[] {
    if (job.resourceRequirements?.length) return job.resourceRequirements;
    return [{
      resourceType: job.requiredResourceType,
      requiredQualifications: job.requiredQualifications ?? [],
      label: job.requiredResourceType,
    }];
  }

  private buildOrderDragContext(order: any): ManualDragContext | null {
    const durationFru = this.getOrderPlanningState(order) === 'partiallyScheduled'
      ? this.getRemainingOrderFru(order)
      : this.getOrderFru(order);
    return {
      kind: 'order',
      orderId: order.id,
      durationMinutes: Math.max(1, durationFru * MINUTES_PER_FRU),
      requirements: this.getAllOrderSchedulingRequirements(order),
    };
  }

  private getAllOrderSchedulingRequirements(order: any): JobResourceRequirement[] {
    const jobs: any[] = order?.jobs ?? [];
    const seen = new Set<string>();
    const result: JobResourceRequirement[] = [];
    for (const job of jobs) {
      for (const req of this.getSchedulingRequirements(job)) {
        const key = `${req.resourceType}:${req.requiredQualifications.map(q => q.id).sort().join(',')}`;
        if (!seen.has(key)) {
          seen.add(key);
          result.push(req);
        }
      }
    }
    return result;
  }

  private buildJobDragContext(job: any, order: any): ManualDragContext {
    const anchor = this.getExistingJobPlacementAnchor(job.id, order.id);
    return {
      kind: 'job',
      orderId: order.id,
      itemId: job.id,
      durationMinutes: this.getJobFru(job) * MINUTES_PER_FRU,
      requirements: this.getSchedulingRequirements(job),
      anchoredStart: anchor?.start,
      anchoredEnd: anchor?.end,
    };
  }

  private getExistingJobPlacementAnchor(jobId: string, orderId?: string): { start: Date; end: Date } | null {
    // Split jobs don't anchor — each part can be placed independently.
    if (this.isJobSplit(jobId, orderId)) return null;

    const existingBooking = this.bookings.find(booking =>
      booking.jobId === jobId &&
      (!orderId || booking.orderId === orderId)
    );
    if (!existingBooking) return null;

    const existingEvent = this.events.find(event => event.id === existingBooking.entryId);
    return existingEvent ? { start: existingEvent.start, end: existingEvent.end } : null;
  }

  private buildActivityDragContext(activity: ActivityTile, order: any): ManualDragContext {
    return {
      kind: 'activity',
      orderId: order.id,
      itemId: activity.id,
      activityTemplateId: this.getActivityTemplateId(activity.id),
      durationMinutes: this.getActivityFru(activity) * MINUTES_PER_FRU,
      requirements: [{
        resourceType: activity.resourceType as Resource['type'],
        requiredQualifications: [],
        label: activity.resourceLabel,
      }],
    };
  }

  private buildManualDropContextForPayload(
    payload: EventDropPayload,
    activeOrderId: string | undefined,
    start: Date,
    end: Date,
  ): ManualDragContext | null {
    if (!this.isActivityId(payload.jobId)) {
      const order = this.allOrders.find(candidate => candidate.id === activeOrderId || candidate.referenceNumber === activeOrderId);
      const job = order?.jobs?.find((candidate: any) => candidate.id === payload.jobId)
        ?? this.allOrders.flatMap((candidate: any) => candidate.jobs).find((candidate: any) => candidate.id === payload.jobId);
      if (!job) return this.manualDragContext;
      return {
        kind: 'job',
        orderId: order?.id ?? activeOrderId,
        itemId: payload.jobId,
        durationMinutes: Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000)),
        requirements: this.getSchedulingRequirements(job),
      };
    }

    const activityTemplateId = this.getActivityTemplateId(payload.jobId);
    const activity = this.getActivityTemplate(activityTemplateId);
    const droppedResource = this.resources.find(resource => resource.id === payload.resourceId)?.meta as Resource | undefined;
    return {
      kind: 'activity',
      orderId: activeOrderId,
      itemId: payload.jobId,
      activityTemplateId,
      durationMinutes: Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000)),
      requirements: [{
        resourceType: (activity?.resourceType ?? droppedResource?.type ?? payload.resourceType ?? 'mechanic') as Resource['type'],
        requiredQualifications: [],
        label: activity?.resourceLabel ?? droppedResource?.type ?? payload.resourceType,
      }],
    };
  }

  private buildPlacedEventDragContext(event: SchedulerEvent): ManualDragContext | null {
    const entry = event.meta?.entry;
    const order = this.findOrderForEvent(event);
    const orderId = order?.id ?? entry?.workOrderReference;
    const durationMinutes = Math.max(1, Math.round((event.end.getTime() - event.start.getTime()) / 60000));

    if (this.isJobEvent(event)) {
      const job = event.meta?.job ?? order?.jobs?.find((candidate: any) => candidate.id === entry?.jobId);
      return {
        kind: 'job',
        orderId,
        itemId: entry?.jobId ?? event.meta?.job?.id,
        entryId: event.id,
        durationMinutes,
        requirements: job ? this.getSchedulingRequirements(job) : [this.getScheduledRequirementFromEvent(event)].filter((requirement): requirement is JobResourceRequirement => !!requirement),
      };
    }

    if (!this.isJobEvent(event) && this.isActivityEvent(event)) {
      const activityEvent = event as SchedulerEvent;
      const activityTemplateId = this.getActivityTemplateId(entry?.jobId ?? '');
      const activity = this.getActivityTemplate(activityTemplateId);
      const rawResource = this.resources.find(resource => resource.id === activityEvent.resourceId)?.meta as Resource | undefined;
      return {
        kind: 'activity',
        orderId,
        itemId: entry?.jobId,
        entryId: activityEvent.id,
        activityTemplateId,
        durationMinutes,
        requirements: [{
          resourceType: (activity?.resourceType ?? rawResource?.type ?? 'mechanic') as Resource['type'],
          requiredQualifications: [],
          label: activity?.resourceLabel ?? rawResource?.type,
        }],
      };
    }

    return null;
  }

  private buildCapacityBlockDragContext(block: SchedulerCapacityBlock): ManualDragContext | null {
    const entry = block.meta?.entry;
    if (!entry) return null;
    const order = this.findOrderForScheduleEntry(entry);
    const orderId = order?.id ?? entry.workOrderReference;
    const durationMinutes = block.durationMinutes;
    const isActivityEntry = this.isActivityScheduleEntry(entry);

    if (!isActivityEntry) {
      const job = block.meta?.job ?? order?.jobs?.find((candidate: any) => candidate.id === entry.jobId);
      return {
        kind: 'job',
        orderId,
        itemId: entry.jobId,
        entryId: block.id,
        durationMinutes,
        requirements: job ? this.getSchedulingRequirements(job) : [this.getScheduledRequirementFromEntry(entry)].filter((requirement): requirement is JobResourceRequirement => !!requirement),
      };
    }

    const activityTemplateId = this.getActivityTemplateId(entry.jobId);
    const activity = this.getActivityTemplate(activityTemplateId);
    const rawResource = this.resources.find(resource => resource.id === block.resourceId)?.meta as Resource | undefined;
    return {
      kind: 'activity',
      orderId,
      itemId: entry.jobId,
      entryId: block.id,
      activityTemplateId,
      durationMinutes,
      requirements: [{
        resourceType: (activity?.resourceType ?? rawResource?.type ?? 'mechanic') as Resource['type'],
        requiredQualifications: [],
        label: activity?.resourceLabel ?? rawResource?.type,
      }],
    };
  }

  private hasExistingManualBookingForResourceType(
    jobId: string,
    orderId: string | undefined,
    resourceType: string,
  ): boolean {
    if (this.isActivityId(jobId)) return false;

    const matchingBookings = this.bookings.filter(booking =>
      booking.jobId === jobId &&
      booking.resourceType === resourceType &&
      (!orderId || booking.orderId === orderId)
    );
    if (!matchingBookings.length) return false;

    // Split jobs allow multiple bookings of the same resource type (one per split part).
    // Only block if all split parts already have a booking of this type.
    if (this.isJobSplit(jobId, orderId)) {
      const splitPartCount = this.getSplitPartCount(jobId, orderId);
      return matchingBookings.length >= splitPartCount;
    }

    return true;
  }

  /** Returns true if the given job has been split into multiple parts. */
  private isJobSplit(jobId: string, orderId?: string): boolean {
    return this.allScheduleEntries.some(entry =>
      entry.jobId === jobId &&
      (!orderId || entry.workOrderReference === this.getOrderReference(orderId) || entry.workOrderReference === orderId) &&
      this.isSplitScheduleEntry(entry)
    );
  }

  /** Returns the number of distinct split parts for a given job. */
  private getSplitPartCount(jobId: string, orderId?: string): number {
    const entries = this.allScheduleEntries.filter(entry =>
      entry.jobId === jobId &&
      (!orderId || entry.workOrderReference === this.getOrderReference(orderId) || entry.workOrderReference === orderId) &&
      this.isSplitScheduleEntry(entry)
    );
    // Count distinct booking set IDs — each represents a split part
    const distinctSetIds = new Set(entries.map(entry => this.getEntryBookingSetId(entry)));
    return Math.max(distinctSetIds.size, 1);
  }

  private isExternalJobAlreadyBookedForResourceType(
    context: ManualDragContext,
    resourceType: string,
  ): boolean {
    if (context.entryId || context.kind !== 'job' || !context.itemId) return false;
    return this.hasExistingManualBookingForResourceType(context.itemId, context.orderId, resourceType);
  }

  private registerManualDragEnd(): void {
    window.addEventListener('dragend', () => {
      this.clearManualInteractionState();
    }, { once: true });
  }

  private setManualDragPointerOffset(event: DragEvent): void {
    if (!this.manualDragContext) return;
    const target = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    const rect = target?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const offsetRatio = Math.max(0, Math.min((event.clientX - rect.left) / rect.width, 1));
    this.manualDragContext.pointerOffsetMinutes = Math.round(this.manualDragContext.durationMinutes * offsetRatio);
  }

  private clearManualInteractionState(): void {
    this.manualDragContext = null;
    this.manualResizeContext = null;
    this.manualResizeResourceId = null;
  }

  private buildManualDropInvalidRanges(context: ManualDragContext): SchedulerInvalidDropRange[] {
    const ranges: SchedulerInvalidDropRange[] = [];

    for (const resource of this.visibleSchedulerResources) {
      const rawResource = resource.meta as Resource | undefined;
      const primaryRequirement = rawResource ? this.getRequirementForResource(context.requirements, rawResource) : null;

      if (
        !rawResource ||
        !primaryRequirement ||
        !this.hasMatchingResource([rawResource], primaryRequirement) ||
        this.isExternalJobAlreadyBookedForResourceType(context, rawResource.type)
      ) {
        this.addVisibleWorkingRanges(ranges, resource.id);
        continue;
      }

      this.addManualSequenceBlockedRanges(ranges, context, resource.id);
      this.addManualResourceBlockedRanges(ranges, context, resource.id);
      this.addManualVehicleBlockedRanges(ranges, context, resource.id);

      if (context.kind === 'job') {
        this.addManualOtherRequirementBlockedRanges(ranges, context, primaryRequirement, resource.id);
      }
    }

    return this.mergeInvalidDropRanges(ranges);
  }

  private addVisibleWorkingRanges(ranges: SchedulerInvalidDropRange[], resourceId: string): void {
    for (const { start, end } of this.getVisibleWorkingDayRanges()) {
      ranges.push({ resourceId, start, end });
    }
  }

  private addManualSequenceBlockedRanges(
    ranges: SchedulerInvalidDropRange[],
    context: ManualDragContext,
    resourceId: string,
  ): void {
    if (!context.orderId) return;

    const checkinEnd = this.getCheckinEndForOrder(context.orderId);
    const latestJobEnd = this.getLatestJobEndForOrder(context.orderId);
    const firstJobStart = this.getFirstJobStartForOrder(context.orderId);
    const handoverStart = this.getHandoverStartForOrder(context.orderId);

    for (const day of this.getVisibleWorkingDayRanges()) {
      if (context.kind === 'job') {
        if (checkinEnd) this.addClippedManualBlockedRange(ranges, resourceId, day.start, checkinEnd, day, 'Jobs must start after Check-In is complete.');
        if (handoverStart) this.addClippedManualBlockedRange(ranges, resourceId, handoverStart, day.end, day, 'Jobs must finish before Handover starts.');
      }

      if (context.activityTemplateId === 'act-checkin') {
        if (firstJobStart) this.addClippedManualBlockedRange(ranges, resourceId, firstJobStart, day.end, day, 'Check-In must finish before scheduled jobs.');
        if (handoverStart) this.addClippedManualBlockedRange(ranges, resourceId, handoverStart, day.end, day, 'Check-In must finish before Handover.');
      }

      if (context.activityTemplateId === 'act-handover') {
        if (latestJobEnd) this.addClippedManualBlockedRange(ranges, resourceId, day.start, latestJobEnd, day, 'Handover must start after scheduled jobs are finished.');
        if (checkinEnd) this.addClippedManualBlockedRange(ranges, resourceId, day.start, checkinEnd, day, 'Handover must start after Check-In is complete.');
      }
    }
  }

  private addManualResourceBlockedRanges(
    ranges: SchedulerInvalidDropRange[],
    context: ManualDragContext,
    resourceId: string,
  ): void {
    for (const event of this.events) {
      if (event.resourceId === resourceId && !this.isSameManualDraggedItem(event, context)) {
        ranges.push({ resourceId, start: event.start, end: event.end });
      }
    }

    for (const block of this.unavailability) {
      if (block.resourceId === resourceId) {
        ranges.push({ resourceId, start: block.start, end: block.end });
      }
    }
  }

  private addManualVehicleBlockedRanges(
    ranges: SchedulerInvalidDropRange[],
    context: ManualDragContext,
    resourceId: string,
  ): void {
    if (context.kind !== 'job') return;
    for (const event of this.events) {
      if (this.isVehicleConflictEvent(event, context)) {
        ranges.push({ resourceId, start: event.start, end: event.end });
      }
    }
  }

  private addManualOtherRequirementBlockedRanges(
    ranges: SchedulerInvalidDropRange[],
    context: ManualDragContext,
    primaryRequirement: JobResourceRequirement,
    targetResourceId: string,
  ): void {
    const otherRequirements = context.requirements.filter(requirement => requirement !== primaryRequirement);
    if (!otherRequirements.length) return;

    const slotMs = this.manualDropSnapMinutes * 60000;
    const compatibleResourcesByRequirement = otherRequirements.map(requirement => ({
      requirement,
      resources: this.visibleSchedulerResources.filter(resource => {
        const rawResource = resource.meta as Resource | undefined;
        return !!rawResource && this.hasMatchingResource([rawResource], requirement);
      }),
    }));

    for (const { resources } of compatibleResourcesByRequirement) {
      for (const day of this.getVisibleWorkingDayRanges()) {
        let cursor = new Date(day.start);
        while (cursor < day.end) {
          const start = new Date(cursor);
          const end = new Date(Math.min(cursor.getTime() + slotMs, day.end.getTime()));
          const anyCompatibleResourceFree = resources.some(resource =>
            this.isResourceAvailableForManualDrop(resource.id, start, end, context)
          );

          if (!anyCompatibleResourceFree) {
            ranges.push({ resourceId: targetResourceId, start, end });
          }
          cursor = new Date(cursor.getTime() + slotMs);
        }
      }
    }
  }

  private addClippedManualBlockedRange(
    ranges: SchedulerInvalidDropRange[],
    resourceId: string,
    start: Date,
    end: Date,
    clipRange?: { start: Date; end: Date },
    reason?: string,
  ): void {
    const clipStart = clipRange?.start ?? this.viewStart;
    const clipEnd = clipRange?.end ?? this.viewEnd;
    const clippedStart = new Date(Math.max(start.getTime(), clipStart.getTime(), this.viewStart.getTime()));
    const clippedEnd = new Date(Math.min(end.getTime(), clipEnd.getTime(), this.viewEnd.getTime()));
    if (clippedStart < clippedEnd) ranges.push({ resourceId, start: clippedStart, end: clippedEnd, reason });
  }

  private getVisibleWorkingDayRanges(): Array<{ start: Date; end: Date }> {
    const ranges: Array<{ start: Date; end: Date }> = [];
    let cursor = new Date(this.viewStart);
    cursor.setHours(9, 0, 0, 0);

    while (cursor < this.viewEnd) {
      const start = new Date(Math.max(cursor.getTime(), this.viewStart.getTime()));
      const dayEnd = new Date(cursor);
      dayEnd.setHours(21, 0, 0, 0);
      const end = new Date(Math.min(dayEnd.getTime(), this.viewEnd.getTime()));
      if (start < end) ranges.push({ start, end });
      cursor = this.nextPlannerDayStart(cursor);
    }

    return ranges;
  }

  private validateManualPlacement(context: ManualDragContext, resource: SchedulerResource, start: Date, end: Date): ManualPlanValidationResult {
    const reasons: ManualPlanInvalidReason[] = [];
    const validationStart = context.anchoredStart ?? start;
    const validationEnd = context.anchoredEnd ?? end;
    if (context.anchoredStart && context.anchoredEnd && (
      start.getTime() !== context.anchoredStart.getTime() ||
      end.getTime() !== context.anchoredEnd.getTime()
    )) {
      reasons.push({ code: 'resource-unavailable' });
    }

    if (end.getHours() > 21 || (end.getHours() === 21 && end.getMinutes() > 0) || end.toDateString() !== start.toDateString()) {
      reasons.push({ code: 'outside-working-hours' });
    }

    const rawResource = resource.meta as Resource | undefined;
    if (!rawResource) {
      reasons.push({ code: 'resource-mismatch' });
      return { valid: false, reasons: this.uniqueManualPlanReasons(reasons) };
    }

    const primaryRequirement = this.getRequirementForResource(context.requirements, rawResource);
    if (!primaryRequirement || !this.hasMatchingResource([rawResource], primaryRequirement)) {
      reasons.push({ code: 'resource-mismatch', detail: this.formatResourceType(rawResource.type) });
    }

    reasons.push(...this.getManualDropSequenceInvalidReasons(context, validationStart, validationEnd));
    if (!this.isResourceAvailableForManualDrop(resource.id, validationStart, validationEnd, context)) {
      reasons.push({ code: 'resource-unavailable' });
    }
    if (this.hasVehicleConflict(context, validationStart, validationEnd)) {
      reasons.push({ code: 'vehicle-unavailable' });
    }

    if (context.kind === 'job' && primaryRequirement) {
      const missingRequirement = this.getFirstUnavailableOtherRequirement(context, primaryRequirement, validationStart, validationEnd);
      if (missingRequirement) {
        reasons.push({ code: 'required-resource-unavailable', detail: this.formatMissingRequirement(missingRequirement) });
      }
    }

    const uniqueReasons = this.uniqueManualPlanReasons(reasons);
    return { valid: uniqueReasons.length === 0, reasons: uniqueReasons };
  }

  private validateManualCapacityPlacement(context: ManualDragContext, resource: SchedulerResource, day: Date): ManualPlanValidationResult {
    const reasons: ManualPlanInvalidReason[] = [];
    const rawResource = resource.meta as Resource | undefined;
    if (!rawResource) {
      reasons.push({ code: 'resource-mismatch' });
      return { valid: false, reasons };
    }

    if (!this.isManualCapacityResourceValid(context, resource)) {
      reasons.push({ code: 'resource-mismatch', detail: this.formatResourceType(rawResource.type) });
    }

    const start = this.getDayCapacityStart(day);
    reasons.push(...this.getManualCapacitySequenceInvalidReasons(context, start));

    if (!this.hasManualCapacityAvailable(context, resource.id, start)) {
      reasons.push({ code: 'capacity-overbooked' });
    }

    const uniqueReasons = this.uniqueManualPlanReasons(reasons);
    return { valid: uniqueReasons.length === 0, reasons: uniqueReasons };
  }

  private hasManualCapacityAvailable(context: ManualDragContext, resourceId: string, day: Date): boolean {
    const dayStart = this.getDayCapacityStart(day);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(21, 0, 0, 0);
    const usedMinutes = this.getMonthResourceUsedMinutes(resourceId, dayStart, dayEnd, this.scheduleEntries)
      - this.getDraggedCapacityBlockMinutesForDay(context, resourceId, dayStart, dayEnd);

    return usedMinutes + context.durationMinutes <= this.getClippedRangeMinutes(dayStart, dayEnd, dayStart, dayEnd);
  }

  private getManualCapacitySequenceInvalidReasons(context: ManualDragContext, day: Date): ManualPlanInvalidReason[] {
    if (!context.orderId) return [];

    const dayStart = this.getDayCapacityStart(day);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(21, 0, 0, 0);
    const checkinEnd = this.getCheckinEndForOrder(context.orderId);
    const latestJobEnd = this.getLatestJobEndForOrder(context.orderId);
    const firstJobStart = this.getFirstJobStartForOrder(context.orderId);
    const handoverStart = this.getHandoverStartForOrder(context.orderId);
    const reasons: ManualPlanInvalidReason[] = [];

    if (context.kind === 'job') {
      if (checkinEnd && dayEnd <= checkinEnd) reasons.push({ code: 'before-checkin' });
      if (handoverStart && dayStart >= handoverStart) reasons.push({ code: 'after-handover' });
    }

    if (context.activityTemplateId === 'act-checkin') {
      if (firstJobStart && dayStart >= firstJobStart) reasons.push({ code: 'checkin-after-job' });
      if (handoverStart && dayStart >= handoverStart) reasons.push({ code: 'checkin-after-handover' });
    }

    if (context.activityTemplateId === 'act-handover') {
      if (latestJobEnd && dayEnd <= latestJobEnd) reasons.push({ code: 'handover-before-job' });
      if (checkinEnd && dayEnd <= checkinEnd) reasons.push({ code: 'handover-before-checkin' });
    }

    return reasons;
  }

  private getDraggedCapacityBlockMinutesForDay(
    context: ManualDragContext,
    resourceId: string,
    dayStart: Date,
    dayEnd: Date,
  ): number {
    if (!context.entryId) return 0;
    const entry = this.scheduleEntries.find(candidate => candidate.id === context.entryId);
    if (!entry || entry.kind !== 'day-capacity' || entry.resourceId !== resourceId) return 0;
    return this.getClippedRangeMinutes(entry.start, entry.end, dayStart, dayEnd);
  }

  private isManualCapacityResourceValid(context: ManualDragContext, resource: SchedulerResource): boolean {
    if (!this.isManualCapacityResourceCompatible(context, resource)) return false;
    const rawResource = resource.meta as Resource | undefined;
    return !!rawResource && !this.isExternalJobAlreadyBookedForResourceType(context, rawResource.type);
  }

  private isManualCapacityResourceCompatible(context: ManualDragContext, resource: SchedulerResource): boolean {
    const rawResource = resource.meta as Resource | undefined;
    if (!rawResource) return false;
    return context.requirements.some(requirement => requirement.resourceType === rawResource.type);
  }

  private getRequirementForResource(requirements: JobResourceRequirement[], resource: Resource): JobResourceRequirement | null {
    return requirements.find(requirement =>
      resource.type === requirement.resourceType &&
      requirement.requiredQualifications.every(qualification =>
        resource.qualifications.some(resourceQualification => resourceQualification.id === qualification.id)
      )
    ) ?? null;
  }

  private isManualDropSequenceValid(context: ManualDragContext, start: Date, end: Date): boolean {
    return this.getManualDropSequenceInvalidReasons(context, start, end).length === 0;
  }

  private getManualDropSequenceInvalidReasons(context: ManualDragContext, start: Date, end: Date): ManualPlanInvalidReason[] {
    if (!context.orderId) return [];

    const checkinEnd = this.getCheckinEndForOrder(context.orderId);
    const latestJobEnd = this.getLatestJobEndForOrder(context.orderId);
    const firstJobStart = this.getFirstJobStartForOrder(context.orderId);
    const handoverStart = this.getHandoverStartForOrder(context.orderId);
    const reasons: ManualPlanInvalidReason[] = [];

    if (context.kind === 'job') {
      if (checkinEnd && start < checkinEnd) reasons.push({ code: 'before-checkin' });
      if (handoverStart && end > handoverStart) reasons.push({ code: 'after-handover' });
    }

    if (context.activityTemplateId === 'act-checkin') {
      if (firstJobStart && end > firstJobStart) reasons.push({ code: 'checkin-after-job' });
      if (handoverStart && end > handoverStart) reasons.push({ code: 'checkin-after-handover' });
    }
    if (context.activityTemplateId === 'act-handover') {
      if (latestJobEnd && start < latestJobEnd) reasons.push({ code: 'handover-before-job' });
      if (checkinEnd && start < checkinEnd) reasons.push({ code: 'handover-before-checkin' });
    }
    if (context.activityTemplateId === 'act-mobility') {
      const span = this.getMobilitySpan(context.orderId);
      if (span && (start.getTime() !== span.start.getTime() || end.getTime() !== span.end.getTime())) {
        reasons.push({ code: 'mobility-fixed-span' });
      }
    }

    return reasons;
  }

  private areOtherRequirementsAvailable(
    context: ManualDragContext,
    primaryRequirement: JobResourceRequirement,
    start: Date,
    end: Date,
  ): boolean {
    return !this.getFirstUnavailableOtherRequirement(context, primaryRequirement, start, end);
  }

  private getFirstUnavailableOtherRequirement(
    context: ManualDragContext,
    primaryRequirement: JobResourceRequirement,
    start: Date,
    end: Date,
  ): JobResourceRequirement | null {
    const otherRequirements = context.requirements.filter(requirement => requirement !== primaryRequirement);
    return otherRequirements.find(requirement =>
      !this.visibleSchedulerResources.some(resource => {
        const rawResource = resource.meta as Resource | undefined;
        return !!rawResource &&
          this.hasMatchingResource([rawResource], requirement) &&
          this.isResourceAvailableForManualDrop(resource.id, start, end, context);
      })
    ) ?? null;
  }

  private isResourceAvailableForManualDrop(resourceId: string, start: Date, end: Date, context: ManualDragContext): boolean {
    const overlaps = (a: Date, b: Date, c: Date, d: Date) => a < d && c < b;

    return !this.events.some(event =>
      event.resourceId === resourceId &&
      !this.isSameManualDraggedItem(event, context) &&
      overlaps(start, end, event.start, event.end)
    ) && !this.unavailability.some(block =>
      block.resourceId === resourceId &&
      overlaps(start, end, block.start, block.end)
    );
  }

  private hasVehicleConflict(context: ManualDragContext, start: Date, end: Date): boolean {
    if (context.kind !== 'job') return false;
    const overlaps = (a: Date, b: Date, c: Date, d: Date) => a < d && c < b;
    return this.events.some(event =>
      this.isVehicleConflictEvent(event, context) && overlaps(start, end, event.start, event.end)
    );
  }

  private isVehicleConflictEvent(event: SchedulerEvent, context: ManualDragContext): boolean {
    if (!this.isJobEvent(event) || this.isSameManualDraggedItem(event, context)) return false;
    // Split siblings of the same job should not trigger vehicle conflicts —
    // a different resource CAN work on another split part at the same time.
    if (this.isSplitSiblingOfDraggedItem(event, context)) return false;
    const draggedOrder = context.orderId
      ? this.allOrders.find(order => order.id === context.orderId || order.referenceNumber === context.orderId)
      : null;
    const eventOrder = this.findOrderForEvent(event);
    const draggedVehicleId = draggedOrder?.vehicle?.id ?? draggedOrder?.vehicle?.licensePlate;
    const eventVehicleId = eventOrder?.vehicle?.id ?? eventOrder?.vehicle?.licensePlate;
    return !!draggedVehicleId && draggedVehicleId === eventVehicleId;
  }

  /** Returns true if the event is a sibling split part of the same job being dragged. */
  private isSplitSiblingOfDraggedItem(event: SchedulerEvent, context: ManualDragContext): boolean {
    const eventEntry = event.meta?.entry;
    if (!eventEntry || !this.isJobScheduleEntry(eventEntry) || !this.isSplitScheduleEntry(eventEntry)) return false;

    // When dragging an existing split event (entryId is set)
    const contextEntry = context.entryId
      ? this.scheduleEntries.find(entry => entry.id === context.entryId)
      : undefined;
    if (contextEntry && this.isJobScheduleEntry(contextEntry) && this.isSplitScheduleEntry(contextEntry)) {
      return eventEntry.jobId === contextEntry.jobId &&
        this.getSplitRootId(eventEntry) === this.getSplitRootId(contextEntry);
    }

    // When dragging from the panel (no entryId) for a split job — all split parts
    // of the same job are siblings and should not trigger vehicle conflicts.
    if (!context.entryId && context.itemId && eventEntry.jobId === context.itemId) {
      return true;
    }

    return false;
  }

  private isSameManualDraggedItem(event: SchedulerEvent, context: ManualDragContext): boolean {
    if (event.id === context.entryId) return true;
    if (!context.itemId) return false;

    const eventEntry = event.meta?.entry;
    const contextEntry = context.entryId
      ? this.scheduleEntries.find(entry => entry.id === context.entryId)
      : undefined;
    const isSplitDrag = !!contextEntry && this.isJobScheduleEntry(contextEntry) && this.isSplitScheduleEntry(contextEntry);
    if (isSplitDrag) {
      return !!eventEntry && this.isJobScheduleEntry(eventEntry) &&
        this.getEntryBookingSetId(eventEntry) === this.getEntryBookingSetId(contextEntry);
    }

    return eventEntry?.jobId === context.itemId || event.meta?.job?.id === context.itemId;
  }

  private isSplitScheduleEntry(entry: ScheduleEntry): boolean {
    const splitEntry = entry as ScheduleEntry & { splitRootId?: string; splitParentBookingSetId?: string; splitSequence?: number };
    return !!splitEntry.splitRootId || !!splitEntry.splitParentBookingSetId || !!splitEntry.splitSequence;
  }

  private getFirstJobStartForOrder(orderId: string): Date | null {
    const orderReference = this.getOrderReference(orderId);
    const jobEvents = this.events.filter(event =>
      (!orderReference || event.meta?.entry?.workOrderReference === orderReference) &&
      this.isJobEvent(event)
    );
    if (!jobEvents.length) return null;
    return new Date(Math.min(...jobEvents.map(event => event.start.getTime())));
  }

  private getHandoverStartForOrder(orderId: string): Date | null {
    const handoverActivityId = this.getOrderActivityId(orderId, 'act-handover');
    const booking = this.bookings.find(candidate =>
      this.getActivityTemplateId(candidate.jobId) === 'act-handover' &&
      (candidate.orderId === orderId || candidate.jobId === handoverActivityId)
    );
    if (booking) return this.events.find(event => event.id === booking.entryId)?.start ?? null;

    const orderReference = this.getOrderReference(orderId);
    return this.events.find(event =>
      (!orderReference || event.meta?.entry?.workOrderReference === orderReference) &&
      this.getActivityTemplateId(event.meta?.entry?.jobId ?? '') === 'act-handover'
    )?.start ?? null;
  }

  private nextPlannerDayStart(date: Date): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    next.setHours(9, 0, 0, 0);
    return next;
  }

  private mergeInvalidDropRanges(ranges: SchedulerInvalidDropRange[]): SchedulerInvalidDropRange[] {
    const sorted = [...ranges].sort((first, second) =>
      first.resourceId === second.resourceId
        ? first.start.getTime() - second.start.getTime()
        : first.resourceId.localeCompare(second.resourceId)
    );
    const merged: SchedulerInvalidDropRange[] = [];

    for (const range of sorted) {
      const previous = merged[merged.length - 1];
      if (previous && previous.resourceId === range.resourceId && previous.end.getTime() >= range.start.getTime()) {
        previous.end = new Date(Math.max(previous.end.getTime(), range.end.getTime()));
      } else {
        merged.push({ ...range });
      }
    }

    return merged;
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

  private uniqueManualPlanReasons(reasons: ManualPlanInvalidReason[]): ManualPlanInvalidReason[] {
    const seen = new Set<string>();
    return reasons.filter(reason => {
      const key = `${reason.code}:${reason.detail ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private formatResourceType(resourceType: string): string {
    return resourceType.charAt(0).toUpperCase() + resourceType.slice(1);
  }

  private findOrderForEvent(event: SchedulerEvent): any | null {
    const metaOrder = (event.meta as any)?.order;
    if (metaOrder) return metaOrder;

    const entry = event.meta?.entry;
    if (entry) {
      const order = this.findOrderForScheduleEntry(entry);
      if (order) return order;
    }

    const booking = this.bookings.find(candidate => candidate.entryId === event.id);
    if (booking?.orderId) {
      return this.allOrders.find(order => order.id === booking.orderId || order.referenceNumber === booking.orderId) ?? null;
    }

    const jobId = event.meta?.job?.id ?? booking?.jobId;
    if (!jobId) return null;

    const activityOrderId = this.getOrderIdFromActivityJobId(jobId);
    if (activityOrderId) {
      const order = this.allOrders.find(candidate => candidate.id === activityOrderId || candidate.referenceNumber === activityOrderId);
      if (order) return order;
    }

    return this.allOrders.find(order => order.jobs?.some((job: any) => job.id === jobId)) ?? null;
  }

  private getContextEventOrder(): any | null {
    const event = this.eventContextMenu
      ? this.events.find(candidate => candidate.id === this.eventContextMenu?.eventId)
      : undefined;
    return event ? this.findOrderForEvent(event) : null;
  }

  private copyTextToClipboard(text: string): void {
    if (navigator?.clipboard?.writeText) {
      void navigator.clipboard.writeText(text);
      return;
    }

    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
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
    const removedEntries = this.allScheduleEntries.filter(entry =>
      this.bookings.some(booking => booking.entryId === entry.id && (!orderId || booking.orderId === orderId))
    );
    const autoEntryIds = new Set(
      this.bookings
        .filter(booking => !orderId || booking.orderId === orderId)
        .map(booking => booking.entryId)
    );
    autoEntryIds.forEach(id => this.scheduleRepo.unassign(id).subscribe());
    this.removeScheduleEntriesById(autoEntryIds);
    this.refreshWorkOrderItemStatusesForEntries(removedEntries);
    for (const entryId of autoEntryIds) {
      this.latestAutoBookingEntryIds.delete(entryId);
    }
    if (this.latestAutoBookingEntryIds.size === 0) {
      this.isAutoProposalVisible = false;
    }
  }

  private bookActivity(activityId: string, resource: any, start: Date, end: Date, orderId?: string, onAssigned?: (entry: ScheduleEntry) => void): void {
    const activityTemplateId = this.getActivityTemplateId(activityId);
    const activityTitle = this.getActivityTemplate(activityTemplateId)?.title ?? activityId;
    const order = this.allOrders.find(candidate => candidate.id === orderId);
    const workOrderReference = order?.referenceNumber;
    const normalizedEnd = this.isFixedDurationActivity(activityId)
      ? new Date(start.getTime() + this.getActivityDurationMinutes(activityId) * 60000)
      : end;
    const existingEntry = this.allScheduleEntries.find(candidate =>
      candidate.workorderItemCategory === 'activity' &&
      this.getActivityTemplateId(candidate.jobId) === activityTemplateId &&
      (!!workOrderReference && candidate.workOrderReference === workOrderReference)
    );

    if (existingEntry) {
      const replacement = {
        ...existingEntry,
        jobId: activityId,
        resourceId: resource.id,
        start,
        end: normalizedEnd,
        title: activityTitle,
        kind: 'scheduled' as const,
        workOrderReference,
        workorderItemStatus: 'scheduled' as const,
        workorderItemCategory: 'activity' as const,
      };
      this.scheduleRepo.unassign(existingEntry.id).subscribe(() => {
        this.scheduleRepo.assign(replacement).subscribe(assigned => {
          this.updateScheduleEntry(existingEntry.id, assigned);
          this.events = this.events.map(event =>
            event.id === existingEntry.id
              ? this.mapScheduleEntryToEvent(assigned)
              : event
          );
          this.latestAutoBookingEntryIds.add(existingEntry.id);
          onAssigned?.(assigned);
        });
      });
      return;
    }

    const entry = {
      id: `auto-act-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      jobId: activityId,
      resourceId: resource.id,
      start,
      end: normalizedEnd,
      title: activityTitle,
      kind: 'scheduled' as const,
      workOrderReference,
      workorderItemStatus: 'scheduled' as const,
      workorderItemCategory: 'activity' as const,
    };
    this.scheduleRepo.assign(entry).subscribe(assigned => {
      this.events = [...this.events, this.mapScheduleEntryToEvent({
        ...assigned,
        workOrderReference,
        workorderItemStatus: 'scheduled',
        workorderItemCategory: 'activity',
      })];
      this.upsertScheduleEntry(assigned);
      this.latestAutoBookingEntryIds.add(assigned.id);
      onAssigned?.(assigned);
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
    const existingJobEntries = this.allScheduleEntries.filter(entry =>
      (!orderReference || entry.workOrderReference === orderReference) &&
      this.isJobScheduleEntry(entry)
    );
    const endTimes = [
      ...bookedJobEvents.map(event => event.end.getTime()),
      ...existingJobEntries.map(entry => entry.end.getTime()),
    ];
    if (!endTimes.length) return null;
    return new Date(Math.max(...endTimes));
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

  /** Called by the ribbon Undo button - removes the most recently added booking */
  private undoLastBooking(): void {
    if (this.bookings.length === 0) return;

    if (this.latestAutoBookingEntryIds.size > 0) {
      const activeOrderId = this.plannerMode === 'order' ? this.getActiveWorkOrderId() : null;
      const entryIds = [...this.latestAutoBookingEntryIds].filter(entryId =>
        !activeOrderId || this.isScheduleEntryForOrder(entryId, activeOrderId)
      );
      entryIds.forEach(entryId => this.scheduleRepo.unassign(entryId).subscribe());
      const entryIdSet = new Set(entryIds);
      const removedEntries = this.removeScheduleEntriesById(entryIdSet);
      entryIds.forEach(entryId => this.latestAutoBookingEntryIds.delete(entryId));
      this.refreshWorkOrderItemStatusesForEntries(removedEntries);
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

  private isBookingForOrder(booking: JobBooking, order: any): boolean {
    if (booking.orderId === order.id || booking.orderId === order.referenceNumber) return true;
    const entry = this.allScheduleEntries.find(candidate => candidate.id === booking.entryId);
    return this.isEntryForOrder(entry, order);
  }

  private isEntryForOrder(entry: ScheduleEntry | undefined, order: any): boolean {
    if (!entry || !order) return false;
    const entryOrder = this.findOrderForScheduleEntry(entry);
    if (entryOrder?.id === order.id || entryOrder?.referenceNumber === order.referenceNumber) return true;
    return !!entry.workOrderReference && (
      entry.workOrderReference === order.referenceNumber ||
      entry.workOrderReference === order.id
    );
  }

  /** Returns the span [check-in end -> handover end] if both are booked, else null */
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
    this.syncOrderAppointment(orderId, checkinEvent.start, handoverEvent.end);
  }

  private syncOrderAppointment(orderId: string, checkinStart: Date, handoverEnd: Date): void {
    this.quickViewSelection.setSelection({
      orderId,
      checkinStart: new Date(checkinStart),
      handoverStart: this.getDefaultHandoverStart(handoverEnd),
      handoverEnd: new Date(handoverEnd),
      checkinFilters: [this.getQuickViewSlotFilter(checkinStart)],
      handoverFilters: [this.getQuickViewSlotFilter(this.getDefaultHandoverStart(handoverEnd))],
    });
    this.appointmentSync.updateAppointment(orderId, checkinStart, handoverEnd).subscribe(savedOrder => {
      if (!savedOrder) return;
      this.allOrders = this.allOrders.map(order => order.id === savedOrder.id ? savedOrder : order);
    });
  }

  private getDefaultHandoverStart(handoverEnd: Date): Date {
    const start = new Date(handoverEnd);
    start.setMinutes(start.getMinutes() - 30);
    return start;
  }

  private getQuickViewSlotFilter(date: Date): 'morning' | 'afternoon' | 'evening' {
    const hour = date.getHours();
    if (hour >= 12 && hour < 16) return 'afternoon';
    if (hour >= 16) return 'evening';
    return 'morning';
  }
}

