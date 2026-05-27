import {
  Component, Input, Output, EventEmitter,
  OnChanges, OnInit, SimpleChanges, ChangeDetectionStrategy,
  ElementRef, ViewChild, AfterViewInit, NgZone, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UnavailabilityBlock } from '../../../../core/models/availability.model';
import { WorkorderItemStatus } from '../../../../core/models/job.model';
import {
  SchedulerResource, SchedulerEvent, SchedulerGroup,
  EventMovePayload, EventResizePayload, EventResizeDragPayload, EventDropPayload, EventClickPayload, EventContextMenuPayload, OrderFocusPayload,
  ResourceSelectionChangePayload, ResourceTypeSelectionChangePayload, SchedulerInvalidDropRange, SchedulerDropVisualContext,
  EventDragPayload
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
const GROUP_ROW_HEIGHT = 48;
const EVENT_FULL_TAG_MIN_WIDTH = 220;
const EVENT_ICON_TAG_MIN_WIDTH = 150;
const EVENT_CONTACT_MIN_WIDTH = 300;

interface EventHoverTooltip {
  event: SchedulerEvent;
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
export class CustomSchedulerComponent implements OnInit, OnChanges, AfterViewInit {
  @Input() public resources: SchedulerResource[] = [];
  @Input() public events: SchedulerEvent[] = [];
  @Input() public groups: SchedulerGroup[] = [];
  @Input() public unavailability: UnavailabilityBlock[] = [];
  @Input() public viewStart: Date = new Date();
  @Input() public viewEnd: Date = new Date();
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
  @Input() public resourceViews: ResourceFavoriteView[] = [];
  @Input() public selectedResourceView: ResourceFavoriteView | null = null;
  @Input('rightPaneOpen') public rightPaneOpen = false;
  @Input() public scrollToEventId: string | null = null;
  @Input() public invalidDropRanges: SchedulerInvalidDropRange[] = [];
  @Input() public resizeInvalidHint = '';
  @Input() public dropVisualContext: SchedulerDropVisualContext | null = null;

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

  // dynamic: one slot always = 60px, so hour width scales with slot duration
  get HOUR_WIDTH(): number {
    return SLOT_WIDTH * (60 / this.slotDurationMinutes);
  }

  get rowHeight(): number {
    return ROW_HEIGHT;
  }

  timeSlots: Date[] = [];
  daySlots: Date[] = [];
  totalMinutes = 0;

  get totalWidth(): number {
    return this.daySlots.length * 12 * this.HOUR_WIDTH;
  }

  months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  selectedMonth = this.viewStart.getMonth();
  resourceSearch = '';
  isGroupDropdownOpen = false;
  isResourceViewDropdownOpen = false;
  showSelectedOnlyByGroup = new Set<string>();
  collapsedGroupIds = new Set<string>();
  copiedContactKey: string | null = null;
  private copiedContactResetId: ReturnType<typeof setTimeout> | null = null;

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
  dropPreview: DropPreview | null = null;
  dropTargetResourceId: string | null = null;
  private lastValidDropPreview: DropPreview | null = null;
  private nativeDraggedEventId: string | null = null;
  private nativeDropHandled = false;

  constructor(private zone: NgZone, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.selectedMonth = this.viewStart.getMonth();
    this.buildTimeSlots();
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      if (this.bodyScrollRef) {
        this.bodyScrollRef.nativeElement.addEventListener('scroll', () => this.syncHeaderScroll());
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['viewStart'] || changes['viewEnd'] || changes['slotDurationMinutes']) {
      this.selectedMonth = this.viewStart.getMonth();
      this.buildTimeSlots();
    }
    if (changes['scrollToEventId'] && this.scrollToEventId) {
      queueMicrotask(() => this.scrollToEvent(this.scrollToEventId));
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
    return dayIndex * 12 * this.HOUR_WIDTH;
  }

  getDayWidth(): number {
    return 12 * this.HOUR_WIDTH;
  }

  getHourOffsetInDay(slot: Date): number {
    return (slot.getHours() - 9 + slot.getMinutes() / 60) * this.HOUR_WIDTH;
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
    return this.getExpandedResourcesForGroup(groupId).length * this.rowHeight + GROUP_ROW_HEIGHT;
  }

  getEventsForResource(resourceId: string): SchedulerEvent[] {
    return this.events.filter(e => e.resourceId === resourceId);
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

  getUnavailabilityLeft(block: UnavailabilityBlock): number {
    const day = new Date(block.start);
    day.setHours(0, 0, 0, 0);
    return this.getDayOffsetPx(day) + (block.start.getHours() - 9 + block.start.getMinutes() / 60) * this.HOUR_WIDTH;
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
    const hourOffset = (date.getHours() - 9 + date.getMinutes() / 60) * this.HOUR_WIDTH;
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
    return this.getEventWidth(event) >= EVENT_ICON_TAG_MIN_WIDTH;
  }

  shouldShowEventTagIconOnly(event: SchedulerEvent): boolean {
    const width = this.getEventWidth(event);
    return width >= EVENT_ICON_TAG_MIN_WIDTH && width < EVENT_FULL_TAG_MIN_WIDTH;
  }

  getRenderedEventLeft(event: SchedulerEvent): number {
    const eventId = this.getSourceEventId(event);
    if (this.resizePreview?.event.id === eventId) return this.resizePreview.left;
    return this.getEventLeft(event);
  }

  getRenderedEventWidth(event: SchedulerEvent): number {
    const eventId = this.getSourceEventId(event);
    if (this.resizePreview?.event.id === eventId) return this.resizePreview.width;
    return this.getEventWidth(event);
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

  getOrderRunLeft(run: SchedulerOrderRun): number {
    return this.getLeftFromDate(run.start);
  }

  getOrderRunWidth(run: SchedulerOrderRun): number {
    return this.getEventWidth({ ...run.firstEvent, start: run.start, end: run.end });
  }

  isInContiguousOrderRun(event: SchedulerEvent): boolean {
    return this.hasContiguousPreviousEvent(event) || this.hasContiguousNextEvent(event);
  }

  shouldReserveOrderRunSpace(event: SchedulerEvent): boolean {
    const orderKey = this.getEventOrderKey(event);
    return this.shouldShowEventDetails(event)
      && this.isInContiguousOrderRun(event)
      && (this.showOrderTiles || (!!orderKey && this.detailedOrderIds.includes(orderKey)));
  }

  isPreviewingEvent(event: SchedulerEvent): boolean {
    const eventId = this.getSourceEventId(event);
    return this.resizePreview?.event.id === eventId;
  }

  isEventResizeActive(event: SchedulerEvent): boolean {
    return this.resizing?.event.id === this.getSourceEventId(event);
  }

  shouldRenderEventForResource(event: SchedulerEvent, resourceId: string): boolean {
    const eventId = this.getSourceEventId(event);
    if (this.resizePreview?.event.id === eventId) return false;
    if (this.isDragFeedbackActive() && this.nativeDraggedEventId !== eventId) return false;
    if (this.resizePreview?.event.resourceId === resourceId) return false;
    return event.resourceId === resourceId;
  }

  shouldShowEventDetails(event: SchedulerEvent): boolean {
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

    const dayWidthPx = 12 * this.HOUR_WIDTH;
    const dayIndex = Math.max(0, Math.min(Math.floor(preview.left / dayWidthPx), this.daySlots.length - 1));
    const start = new Date(this.daySlots[dayIndex]);
    start.setHours(9, 0, 0, 0);
    start.setMinutes(((preview.left - dayIndex * dayWidthPx) / this.HOUR_WIDTH) * MINUTES_PER_FRU, 0, 0);
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

  isDropPreviewInvalidForResource(resourceId: string): boolean {
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
    this.hoverTooltip = {
      event,
      x: mouseEvent.clientX + 12,
      y: mouseEvent.clientY + 12,
    };
  }

  moveEventTooltip(event: SchedulerEvent, mouseEvent: MouseEvent): void {
    if (this.isResizePreviewInvalid()) return;
    this.hoverTooltip = {
      event,
      x: mouseEvent.clientX + 12,
      y: mouseEvent.clientY + 12,
    };
  }

  hideEventTooltip(): void {
    this.hoverTooltip = null;
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

  getEventOrderId(event: SchedulerEvent): string | null {
    const order = (event.meta as any)?.order;
    const entry = event.meta?.entry;
    const reference = entry?.workOrderReference;
    const activityOrderId = entry?.jobId?.includes(':act-') ? entry.jobId.split(':act-')[0] : null;
    return order?.id ?? order?.referenceNumber ?? reference ?? activityOrderId ?? null;
  }
  getEventOrderReference(event: SchedulerEvent): string {
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

  getResourcesForGroup(groupId: string): SchedulerResource[] {
    const query = this.resourceSearch.trim().toLowerCase();
    return this.resources.filter(resource => {
      if (resource.groupId !== groupId) return false;
      if (!this.selectedResourceTypeGroupIds.includes(groupId)) return false;
      if (this.showSelectedOnlyByGroup.has(groupId) && !this.isResourceSelected(resource.id)) return false;
      if (query && !`${resource.label} ${resource.groupLabel ?? ''}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }

  public getExpandedResourcesForGroup(groupId: string): SchedulerResource[] {
    return this.collapsedGroupIds.has(groupId) ? [] : this.getResourcesForGroup(groupId);
  }

  getUngroupedResources(): SchedulerResource[] {
    const visibleGroupIds = new Set(this.visibleGroups.map(group => group.id));
    return this.resources.filter(resource => !resource.groupId || !visibleGroupIds.has(resource.groupId));
  }

  get visibleGroups(): SchedulerGroup[] {
    return this.groups.filter(group => {
      if (!this.selectedResourceTypeGroupIds.includes(group.id)) return false;
      return this.hasResourcesForGroup(group.id);
    });
  }

  private hasResourcesForGroup(groupId: string): boolean {
    const query = this.resourceSearch.trim().toLowerCase();
    return this.resources.some(resource => {
      if (resource.groupId !== groupId) return false;
      if (query && !`${resource.label} ${resource.groupLabel ?? ''}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }

  get selectedGroupLabel(): string {
    const count = this.selectedResourceTypeGroupIds.length;
    return this.areAllResourceTypesSelected() ? 'All resource types' : `${count} selected`;
  }

  areAllResourceTypesSelected(): boolean {
    return this.groups.every(group => this.selectedResourceTypeGroupIds.includes(group.id));
  }

  get selectedResourceViewLabel(): string {
    return this.selectedResourceView?.label ?? 'All resources';
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
    this.syncHeaderScroll();
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
    this.headerScrollRef.nativeElement.scrollLeft = this.bodyScrollRef.nativeElement.scrollLeft;
  }

  private scrollToEvent(eventId: string | null): void {
    if (!eventId || !this.bodyScrollRef) return;
    const event = this.events.find(candidate => candidate.id === eventId);
    if (!event) return;

    const body = this.bodyScrollRef.nativeElement;
    const eventLeft = this.getEventLeft(event);
    const eventWidth = this.getEventWidth(event);
    const left = Math.max(0, eventLeft + eventWidth / 2 - body.clientWidth / 2);
    const top = Math.max(0, this.getResourceTop(event.resourceId) - GROUP_ROW_HEIGHT);
    body.scrollTo({ left, top, behavior: 'smooth' });
    this.syncHeaderScroll();
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

  isGroupCollapsed(groupId: string): boolean {
    return this.collapsedGroupIds.has(groupId);
  }

  toggleSelectedOnlyForGroup(groupId: string): void {
    if (this.showSelectedOnlyByGroup.has(groupId)) {
      this.showSelectedOnlyByGroup.delete(groupId);
      return;
    }
    if (!this.resources.some(resource => resource.groupId === groupId && this.isResourceSelected(resource.id))) return;
    this.showSelectedOnlyByGroup.add(groupId);
  }

  isShowingSelectedOnly(groupId: string): boolean {
    return this.showSelectedOnlyByGroup.has(groupId);
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

  onEventDragEnd(e: DragEvent, event: SchedulerEvent): void {
    e.stopPropagation();
    const sourceEvent = this.getSourceEvent(event);
    const preview = this.dropPreview ?? this.lastValidDropPreview;
    if (!this.nativeDropHandled && this.nativeDraggedEventId === sourceEvent.id && preview) {
      this.zone.run(() => {
        this.eventMoved.emit({ eventId: sourceEvent.id, resourceId: preview.resourceId, start: preview.start, end: preview.end });
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
  private getResourceAtY(y: number): SchedulerResource | null {
    let currentY = 0;
    for (const group of this.visibleGroups) {
      currentY += GROUP_ROW_HEIGHT; // group label height
      for (const resource of this.getExpandedResourcesForGroup(group.id)) {
        if (y >= currentY && y < currentY + this.rowHeight) return resource;
        currentY += this.rowHeight;
      }
    }
    for (const resource of this.getUngroupedResources()) {
      if (y >= currentY && y < currentY + this.rowHeight) return resource;
      currentY += this.rowHeight;
    }
    return null;
  }

  private getResourceTop(resourceId: string): number {
    let currentY = 0;
    for (const group of this.visibleGroups) {
      currentY += GROUP_ROW_HEIGHT;
      for (const resource of this.getExpandedResourcesForGroup(group.id)) {
        if (resource.id === resourceId) return currentY;
        currentY += this.rowHeight;
      }
    }
    for (const resource of this.getUngroupedResources()) {
      if (resource.id === resourceId) return currentY;
      currentY += this.rowHeight;
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
    this.hideEventTooltip();
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

  onDragLeave(): void {
    this.dropPreview = null;
    this.dropTargetResourceId = null;
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
    const externalDropType = (dropType || (orderId ? 'order' : 'job')) as 'job' | 'order';
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
      this.eventDropped.emit({ jobId: jobId || `order-${orderId}`, orderId, dropType: externalDropType, resourceId: preview.resourceId, resourceType, droppedResourceType, start, end });
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
    const durationMinutes = this.dropVisualContext?.durationMinutes
      ?? (draggedEvent ? Math.max(1, Math.round((draggedEvent.end.getTime() - draggedEvent.start.getTime()) / 60000)) : undefined)
      ?? (Number.isFinite(durationFru) && durationFru > 0 ? durationFru : 1) * MINUTES_PER_FRU;
    const bodyEl = this.bodyScrollRef?.nativeElement;
    const scrollLeft = bodyEl ? bodyEl.scrollLeft : 0;
    const rowEl = e.currentTarget as HTMLElement;
    const cell = rowEl.querySelector('.scheduler__timeline-cell') as HTMLElement | null;
    if (!cell || !this.daySlots.length) return null;

    const cellRect = cell.getBoundingClientRect();
    if (e.clientX < cellRect.left || e.clientX > cellRect.right) return null;

    const dayWidthPx = 12 * this.HOUR_WIDTH;
    const previewWidth = Math.max((durationMinutes / 60) * this.HOUR_WIDTH, 20);
    const maxLeft = Math.max(0, this.totalWidth - previewWidth);
    const absoluteX = Math.max(0, Math.min(e.clientX - cellRect.left + scrollLeft, maxLeft));
    const dayIndex = Math.max(0, Math.min(Math.floor(absoluteX / dayWidthPx), this.daySlots.length - 1));
    const safeDay = this.daySlots[dayIndex];
    const xWithinDay = Math.max(0, Math.min(absoluteX - dayIndex * dayWidthPx, dayWidthPx));
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







