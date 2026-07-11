import {
  Component, Input, Output, EventEmitter,
  OnChanges, OnInit, SimpleChanges, ChangeDetectionStrategy,
  ElementRef, ViewChild, AfterViewInit, NgZone, ChangeDetectorRef, OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UnavailabilityBlock } from '../../../../core/models/availability.model';
import { WorkorderItemStatus } from '../../../../core/models/job.model';
import { BookingCategory } from '../../../../core/models/booking-category.model';
import {
  SchedulerResource, SchedulerEvent, SchedulerGroup,
  SchedulerCapacityBlock,
  EventMovePayload, EventResizePayload, EventResizeDragPayload, EventDropPayload, EventClickPayload, EventContextMenuPayload, OrderFocusPayload,
  ResourceSelectionChangePayload, ResourceTypeSelectionChangePayload, SchedulerInvalidDropRange, SchedulerInvalidCapacityResource, SchedulerDropVisualContext, SchedulerTimeRangePayload,
  EventDragPayload, SchedulerBookedResourceFilterContext, SchedulerResourceSlotContextMenuPayload
} from '../scheduler.interface';
import { ResourceFavoriteView } from '../../../../features/service-planner/services/planner-settings.service';

const MINUTES_PER_FRU = 60;

const SLOT_WIDTH = 60;        // px per slot (fixed — one slot always = 60px)
const ROW_HEIGHT = 92;        // px per resource row
const ORDER_TILE_HEIGHT = 28;
const JOB_TILE_HEIGHT = ROW_HEIGHT - ORDER_TILE_HEIGHT;
const HEADER_HEIGHT = 80;     // date row (32) + hour row (48)
const DATE_ROW_HEIGHT = 32;
const HOUR_ROW_HEIGHT = 48;
const MONTH_BAR_HEIGHT = 40;
const RESOURCE_COL_WIDTH = 310;
const GROUP_ROW_HEIGHT = 80;
const DAY_CAPACITY_LANE_WIDTH = 280;
const CAPACITY_COLLAPSED_VISIBLE_COUNT = 2;
const CAPACITY_OVERFLOW_VISIBLE_COUNT = 1;
const CAPACITY_BLOCK_HEIGHT = 36;
const CAPACITY_OVERFLOW_BUTTON_HEIGHT = 12;
const CAPACITY_LANE_PADDING_Y = 8;
const CAPACITY_LANE_GAP = 4;
const EVENT_FULL_TAG_MIN_WIDTH = 360;
const EVENT_ICON_TAG_MIN_WIDTH = 150;
const EVENT_CONTACT_MIN_WIDTH = 300;
const EVENT_CONTENT_MAX_WIDTH = 120;
const EVENT_CONTENT_PADDING = 40;
const EVENT_CONTENT_MAX_RESERVE = EVENT_CONTENT_MAX_WIDTH + EVENT_CONTENT_PADDING;

interface EventHoverTooltip {
  event: SchedulerEvent;
  x: number;
  y: number;
}

interface CapacityOverflowPreview {
  blocks: SchedulerCapacityBlock[];
  hiddenCount: number;
  blockedDurationLabel: string;
  jobCountLabel: string;
  x: number;
  y: number;
}

interface SchedulerOrderRun {
  key: string;
  resourceId: string;
  events: SchedulerEvent[];
  start: Date;
  end: Date;
  firstEvent: SchedulerEvent;
}

interface DropPreview {
  resourceId: string;
  start: Date;
  end: Date;
  left: number;
  top: number;
  width: number;
  mode?: 'timed' | 'day-capacity';
  date?: Date;
  durationMinutes?: number;
}

@Component({
  selector: 'app-custom-scheduler',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './custom-scheduler.component.html',
  styleUrl: './custom-scheduler.component.scss',
  changeDetection: ChangeDetectionStrategy.Default,
  host: { style: 'display: flex; flex: 1; min-height: 0; overflow: hidden;' }
})
export class CustomSchedulerComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @Input() public resources: SchedulerResource[] = [];
  @Input() public events: SchedulerEvent[] = [];
  @Input() public capacityBlocks: SchedulerCapacityBlock[] = [];
  @Input() public showDayCapacityLane = false;
  @Input() public groups: SchedulerGroup[] = [];
  @Input() public unavailability: UnavailabilityBlock[] = [];
  @Input() public viewStart: Date = new Date();
  @Input() public viewEnd: Date = new Date();
  @Input() public currentTime: Date | null = null;
  @Input() public slotDurationMinutes = 60;
  @Input() public dropSnapMinutes = 30;
  @Input() public readonly = false;
  @Input() public showOrderTiles = true;
  @Input() public showAvailabilityBlocks = false;
  @Input() public preserveRowHeightOnAvailability = false;
  @Input() public detailedEventIds: string[] = [];
  @Input() public detailedOrderIds: string[] = [];
  @Input() public selectedResourceIds: string[] = [];
  @Input() public selectedResourceTypeGroupIds: string[] = [];
  @Input() public bookedResourceFilterContext: SchedulerBookedResourceFilterContext | null = null;
  @Input() public bookingCategories: BookingCategory[] = [];
  @Input() public resourceViews: ResourceFavoriteView[] = [];
  @Input() public selectedResourceView: ResourceFavoriteView | null = null;
  @Input('rightPaneOpen') public rightPaneOpen = false;
  @Input() public scrollToEventId: string | null = null;
  @Input() public scrollToEventIds: string[] = [];
  @Input() public scrollToEventPulse = true;
  @Input() public scrollToEventRequestId = 0;
  @Input() public invalidDropRanges: SchedulerInvalidDropRange[] = [];
  @Input() public resizeInvalidHint = '';
  @Input() public invalidCapacityResources: SchedulerInvalidCapacityResource[] = [];
  @Input() public dropVisualContext: SchedulerDropVisualContext | null = null;
  @Input() public selectedTimeRange: SchedulerTimeRangePayload | null = null;
  @Input() public navigationTitle = '';
  @Input() public navigationMeta = '';
  @Input() public previousNavigationLabel = 'Previous period';
  @Input() public nextNavigationLabel = 'Next period';

  @Output() public eventMoved   = new EventEmitter<EventMovePayload>();
  @Output() public eventResized = new EventEmitter<EventResizePayload>();
  @Output() public eventResizeStarted = new EventEmitter<EventResizeDragPayload>();
  @Output() public eventResizeEnded = new EventEmitter<EventResizeDragPayload>();
  @Output() public eventDropped = new EventEmitter<EventDropPayload>();
  @Output() public eventClicked = new EventEmitter<EventClickPayload>();
  @Output() public eventContextMenu = new EventEmitter<EventContextMenuPayload>();
  @Output() public orderFocusRequested = new EventEmitter<OrderFocusPayload>();
  @Output() public eventDragStarted = new EventEmitter<EventDragPayload>();
  @Output() public eventDragEnded = new EventEmitter<EventDragPayload>();
  @Output() public resourceSelectionChange = new EventEmitter<ResourceSelectionChangePayload>();
  @Output() public resourceTypeSelectionChange = new EventEmitter<ResourceTypeSelectionChangePayload>();
  @Output() public resourceViewChange = new EventEmitter<ResourceFavoriteView | null>();
  @Output() public resourceViewListRequested = new EventEmitter<ResourceFavoriteView | null>();
  @Output() public resourceViewAddRequested = new EventEmitter<void>();
  @Output() public rightPaneToggle = new EventEmitter<void>();
  @Output() public timeRangeSelected = new EventEmitter<SchedulerTimeRangePayload>();
  @Output() public timeRangeCleared = new EventEmitter<void>();
  @Output() public resourceSlotContextMenu = new EventEmitter<SchedulerResourceSlotContextMenuPayload>();
  @Output() public previousPeriod = new EventEmitter<void>();
  @Output() public nextPeriod = new EventEmitter<void>();

  @ViewChild('headerScroll') headerScrollRef!: ElementRef<HTMLElement>;
  @ViewChild('bodyScroll') bodyScrollRef!: ElementRef<HTMLElement>;

  readonly ROW_HEIGHT = ROW_HEIGHT;
  readonly ORDER_TILE_HEIGHT = ORDER_TILE_HEIGHT;
  readonly JOB_TILE_HEIGHT = JOB_TILE_HEIGHT;
  readonly HEADER_HEIGHT = HEADER_HEIGHT;
  readonly DATE_ROW_HEIGHT = DATE_ROW_HEIGHT;
  readonly HOUR_ROW_HEIGHT = HOUR_ROW_HEIGHT;
  readonly MONTH_BAR_HEIGHT = MONTH_BAR_HEIGHT;
  readonly RESOURCE_COL_WIDTH = RESOURCE_COL_WIDTH;
  readonly GROUP_ROW_HEIGHT = GROUP_ROW_HEIGHT;
  readonly DAY_CAPACITY_LANE_WIDTH = DAY_CAPACITY_LANE_WIDTH;
  readonly CAPACITY_COLLAPSED_VISIBLE_COUNT = CAPACITY_COLLAPSED_VISIBLE_COUNT;

  private timelineViewportWidth = 0;
  private resizeObserver: ResizeObserver | null = null;
  private removeBodyScrollListener: (() => void) | null = null;
  private scrollSyncFrame: number | null = null;
  private isSyncingHeaderScroll = false;

  // dynamic: one slot always = 60px, so hour width scales with slot duration
  get HOUR_WIDTH(): number {
    const fixedHourWidth = SLOT_WIDTH * (60 / this.slotDurationMinutes);
    if (this.daySlots.length !== 1 || !this.timelineViewportWidth) return fixedHourWidth;
    const timedViewportWidth = Math.max(0, this.timelineViewportWidth - this.getDayCapacityLaneWidth());
    return Math.max(fixedHourWidth, timedViewportWidth / 12);
  }

  get rowHeight(): number {
    return ROW_HEIGHT;
  }

  timeSlots: Date[] = [];
  daySlots: Date[] = [];
  totalMinutes = 0;

  get totalWidth(): number {
    return this.daySlots.length * this.getDayWidth();
  }

  get navigationRowWidth(): number {
    return this.timelineViewportWidth || this.totalWidth;
  }

  get isSingleDayView(): boolean {
    return this.daySlots.length === 1;
  }

  get totalBodyHeight(): number {
    const groupedHeight = this.visibleGroups.reduce((height, group) =>
      height + this.GROUP_ROW_HEIGHT + this.getExpandedResourcesForGroup(group.id).reduce((sum, resource) => sum + this.getResourceRowHeight(resource.id), 0),
      0
    );
    return groupedHeight + this.getUngroupedResources().reduce((height, resource) => height + this.getResourceRowHeight(resource.id), 0);
  }

  months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  selectedMonth = this.viewStart.getMonth();
  resourceSearch = '';
  isGroupDropdownOpen = false;
  isResourceViewDropdownOpen = false;
  showSelectedOnlyResources = false;
  showBookedOnlyResources = false;
  showCapacityOnlyMode = false;
  collapsedGroupIds = new Set<string>();
  copiedContactKey: string | null = null;
  private lastBookedContextKey: string | null = null;
  private copiedContactResetId: ReturnType<typeof setTimeout> | null = null;
  private expandedCapacityLane: { resourceId: string; dayKey: string } | null = null;
  private groupCapacityDropTarget: { groupId: string; dayKey: string } | null = null;

  get selectedYear(): number { return this.viewStart.getFullYear(); }

  get effectiveDropSnapMinutes(): number {
    return this.normalizeDropSnapMinutes(this.dropSnapMinutes);
  }

  selectMonth(monthIndex: number): void {
    this.selectedMonth = monthIndex;
    const newStart = new Date(this.viewStart);
    newStart.setMonth(monthIndex);
    newStart.setDate(1);
    newStart.setHours(9, 0, 0, 0);
    const newEnd = new Date(newStart);
    newEnd.setDate(newEnd.getDate() + 6); // show a week
    newEnd.setHours(21, 0, 0, 0);
    this.viewStart = newStart;
    this.viewEnd = newEnd;
    this.buildTimeSlots();
  }

  // drag state
  private resizing: { event: SchedulerEvent; edge: 'left' | 'right'; startX: number; originalStart: Date; originalEnd: Date } | null = null;
  resizePreview: { event: SchedulerEvent; left: number; top: number; width: number } | null = null;
  hoverTooltip: EventHoverTooltip | null = null;
  private hoverTooltipTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private suppressHoverTooltipUntil = 0;
  capacityOverflowPreview: CapacityOverflowPreview | null = null;
  dropPreview: DropPreview | null = null;
  dropTargetResourceId: string | null = null;
  private lastValidDropPreview: DropPreview | null = null;
  private nativeDraggedEventId: string | null = null;
  private nativeDropHandled = false;
  private timeRangeSelection: { anchor: Date; current: Date; resourceId?: string } | null = null;
  private resourceTimeRangeSelection: SchedulerTimeRangePayload | null = null;
  private timeRangeMove: { durationMinutes: number; pointerOffsetMinutes: number } | null = null;
  private timeRangeResize: { edge: 'left' | 'right'; fixedTimelineMinutes: number } | null = null;
  private activePulseEventIds = new Set<string>();
  private pendingPulseEventIds = new Set<string>();
  private pulseTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private pulseScrollSettleTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private programmaticScrollPulse = false;

  constructor(private zone: NgZone, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.selectedMonth = this.viewStart.getMonth();
    this.buildTimeSlots();
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      if (this.bodyScrollRef) {
        const body = this.bodyScrollRef.nativeElement;
        const syncScroll = () => this.scheduleHeaderScrollSync();
        body.addEventListener('scroll', syncScroll);
        this.removeBodyScrollListener = () => body.removeEventListener('scroll', syncScroll);
        this.updateTimelineViewportWidth();
        this.scheduleHeaderScrollSync();
        if (typeof ResizeObserver !== 'undefined') {
          this.resizeObserver = new ResizeObserver(() => {
            this.updateTimelineViewportWidth();
            this.scheduleHeaderScrollSync();
          });
          this.resizeObserver.observe(body);
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.removeBodyScrollListener?.();
    this.resizeObserver?.disconnect();
    if (this.scrollSyncFrame !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.scrollSyncFrame);
    }
    this.scrollSyncFrame = null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['viewStart'] || changes['viewEnd'] || changes['slotDurationMinutes']) {
      this.selectedMonth = this.viewStart.getMonth();
      this.buildTimeSlots();
      queueMicrotask(() => this.updateTimelineViewportWidth());
    }
    if (changes['capacityBlocks'] || changes['resources'] || changes['viewStart'] || changes['viewEnd']) {
      this.reconcileExpandedCapacityLane();
    }
    if (changes['bookedResourceFilterContext']) {
      this.syncBookedFilterWithContext();
    }
    if (changes['scrollToEventId'] || changes['scrollToEventIds'] || changes['scrollToEventRequestId']) {
      const eventIds = this.scrollToEventIds.length ? this.scrollToEventIds : (this.scrollToEventId ? [this.scrollToEventId] : []);
      if (eventIds.length) queueMicrotask(() => this.scrollToEvents(eventIds, this.scrollToEventPulse));
    }
  }

  private buildTimeSlots(): void {
    this.timeSlots = [];
    this.daySlots = [];

    // build day slots
    const dayStart = new Date(this.viewStart);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(this.viewEnd);
    dayEnd.setHours(0, 0, 0, 0);
    const current = new Date(dayStart);
    while (current <= dayEnd) {
      this.daySlots.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    // build hour slots for one day (9-21)
    const hourStart = new Date(this.viewStart);
    hourStart.setHours(9, 0, 0, 0);
    const hourEnd = new Date(this.viewStart);
    hourEnd.setHours(21, 0, 0, 0);
    const h = new Date(hourStart);
    while (h < hourEnd) {
      this.timeSlots.push(new Date(h));
      h.setMinutes(h.getMinutes() + this.slotDurationMinutes);
    }

    const hoursPerDay = 12;
    this.totalMinutes = this.daySlots.length * hoursPerDay * 60;
  }

  getDayOffsetPx(day: Date): number {
    const dayIndex = this.daySlots.findIndex(d =>
      d.toDateString() === day.toDateString()
    );
    return dayIndex * this.getDayWidth();
  }

  getDayWidth(): number {
    return 12 * this.HOUR_WIDTH + this.getDayCapacityLaneWidth();
  }

  getTimedDayWidth(): number {
    return 12 * this.HOUR_WIDTH;
  }

  getDayCapacityLaneWidth(): number {
    return this.showDayCapacityLane ? DAY_CAPACITY_LANE_WIDTH : 0;
  }

  getHourOffsetInDay(slot: Date): number {
    return this.getDayCapacityLaneWidth() + (slot.getHours() - 9 + slot.getMinutes() / 60) * this.HOUR_WIDTH;
  }

  isFirstHourSlot(slot: Date): boolean {
    return slot.getHours() === 9 && slot.getMinutes() === 0;
  }

  isMinorSlotLine(slot: Date): boolean {
    return slot.getMinutes() !== 0;
  }

  formatDay(day: Date): string {
    return day.getDate().toString();
  }

  formatWeekday(day: Date): string {
    return day.toLocaleDateString('en-GB', { weekday: 'short' });
  }

  // ── Layout helpers ──────────────────────────────────────────────────────────

  getGroupHeight(groupId: string): number {
    return this.getExpandedResourcesForGroup(groupId).reduce((height, resource) => height + this.getResourceRowHeight(resource.id), GROUP_ROW_HEIGHT);
  }

  getEventsForResource(resourceId: string): SchedulerEvent[] {
    return this.events.filter(e => e.resourceId === resourceId);
  }

  private getCategoryTagWidth(category: BookingCategory, withLabel: boolean): number {
    const iconWidth = 16;
    const horizontalPadding = 16; // 8px left + 8px right
    const gap = withLabel ? 4 : 0;
    const labelWidth = withLabel ? this.estimateTextWidth(category.label) : 0;
    return Math.max(24, iconWidth + horizontalPadding + gap + labelWidth);
  }

  private estimateTextWidth(text: string): number {
    return Math.max(0, Math.round(text.length * 7.25));
  }

  private getEventContentReserveWidth(event: SchedulerEvent): number {
    const eventWidth = this.getEventWidth(event);
    const titleWidth = this.estimateTextWidth(this.getEventJobDescription(event));
    const detailWidth = this.estimateTextWidth(this.getEventDetail(event));
    const customerWidth = this.estimateTextWidth(this.getEventCustomerVehicleDetail(event));
    const maxLineWidth = Math.max(titleWidth, detailWidth, customerWidth);

    const contentNeeded = maxLineWidth + EVENT_CONTENT_PADDING;
    const contentMaxReserve = Math.min(EVENT_CONTENT_MAX_RESERVE, eventWidth);
    const reserved = Math.max(contentNeeded, contentMaxReserve, 120);

    return Math.min(reserved, Math.max(eventWidth - 60, 60));
  }

  private getEventAvailableTagWidth(event: SchedulerEvent): number {
    return Math.max(0, this.getEventWidth(event) - this.getEventContentReserveWidth(event));
  }

  private getStatusTagWidth(event: SchedulerEvent, withLabel: boolean): number {
    const iconWidth = 16;
    const horizontalPadding = 16;
    const gap = withLabel ? 4 : 0;
    const labelWidth = withLabel ? this.estimateTextWidth(this.getEventTagLabel(event)) : 0;
    return Math.max(32, iconWidth + horizontalPadding + gap + labelWidth);
  }

  private getMaxFittingCategoryCount(categories: BookingCategory[], availableWidth: number, withLabel: boolean): number {
    let used = 0;
    let count = 0;

    for (const category of categories) {
      const tagWidth = this.getCategoryTagWidth(category, withLabel);
      const spacing = count > 0 ? 2 : 0;
      if (used + spacing + tagWidth > availableWidth) break;
      used += spacing + tagWidth;
      count += 1;
    }

    return count;
  }

  getEventCategories(event: SchedulerEvent): BookingCategory[] {
    const ids = event.meta?.entry?.categoryIds ?? [];
    if (!ids.length) return [];
    return ids
      .map(id => this.bookingCategories.find(category => category.id === id))
      .filter((category): category is BookingCategory => !!category);
  }

  getVisibleEventCategories(event: SchedulerEvent): BookingCategory[] {
    const categories = this.getEventCategories(event);
    if (!categories.length) return [];

    const available = this.getEventAvailableTagWidth(event);
    const statusFullWidth = this.getStatusTagWidth(event, true);
    const statusIconWidth = this.getStatusTagWidth(event, false);
    const statusFitsFull = available >= statusFullWidth;
    const iconOnlyStatus = this.shouldShowEventTagIconOnly(event);
    const statusWidth = iconOnlyStatus ? statusIconWidth : statusFitsFull ? statusFullWidth : statusIconWidth;
    const leftover = available - statusWidth;

    if (leftover < this.getCategoryTagWidth(categories[0], false)) return [];

    const iconCount = this.getMaxFittingCategoryCount(categories, leftover, false);
    if (iconCount <= 0) return [];

    if (!iconOnlyStatus && statusFitsFull) {
      const fullLabelCount = this.getMaxFittingCategoryCount(categories, leftover, true);
      if (fullLabelCount === categories.length) return categories;
      if (iconCount > fullLabelCount) return categories.slice(0, iconCount);
      return categories.slice(0, fullLabelCount);
    }

    return categories.slice(0, iconCount);
  }

  private canShowEventCategoryLabels(event: SchedulerEvent, categories: BookingCategory[]): boolean {
    if (!categories.length) return false;
    if (this.shouldShowEventTagIconOnly(event)) return false;

    const available = this.getEventAvailableTagWidth(event) - this.getStatusTagWidth(event, true);
    const fullLabelCount = this.getMaxFittingCategoryCount(categories, available, true);
    return fullLabelCount >= categories.length;
  }

  getRenderedEventsForResource(resourceId: string): SchedulerEvent[] {
    const rendered = new Map<string, SchedulerEvent>();
    for (const event of this.getEventsForResource(resourceId)) {
      for (const segment of this.getRenderedEventSegments(event)) {
        const key = `${this.getSourceEventId(segment)}:${segment.resourceId}:${segment.start.getTime()}:${segment.end.getTime()}`;
        if (!rendered.has(key)) rendered.set(key, segment);
      }
    }
    return [...rendered.values()];
  }

  private getRenderedEventSegments(event: SchedulerEvent): SchedulerEvent[] {
    const segments: SchedulerEvent[] = [];
    const cursor = new Date(event.start);
    cursor.setSeconds(0, 0);

    while (cursor < event.end) {
      const dayStart = new Date(cursor);
      dayStart.setHours(9, 0, 0, 0);
      const dayEnd = new Date(cursor);
      dayEnd.setHours(21, 0, 0, 0);
      const segmentStart = cursor < dayStart ? dayStart : new Date(cursor);
      const segmentEnd = event.end < dayEnd ? new Date(event.end) : dayEnd;

      if (segmentStart < segmentEnd) {
        const segment = {
          ...event,
          id: segments.length === 0 ? event.id : `${event.id}__day-${segments.length + 1}`,
          start: segmentStart,
          end: segmentEnd,
          meta: { ...(event.meta ?? {}), sourceEventId: event.id } as any,
        };
        segments.push(segment);
      }

      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(9, 0, 0, 0);
    }

    return segments.length ? segments : [event];
  }

  getUnavailabilityForResource(resourceId: string): UnavailabilityBlock[] {
    return this.unavailability.filter(u => u.resourceId === resourceId);
  }

  getCapacityBlocksForResourceDay(resourceId: string, day: Date): SchedulerCapacityBlock[] {
    return this.capacityBlocks.filter(block =>
      block.resourceId === resourceId &&
      this.isSameDay(block.date, day)
    );
  }

  getVisibleCapacityBlocksForResourceDay(resourceId: string, day: Date): SchedulerCapacityBlock[] {
    const blocks = this.getCapacityBlocksForResourceDay(resourceId, day);
    if (this.showCapacityOnlyMode) return blocks;
    return this.isCapacityLaneExpandedForBlocks(resourceId, day, blocks.length)
      ? blocks
      : blocks.slice(0, this.getCollapsedCapacityVisibleCount(blocks.length));
  }

  getHiddenCapacityBlockCount(resourceId: string, day: Date): number {
    if (this.showCapacityOnlyMode) return 0;
    const blockCount = this.getCapacityBlocksForResourceDay(resourceId, day).length;
    if (this.isCapacityLaneExpandedForBlocks(resourceId, day, blockCount)) return 0;
    return Math.max(blockCount - this.getCollapsedCapacityVisibleCount(blockCount), 0);
  }

  getScheduledEventsForResourceDay(resourceId: string, day: Date): SchedulerEvent[] {
    return this.getRenderedEventsForResource(resourceId).filter(event => {
      const eventDay = new Date(event.start);
      eventDay.setHours(0, 0, 0, 0);
      const targetDay = new Date(day);
      targetDay.setHours(0, 0, 0, 0);
      return eventDay.getTime() === targetDay.getTime();
    });
  }

  eventAsCapacityBlock(evt: SchedulerEvent): SchedulerCapacityBlock {
    return {
      id: evt.id,
      resourceId: evt.resourceId,
      date: evt.start,
      durationMinutes: Math.max(1, Math.round((evt.end.getTime() - evt.start.getTime()) / 60000)),
      title: evt.title,
      color: evt.color,
      meta: evt.meta,
    };
  }

  getCapacityOrderRuns(resourceId: string, day: Date): { orderRef: string; count: number }[] {
    const blocks = this.getCapacityBlocksForResourceDay(resourceId, day);
    const events = this.showCapacityOnlyMode ? this.getScheduledEventsForResourceDay(resourceId, day) : [];
    const orderMap = new Map<string, number>();
    for (const block of blocks) {
      const ref = this.getCapacityBlockOrderReference(block);
      orderMap.set(ref, (orderMap.get(ref) ?? 0) + 1);
    }
    for (const evt of events) {
      const ref = this.getEventOrderReference(evt);
      orderMap.set(ref, (orderMap.get(ref) ?? 0) + 1);
    }
    return [...orderMap.entries()]
      .filter(([, count]) => count > 1)
      .map(([orderRef, count]) => ({ orderRef, count }));
  }

  getCapacityBlocksForOrder(resourceId: string, day: Date, orderRef: string): SchedulerCapacityBlock[] {
    return this.getCapacityBlocksForResourceDay(resourceId, day)
      .filter(block => this.getCapacityBlockOrderReference(block) === orderRef);
  }

  getVisibleCapacityBlocksForOrder(resourceId: string, day: Date, orderRef: string): SchedulerCapacityBlock[] {
    const blocks = this.getCapacityBlocksForOrder(resourceId, day, orderRef);
    if (this.showCapacityOnlyMode) return blocks;
    if (this.isCapacityLaneExpanded(resourceId, day)) return blocks;
    // In collapsed timeline mode, show up to 2 tiles per order run
    return blocks.slice(0, CAPACITY_COLLAPSED_VISIBLE_COUNT);
  }

  getFirstBlockForOrder(resourceId: string, day: Date, orderRef: string): SchedulerCapacityBlock | null {
    return this.getCapacityBlocksForOrder(resourceId, day, orderRef)[0]
      ?? this.getScheduledEventsForOrder(resourceId, day, orderRef).map(evt => this.eventAsCapacityBlock(evt))[0]
      ?? null;
  }

  isBlockInOrderRun(resourceId: string, day: Date, block: SchedulerCapacityBlock): boolean {
    const runs = this.getCapacityOrderRuns(resourceId, day);
    const ref = this.getCapacityBlockOrderReference(block);
    return runs.some(run => run.orderRef === ref);
  }

  onOrderRunDragStart(e: DragEvent, orderRef: string, resourceId: string): void {
    e.stopPropagation();
    this.lastValidDropPreview = null;
    const orderId = this.getOrderIdFromReference(orderRef);
    e.dataTransfer?.setData('orderId', orderId ?? orderRef);
    e.dataTransfer?.setData('dropType', 'order');
    e.dataTransfer?.setData('droptype', 'order');
    e.dataTransfer?.setData('text/plain', orderId ?? orderRef);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    this.nativeDraggedEventId = null;
    this.nativeDropHandled = false;
  }

  onOrderRunDragEnd(e: DragEvent, orderRef: string): void {
    e.stopPropagation();
    this.dropPreview = null;
    this.lastValidDropPreview = null;
    this.nativeDraggedEventId = null;
  }

  private getOrderIdFromReference(orderRef: string): string | null {
    const ref = orderRef.startsWith('SOW') ? orderRef.slice(3) : orderRef;
    return ref || null;
  }

  getScheduledEventsForOrder(resourceId: string, day: Date, orderRef: string): SchedulerEvent[] {
    return this.getScheduledEventsForResourceDay(resourceId, day)
      .filter(evt => this.getEventOrderReference(evt) === orderRef);
  }

  getUngroupedCapacityBlocks(resourceId: string, day: Date): SchedulerCapacityBlock[] {
    const runs = this.getCapacityOrderRuns(resourceId, day);
    const groupedRefs = new Set(runs.map(r => r.orderRef));
    return this.getVisibleCapacityBlocksForResourceDay(resourceId, day)
      .filter(block => !groupedRefs.has(this.getCapacityBlockOrderReference(block)));
  }

  getUngroupedScheduledEvents(resourceId: string, day: Date): SchedulerEvent[] {
    const runs = this.getCapacityOrderRuns(resourceId, day);
    const groupedRefs = new Set(runs.map(r => r.orderRef));
    return this.getScheduledEventsForResourceDay(resourceId, day)
      .filter(evt => !groupedRefs.has(this.getEventOrderReference(evt)));
  }

  private getCollapsedCapacityVisibleCount(blockCount: number): number {
    return 1;
  }

  isCapacityLaneExpanded(resourceId: string, day: Date): boolean {
    return this.expandedCapacityLane?.resourceId === resourceId &&
      this.expandedCapacityLane.dayKey === this.getCapacityDayKey(day);
  }

  toggleCapacityLaneExpansion(event: MouseEvent, resourceId: string, day: Date): void {
    event.preventDefault();
    event.stopPropagation();
    this.hideCapacityOverflowPreview();
    const dayKey = this.getCapacityDayKey(day);
    this.expandedCapacityLane = this.isCapacityLaneExpanded(resourceId, day)
      ? null
      : { resourceId, dayKey };
  }

  getResourceRowHeight(resourceId: string): number {
    if (this.expandedCapacityLane?.resourceId !== resourceId) return ROW_HEIGHT;

    const day = this.daySlots.find(slot => this.getCapacityDayKey(slot) === this.expandedCapacityLane?.dayKey);
    if (!day) return ROW_HEIGHT;

    const blockCount = this.getCapacityBlocksForResourceDay(resourceId, day).length;
    if (!this.isCapacityLaneExpandable(blockCount)) return ROW_HEIGHT;

    const runs = this.getCapacityOrderRuns(resourceId, day);
    const runHeaderCount = runs.length;
    const visibleItemCount = blockCount + runHeaderCount + 1;
    const expandedHeight = CAPACITY_LANE_PADDING_Y +
      blockCount * CAPACITY_BLOCK_HEIGHT +
      runHeaderCount * 20 +
      CAPACITY_OVERFLOW_BUTTON_HEIGHT +
      Math.max(visibleItemCount - 1, 0) * CAPACITY_LANE_GAP;

    return Math.max(ROW_HEIGHT, expandedHeight);
  }

  private isCapacityLaneExpandedForBlocks(resourceId: string, day: Date, blockCount: number): boolean {
    return this.isCapacityLaneExpandable(blockCount) &&
      this.expandedCapacityLane?.resourceId === resourceId &&
      this.expandedCapacityLane.dayKey === this.getCapacityDayKey(day);
  }

  private isCapacityLaneExpandable(blockCount: number): boolean {
    return blockCount > 1;
  }

  private reconcileExpandedCapacityLane(): void {
    if (!this.expandedCapacityLane) return;

    const day = this.daySlots.find(slot => this.getCapacityDayKey(slot) === this.expandedCapacityLane?.dayKey);
    const resourceExists = this.resources.some(resource => resource.id === this.expandedCapacityLane?.resourceId);
    const blockCount = day && resourceExists
      ? this.getCapacityBlocksForResourceDay(this.expandedCapacityLane.resourceId, day).length
      : 0;

    if (!this.isCapacityLaneExpandable(blockCount)) {
      this.expandedCapacityLane = null;
    }
  }

  getDropPreviewHeight(): number {
    return this.dropPreview ? this.getResourceRowHeight(this.dropPreview.resourceId) : ROW_HEIGHT;
  }

  private getCapacityDayKey(day: Date): string {
    const year = day.getFullYear();
    const month = String(day.getMonth() + 1).padStart(2, '0');
    const date = String(day.getDate()).padStart(2, '0');
    return `${year}-${month}-${date}`;
  }

  getCapacityLaneLeft(day: Date): number {
    return this.getDayOffsetPx(day);
  }

  getCapacityLaneTitle(resourceId: string, day: Date): string {
    const durationMinutes = this.getCapacityBlockedDurationMinutes(resourceId, day);
    return durationMinutes ? `${this.formatMinutes(durationMinutes)} blocked` : 'Drop here to block day capacity';
  }

  getCapacityBlockedDurationLabel(resourceId: string, day: Date): string {
    return `${this.formatMinutes(this.getCapacityBlockedDurationMinutes(resourceId, day))} blocked`;
  }

  getCapacityOverflowLabel(resourceId: string, day: Date, hiddenCount: number): string {
    return `+${hiddenCount} more \u00b7 ${this.getHiddenCapacityBlockedDurationShortLabel(resourceId, day)}`;
  }

  getGroupCapacityOverflowLabel(groupId: string, day: Date, hiddenCount: number): string {
    const blocks = this.getGroupCapacityBlocksForDay(groupId, day);
    const hiddenDurationMinutes = blocks
      .slice(1)
      .reduce((sum, block) => sum + block.durationMinutes, 0);
    return `+${hiddenCount} more \u00b7 ${this.formatCapacityDurationShort(hiddenDurationMinutes)}`;
  }

  getCapacityBlockTitle(block: SchedulerCapacityBlock): string {
    return block.title;
  }

  getCapacityBlockDetail(block: SchedulerCapacityBlock): string {
    return this.formatMinutes(block.durationMinutes);
  }

  getCapacityBlockSummary(block: SchedulerCapacityBlock): string {
    return `${this.getCapacityBlockDetail(block)} \u00b7 ${block.title}`;
  }

  getCapacityBlockOrderReference(block: SchedulerCapacityBlock): string {
    const entryReference = block.meta?.entry?.workOrderReference;
    const order = (block.meta as any)?.order;
    const reference = entryReference ?? order?.referenceNumber ?? order?.orderNumber ?? order?.id;
    if (!reference) return 'SOW12345';
    return String(reference).startsWith('SOW') ? String(reference) : `SOW${reference}`;
  }

  getCapacityBlockOrderId(block: SchedulerCapacityBlock): string | null {
    const order = (block.meta as any)?.order;
    const entry = block.meta?.entry;
    const reference = entry?.workOrderReference;
    const activityOrderId = entry?.jobId?.includes(':act-') ? entry.jobId.split(':act-')[0] : null;
    return order?.id ?? order?.referenceNumber ?? reference ?? activityOrderId ?? null;
  }

  getCapacityBlockAriaLabel(block: SchedulerCapacityBlock): string {
    return `${this.getCapacityBlockOrderReference(block)} ${block.title}, day capacity, ${this.getCapacityBlockDetail(block)}`;
  }

  isCapacityBlockUnfocused(block: SchedulerCapacityBlock): boolean {
    if (!this.detailedOrderIds.length) return false;
    const ref = this.getCapacityBlockOrderReference(block);
    const orderId = this.getCapacityBlockOrderId(block);
    return !this.detailedOrderIds.some(id => id === ref || id === orderId);
  }

  showCapacityOverflowPreview(event: MouseEvent | FocusEvent, resource: SchedulerResource, day: Date, hiddenCount: number): void {
    const blocks = this.getCapacityBlocksForResourceDay(resource.id, day);
    const point = this.getCapacityPreviewPoint(event);
    this.capacityOverflowPreview = {
      blocks,
      hiddenCount,
      blockedDurationLabel: this.getCapacityBlockedDurationLabel(resource.id, day),
      jobCountLabel: this.getCapacityJobCountLabel(blocks.length),
      x: point.x,
      y: point.y,
    };
  }

  moveCapacityOverflowPreview(event: MouseEvent, resource: SchedulerResource, day: Date, hiddenCount: number): void {
    if (!this.capacityOverflowPreview) return;
    this.showCapacityOverflowPreview(event, resource, day, hiddenCount);
  }

  hideCapacityOverflowPreview(): void {
    this.capacityOverflowPreview = null;
  }

  showGroupCapacityOverflowPreview(event: MouseEvent | FocusEvent, groupId: string, groupLabel: string, day: Date, hiddenCount: number): void {
    const blocks = this.getGroupCapacityBlocksForDay(groupId, day);
    const totalDurationMinutes = blocks.reduce((sum, block) => sum + block.durationMinutes, 0);
    const durationLabel = this.formatCapacityDurationShort(totalDurationMinutes);
    const point = this.getCapacityPreviewPoint(event);
    this.capacityOverflowPreview = {
      blocks,
      hiddenCount,
      blockedDurationLabel: durationLabel,
      jobCountLabel: this.getCapacityJobCountLabel(blocks.length),
      x: point.x,
      y: point.y,
    };
  }

  private getCapacityPreviewPoint(event: MouseEvent | FocusEvent): { x: number; y: number } {
    if (event instanceof MouseEvent) {
      return { x: event.clientX + 12, y: event.clientY + 12 };
    }

    const element = event.currentTarget as HTMLElement | null;
    const rect = element?.getBoundingClientRect();
    return rect
      ? { x: rect.right + 8, y: rect.top }
      : { x: 12, y: 12 };
  }

  getCapacityPreviewOrderGroups(): { orderRef: string; blocks: SchedulerCapacityBlock[] }[] {
    if (!this.capacityOverflowPreview) return [];
    const blocks = this.capacityOverflowPreview.blocks;
    const orderMap = new Map<string, SchedulerCapacityBlock[]>();
    for (const block of blocks) {
      const ref = this.getCapacityBlockOrderReference(block);
      if (!orderMap.has(ref)) {
        orderMap.set(ref, []);
      }
      orderMap.get(ref)!.push(block);
    }
    return [...orderMap.entries()].map(([orderRef, blocks]) => ({ orderRef, blocks }));
  }

  private getCapacityBlockedDurationMinutes(resourceId: string, day: Date): number {
    return this.getCapacityBlocksForResourceDay(resourceId, day)
      .reduce((sum, block) => sum + block.durationMinutes, 0);
  }

  private getCapacityBlockedDurationShortLabel(resourceId: string, day: Date): string {
    return this.formatCapacityDurationShort(this.getCapacityBlockedDurationMinutes(resourceId, day));
  }

  private getHiddenCapacityBlockedDurationShortLabel(resourceId: string, day: Date): string {
    const blocks = this.getCapacityBlocksForResourceDay(resourceId, day);
    const visibleCount = this.getCollapsedCapacityVisibleCount(blocks.length);
    const hiddenDurationMinutes = blocks
      .slice(visibleCount)
      .reduce((sum, block) => sum + block.durationMinutes, 0);

    return this.formatCapacityDurationShort(hiddenDurationMinutes);
  }

  private formatCapacityDurationShort(durationMinutes: number): string {
    if (durationMinutes <= 0) return '0h';
    const hours = durationMinutes / 60;
    return `${Number.isInteger(hours) ? hours : Number(hours.toFixed(2))}h`;
  }

  private getCapacityJobCountLabel(blockCount: number): string {
    return `${blockCount} ${blockCount === 1 ? 'job' : 'jobs'}`;
  }

  getUnavailabilityLeft(block: UnavailabilityBlock): number {
    return this.getLeftFromDate(block.start);
  }

  getUnavailabilityWidth(block: UnavailabilityBlock): number {
    return (block.end.getTime() - block.start.getTime()) / 3600000 * this.HOUR_WIDTH;
  }

  getInvalidDropRangesForResource(resourceId: string): SchedulerInvalidDropRange[] {
    return this.invalidDropRanges.filter(range => range.resourceId === resourceId);
  }

  getInvalidDropRangeLeft(range: SchedulerInvalidDropRange): number {
    return this.getLeftFromDate(range.start);
  }

  getInvalidDropRangeWidth(range: SchedulerInvalidDropRange): number {
    return Math.max((range.end.getTime() - range.start.getTime()) / 3600000 * this.HOUR_WIDTH, 0);
  }

  private rangesOverlap(firstStart: Date, firstEnd: Date, secondStart: Date, secondEnd: Date): boolean {
    return firstStart < secondEnd && secondStart < firstEnd;
  }

  getUnavailabilityTitle(block: UnavailabilityBlock): string {
    return block.title ?? block.reason ?? 'Unavailable';
  }

  getUnavailabilityDetail(block: UnavailabilityBlock): string {
    return `${this.formatDateRange(block.start, block.end)} | ${this.formatDuration(block.start, block.end)}`;
  }

  private getBlockDuration(block: UnavailabilityBlock): string {
    return this.formatDuration(block.start, block.end);
  }

  isLunchBlock(block: UnavailabilityBlock): boolean {
    return (block.title ?? block.reason ?? '').toLowerCase() === 'lunch';
  }

  getEventLeft(event: SchedulerEvent): number {
    return this.getLeftFromDate(event.start);
  }

  private getLeftFromDate(date: Date): number {
    const eventDay = new Date(date);
    eventDay.setHours(0, 0, 0, 0);
    const dayOffset = this.getDayOffsetPx(eventDay);
    const hourOffset = this.getDayCapacityLaneWidth() + (date.getHours() - 9 + date.getMinutes() / 60) * this.HOUR_WIDTH;
    return dayOffset + hourOffset;
  }

  getEventWidth(event: SchedulerEvent): number {
    // Count only visible hours (09:00–21:00 per day) across the span
    let visibleHours = 0;
    const start = new Date(event.start);
    const end = new Date(event.end);

    // Walk day by day and accumulate visible time
    const cursor = new Date(start);
    cursor.setSeconds(0, 0);

    while (cursor < end) {
      const dayStart = new Date(cursor);
      dayStart.setHours(9, 0, 0, 0);
      const dayEnd = new Date(cursor);
      dayEnd.setHours(21, 0, 0, 0);

      const sliceStart = cursor < dayStart ? dayStart : cursor;
      const sliceEnd   = end < dayEnd ? end : dayEnd;

      if (sliceStart < sliceEnd) {
        visibleHours += (sliceEnd.getTime() - sliceStart.getTime()) / 3600000;
      }

      // Advance to next day 09:00
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(9, 0, 0, 0);
    }

    return Math.max(visibleHours * this.HOUR_WIDTH, 20);
  }

  getFreeHoursForResource(resourceId: string): number {
    const workingRanges = this.getWorkingRangesForCurrentView();
    const totalWorkingMs = workingRanges.reduce((sum, r) => sum + (r.end.getTime() - r.start.getTime()), 0);

    const bookedMs = this.events
      .filter(e => e.resourceId === resourceId)
      .reduce((sum, e) => {
        // Intersect with each working range
        return sum + workingRanges.reduce((wSum, r) => {
          const start = Math.max(e.start.getTime(), r.start.getTime());
          const end = Math.min(e.end.getTime(), r.end.getTime());
          return wSum + Math.max(0, end - start);
        }, 0);
      }, 0);

    const freeMs = Math.max(0, totalWorkingMs - bookedMs);
    return Math.round((freeMs / 3600000) * 10) / 10;
  }

  hasContiguousPreviousEvent(event: SchedulerEvent): boolean {
    const orderKey = this.getEventOrderKey(event);
    if (!orderKey) return false;
    return this.events.some(candidate =>
      candidate.id !== event.id &&
      candidate.resourceId === event.resourceId &&
      this.getEventOrderKey(candidate) === orderKey &&
      candidate.end.getTime() === event.start.getTime()
    );
  }

  hasContiguousNextEvent(event: SchedulerEvent): boolean {
    const orderKey = this.getEventOrderKey(event);
    if (!orderKey) return false;
    return this.events.some(candidate =>
      candidate.id !== event.id &&
      candidate.resourceId === event.resourceId &&
      this.getEventOrderKey(candidate) === orderKey &&
      candidate.start.getTime() === event.end.getTime()
    );
  }

  private getEventOrderKey(event: SchedulerEvent): string | null {
    const entryReference = event.meta?.entry?.workOrderReference;
    const order = (event.meta as any)?.order;
    const reference = entryReference ?? order?.referenceNumber ?? order?.id;
    return reference ? String(reference) : null;
  }

  shouldShowEventTag(event: SchedulerEvent): boolean {
    const available = this.getEventAvailableTagWidth(event);
    return available >= this.getStatusTagWidth(event, false);
  }

  shouldShowEventTagIconOnly(event: SchedulerEvent): boolean {
    const available = this.getEventAvailableTagWidth(event);
    const fullStatusWidth = this.getStatusTagWidth(event, true);
    const iconOnlyWidth = this.getStatusTagWidth(event, false);
    if (available < iconOnlyWidth) return false;

    const categories = this.getEventCategories(event);
    if (!categories.length) {
      return available < fullStatusWidth;
    }

    const firstCategoryIconWidth = this.getCategoryTagWidth(categories[0], false);
    return available < fullStatusWidth + firstCategoryIconWidth;
  }

  shouldShowEventCategoryLabels(event: SchedulerEvent): boolean {
    return this.canShowEventCategoryLabels(event, this.getVisibleEventCategories(event));
  }

  getRenderedEventLeft(event: SchedulerEvent): number {
    const eventId = this.getSourceEventId(event);
    if (this.resizePreview?.event.id === eventId) return this.resizePreview.left;
    return this.getEventLeft(event);
  }

  getRenderedEventWidth(event: SchedulerEvent): number {
    const eventId = this.getSourceEventId(event);
    if (this.resizePreview?.event.id === eventId) return this.resizePreview.width;
    if (!this.shouldShowEventDetails(event)) return this.getCompactAvailabilityBlockWidth(event);
    return this.getEventWidth(event);
  }

  private getCompactAvailabilityBlockWidth(event: SchedulerEvent): number {
    return this.getEventWidth({ ...event, end: this.getCompactAvailabilityBlockEnd(event) });
  }

  private getCompactAvailabilityBlockEnd(event: SchedulerEvent): Date {
    let end = event.end;
    let next = this.getNextCompactContiguousEvent(event);
    while (next) {
      end = next.end;
      next = this.getNextCompactContiguousEvent(next);
    }
    return end;
  }

  private hasCompactContiguousPreviousEvent(event: SchedulerEvent): boolean {
    return !!this.getPreviousCompactContiguousEvent(event);
  }

  private getPreviousCompactContiguousEvent(event: SchedulerEvent): SchedulerEvent | undefined {
    const orderKey = this.getEventOrderKey(event);
    if (!orderKey || this.shouldShowEventDetails(event)) return undefined;
    return this.getRenderedEventsForResource(event.resourceId).find(candidate =>
      this.getSourceEventId(candidate) !== this.getSourceEventId(event) &&
      !this.shouldShowEventDetails(candidate) &&
      this.getEventOrderKey(candidate) === orderKey &&
      candidate.end.getTime() === event.start.getTime()
    );
  }

  private getNextCompactContiguousEvent(event: SchedulerEvent): SchedulerEvent | undefined {
    const orderKey = this.getEventOrderKey(event);
    if (!orderKey || this.shouldShowEventDetails(event)) return undefined;
    return this.getRenderedEventsForResource(event.resourceId).find(candidate =>
      this.getSourceEventId(candidate) !== this.getSourceEventId(event) &&
      !this.shouldShowEventDetails(candidate) &&
      this.getEventOrderKey(candidate) === orderKey &&
      candidate.start.getTime() === event.end.getTime()
    );
  }
  getRenderedEventTop(event: SchedulerEvent): number {
    return this.shouldReserveOrderRunSpace(event) ? ORDER_TILE_HEIGHT : 0;
  }

  getRenderedEventHeight(event: SchedulerEvent): number {
    return this.shouldReserveOrderRunSpace(event) ? JOB_TILE_HEIGHT : ROW_HEIGHT;
  }

  getOrderRunsForResource(resourceId: string): SchedulerOrderRun[] {
    const events = this.getEventsForResource(resourceId)
      .filter(event => !!this.getEventOrderKey(event))
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    const runs: SchedulerOrderRun[] = [];

    for (const event of events) {
      const key = this.getEventOrderKey(event);
      if (!key) continue;
      const previous = runs[runs.length - 1];
      if (previous && previous.key === key && previous.end.getTime() === event.start.getTime()) {
        previous.events.push(event);
        previous.end = event.end;
      } else {
        runs.push({ key, resourceId, events: [event], start: event.start, end: event.end, firstEvent: event });
      }
    }

    return runs;
  }

  shouldRenderOrderRun(run: SchedulerOrderRun): boolean {
    if (this.isDragFeedbackActive()) return false;
    if (this.resizePreview?.event.resourceId === run.resourceId) return false;
    return run.events.length > 1 && (this.showOrderTiles || this.detailedOrderIds.includes(run.key));
  }

  isPulsingOrderRun(run: SchedulerOrderRun): boolean {
    return run.events.some(event => this.activePulseEventIds.has(this.getSourceEventId(event)));
  }

  getOrderRunLeft(run: SchedulerOrderRun): number {
    return this.getLeftFromDate(run.start);
  }

  getOrderRunWidth(run: SchedulerOrderRun): number {
    return this.getEventWidth({ ...run.firstEvent, start: run.start, end: run.end });
  }

  private isSameDay(first: Date, second: Date): boolean {
    return first.toDateString() === second.toDateString();
  }

  isInContiguousOrderRun(event: SchedulerEvent): boolean {
    return this.hasContiguousPreviousEvent(event) || this.hasContiguousNextEvent(event);
  }

  shouldReserveOrderRunSpace(event: SchedulerEvent): boolean {
    if (this.showCapacityOnlyMode) return false;
    const orderKey = this.getEventOrderKey(event);
    return this.shouldShowEventDetails(event)
      && this.isInContiguousOrderRun(event)
      && (this.showOrderTiles || (!!orderKey && this.detailedOrderIds.includes(orderKey)));
  }

  isPreviewingEvent(event: SchedulerEvent): boolean {
    const eventId = this.getSourceEventId(event);
    return this.resizePreview?.event.id === eventId;
  }

  isPulsingEvent(event: SchedulerEvent): boolean {
    return this.activePulseEventIds.has(this.getSourceEventId(event));
  }

  isEventResizeActive(event: SchedulerEvent): boolean {
    return this.resizing?.event.id === this.getSourceEventId(event);
  }

  shouldRenderEventForResource(event: SchedulerEvent, resourceId: string): boolean {
    if (this.showCapacityOnlyMode) return false;
    const eventId = this.getSourceEventId(event);
    if (this.resizePreview?.event.id === eventId) return false;
    if (this.isDragFeedbackActive() && this.nativeDraggedEventId !== eventId) return false;
    if (this.resizePreview?.event.resourceId === resourceId) return false;
    if (this.hasCompactContiguousPreviousEvent(event)) return false;
    return event.resourceId === resourceId;
  }
  shouldShowEventDetails(event: SchedulerEvent): boolean {
    if (this.showCapacityOnlyMode) return true;
    return this.showOrderTiles || this.detailedEventIds.includes(this.getSourceEventId(event));
  }

  private getSourceEventId(event: SchedulerEvent): string {
    return (event.meta as any)?.sourceEventId ?? event.id;
  }

  getPreviewEvent(): SchedulerEvent | null {
    return this.resizePreview?.event ?? null;
  }

  getResizePreviewForResource(resourceId: string): SchedulerEvent | null {
    const event = this.resizePreview?.event;
    return event?.resourceId === resourceId ? event : null;
  }

  isDragFeedbackActive(): boolean {
    return !!this.dropPreview || !!this.dropVisualContext;
  }

  isUnavailableFeedbackActive(): boolean {
    return this.isDragFeedbackActive() || !!this.resizePreview;
  }

  shouldShowUnavailableFeedbackForResource(resourceId: string): boolean {
    if (this.showAvailabilityBlocks) return true;
    if (this.isDragFeedbackActive()) return true;
    return this.resizePreview?.event.resourceId === resourceId;
  }

  shouldShowBaseAvailabilityBlocks(): boolean {
    return this.showAvailabilityBlocks || !this.invalidDropRanges.length;
  }

  getPreviewLeft(): number {
    return this.resizePreview?.left ?? 0;
  }

  getPreviewTop(): number {
    const event = this.resizePreview?.event;
    return event && this.shouldShowEventDetails(event) ? this.getRenderedEventTop(event) : 0;
  }

  getPreviewWidth(): number {
    return this.resizePreview?.width ?? 0;
  }

  getPreviewHeight(): number {
    const event = this.resizePreview?.event;
    return event && this.shouldShowEventDetails(event) ? this.getRenderedEventHeight(event) : this.rowHeight;
  }

  isResizePreviewInvalid(): boolean {
    return !!this.getResizePreviewInvalidRange();
  }

  getResizePreviewHint(): string {
    return this.getResizePreviewInvalidRange()?.reason || this.resizeInvalidHint;
  }

  private getResizePreviewInvalidRange(): SchedulerInvalidDropRange | null {
    const preview = this.resizePreview;
    if (!preview) return null;

    const dayWidthPx = this.getDayWidth();
    const dayIndex = Math.max(0, Math.min(Math.floor(preview.left / dayWidthPx), this.daySlots.length - 1));
    const start = new Date(this.daySlots[dayIndex]);
    start.setHours(9, 0, 0, 0);
    start.setMinutes(((preview.left - dayIndex * dayWidthPx - this.getDayCapacityLaneWidth()) / this.HOUR_WIDTH) * MINUTES_PER_FRU, 0, 0);
    const durationMinutes = (preview.width / this.HOUR_WIDTH) * MINUTES_PER_FRU;
    const end = new Date(start.getTime() + durationMinutes * 60000);

    return this.invalidDropRanges.find(range =>
      range.resourceId === preview.event.resourceId &&
      this.rangesOverlap(start, end, range.start, range.end)
    ) ?? null;
  }

  getDropPreviewLeft(): number {
    return (this.dropPreview?.left ?? 0) + RESOURCE_COL_WIDTH;
  }

  getDropPreviewTop(): number {
    return this.dropPreview?.top ?? 0;
  }

  getDropPreviewWidth(): number {
    return this.dropPreview?.width ?? 0;
  }

  getDropPreviewMode(): 'timed' | 'day-capacity' {
    return this.dropPreview?.mode ?? 'timed';
  }

  isDropPreviewInvalidForResource(resourceId: string): boolean {
    if (this.dropPreview?.mode === 'day-capacity') {
      return this.dropPreview.resourceId === resourceId &&
        this.isCapacityDropPreviewInvalidForResource(resourceId);
    }
    return !!this.dropPreview &&
      this.dropPreview.resourceId === resourceId &&
      this.invalidDropRanges.some(range =>
        range.resourceId === resourceId &&
        this.rangesOverlap(this.dropPreview!.start, this.dropPreview!.end, range.start, range.end)
      );
  }

  isDropPreviewInvalid(): boolean {
    return !!this.dropPreview && this.isDropPreviewInvalidForResource(this.dropPreview.resourceId);
  }

  isDropTargetResource(resourceId: string): boolean {
    return this.dropTargetResourceId === resourceId;
  }

  isCapacityDropPreviewForResourceDay(resourceId: string, day: Date): boolean {
    return this.dropPreview?.mode === 'day-capacity' &&
      this.dropPreview.resourceId === resourceId &&
      !!this.dropPreview.date &&
      this.isSameDay(this.dropPreview.date, day);
  }

  isCapacityDropPreviewInvalidForResourceDay(resourceId: string, day: Date): boolean {
    return this.isCapacityDropPreviewForResourceDay(resourceId, day) &&
      this.isCapacityDropPreviewInvalidForResource(resourceId);
  }

  private isCapacityDropPreviewInvalidForResource(resourceId: string): boolean {
    return this.invalidCapacityResources.some(resource =>
      resource.resourceId === resourceId &&
      (!resource.date || !this.dropPreview?.date || this.isSameDay(resource.date, this.dropPreview.date))
    );
  }

  getEventTagLabel(event: SchedulerEvent): string {
    const status = this.getWorkorderItemStatus(event);
    if (status === 'unscheduled') return 'Unscheduled';
    if (status === 'scheduled') return 'Scheduled';
    if (status === 'in-progress' || status === 'started') return 'In progress';
    if (status === 'completed') return 'Completed';
    if (status === 'cancelled') return 'Cancelled';
    return '';
  }

  getEventTagBackground(event: SchedulerEvent): string {
    const status = this.getWorkorderItemStatus(event);
    if (status === 'scheduled') return 'var(--Tag-tag-background-yellow, #FFE8BF)';
    if (status === 'in-progress' || status === 'started') return 'var(--Tag-tag-background-blue, #D0E2FF)';
    if (status === 'completed') return 'var(--Tag-tag-background-green, #A7F0BA)';
    if (status === 'cancelled') return 'var(--Tag-tag-background-red, #FFD7D9)';
    return 'var(--Tag-tag-background-gray, #E0E0E0)';
  }

  getEventTagColor(event: SchedulerEvent): string {
    const status = this.getWorkorderItemStatus(event);
    if (status === 'scheduled') return 'var(--Tag-tag-color-yellow, #684E00)';
    if (status === 'in-progress' || status === 'started') return 'var(--Tag-tag-color-blue, #0043CE)';
    if (status === 'completed') return 'var(--Tag-tag-color-green, #0E6027)';
    if (status === 'cancelled') return 'var(--Tag-tag-color-red, #A2191F)';
    return 'var(--Tag-tag-color-gray, #161616)';
  }
  getWorkorderItemStatus(event: SchedulerEvent): WorkorderItemStatus {
    const entryStatus = event.meta?.entry?.workorderItemStatus;
    const jobStatus = event.meta?.job?.workorderItemStatus;
    return this.normalizeWorkorderItemStatus(entryStatus ?? jobStatus);
  }

  private normalizeWorkorderItemStatus(status: unknown): WorkorderItemStatus {
    if (status === 'scheduled' || status === 'completed' || status === 'cancelled' || status === 'unscheduled') return status;
    if (status === 'started' || status === 'in-progress') return 'in-progress';
    return 'unscheduled';
  }

  isBlockedOrderEvent(event: SchedulerEvent): boolean {
    return event.meta?.entry?.kind === 'blocked-order';
  }

  isResourceBlockEvent(event: SchedulerEvent): boolean {
    return event.meta?.entry?.kind === 'resource-block';
  }

  getEventDetail(event: SchedulerEvent): string {
    return `${this.formatEventTimeRange(event)} | ${this.getEventDuration(event)}`;
  }

  isActivityEvent(event: SchedulerEvent): boolean {
    return event.meta?.entry?.workorderItemCategory === 'activity' || this.getActivityTemplateId(event).startsWith('act-');
  }

  getEventWorkItemLabel(event: SchedulerEvent): string {
    return this.isActivityEvent(event) ? 'Activity' : 'Job';
  }

  getEventJobDescription(event: SchedulerEvent): string {
    return event.title ?? event.meta?.job?.title ?? event.meta?.entry?.title ?? 'Booking';
  }

  getEventJobLongDescription(event: SchedulerEvent): string | null {
    if (!this.isActivityEvent(event)) return event.meta?.job?.description ?? null;

    const templateId = this.getActivityTemplateId(event);
    if (templateId === 'act-checkin') return 'Receive the customer, confirm appointment details, vehicle condition, and requested work before workshop processing.';
    if (templateId === 'act-handover') return 'Review completed work with the customer, confirm vehicle readiness, and complete final handover steps.';
    if (templateId === 'act-mobility') return 'Arrange the customer mobility option and keep it reserved for the appointment duration.';
    return 'Coordinate the planned service activity for this order.';
  }

  private getActivityTemplateId(event: SchedulerEvent): string {
    const jobId = event.meta?.entry?.jobId ?? event.meta?.job?.id ?? event.id;
    return jobId.split(':').pop() ?? jobId;
  }

  getEventCustomerName(event: SchedulerEvent): string {
    const order = (event.meta as any)?.order;
    return order?.customer?.name ?? 'Unknown customer';
  }

  getEventLicensePlate(event: SchedulerEvent): string {
    const order = (event.meta as any)?.order;
    return order?.vehicle?.licensePlate ?? 'No vehicle';
  }

  getEventCustomerVehicleDetail(event: SchedulerEvent): string {
    if (this.isResourceBlockEvent(event)) return event.meta?.entry?.description || 'Resource blocked';
    return `${this.getEventCustomerName(event)} | ${this.getEventLicensePlate(event)}`;
  }

  getEventCustomerEmail(event: SchedulerEvent): string | null {
    const order = (event.meta as any)?.order;
    return order?.customer?.email ?? null;
  }

  getEventCustomerPhone(event: SchedulerEvent): string | null {
    const order = (event.meta as any)?.order;
    return order?.customer?.phone ?? null;
  }

  getEventTileAriaLabel(event: SchedulerEvent): string {
    return [
      this.getEventOrderReference(event),
      this.getEventJobDescription(event),
      this.getEventDetail(event),
      this.getEventCustomerVehicleDetail(event),
      this.getEventCustomerEmail(event) ? `Email ${this.getEventCustomerEmail(event)}` : '',
      this.getEventCustomerPhone(event) ? `Phone ${this.getEventCustomerPhone(event)}` : '',
      this.getEventTagLabel(event),
    ].filter(Boolean).join(', ');
  }

  getEventTooltipResource(event: SchedulerEvent): string {
    return this.resources.find(candidate => candidate.id === event.resourceId)?.label ?? event.resourceId;
  }

  showEventTooltip(event: SchedulerEvent, mouseEvent: MouseEvent): void {
    if (this.isResizePreviewInvalid()) return;
    if (Date.now() < this.suppressHoverTooltipUntil) return;
    this.clearHoverTooltipTimeout();
    const x = mouseEvent.clientX + 12;
    const y = mouseEvent.clientY + 12;
    this.hoverTooltipTimeoutId = setTimeout(() => {
      if (Date.now() < this.suppressHoverTooltipUntil) return;
      this.hoverTooltip = { event, x, y };
      this.cdr.detectChanges();
    }, 180);
  }

  moveEventTooltip(event: SchedulerEvent, mouseEvent: MouseEvent): void {
    if (this.isResizePreviewInvalid()) return;
    if (Date.now() < this.suppressHoverTooltipUntil) return;
    if (!this.hoverTooltip) return;
    this.hoverTooltip = {
      event,
      x: mouseEvent.clientX + 12,
      y: mouseEvent.clientY + 12,
    };
  }

  hideEventTooltip(): void {
    this.clearHoverTooltipTimeout();
    this.hoverTooltip = null;
  }

  private suppressEventTooltip(durationMs = 800): void {
    this.suppressHoverTooltipUntil = Date.now() + durationMs;
    this.hideEventTooltip();
  }

  private clearHoverTooltipTimeout(): void {
    if (!this.hoverTooltipTimeoutId) return;
    clearTimeout(this.hoverTooltipTimeoutId);
    this.hoverTooltipTimeoutId = null;
  }

  shouldShowEventContacts(event: SchedulerEvent): boolean {
    return this.getEventWidth(event) >= EVENT_CONTACT_MIN_WIDTH;
  }

  suppressEventAction(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
  }

  copyEventContact(event: Event, schedulerEvent: SchedulerEvent, contactType: 'email' | 'phone'): void {
    this.suppressEventAction(event);
    const value = contactType === 'email'
      ? this.getEventCustomerEmail(schedulerEvent)
      : this.getEventCustomerPhone(schedulerEvent);
    if (!value) return;

    void this.copyTextToClipboard(value).then(() => {
      this.copiedContactKey = this.getContactCopyKey(schedulerEvent, contactType);
      if (this.copiedContactResetId) clearTimeout(this.copiedContactResetId);
      this.copiedContactResetId = setTimeout(() => {
        this.copiedContactKey = null;
        this.copiedContactResetId = null;
      }, 1500);
    });
  }

  isEventContactCopied(event: SchedulerEvent, contactType: 'email' | 'phone'): boolean {
    return this.copiedContactKey === this.getContactCopyKey(event, contactType);
  }

  private getContactCopyKey(event: SchedulerEvent, contactType: 'email' | 'phone'): string {
    return `${event.id}:${contactType}`;
  }

  private async copyTextToClipboard(value: string): Promise<void> {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }

  onOrderFocusClick(domEvent: Event, schedulerEvent: SchedulerEvent): void {
    this.suppressEventAction(domEvent);
    const orderId = this.getEventOrderId(schedulerEvent);
    this.orderFocusRequested.emit({ orderId: orderId ?? undefined, eventId: schedulerEvent.id });
  }

  onCapacityOrderFocusClick(domEvent: Event, block: SchedulerCapacityBlock): void {
    this.suppressEventAction(domEvent);
    const orderId = this.getCapacityBlockOrderId(block);
    this.orderFocusRequested.emit({ orderId: orderId ?? undefined, eventId: block.id });
  }

  getEventOrderId(event: SchedulerEvent): string | null {
    const order = (event.meta as any)?.order;
    const entry = event.meta?.entry;
    const reference = entry?.workOrderReference;
    const activityOrderId = entry?.jobId?.includes(':act-') ? entry.jobId.split(':act-')[0] : null;
    return order?.id ?? order?.referenceNumber ?? reference ?? activityOrderId ?? null;
  }
  getEventOrderReference(event: SchedulerEvent): string {
    if (this.isResourceBlockEvent(event)) return 'Block';
    const entryReference = event.meta?.entry?.workOrderReference;
    const order = (event.meta as any)?.order;
    const reference = entryReference ?? order?.referenceNumber ?? order?.orderNumber ?? order?.id;
    if (!reference) return event.title || 'SOW12345';
    return String(reference).startsWith('SOW') ? String(reference) : `SOW${reference}`;
  }

  getEventOrderSequence(event: SchedulerEvent): string {
    const order = (event.meta as any)?.order;
    const totalJobs = order?.jobs?.length ?? 1;
    const visibleJobs = new Set(
      this.events
        .filter(candidate => this.getEventOrderKey(candidate) === this.getEventOrderKey(event))
        .map(candidate => candidate.meta?.entry?.jobId ?? candidate.meta?.job?.id ?? candidate.id)
    );
    return `${visibleJobs.size}/${totalJobs}`;
  }

  getOrderRunSequence(run: SchedulerOrderRun): string {
    const order = (run.firstEvent.meta as any)?.order;
    const totalJobs = order?.jobs?.length ?? run.events.length;
    const visibleJobs = new Set(run.events.map(event => event.meta?.entry?.jobId ?? event.meta?.job?.id ?? event.id)).size;
    return `${visibleJobs}/${totalJobs}`;
  }

  getEventDuration(event: SchedulerEvent): string {
    return this.formatDuration(event.start, event.end);
  }

  private formatMinutes(durationMinutes: number): string {
    const totalMinutes = Math.max(0, Math.round(durationMinutes));
    const hours = Math.floor(totalMinutes / MINUTES_PER_FRU);
    const minutes = totalMinutes % MINUTES_PER_FRU;
    return [
      hours ? `${hours}hr` : '',
      minutes ? `${minutes}min` : '',
    ].filter(Boolean).join(' ') || '0min';
  }

  formatEventTimeRange(event: SchedulerEvent): string {
    return this.formatDateRange(event.start, event.end);
  }

  private formatDateRange(start: Date, end: Date): string {
    return `${this.formatEventTime(start)} - ${this.formatEventTime(end)}`;
  }

  private formatDuration(start: Date, end: Date): string {
    const durationMinutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
    const hours = Math.floor(durationMinutes / MINUTES_PER_FRU);
    const minutes = durationMinutes % MINUTES_PER_FRU;
    return [
      hours ? `${hours}hr` : '',
      minutes ? `${minutes}min` : '',
    ].filter(Boolean).join(' ') || '0min';
  }

  private formatEventTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  getSlotStyle(slot: Date): Record<string, string> {
    const offset = (slot.getTime() - this.viewStart.getTime()) / 60000;
    return { left: `${(offset / 60) * this.HOUR_WIDTH}px` };
  }

  formatSlot(slot: Date): string {
    return slot.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  formatTimeRange(range: SchedulerTimeRangePayload): string {
    const sameDay = range.start.toDateString() === range.end.toDateString();
    const dateLabel = range.start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    const endDateLabel = range.end.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    return sameDay
      ? `${dateLabel}, ${this.formatSlot(range.start)}–${this.formatSlot(range.end)}`
      : `${dateLabel} ${this.formatSlot(range.start)}–${endDateLabel} ${this.formatSlot(range.end)}`;
  }

  getActiveTimeRange(): SchedulerTimeRangePayload | null {
    if (this.timeRangeSelection && !this.timeRangeSelection.resourceId) {
      return this.normalizeTimeRange(this.timeRangeSelection.anchor, this.timeRangeSelection.current);
    }
    return this.selectedTimeRange;
  }

  getResourceActiveTimeRange(resourceId: string): SchedulerTimeRangePayload | null {
    if (this.timeRangeSelection?.resourceId === resourceId) {
      return { ...this.normalizeTimeRange(this.timeRangeSelection.anchor, this.timeRangeSelection.current), resourceId };
    }
    return this.resourceTimeRangeSelection?.resourceId === resourceId ? this.resourceTimeRangeSelection : null;
  }

  getTimeRangeLeft(range: SchedulerTimeRangePayload): number {
    return this.getLeftFromDate(range.start);
  }

  getTimeRangeWidth(range: SchedulerTimeRangePayload): number {
    return Math.max(2, this.getLeftFromDate(range.end) - this.getLeftFromDate(range.start));
  }

  shouldShowCurrentTimeMarker(): boolean {
    return !!this.currentTime && this.currentTime >= this.viewStart && this.currentTime <= this.viewEnd;
  }

  getCurrentTimeLeft(): number {
    return this.currentTime ? this.getLeftFromDate(this.currentTime) : 0;
  }

  getCurrentTimeMarkerLeft(): number {
    return RESOURCE_COL_WIDTH + this.getCurrentTimeLeft();
  }

  getCurrentTimeLabel(): string {
    return this.currentTime ? this.formatSlot(this.currentTime) : '';
  }

  scrollToCurrentTime(): void {
    if (!this.currentTime || !this.bodyScrollRef) return;
    const body = this.bodyScrollRef.nativeElement;
    const left = Math.max(0, this.getCurrentTimeLeft() - body.clientWidth / 2);
    this.scrollElementTo(body, left, body.scrollTop, 'smooth');
    this.scheduleHeaderScrollSync();
  }

  onTimeRangePointerDown(event: PointerEvent): void {
    if (event.button !== 0 || this.readonly) return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.closest('button, a, input, select, textarea, [data-scheduler-action]')) return;

    const date = this.getDateFromTimelinePointer(event);
    if (!date) return;

    event.preventDefault();
    const snapped = this.snapDateToSelection(date);
    this.timeRangeSelection = { anchor: snapped, current: snapped };
    window.addEventListener('pointermove', this.onTimeRangePointerMove);
    window.addEventListener('pointerup', this.onTimeRangePointerUp, { once: true });
  }

  onResourceTimeRangePointerDown(event: PointerEvent, resourceId: string): void {
    if (event.button !== 0 || this.readonly) return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.closest('button, a, input, select, textarea, [data-scheduler-action], .scheduler__event, .scheduler__capacity-lane, .scheduler__unavailable')) return;

    const date = this.getDateFromTimelinePointer(event);
    if (!date) return;

    event.preventDefault();
    event.stopPropagation();
    const snapped = this.snapDateToSelection(date);
    this.resourceTimeRangeSelection = null;
    this.timeRangeSelection = { anchor: snapped, current: snapped, resourceId };
    window.addEventListener('pointermove', this.onTimeRangePointerMove);
    window.addEventListener('pointerup', this.onTimeRangePointerUp, { once: true });
  }

  clearSelectedTimeRange(event?: MouseEvent): void {
    event?.stopPropagation();
    this.timeRangeSelection = null;
    this.resourceTimeRangeSelection = null;
    this.timeRangeCleared.emit();
  }

  onResourceSlotContextMenu(event: MouseEvent, resourceId: string): void {
    if ((event.target as HTMLElement).closest('.scheduler__event, .scheduler__capacity-lane, .scheduler__unavailable')) return;
    event.preventDefault();
    event.stopPropagation();
    const pointerDate = this.getDateFromTimelinePointer(event);
    if (!pointerDate) return;
    const selectedRange = this.resourceTimeRangeSelection?.resourceId === resourceId &&
      pointerDate >= this.resourceTimeRangeSelection.start &&
      pointerDate <= this.resourceTimeRangeSelection.end
        ? this.resourceTimeRangeSelection
        : null;
    const start = selectedRange?.start ?? this.snapDateToSelection(pointerDate);
    const end = selectedRange?.end ?? new Date(start.getTime() + this.effectiveDropSnapMinutes * 60000);
    this.resourceSlotContextMenu.emit({ resourceId, start, end, x: event.clientX, y: event.clientY, source: selectedRange ? 'selection' : 'slot' });
  }

  onBookingWindowMovePointerDown(event: PointerEvent): void {
    if (!this.selectedTimeRange || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const pointerDate = this.getDateFromTimelinePointer(event);
    if (!pointerDate) return;
    this.timeRangeMove = {
      durationMinutes: this.getTimelineMinutesBetween(this.selectedTimeRange.start, this.selectedTimeRange.end),
      pointerOffsetMinutes: this.getTimelineMinutesBetween(this.selectedTimeRange.start, pointerDate),
    };
    window.addEventListener('pointermove', this.onBookingWindowMovePointerMove);
    window.addEventListener('pointerup', this.onBookingWindowMovePointerUp, { once: true });
  }

  onBookingWindowResizePointerDown(event: PointerEvent, edge: 'left' | 'right'): void {
    if (!this.selectedTimeRange || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const fixedDate = edge === 'left' ? this.selectedTimeRange.end : this.selectedTimeRange.start;
    this.timeRangeResize = { edge, fixedTimelineMinutes: this.getTimelineMinutes(fixedDate) };
    window.addEventListener('pointermove', this.onBookingWindowResizePointerMove);
    window.addEventListener('pointerup', this.onBookingWindowResizePointerUp, { once: true });
  }

  getResourcesForGroup(groupId: string): SchedulerResource[] {
    return this.resources.filter(resource => {
      if (resource.groupId !== groupId) return false;
      if (!this.selectedResourceTypeGroupIds.includes(groupId)) return false;
      return this.matchesResourceDisplayFilters(resource);
    });
  }

  public getExpandedResourcesForGroup(groupId: string): SchedulerResource[] {
    return this.collapsedGroupIds.has(groupId) ? [] : this.getResourcesForGroup(groupId);
  }

  getUngroupedResources(): SchedulerResource[] {
    const visibleGroupIds = new Set(this.visibleGroups.map(group => group.id));
    return this.resources.filter(resource => {
      if (resource.groupId && visibleGroupIds.has(resource.groupId)) return false;
      return this.matchesResourceDisplayFilters(resource);
    });
  }

  get visibleGroups(): SchedulerGroup[] {
    return this.groups.filter(group => {
      if (!this.selectedResourceTypeGroupIds.includes(group.id)) return false;
      return this.hasResourcesForGroup(group.id);
    });
  }

  private hasResourcesForGroup(groupId: string): boolean {
    return this.resources.some(resource => {
      if (resource.groupId !== groupId) return false;
      return this.matchesResourceDisplayFilters(resource);
    });
  }

  private matchesResourceDisplayFilters(resource: SchedulerResource): boolean {
    const query = this.resourceSearch.trim().toLowerCase();
    if (this.showSelectedOnlyResources && !this.isResourceSelected(resource.id)) return false;
    if (this.showBookedOnlyResources && !this.isResourceBooked(resource.id)) return false;
    if (query && !`${resource.label} ${resource.groupLabel ?? ''}`.toLowerCase().includes(query)) return false;
    return true;
  }

  private syncBookedFilterWithContext(): void {
    const contextKey = this.bookedResourceFilterContext?.contextKey ?? null;
    if (contextKey === this.lastBookedContextKey) return;

    if (contextKey) {
      // Auto-activate only for focused-order (full planner View Only)
      if (this.bookedResourceFilterContext?.source === 'focused-order') {
        this.showBookedOnlyResources = true;
      }
    } else {
      this.showBookedOnlyResources = false;
    }
    this.lastBookedContextKey = contextKey;
  }

  private getEffectiveBookedResourceIds(): Set<string> {
    return this.bookedResourceFilterContext?.active
      ? new Set(this.bookedResourceFilterContext.resourceIds)
      : new Set<string>();
  }

  get selectedGroupLabel(): string {
    const count = this.selectedResourceTypeGroupIds.length;
    return this.areAllResourceTypesSelected() ? 'All resource types' : `${count} selected`;
  }

  areAllResourceTypesSelected(): boolean {
    return this.groups.every(group => this.selectedResourceTypeGroupIds.includes(group.id));
  }

  get selectedResourceViewLabel(): string {
    return this.selectedResourceView?.label ?? 'Service Centre Munich';
  }

  selectResourceView(view: ResourceFavoriteView | null): void {
    this.resourceViewChange.emit(view);
    this.isResourceViewDropdownOpen = false;
  }

  public toggleResourceViewDropdown(): void {
    this.isResourceViewDropdownOpen = !this.isResourceViewDropdownOpen;
    if (this.isResourceViewDropdownOpen) this.isGroupDropdownOpen = false;
  }

  public onBodyScroll(): void {
    this.scheduleHeaderScrollSync();
    if (this.pendingPulseEventIds.size && this.programmaticScrollPulse) {
      this.schedulePulseAfterScrollSettles([...this.pendingPulseEventIds]);
      return;
    }
    if (!this.programmaticScrollPulse && this.activePulseEventIds.size) {
      this.clearPulse();
    }
  }

  public openResourceViewList(): void {
    this.isResourceViewDropdownOpen = false;
    this.resourceViewListRequested.emit(this.selectedResourceView);
  }

  addResourceView(): void {
    this.isResourceViewDropdownOpen = false;
    this.resourceViewAddRequested.emit();
  }

  private syncHeaderScroll(): void {
    if (!this.headerScrollRef || !this.bodyScrollRef) return;
    if (this.isSyncingHeaderScroll) return;
    const header = this.headerScrollRef.nativeElement;
    const body = this.bodyScrollRef.nativeElement;
    if (Math.abs(header.scrollLeft - body.scrollLeft) < 1) return;
    this.isSyncingHeaderScroll = true;
    try {
      header.scrollLeft = body.scrollLeft;
    } finally {
      this.isSyncingHeaderScroll = false;
    }
  }

  private scheduleHeaderScrollSync(): void {
    if (this.scrollSyncFrame !== null) return;
    const sync = () => {
      this.scrollSyncFrame = null;
      this.syncHeaderScroll();
    };
    if (typeof requestAnimationFrame === 'function') {
      this.scrollSyncFrame = requestAnimationFrame(sync);
      return;
    }
    sync();
  }

  private updateTimelineViewportWidth(): void {
    if (!this.bodyScrollRef) return;
    const width = Math.max(0, this.bodyScrollRef.nativeElement.clientWidth - RESOURCE_COL_WIDTH);
    if (Math.abs(width - this.timelineViewportWidth) < 1) return;
    this.timelineViewportWidth = width;
    this.cdr.detectChanges();
    this.scheduleHeaderScrollSync();
  }

  private scrollToEvents(eventIds: string[], pulse = true): void {
    if (!eventIds.length || !this.bodyScrollRef) return;
    const requestedIds = this.normalizePulseEventIds(eventIds);
    const requestedIdSet = new Set(requestedIds);
    const events = this.events.filter(candidate => requestedIdSet.has(candidate.id) || requestedIdSet.has(this.getSourceEventId(candidate)));
    if (!events.length) return;

    const body = this.bodyScrollRef.nativeElement;
    const minLeft = Math.min(...events.map(event => this.getEventLeft(event)));
    const maxRight = Math.max(...events.map(event => this.getEventLeft(event) + this.getEventWidth(event)));
    const minTop = Math.min(...events.map(event => this.getResourceTop(event.resourceId)));
    const left = Math.max(0, minLeft + (maxRight - minLeft) / 2 - body.clientWidth / 2);
    const top = Math.max(0, minTop - GROUP_ROW_HEIGHT);
    const alreadyInView = Math.abs(body.scrollLeft - left) < 2 && Math.abs(body.scrollTop - top) < 2;
    if (!pulse) {
      this.clearPulse();
    } else if (alreadyInView) {
      this.activatePulseImmediately(requestedIds);
    } else {
      this.queuePulse(requestedIds);
    }
    this.scrollElementTo(body, left, top, 'smooth');
    this.scheduleHeaderScrollSync();
  }

  private scrollElementTo(element: HTMLElement, left: number, top: number, behavior: ScrollBehavior = 'auto'): void {
    if (typeof element.scrollTo === 'function') {
      element.scrollTo({ left, top, behavior });
      return;
    }
    element.scrollLeft = left;
    element.scrollTop = top;
  }

  private queuePulse(eventIds: string[]): void {
    this.clearPulseTimeout();
    this.clearPulseScrollSettleTimeout();
    this.activePulseEventIds.clear();
    this.pendingPulseEventIds = new Set(this.normalizePulseEventIds(eventIds));
    this.programmaticScrollPulse = true;
    this.schedulePulseAfterScrollSettles([...this.pendingPulseEventIds]);
  }

  private schedulePulseAfterScrollSettles(eventIds: string[]): void {
    this.clearPulseScrollSettleTimeout();
    this.pulseScrollSettleTimeoutId = setTimeout(() => this.activatePulse(eventIds), 180);
  }

  private activatePulse(eventIds: string[]): void {
    const normalizedIds = this.normalizePulseEventIds(eventIds);
    if (!this.arePulseEventIdsEqual(this.pendingPulseEventIds, normalizedIds)) return;
    this.pendingPulseEventIds.clear();
    this.activePulseEventIds = new Set(normalizedIds);
    this.programmaticScrollPulse = false;
    this.cdr.detectChanges();
    this.pulseTimeoutId = setTimeout(() => {
      if (this.arePulseEventIdsEqual(this.activePulseEventIds, normalizedIds)) this.activePulseEventIds.clear();
      this.cdr.detectChanges();
    }, 1200);
  }

  private activatePulseImmediately(eventIds: string[]): void {
    this.clearPulseTimeout();
    this.clearPulseScrollSettleTimeout();
    this.pendingPulseEventIds.clear();
    this.programmaticScrollPulse = false;
    this.activePulseEventIds.clear();
    this.cdr.detectChanges();
    setTimeout(() => this.activatePulseFromCurrentPosition(eventIds));
  }

  private activatePulseFromCurrentPosition(eventIds: string[]): void {
    const normalizedIds = this.normalizePulseEventIds(eventIds);
    this.activePulseEventIds = new Set(normalizedIds);
    this.cdr.detectChanges();
    this.pulseTimeoutId = setTimeout(() => {
      if (this.arePulseEventIdsEqual(this.activePulseEventIds, normalizedIds)) this.activePulseEventIds.clear();
      this.cdr.detectChanges();
    }, 1200);
  }

  private clearPulse(): void {
    this.clearPulseTimeout();
    this.clearPulseScrollSettleTimeout();
    this.activePulseEventIds.clear();
    this.pendingPulseEventIds.clear();
    this.programmaticScrollPulse = false;
  }

  private normalizePulseEventIds(eventIds: string[]): string[] {
    return [...new Set(eventIds.filter(Boolean))];
  }

  private arePulseEventIdsEqual(currentIds: Set<string>, nextIds: string[]): boolean {
    if (currentIds.size !== nextIds.length) return false;
    return nextIds.every(eventId => currentIds.has(eventId));
  }

  private clearPulseTimeout(): void {
    if (!this.pulseTimeoutId) return;
    clearTimeout(this.pulseTimeoutId);
    this.pulseTimeoutId = null;
  }

  private clearPulseScrollSettleTimeout(): void {
    if (!this.pulseScrollSettleTimeoutId) return;
    clearTimeout(this.pulseScrollSettleTimeoutId);
    this.pulseScrollSettleTimeoutId = null;
  }

  private onTimeRangePointerMove = (event: PointerEvent): void => {
    if (!this.timeRangeSelection) return;
    const date = this.getDateFromTimelinePointer(event);
    if (!date) return;
    this.timeRangeSelection = {
      ...this.timeRangeSelection,
      current: this.snapDateToSelection(date),
    };
    this.cdr.detectChanges();
  };

  private onTimeRangePointerUp = (): void => {
    window.removeEventListener('pointermove', this.onTimeRangePointerMove);
    if (!this.timeRangeSelection) return;

    const range = this.normalizeTimeRange(this.timeRangeSelection.anchor, this.timeRangeSelection.current);
    const resourceId = this.timeRangeSelection.resourceId;
    this.timeRangeSelection = null;
    if (range.end.getTime() - range.start.getTime() >= this.effectiveDropSnapMinutes * 60000) {
      if (resourceId) {
        this.resourceTimeRangeSelection = { ...range, resourceId };
      } else {
        this.timeRangeSelected.emit(range);
      }
    }
    this.cdr.detectChanges();
  };

  private onBookingWindowMovePointerMove = (event: PointerEvent): void => {
    if (!this.timeRangeMove) return;
    const pointerDate = this.getDateFromTimelinePointer(event);
    if (!pointerDate) return;
    this.timeRangeSelected.emit(this.buildMovedTimeRange(pointerDate));
    this.cdr.detectChanges();
  };

  private onBookingWindowMovePointerUp = (): void => {
    window.removeEventListener('pointermove', this.onBookingWindowMovePointerMove);
    this.timeRangeMove = null;
    this.cdr.detectChanges();
  };

  private onBookingWindowResizePointerMove = (event: PointerEvent): void => {
    if (!this.timeRangeResize) return;
    const pointerDate = this.getDateFromTimelinePointer(event);
    if (!pointerDate) return;
    const snap = this.effectiveDropSnapMinutes;
    const pointerTimelineMinutes = Math.round(this.getTimelineMinutes(pointerDate) / snap) * snap;
    const minMinutes = snap;
    const startTimelineMinutes = this.timeRangeResize.edge === 'left'
      ? Math.min(pointerTimelineMinutes, this.timeRangeResize.fixedTimelineMinutes - minMinutes)
      : this.timeRangeResize.fixedTimelineMinutes;
    const endTimelineMinutes = this.timeRangeResize.edge === 'right'
      ? Math.max(pointerTimelineMinutes, this.timeRangeResize.fixedTimelineMinutes + minMinutes)
      : this.timeRangeResize.fixedTimelineMinutes;
    this.timeRangeSelected.emit({
      start: this.getDateFromTimelineMinutes(startTimelineMinutes),
      end: this.getDateFromTimelineMinutes(endTimelineMinutes),
    });
    this.cdr.detectChanges();
  };

  private onBookingWindowResizePointerUp = (): void => {
    window.removeEventListener('pointermove', this.onBookingWindowResizePointerMove);
    this.timeRangeResize = null;
    this.cdr.detectChanges();
  };

  private getDateFromTimelinePointer(event: MouseEvent | PointerEvent): Date | null {
    const header = this.headerScrollRef?.nativeElement;
    if (!header || !this.daySlots.length) return null;
    const rect = header.getBoundingClientRect();
    const rawX = event.clientX - rect.left + header.scrollLeft;
    const x = Math.max(0, Math.min(rawX, this.totalWidth));
    const dayWidthPx = 12 * this.HOUR_WIDTH;
    const dayIndex = Math.max(0, Math.min(Math.floor(x / dayWidthPx), this.daySlots.length - 1));
    const minutesWithinDay = ((x - dayIndex * dayWidthPx) / this.HOUR_WIDTH) * 60;
    const date = new Date(this.daySlots[dayIndex]);
    date.setHours(9, 0, 0, 0);
    date.setMinutes(Math.max(0, Math.min(12 * 60, minutesWithinDay)), 0, 0);
    return date;
  }

  private snapDateToSelection(date: Date): Date {
    const snapped = new Date(date);
    const dayStart = new Date(date);
    dayStart.setHours(9, 0, 0, 0);
    const minutes = Math.max(0, Math.min(12 * 60, (date.getTime() - dayStart.getTime()) / 60000));
    const snappedMinutes = Math.round(minutes / this.effectiveDropSnapMinutes) * this.effectiveDropSnapMinutes;
    snapped.setHours(9, 0, 0, 0);
    snapped.setMinutes(Math.max(0, Math.min(12 * 60, snappedMinutes)), 0, 0);
    return snapped;
  }

  private normalizeTimeRange(first: Date, second: Date): SchedulerTimeRangePayload {
    const start = first <= second ? first : second;
    const end = first <= second ? second : first;
    return { start: new Date(start), end: new Date(end) };
  }

  private buildMovedTimeRange(pointerDate: Date): SchedulerTimeRangePayload {
    const move = this.timeRangeMove!;
    const pointerTimelineMinutes = this.getTimelineMinutes(pointerDate);
    const rawStartTimelineMinutes = pointerTimelineMinutes - move.pointerOffsetMinutes;
    const snap = this.effectiveDropSnapMinutes;
    const snappedStartTimelineMinutes = Math.round(rawStartTimelineMinutes / snap) * snap;
    const maxStartTimelineMinutes = this.daySlots.length * 12 * 60 - move.durationMinutes;
    const startTimelineMinutes = Math.max(0, Math.min(snappedStartTimelineMinutes, maxStartTimelineMinutes));
    const start = this.getDateFromTimelineMinutes(startTimelineMinutes);
    const end = this.getDateFromTimelineMinutes(startTimelineMinutes + move.durationMinutes);
    return { start, end };
  }

  private getTimelineMinutes(date: Date): number {
    const day = new Date(date);
    day.setHours(0, 0, 0, 0);
    const dayIndex = Math.max(0, this.daySlots.findIndex(slot => slot.toDateString() === day.toDateString()));
    const minutesInDay = Math.max(0, Math.min(12 * 60, (date.getHours() - 9) * 60 + date.getMinutes()));
    return dayIndex * 12 * 60 + minutesInDay;
  }

  private getTimelineMinutesBetween(start: Date, end: Date): number {
    return Math.max(0, this.getTimelineMinutes(end) - this.getTimelineMinutes(start));
  }

  private getDateFromTimelineMinutes(totalMinutes: number): Date {
    const minutesPerDay = 12 * 60;
    const maxMinutes = Math.max(0, this.daySlots.length * minutesPerDay);
    const clampedMinutes = Math.max(0, Math.min(totalMinutes, maxMinutes));
    const dayIndex = Math.min(Math.floor(clampedMinutes / minutesPerDay), Math.max(0, this.daySlots.length - 1));
    const minutesInDay = Math.min(clampedMinutes - dayIndex * minutesPerDay, minutesPerDay);
    const date = new Date(this.daySlots[dayIndex]);
    date.setHours(9, 0, 0, 0);
    date.setMinutes(minutesInDay, 0, 0);
    return date;
  }

  toggleGroupDropdown(): void {
    this.isGroupDropdownOpen = !this.isGroupDropdownOpen;
    if (this.isGroupDropdownOpen) this.isResourceViewDropdownOpen = false;
  }

  toggleGroupSelection(groupId: string, event: Event): void {
    event.stopPropagation();
    const groupIds = this.selectedResourceTypeGroupIds.includes(groupId)
      ? this.selectedResourceTypeGroupIds.filter(id => id !== groupId)
      : [...this.selectedResourceTypeGroupIds, groupId];
    this.resourceTypeSelectionChange.emit({ groupIds });
  }

  clearGroupSelection(event: Event): void {
    event.stopPropagation();
    this.resourceTypeSelectionChange.emit({ groupIds: [] });
  }

  toggleGroupCollapsed(groupId: string): void {
    if (this.collapsedGroupIds.has(groupId)) {
      this.collapsedGroupIds.delete(groupId);
      return;
    }
    this.collapsedGroupIds.add(groupId);
  }

  expandAllGroups(): void {
    this.collapsedGroupIds.clear();
  }

  collapseAllGroups(): void {
    this.collapsedGroupIds = new Set(this.visibleGroups.map(group => group.id));
  }

  areAllVisibleGroupsCollapsed(): boolean {
    const visibleGroupIds = this.visibleGroups.map(group => group.id);
    return visibleGroupIds.length > 0 && visibleGroupIds.every(groupId => this.collapsedGroupIds.has(groupId));
  }

  toggleAllGroupsCollapsed(): void {
    if (this.areAllVisibleGroupsCollapsed()) {
      this.expandAllGroups();
      return;
    }
    this.collapseAllGroups();
  }

  isGroupCollapsed(groupId: string): boolean {
    return this.collapsedGroupIds.has(groupId);
  }

  areAllGroupResourcesSelected(groupId: string): boolean {
    const resources = this.getResourcesForGroup(groupId);
    return resources.length > 0 && resources.every(resource => this.isResourceSelected(resource.id));
  }

  areSomeGroupResourcesSelected(groupId: string): boolean {
    return this.getResourcesForGroup(groupId).some(resource => this.isResourceSelected(resource.id));
  }

  onGroupResourceSelectionChange(event: Event, groupId: string): void {
    event.stopPropagation();
    const selected = (event.target as HTMLInputElement).checked;
    for (const resource of this.getResourcesForGroup(groupId)) {
      if (this.isResourceSelected(resource.id) !== selected) {
        this.resourceSelectionChange.emit({ resourceId: resource.id, selected });
      }
    }
    if (!selected) this.showSelectedOnlyResources = false;
  }

  toggleSelectedOnlyResources(): void {
    if (this.showSelectedOnlyResources) {
      this.showSelectedOnlyResources = false;
      return;
    }
    if (!this.resources.some(resource => this.isResourceSelected(resource.id))) return;
    this.showSelectedOnlyResources = true;
  }

  toggleBookedOnlyResources(): void {
    if (!this.bookedResourceFilterContext) return;
    this.showBookedOnlyResources = !this.showBookedOnlyResources;
  }

  toggleCapacityOnlyMode(): void {
    this.showCapacityOnlyMode = !this.showCapacityOnlyMode;
  }

  getEventDayColumn(event: SchedulerEvent): number {
    const eventDay = new Date(event.start);
    eventDay.setHours(0, 0, 0, 0);
    const dayIndex = this.daySlots.findIndex(d => d.toDateString() === eventDay.toDateString());
    return Math.max(1, (dayIndex >= 0 ? dayIndex : 0) + 1);
  }

  getCapacityLaneDayColumn(day: Date): number {
    const dayIndex = this.daySlots.findIndex(d => d.toDateString() === day.toDateString());
    return Math.max(1, (dayIndex >= 0 ? dayIndex : 0) + 1);
  }

  get effectiveTotalWidth(): number {
    if (this.showCapacityOnlyMode) {
      return this.daySlots.length * this.effectiveCapacityLaneWidth;
    }
    return this.totalWidth;
  }

  get effectiveCapacityLaneWidth(): number {
    if (this.showCapacityOnlyMode && this.timelineViewportWidth) {
      return Math.max(DAY_CAPACITY_LANE_WIDTH, Math.floor(this.timelineViewportWidth / Math.max(1, this.daySlots.length)));
    }
    return DAY_CAPACITY_LANE_WIDTH;
  }

  getEffectiveCapacityLaneLeft(day: Date): number {
    if (this.showCapacityOnlyMode) {
      const dayIndex = this.daySlots.findIndex(d => d.toDateString() === day.toDateString());
      return dayIndex * this.effectiveCapacityLaneWidth;
    }
    return this.getCapacityLaneLeft(day);
  }

  hasSelectedResources(): boolean {
    return this.resources.some(resource => this.isResourceSelected(resource.id));
  }

  hasBookedResources(): boolean {
    return this.getEffectiveBookedResourceIds().size > 0;
  }

  isResourceBooked(resourceId: string): boolean {
    return this.getEffectiveBookedResourceIds().has(resourceId);
  }

  hasVisibleResources(): boolean {
    return this.resources.length > 0;
  }

  areAllVisibleResourcesSelected(): boolean {
    return this.resources.length > 0 && this.resources.every(resource => this.isResourceSelected(resource.id));
  }

  areSomeVisibleResourcesSelected(): boolean {
    return this.resources.some(resource => this.isResourceSelected(resource.id));
  }

  onAllVisibleResourceSelectionChange(event: Event): void {
    event.stopPropagation();
    const selected = !this.areAllVisibleResourcesSelected();
    for (const resource of this.resources) {
      if (this.isResourceSelected(resource.id) !== selected) {
        this.resourceSelectionChange.emit({ resourceId: resource.id, selected });
      }
    }
    if (!selected) this.showSelectedOnlyResources = false;
  }

  isResourceSelected(resourceId: string): boolean {
    return this.selectedResourceIds.includes(resourceId);
  }

  onResourceSelectionChange(event: Event, resource: SchedulerResource): void {
    event.stopPropagation();
    const selected = (event.target as HTMLInputElement).checked;
    this.resourceSelectionChange.emit({ resourceId: resource.id, selected });
  }

  getResourceIndex(resourceId: string): number {
    return this.resources.findIndex(r => r.id === resourceId);
  }

  // Drag to move

  onEventDragStart(e: DragEvent, event: SchedulerEvent): void {
    if (this.readonly) return;
    if (this.isEventResizeActive(event)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const sourceEvent = this.getSourceEvent(event);
    e.stopPropagation();
    this.lastValidDropPreview = null;
    const durationMinutes = Math.max(1, Math.round((sourceEvent.end.getTime() - sourceEvent.start.getTime()) / 60000));
    const pointerOffsetMinutes = this.getEventPointerOffsetMinutes(e, sourceEvent);
    e.dataTransfer?.setData('eventId', sourceEvent.id);
    e.dataTransfer?.setData('eventid', sourceEvent.id);
    e.dataTransfer?.setData('dropType', 'event');
    e.dataTransfer?.setData('droptype', 'event');
    e.dataTransfer?.setData('fru', String(durationMinutes / MINUTES_PER_FRU));
    e.dataTransfer?.setData('text/plain', sourceEvent.id);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    this.nativeDraggedEventId = sourceEvent.id;
    this.nativeDropHandled = false;
    this.eventDragStarted.emit({ eventId: sourceEvent.id, pointerOffsetMinutes });
  }

  onCapacityBlockDragStart(e: DragEvent, block: SchedulerCapacityBlock): void {
    if (this.readonly) return;
    e.stopPropagation();
    this.lastValidDropPreview = null;
    e.dataTransfer?.setData('eventId', block.id);
    e.dataTransfer?.setData('eventid', block.id);
    e.dataTransfer?.setData('dropType', 'event');
    e.dataTransfer?.setData('droptype', 'event');
    e.dataTransfer?.setData('fru', String(block.durationMinutes / MINUTES_PER_FRU));
    e.dataTransfer?.setData('text/plain', block.id);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    this.nativeDraggedEventId = block.id;
    this.nativeDropHandled = false;
    this.eventDragStarted.emit({ eventId: block.id, dropMode: 'day-capacity' });
  }

  onEventDragEnd(e: DragEvent, event: SchedulerEvent): void {
    e.stopPropagation();
    const sourceEvent = this.getSourceEvent(event);
    const preview = this.dropPreview ?? this.lastValidDropPreview;
    if (!this.nativeDropHandled && this.nativeDraggedEventId === sourceEvent.id && preview) {
      this.zone.run(() => {
        this.eventMoved.emit({
          eventId: sourceEvent.id,
          resourceId: preview.resourceId,
          start: preview.start,
          end: preview.end,
          dropMode: preview.mode ?? 'timed',
          date: preview.date,
          durationMinutes: preview.durationMinutes,
        });
      });
      this.nativeDropHandled = true;
    }
    this.dropPreview = null;
    this.lastValidDropPreview = null;
    window.setTimeout(() => {
      if (this.nativeDraggedEventId === sourceEvent.id) this.nativeDraggedEventId = null;
    }, 0);
    this.eventDragEnded.emit({ eventId: sourceEvent.id });
  }

  onCapacityBlockDragEnd(e: DragEvent, block: SchedulerCapacityBlock): void {
    e.stopPropagation();
    const preview = this.dropPreview ?? this.lastValidDropPreview;
    if (!this.nativeDropHandled && this.nativeDraggedEventId === block.id && preview) {
      this.zone.run(() => {
        this.eventMoved.emit({
          eventId: block.id,
          resourceId: preview.resourceId,
          start: preview.start,
          end: preview.end,
          dropMode: preview.mode ?? 'timed',
          date: preview.date,
          durationMinutes: preview.durationMinutes,
        });
      });
      this.nativeDropHandled = true;
    }
    this.dropPreview = null;
    this.lastValidDropPreview = null;
    window.setTimeout(() => {
      if (this.nativeDraggedEventId === block.id) this.nativeDraggedEventId = null;
    }, 0);
    this.eventDragEnded.emit({ eventId: block.id, dropMode: 'day-capacity' });
  }
  private getResourceAtY(y: number): SchedulerResource | null {
    let currentY = 0;
    for (const group of this.visibleGroups) {
      currentY += GROUP_ROW_HEIGHT; // group label height
      for (const resource of this.getExpandedResourcesForGroup(group.id)) {
        const resourceRowHeight = this.getResourceRowHeight(resource.id);
        if (y >= currentY && y < currentY + resourceRowHeight) return resource;
        currentY += resourceRowHeight;
      }
    }
    for (const resource of this.getUngroupedResources()) {
      const resourceRowHeight = this.getResourceRowHeight(resource.id);
      if (y >= currentY && y < currentY + resourceRowHeight) return resource;
      currentY += resourceRowHeight;
    }
    return null;
  }

  // Group-level capacity lane (qualification-level booking)

  isGroupCapacityDropTarget(groupId: string, day: Date): boolean {
    return this.groupCapacityDropTarget?.groupId === groupId &&
      this.groupCapacityDropTarget?.dayKey === day.toDateString();
  }

  onGroupCapacityDragOver(e: DragEvent, groupId: string, day: Date): void {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    this.groupCapacityDropTarget = { groupId, dayKey: day.toDateString() };
  }

  onGroupCapacityDrop(e: DragEvent, groupId: string, day: Date): void {
    e.preventDefault();
    e.stopPropagation();
    this.groupCapacityDropTarget = null;

    const dropType = this.getDragData(e, 'dropType') || undefined;
    const jobId = e.dataTransfer?.getData('jobId');
    const orderId = e.dataTransfer?.getData('orderId') || undefined;
    if (!jobId && !orderId) return;

    const durationFru = parseFloat(e.dataTransfer?.getData('fru') ?? '1');
    const durationMinutes = Number.isFinite(durationFru) && durationFru > 0
      ? durationFru * MINUTES_PER_FRU
      : MINUTES_PER_FRU;
    const date = new Date(day);
    date.setHours(0, 0, 0, 0);
    const start = new Date(date);
    start.setHours(9, 0, 0, 0);
    const end = new Date(start.getTime() + durationMinutes * 60000);

    const externalDropType = (dropType || (orderId ? 'order' : 'job')) as 'job' | 'order' | 'activity';
    const resourceType = e.dataTransfer?.getData('resourceType') || undefined;
    const group = this.groups.find(g => g.id === groupId);

    this.nativeDropHandled = true;
    this.zone.run(() => {
      this.eventDropped.emit({
        jobId: jobId || `order-${orderId}`,
        orderId,
        dropType: externalDropType,
        dropMode: 'group-capacity',
        resourceId: groupId,
        resourceType,
        droppedResourceType: (group as any)?.resourceType,
        start,
        end,
        date,
        durationMinutes,
        groupId,
      });
    });
  }

  getGroupCapacityBlocksForDay(groupId: string, day: Date): SchedulerCapacityBlock[] {
    return this.capacityBlocks.filter(block =>
      block.resourceId === groupId &&
      this.isSameDay(block.date, day)
    );
  }

  getGroupRowHeight(groupId: string): number {
    if (!this.showDayCapacityLane || this.showCapacityOnlyMode) return GROUP_ROW_HEIGHT;
    // Check if any day's capacity lane for this group is expanded
    for (const day of this.daySlots) {
      if (this.isCapacityLaneExpanded(groupId, day)) {
        const blockCount = this.getGroupCapacityBlocksForDay(groupId, day).length;
        const runs = this.getCapacityOrderRuns(groupId, day);
        const runHeaderHeight = runs.length * 20;
        const blockHeight = blockCount * 40;
        const buttonHeight = 24;
        return Math.max(GROUP_ROW_HEIGHT, runHeaderHeight + blockHeight + buttonHeight + 16);
      }
    }
    return GROUP_ROW_HEIGHT;
  }

  getVisibleGroupCapacityItems(groupId: string, day: Date): SchedulerCapacityBlock[] {
    const blocks = this.getGroupCapacityBlocksForDay(groupId, day);
    if (this.showCapacityOnlyMode) return blocks;
    if (this.isCapacityLaneExpanded(groupId, day)) return blocks;
    // In collapsed state, only show blocks not in any run (runs handle their own visibility)
    const runs = this.getCapacityOrderRuns(groupId, day);
    const groupedRefs = new Set(runs.map(r => r.orderRef));
    return blocks.filter(block => !groupedRefs.has(this.getCapacityBlockOrderReference(block))).slice(0, 1);
  }

  getVisibleGroupOrderRuns(groupId: string, day: Date): { orderRef: string; count: number }[] {
    const runs = this.getCapacityOrderRuns(groupId, day);
    if (this.showCapacityOnlyMode || this.isCapacityLaneExpanded(groupId, day)) return runs;
    return runs.slice(0, 1);
  }

  getHiddenGroupCapacityCount(groupId: string, day: Date): number {
    if (this.showCapacityOnlyMode) return 0;
    const blockCount = this.getGroupCapacityBlocksForDay(groupId, day).length;
    if (blockCount === 0) return 0;
    if (this.isCapacityLaneExpanded(groupId, day)) return 0;
    // In collapsed state: 1 run shown with 1 tile visible, plus up to 1 ungrouped block visible
    const runs = this.getCapacityOrderRuns(groupId, day);
    const visibleRuns = runs.slice(0, 1);
    const hiddenRunBlocks = runs.slice(1).reduce((sum, r) => sum + r.count, 0);
    const visibleRunBlocksTotal = visibleRuns.reduce((sum, r) => sum + r.count, 0);
    // We show 1 tile from the visible run
    const hiddenFromVisibleRun = Math.max(0, visibleRunBlocksTotal - 1);
    const ungroupedBlocks = this.getGroupCapacityBlocksForDay(groupId, day)
      .filter(block => !runs.some(r => r.orderRef === this.getCapacityBlockOrderReference(block)));
    // We show up to 1 ungrouped block
    const hiddenUngrouped = Math.max(0, ungroupedBlocks.length - 1);
    const totalHidden = hiddenFromVisibleRun + hiddenRunBlocks + hiddenUngrouped;
    return totalHidden;
  }

  private getResourceTop(resourceId: string): number {
    let currentY = 0;
    for (const group of this.visibleGroups) {
      currentY += GROUP_ROW_HEIGHT;
      for (const resource of this.getExpandedResourcesForGroup(group.id)) {
        if (resource.id === resourceId) return currentY;
        currentY += this.getResourceRowHeight(resource.id);
      }
    }
    for (const resource of this.getUngroupedResources()) {
      if (resource.id === resourceId) return currentY;
      currentY += this.getResourceRowHeight(resource.id);
    }
    return 0;
  }

  // ── Resize ──────────────────────────────────────────────────────────────────

  onResizeMouseDown(e: MouseEvent, event: SchedulerEvent, edge: 'left' | 'right'): void {
    if (this.readonly) return;
    if (e.button === 2) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const sourceEvent = this.getSourceEvent(event);
    this.resizing = {
      event: sourceEvent, edge,
      startX: e.clientX,
      originalStart: new Date(sourceEvent.start),
      originalEnd: new Date(sourceEvent.end),
    };
    this.resizePreview = {
      event: sourceEvent,
      left: this.getEventLeft(sourceEvent),
      top: this.getResourceTop(sourceEvent.resourceId),
      width: this.getEventWidth(sourceEvent),
    };
    this.eventResizeStarted.emit({ eventId: sourceEvent.id });
    this.cdr.detectChanges();

    const onMove = (me: MouseEvent) => this.onResizeMove(me);
    const onUp   = (me: MouseEvent) => {
      this.onResizeEnd(me);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  private onResizeMove(e: MouseEvent): void {
    if (!this.resizing) return;
    const { event, edge, startX, originalStart, originalEnd } = this.resizing;

    const deltaX = e.clientX - startX;
    const deltaMinutes = this.getSnappedResizeDeltaMinutes(deltaX);

    const newStart = edge === 'left'
      ? new Date(originalStart.getTime() + deltaMinutes * 60000)
      : originalStart;
    const newEnd = edge === 'right'
      ? new Date(originalEnd.getTime() + deltaMinutes * 60000)
      : originalEnd;

    if (newEnd > newStart) {
      this.zone.run(() => {
        this.resizePreview = {
          event,
          left: this.getLeftFromDate(newStart),
          top: this.getResourceTop(event.resourceId),
          width: Math.max((newEnd.getTime() - newStart.getTime()) / 3600000 * this.HOUR_WIDTH, 20),
        };
        this.cdr.detectChanges();
      });
    } else {
      this.cdr.detectChanges();
    }
  }

  private onResizeEnd(e: MouseEvent): void {
    if (!this.resizing) return;
    const { event, edge, startX, originalStart, originalEnd } = this.resizing;
    this.resizing = null;
    this.resizePreview = null;
    this.eventResizeEnded.emit({ eventId: event.id });

    // event.start/end already updated live in onResizeMove — just emit final values
    const deltaX = e.clientX - startX;
    const deltaMinutes = this.getSnappedResizeDeltaMinutes(deltaX);
    const newStart = edge === 'left'
      ? new Date(originalStart.getTime() + deltaMinutes * 60000)
      : originalStart;
    const newEnd = edge === 'right'
      ? new Date(originalEnd.getTime() + deltaMinutes * 60000)
      : originalEnd;
    if (newEnd <= newStart) return;

    this.zone.run(() => {
      this.eventResized.emit({ eventId: event.id, start: newStart, end: newEnd });
    });
  }

  private getSnappedResizeDeltaMinutes(deltaX: number): number {
    const rawDeltaMinutes = deltaX * (60 / this.HOUR_WIDTH);
    const snapMinutes = this.effectiveDropSnapMinutes;
    return Math.round(rawDeltaMinutes / snapMinutes) * snapMinutes;
  }

  onEventClick(e: MouseEvent, event: SchedulerEvent): void {
    e.stopPropagation();
    if (this.isInteractiveEventTarget(e.target)) return;
    this.eventClicked.emit({ eventId: this.getSourceEventId(event) });
  }

  private isInteractiveEventTarget(target: EventTarget | null): boolean {
    return target instanceof HTMLElement && !!target.closest('button, a, input, select, textarea, [data-scheduler-action]');
  }

  onEventContextMenu(e: MouseEvent, event: SchedulerEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.suppressEventTooltip();
    this.eventContextMenu.emit({ eventId: this.getSourceEventId(event), x: e.clientX, y: e.clientY });
  }

  private getSourceEvent(event: SchedulerEvent): SchedulerEvent {
    const sourceEventId = this.getSourceEventId(event);
    return this.events.find(candidate => candidate.id === sourceEventId) ?? event;
  }

  onDragOver(e: DragEvent, resourceId: string): void {
    e.preventDefault();
    this.dropPreview = this.buildDropPreview(e, resourceId, true);
    this.dropTargetResourceId = this.isResourceGenerallyAvailableForDrop(resourceId) ? resourceId : null;
    if (this.dropPreview) this.lastValidDropPreview = this.dropPreview;
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
  }

  onCapacityDragOver(e: DragEvent, resourceId: string, day: Date): void {
    e.preventDefault();
    e.stopPropagation();
    this.dropPreview = this.buildCapacityDropPreview(e, resourceId, day, true);
    this.dropTargetResourceId = resourceId;
    if (this.dropPreview) this.lastValidDropPreview = this.dropPreview;
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
  }

  onDragLeave(): void {
    this.dropPreview = null;
    this.dropTargetResourceId = null;
    this.groupCapacityDropTarget = null;
  }

  onDrop(e: DragEvent, resourceId: string): void {
    e.preventDefault();
    const preview = this.buildDropPreview(e, resourceId, true) ?? this.dropPreview;
    this.dropPreview = null;
    this.dropTargetResourceId = null;
    this.lastValidDropPreview = null;

    const dropType = this.getDragData(e, 'dropType') || undefined;
    const eventId = dropType === 'event' || this.nativeDraggedEventId
      ? this.getDragData(e, 'eventId') || e.dataTransfer?.getData('text/plain') || this.nativeDraggedEventId
      : undefined;
    const jobId = e.dataTransfer?.getData('jobId');
    const orderId = e.dataTransfer?.getData('orderId') || undefined;
    const externalDropType = (dropType || (orderId ? 'order' : 'job')) as 'job' | 'order' | 'activity';
    const resourceType = e.dataTransfer?.getData('resourceType') || undefined;
    const droppedResource = this.resources.find(resource => resource.id === preview?.resourceId);
    const droppedResourceType = (droppedResource?.meta as any)?.type;
    if (!preview) return;

    const start = preview.start;
    const end = preview.end;
    this.nativeDropHandled = true;

    if (eventId) {
      this.zone.run(() => {
        this.eventMoved.emit({ eventId, resourceId: preview.resourceId, start, end });
      });
      this.nativeDraggedEventId = null;
      return;
    }

    if (!jobId && !orderId) return;

    this.zone.run(() => {
      this.eventDropped.emit({ jobId: jobId || `order-${orderId}`, orderId, dropType: externalDropType, dropMode: 'timed', resourceId: preview.resourceId, resourceType, droppedResourceType, start, end });
    });
  }

  onCapacityDrop(e: DragEvent, resourceId: string, day: Date): void {
    e.preventDefault();
    e.stopPropagation();
    const preview = this.buildCapacityDropPreview(e, resourceId, day, true) ?? this.dropPreview;
    this.dropPreview = null;
    this.dropTargetResourceId = null;
    this.lastValidDropPreview = null;
    if (!preview) return;

    const dropType = this.getDragData(e, 'dropType') || undefined;
    const eventId = dropType === 'event' || this.nativeDraggedEventId
      ? this.getDragData(e, 'eventId') || e.dataTransfer?.getData('text/plain') || this.nativeDraggedEventId
      : undefined;
    if (eventId) {
      this.nativeDropHandled = true;
      this.zone.run(() => {
        this.eventMoved.emit({
          eventId,
          resourceId: preview.resourceId,
          start: preview.start,
          end: preview.end,
          dropMode: 'day-capacity',
          date: preview.date,
          durationMinutes: preview.durationMinutes,
        });
      });
      this.nativeDraggedEventId = null;
      return;
    }

    const jobId = e.dataTransfer?.getData('jobId');
    const orderId = e.dataTransfer?.getData('orderId') || undefined;
    if (!jobId && !orderId) return;

    const externalDropType = (dropType || (orderId ? 'order' : 'job')) as 'job' | 'order' | 'activity';
    const resourceType = e.dataTransfer?.getData('resourceType') || undefined;
    const droppedResource = this.resources.find(resource => resource.id === preview.resourceId);
    const droppedResourceType = (droppedResource?.meta as any)?.type;
    this.nativeDropHandled = true;

    this.zone.run(() => {
      this.eventDropped.emit({
        jobId: jobId || `order-${orderId}`,
        orderId,
        dropType: externalDropType,
        dropMode: 'day-capacity',
        resourceId: preview.resourceId,
        resourceType,
        droppedResourceType,
        start: preview.start,
        end: preview.end,
        date: preview.date,
        durationMinutes: preview.durationMinutes,
      });
    });
  }

  private isResourceGenerallyAvailableForDrop(resourceId: string): boolean {
    if (!this.isDragFeedbackActive()) return true;
    const workingRanges = this.getWorkingRangesForCurrentView();
    if (!workingRanges.length) return true;

    return !workingRanges.every(workingRange =>
      this.invalidDropRanges.some(range =>
        range.resourceId === resourceId &&
        range.start.getTime() <= workingRange.start.getTime() &&
        range.end.getTime() >= workingRange.end.getTime()
      )
    );
  }

  private getWorkingRangesForCurrentView(): Array<{ start: Date; end: Date }> {
    const ranges: Array<{ start: Date; end: Date }> = [];
    let cursor = new Date(this.viewStart);
    cursor.setHours(9, 0, 0, 0);

    while (cursor < this.viewEnd) {
      const start = new Date(Math.max(cursor.getTime(), this.viewStart.getTime()));
      const end = new Date(cursor);
      end.setHours(21, 0, 0, 0);
      const clippedEnd = new Date(Math.min(end.getTime(), this.viewEnd.getTime()));
      if (start < clippedEnd) ranges.push({ start, end: clippedEnd });

      cursor = new Date(cursor);
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(9, 0, 0, 0);
    }

    return ranges;
  }

  private buildDropPreview(e: DragEvent, resourceId: string, allowDragOverFallback = false): DropPreview | null {
    const eventId = this.getDragData(e, 'eventId') || this.nativeDraggedEventId;
    const jobId = e.dataTransfer?.getData('jobId');
    const orderId = e.dataTransfer?.getData('orderId');
    if (!eventId && !jobId && !orderId && !allowDragOverFallback) return null;

    const durationFru = parseFloat(e.dataTransfer?.getData('fru') ?? '1');
    const draggedEvent = eventId ? this.events.find(event => event.id === eventId) : undefined;
    const draggedCapacityBlock = eventId ? this.capacityBlocks.find(block => block.id === eventId) : undefined;
    const durationMinutes = this.dropVisualContext?.durationMinutes
      ?? (draggedEvent ? Math.max(1, Math.round((draggedEvent.end.getTime() - draggedEvent.start.getTime()) / 60000)) : undefined)
      ?? draggedCapacityBlock?.durationMinutes
      ?? (Number.isFinite(durationFru) && durationFru > 0 ? durationFru : 1) * MINUTES_PER_FRU;
    const rowEl = e.currentTarget as HTMLElement;
    const cell = rowEl.querySelector('.scheduler__timeline-cell') as HTMLElement | null;
    if (!cell || !this.daySlots.length) return null;

    const cellRect = cell.getBoundingClientRect();
    if (e.clientX < cellRect.left || e.clientX > cellRect.right) return null;

    const dayWidthPx = this.getDayWidth();
    const previewWidth = Math.max((durationMinutes / 60) * this.HOUR_WIDTH, 20);
    const maxLeft = Math.max(0, this.totalWidth - previewWidth);
    const absoluteX = Math.max(0, Math.min(e.clientX - cellRect.left, maxLeft));
    const dayIndex = Math.max(0, Math.min(Math.floor(absoluteX / dayWidthPx), this.daySlots.length - 1));
    const safeDay = this.daySlots[dayIndex];
    const xWithinDay = Math.max(0, Math.min(absoluteX - dayIndex * dayWidthPx - this.getDayCapacityLaneWidth(), this.getTimedDayWidth()));
    const minutesFromDayStart = (xWithinDay / this.HOUR_WIDTH) * 60;
    const snapMinutes = this.effectiveDropSnapMinutes;
    const pointerOffsetMinutes = this.dropVisualContext?.pointerOffsetMinutes ?? 0;
    const startMinutesFromDayStart = Math.max(0, minutesFromDayStart - pointerOffsetMinutes);
    const snappedSlotIndex = Math.floor(startMinutesFromDayStart / snapMinutes);
    const snappedMinutesFromDayStart = Math.max(
      0,
      Math.min(
        snappedSlotIndex * snapMinutes,
        12 * 60,
      ),
    );

    const start = this.dropVisualContext?.anchoredStart
      ? new Date(this.dropVisualContext.anchoredStart)
      : new Date(safeDay);
    if (!this.dropVisualContext?.anchoredStart) {
      start.setHours(9, 0, 0, 0);
      start.setMinutes(snappedMinutesFromDayStart, 0, 0);
    }
    const end = this.dropVisualContext?.anchoredEnd
      ? new Date(this.dropVisualContext.anchoredEnd)
      : new Date(start.getTime() + durationMinutes * 60000);
    const left = this.getLeftFromDate(start);
    const width = Math.max((end.getTime() - start.getTime()) / 3600000 * this.HOUR_WIDTH, 20);
    const previewLeft = Math.max(0, Math.min(left, this.totalWidth - width));

    return {
      resourceId,
      start,
      end,
      left: previewLeft,
      top: this.getResourceTop(resourceId),
      width,
      mode: 'timed',
    };
  }

  private buildCapacityDropPreview(e: DragEvent, resourceId: string, day: Date, allowDragOverFallback = false): DropPreview | null {
    const eventId = this.getDragData(e, 'eventId') || this.nativeDraggedEventId;
    const jobId = e.dataTransfer?.getData('jobId');
    const orderId = e.dataTransfer?.getData('orderId');
    if (!jobId && !orderId && !allowDragOverFallback) return null;

    const durationFru = parseFloat(e.dataTransfer?.getData('fru') ?? '1');
    const draggedEvent = eventId ? this.events.find(event => event.id === eventId) : undefined;
    const draggedCapacityBlock = eventId ? this.capacityBlocks.find(block => block.id === eventId) : undefined;
    const durationMinutes = this.dropVisualContext?.durationMinutes
      ?? (draggedEvent ? Math.max(1, Math.round((draggedEvent.end.getTime() - draggedEvent.start.getTime()) / 60000)) : undefined)
      ?? draggedCapacityBlock?.durationMinutes
      ?? (Number.isFinite(durationFru) && durationFru > 0 ? durationFru : 1) * MINUTES_PER_FRU;
    const date = new Date(day);
    date.setHours(0, 0, 0, 0);
    const start = new Date(date);
    start.setHours(9, 0, 0, 0);
    const end = new Date(start.getTime() + durationMinutes * 60000);

    return {
      resourceId,
      start,
      end,
      left: this.getCapacityLaneLeft(day),
      top: this.getResourceTop(resourceId),
      width: this.getDayCapacityLaneWidth(),
      mode: 'day-capacity',
      date,
      durationMinutes,
    };
  }

  private normalizeDropSnapMinutes(value: number | null | undefined): number {
    if (!Number.isFinite(value) || !value || value <= 0) return this.slotDurationMinutes;
    return value;
  }

  private getDragData(e: DragEvent, key: string): string {
    return e.dataTransfer?.getData(key) || e.dataTransfer?.getData(key.toLowerCase()) || '';
  }

  private getEventPointerOffsetMinutes(e: DragEvent, event: SchedulerEvent): number {
    const target = e.target instanceof HTMLElement ? e.target.closest('.scheduler__event') as HTMLElement | null : null;
    const rect = target?.getBoundingClientRect();
    if (!rect) return 0;
    const offsetPx = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    return Math.max(0, Math.min((offsetPx / this.HOUR_WIDTH) * 60, Math.max(0, (event.end.getTime() - event.start.getTime()) / 60000)));
  }
}

