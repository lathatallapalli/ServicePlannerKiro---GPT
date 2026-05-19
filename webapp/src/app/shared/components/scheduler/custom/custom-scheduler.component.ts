import {
  Component, Input, Output, EventEmitter,
  OnChanges, OnInit, SimpleChanges, ChangeDetectionStrategy,
  ElementRef, ViewChild, AfterViewInit, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UnavailabilityBlock } from '../../../../core/models/availability.model';
import {
  SchedulerResource, SchedulerEvent, SchedulerGroup,
  EventMovePayload, EventResizePayload, EventDropPayload, EventClickPayload, ResourceSelectionChangePayload
} from '../scheduler.interface';
import { ResourceFavoriteView } from '../../../../features/service-planner/services/planner-settings.service';

const SLOT_WIDTH = 60;        // px per slot (fixed — one slot always = 60px)
const ROW_HEIGHT = 78;        // px per resource row
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

interface SchedulerOrderRun {
  key: string;
  resourceId: string;
  events: SchedulerEvent[];
  start: Date;
  end: Date;
  firstEvent: SchedulerEvent;
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
  @Input() resources: SchedulerResource[] = [];
  @Input() events: SchedulerEvent[] = [];
  @Input() groups: SchedulerGroup[] = [];
  @Input() unavailability: UnavailabilityBlock[] = [];
  @Input() viewStart: Date = new Date();
  @Input() viewEnd: Date = new Date();
  @Input() slotDurationMinutes = 60;
  @Input() readonly = false;
  @Input() showOrderTiles = true;
  @Input() preserveRowHeightOnAvailability = false;
  @Input() detailedEventIds: string[] = [];
  @Input() detailedOrderIds: string[] = [];
  @Input() selectedResourceIds: string[] = [];
  @Input() resourceViews: ResourceFavoriteView[] = [];
  @Input() selectedResourceView: ResourceFavoriteView | null = null;
  @Input() rightPaneOpen = false;

  @Output() eventMoved   = new EventEmitter<EventMovePayload>();
  @Output() eventResized = new EventEmitter<EventResizePayload>();
  @Output() eventDropped = new EventEmitter<EventDropPayload>();
  @Output() eventClicked = new EventEmitter<EventClickPayload>();
  @Output() resourceSelectionChange = new EventEmitter<ResourceSelectionChangePayload>();
  @Output() resourceViewChange = new EventEmitter<ResourceFavoriteView | null>();
  @Output() resourceViewListRequested = new EventEmitter<ResourceFavoriteView | null>();
  @Output() resourceViewAddRequested = new EventEmitter<void>();
  @Output() rightPaneToggle = new EventEmitter<void>();

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
  selectedMonth: number = new Date().getMonth();
  resourceSearch = '';
  selectedGroupIds: string[] = [];
  isGroupDropdownOpen = false;
  isResourceViewDropdownOpen = false;
  showSelectedOnlyByGroup = new Set<string>();
  collapsedGroupIds = new Set<string>();
  private hasInitializedGroupSelection = false;

  get selectedYear(): number { return this.viewStart.getFullYear(); }

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
  private dragging: { event: SchedulerEvent; offsetX: number; startY: number } | null = null;
  private resizing: { event: SchedulerEvent; edge: 'left' | 'right'; startX: number; originalStart: Date; originalEnd: Date } | null = null;
  dragPreview: { event: SchedulerEvent; resourceId: string; left: number; top: number; width: number } | null = null;
  resizePreview: { event: SchedulerEvent; left: number; top: number; width: number } | null = null;

  constructor(private zone: NgZone) {}

  ngOnInit(): void {
    this.buildTimeSlots();
  }

  ngAfterViewInit(): void {
    this.selectedMonth = this.viewStart.getMonth();
    this.zone.runOutsideAngular(() => {
      if (this.bodyScrollRef) {
        this.bodyScrollRef.nativeElement.addEventListener('scroll', () => this.syncHeaderScroll());
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['viewStart'] || changes['viewEnd'] || changes['slotDurationMinutes']) {
      this.buildTimeSlots();
    }
    if (changes['groups'] && !this.hasInitializedGroupSelection) {
      this.selectedGroupIds = this.groups.map(group => group.id);
      this.hasInitializedGroupSelection = true;
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

  getHourOffsetInDay(hour: Date): number {
    return (hour.getHours() - 9) * this.HOUR_WIDTH;
  }

  formatDay(day: Date): string {
    return day.getDate().toString();
  }

  formatWeekday(day: Date): string {
    return day.toLocaleDateString('en-GB', { weekday: 'short' });
  }

  // ── Layout helpers ──────────────────────────────────────────────────────────

  getGroupHeight(groupId: string): number {
    return this.getResourcesForGroup(groupId).length * this.rowHeight + GROUP_ROW_HEIGHT;
  }

  getEventsForResource(resourceId: string): SchedulerEvent[] {
    return this.events.filter(e => e.resourceId === resourceId);
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

  getUnavailabilityTitle(block: UnavailabilityBlock): string {
    return block.title ?? block.reason ?? 'Unavailable';
  }

  getUnavailabilityDetail(block: UnavailabilityBlock): string {
    return `${this.formatEventTime(block.start)}–${this.formatEventTime(block.end)}`;
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

    const visualGap = this.hasContiguousNextEvent(event) ? 0 : 4;
    return Math.max(visibleHours * this.HOUR_WIDTH - visualGap, 20);
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
    if (this.dragPreview?.event.id === event.id) return this.dragPreview.left;
    if (this.resizePreview?.event.id === event.id) return this.resizePreview.left;
    return this.getEventLeft(event);
  }

  getRenderedEventWidth(event: SchedulerEvent): number {
    if (this.dragPreview?.event.id === event.id) return this.dragPreview.width;
    if (this.resizePreview?.event.id === event.id) return this.resizePreview.width;
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
    return this.dragPreview?.event.id === event.id || this.resizePreview?.event.id === event.id;
  }

  shouldRenderEventForResource(event: SchedulerEvent, resourceId: string): boolean {
    if (this.dragPreview?.event.id === event.id) return false;
    if (this.resizePreview?.event.id === event.id) return false;
    return event.resourceId === resourceId;
  }

  shouldShowEventDetails(event: SchedulerEvent): boolean {
    return this.showOrderTiles || this.detailedEventIds.includes(event.id);
  }

  getPreviewEvent(): SchedulerEvent | null {
    return this.dragPreview?.event ?? this.resizePreview?.event ?? null;
  }

  getPreviewLeft(): number {
    return (this.dragPreview?.left ?? this.resizePreview?.left ?? 0) + RESOURCE_COL_WIDTH;
  }

  getPreviewTop(): number {
    return this.dragPreview?.top ?? this.resizePreview?.top ?? 0;
  }

  getPreviewWidth(): number {
    return this.dragPreview?.width ?? this.resizePreview?.width ?? 0;
  }

  getEventTagLabel(event: SchedulerEvent): string {
    const status = this.getEventStatus(event);
    if (status === 'order-started') return 'Order started';
    if (status === 'customer-waiting') return 'Customer waiting';
    if (status === 'completed') return 'Completed';

    const kind = event.meta?.entry?.kind;
    if (!kind || kind === 'tentative') return 'Tentative';
    if (kind === 'blocked-order') return 'Booked';
    return kind
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  getEventStatus(event: SchedulerEvent): 'order-started' | 'customer-waiting' | 'completed' | null {
    const jobStatus = event.meta?.job?.status;
    const order = (event.meta as any)?.order;
    const orderStatus = order?.status;
    const customerWaiting = order?.customerWaiting ?? order?.isCustomerWaiting;

    if (jobStatus === 'completed' || orderStatus === 'complete') return 'completed';
    if (customerWaiting) return 'customer-waiting';
    if (jobStatus === 'in-progress' || orderStatus === 'preparation') return 'order-started';
    return null;
  }

  isBlockedOrderEvent(event: SchedulerEvent): boolean {
    return event.meta?.entry?.kind === 'blocked-order';
  }

  getEventDetail(event: SchedulerEvent): string {
    if (this.isBlockedOrderEvent(event)) {
      return event.meta?.entry?.title ?? event.meta?.entry?.workOrderReference ?? this.formatEventTimeRange(event);
    }

    const job = event.meta?.job;
    const detailParts = [job?.description ?? job?.title, this.getEventDuration(event)].filter(Boolean);
    return detailParts.join(' | ');
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
    const eventJobId = event.meta?.entry?.jobId ?? event.meta?.job?.id ?? event.id;
    const visibleJobs = new Set(
      this.events
        .filter(candidate => this.getEventOrderKey(candidate) === this.getEventOrderKey(event))
        .map(candidate => candidate.meta?.entry?.jobId ?? candidate.meta?.job?.id ?? candidate.id)
    );
    return `${visibleJobs.has(eventJobId) ? 1 : 0}/${totalJobs}`;
  }

  getOrderRunSequence(run: SchedulerOrderRun): string {
    const order = (run.firstEvent.meta as any)?.order;
    const totalJobs = order?.jobs?.length ?? run.events.length;
    const visibleJobs = new Set(run.events.map(event => event.meta?.entry?.jobId ?? event.meta?.job?.id ?? event.id)).size;
    return `${visibleJobs}/${totalJobs}`;
  }

  getEventDuration(event: SchedulerEvent): string {
    const durationMinutes = event.meta?.job?.estimatedDurationMinutes
      ?? Math.round((event.end.getTime() - event.start.getTime()) / 60000);
    return `${durationMinutes} min`;
  }

  formatEventTimeRange(event: SchedulerEvent): string {
    return `${this.formatEventTime(event.start)}–${this.formatEventTime(event.end)}`;
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
    if (this.collapsedGroupIds.has(groupId)) return [];
    const query = this.resourceSearch.trim().toLowerCase();
    return this.resources.filter(resource => {
      if (resource.groupId !== groupId) return false;
      if (!this.selectedGroupIds.includes(groupId)) return false;
      if (this.showSelectedOnlyByGroup.has(groupId) && !this.isResourceSelected(resource.id)) return false;
      if (query && !`${resource.label} ${resource.groupLabel ?? ''}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }

  getUngroupedResources(): SchedulerResource[] {
    return this.resources.filter(r => !r.groupId);
  }

  get visibleGroups(): SchedulerGroup[] {
    return this.groups.filter(group => {
      if (!this.selectedGroupIds.includes(group.id)) return false;
      return this.getResourcesForGroup(group.id).length > 0;
    });
  }

  get selectedGroupLabel(): string {
    const count = this.selectedGroupIds.length;
    return count === this.groups.length ? 'All resource types' : `${count} selected`;
  }

  get selectedResourceViewLabel(): string {
    return this.selectedResourceView?.label ?? 'All resources';
  }

  selectResourceView(view: ResourceFavoriteView | null): void {
    this.resourceViewChange.emit(view);
    this.isResourceViewDropdownOpen = false;
  }

  toggleResourceViewDropdown(): void {
    this.isResourceViewDropdownOpen = !this.isResourceViewDropdownOpen;
    if (this.isResourceViewDropdownOpen) this.isGroupDropdownOpen = false;
  }

  onBodyScroll(): void {
    this.syncHeaderScroll();
  }

  openResourceViewList(): void {
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

  toggleGroupDropdown(): void {
    this.isGroupDropdownOpen = !this.isGroupDropdownOpen;
    if (this.isGroupDropdownOpen) this.isResourceViewDropdownOpen = false;
  }

  toggleGroupSelection(groupId: string, event: Event): void {
    event.stopPropagation();
    this.selectedGroupIds = this.selectedGroupIds.includes(groupId)
      ? this.selectedGroupIds.filter(id => id !== groupId)
      : [...this.selectedGroupIds, groupId];
  }

  clearGroupSelection(event: Event): void {
    event.stopPropagation();
    this.selectedGroupIds = this.groups.map(group => group.id);
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

  // ── Drag to move ────────────────────────────────────────────────────────────

  onEventMouseDown(e: MouseEvent, event: SchedulerEvent): void {
    if (this.readonly) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    this.dragging = { event, offsetX: e.clientX - rect.left, startY: e.clientY };

    const onMove = (me: MouseEvent) => this.onDragMove(me);
    const onUp   = (me: MouseEvent) => {
      this.onDragEnd(me);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  private onDragMove(e: MouseEvent): void {
    if (!this.dragging) return;
    const { event, offsetX } = this.dragging;
    const gridEl = this.bodyScrollRef.nativeElement;
    const gridRect = gridEl.getBoundingClientRect();
    const rawLeft = e.clientX - gridRect.left + gridEl.scrollLeft - RESOURCE_COL_WIDTH - offsetX;
    const left = Math.max(0, Math.min(rawLeft, Math.max(0, this.totalWidth - this.getEventWidth(event))));
    const yInBody = e.clientY - gridRect.top + gridEl.scrollTop;
    const resource = this.getResourceAtY(yInBody);

    this.zone.run(() => {
      this.dragPreview = {
        event,
        resourceId: resource?.id ?? event.resourceId,
        left,
        top: this.getResourceTop(resource?.id ?? event.resourceId),
        width: this.getEventWidth(event),
      };
    });
  }

  private onDragEnd(e: MouseEvent): void {
    if (!this.dragging) return;
    const { event, offsetX } = this.dragging;
    const preview = this.dragPreview;
    this.dragging = null;
    this.dragPreview = null;

    const gridEl = this.bodyScrollRef.nativeElement;
    const gridRect = gridEl.getBoundingClientRect();

    // X position within the timeline (accounting for resource col and scroll)
    const xInTimeline = preview?.left ?? e.clientX - gridRect.left + gridEl.scrollLeft - RESOURCE_COL_WIDTH - offsetX;
    const dayIndex = Math.floor(xInTimeline / (12 * this.HOUR_WIDTH));
    const xInDay = xInTimeline - dayIndex * 12 * this.HOUR_WIDTH;
    const hoursInDay = (xInDay / this.HOUR_WIDTH);
    const snappedHours = Math.round(hoursInDay * (60 / this.slotDurationMinutes)) / (60 / this.slotDurationMinutes);

    const safeDay = this.daySlots[Math.max(0, Math.min(dayIndex, this.daySlots.length - 1))];
    const newStart = new Date(safeDay);
    newStart.setHours(9 + Math.floor(snappedHours), (snappedHours % 1) * 60, 0, 0);

    const duration = event.end.getTime() - event.start.getTime();
    const newEnd = new Date(newStart.getTime() + duration);

    // Y position to find resource row (skip group label rows of 28px)
    const yInBody = e.clientY - gridRect.top + gridEl.scrollTop;
    const newResource = this.getResourceAtY(yInBody);

    this.zone.run(() => {
      this.eventMoved.emit({
        eventId: event.id,
        resourceId: preview?.resourceId ?? newResource?.id ?? event.resourceId,
        start: newStart,
        end: newEnd,
      });
    });
  }

  private getResourceAtY(y: number): SchedulerResource | null {
    let currentY = 0;
    for (const group of this.visibleGroups) {
      currentY += GROUP_ROW_HEIGHT; // group label height
      for (const resource of this.getResourcesForGroup(group.id)) {
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
      for (const resource of this.getResourcesForGroup(group.id)) {
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
    e.preventDefault();
    e.stopPropagation();

    this.resizing = {
      event, edge,
      startX: e.clientX,
      originalStart: new Date(event.start),
      originalEnd: new Date(event.end),
    };

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
    const deltaMinutes = deltaX * (60 / this.HOUR_WIDTH);

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
      });
    }
  }

  private onResizeEnd(e: MouseEvent): void {
    if (!this.resizing) return;
    const { event, edge, startX, originalStart, originalEnd } = this.resizing;
    this.resizing = null;
    this.resizePreview = null;

    // event.start/end already updated live in onResizeMove — just emit final values
    const deltaX = e.clientX - startX;
    const rawDeltaMinutes = deltaX * (60 / this.HOUR_WIDTH);
    const deltaMinutes = Math.round(rawDeltaMinutes / this.slotDurationMinutes) * this.slotDurationMinutes;
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

  onEventClick(e: MouseEvent, event: SchedulerEvent): void {
    e.stopPropagation();
    this.eventClicked.emit({ eventId: event.id });
  }

  dropTargetResourceId: string | null = null;

  onDragOver(e: DragEvent, resourceId: string): void {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    this.dropTargetResourceId = resourceId;
  }

  onDragLeave(): void {
    this.dropTargetResourceId = null;
  }

  onDrop(e: DragEvent, resourceId: string): void {
    e.preventDefault();
    this.dropTargetResourceId = null;

    const jobId = e.dataTransfer?.getData('jobId');
    const orderId = e.dataTransfer?.getData('orderId') || undefined;
    const dropType = (e.dataTransfer?.getData('dropType') || (orderId ? 'order' : 'job')) as 'job' | 'order';
    const durationMinutes = parseInt(e.dataTransfer?.getData('durationMinutes') ?? '60', 10);
    const resourceType = e.dataTransfer?.getData('resourceType') || undefined;
    if (!jobId && !orderId) return;

    const bodyEl = this.bodyScrollRef?.nativeElement;
    const scrollLeft = bodyEl ? bodyEl.scrollLeft : 0;

    // Absolute X position within the scrollable timeline (excluding resource column)
    const cell = (e.currentTarget as HTMLElement).querySelector('.scheduler__timeline-cell') as HTMLElement;
    if (!cell) return;
    const cellRect = cell.getBoundingClientRect();
    const xInCell = e.clientX - cellRect.left;
    const absoluteX = xInCell + scrollLeft;

    // Which day column are we in?
    const dayWidthPx = 12 * this.HOUR_WIDTH; // 12 hours per day
    const dayIndex = Math.floor(absoluteX / dayWidthPx);
    const safeDay = this.daySlots[Math.max(0, Math.min(dayIndex, this.daySlots.length - 1))];

    // X offset within that specific day column → minutes from 09:00
    const xWithinDay = absoluteX - dayIndex * dayWidthPx;
    const minutesFromDayStart = (xWithinDay / this.HOUR_WIDTH) * 60;

    const start = new Date(safeDay);
    start.setHours(9, 0, 0, 0);
    start.setMinutes(Math.max(0, minutesFromDayStart));

    // snap to slot
    const slotMins = this.slotDurationMinutes;
    const totalMins = start.getHours() * 60 + start.getMinutes();
    const snappedTotalMins = Math.round(totalMins / slotMins) * slotMins;
    start.setHours(Math.floor(snappedTotalMins / 60), snappedTotalMins % 60, 0, 0);

    const end = new Date(start.getTime() + durationMinutes * 60000);

    this.zone.run(() => {
      this.eventDropped.emit({ jobId: jobId || `order-${orderId}`, orderId, dropType, resourceId, resourceType, start, end });
    });
  }
}
