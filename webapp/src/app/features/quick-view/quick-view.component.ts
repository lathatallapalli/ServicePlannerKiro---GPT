import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Resource } from '../../core/models/resource.model';
import { ScheduleEntry } from '../../core/models/schedule.model';
import { WorkOrder } from '../../core/models/work-order.model';
import { ResourceRepository } from '../../core/services/resource.repository';
import { ScheduleRepository } from '../../core/services/schedule.repository';
import { WorkOrderRepository } from '../../core/services/work-order.repository';
import { PlannerSettingsService } from '../service-planner/services/planner-settings.service';
import { QuickViewActivitySlot, QuickViewDay, QuickViewHandoverSlot, QuickViewSlotFilter, QuickViewWorkProposal } from './quick-view.models';
import { QuickViewSchedulerService } from './quick-view-scheduler.service';
import { QuickViewSelectionService } from './quick-view-selection.service';

type SlotFilterScope = 'checkin' | 'handover';

@Component({
  selector: 'app-quick-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './quick-view.component.html',
  styleUrl: './quick-view.component.scss',
})
export class QuickViewComponent implements OnInit {
  protected workOrder: WorkOrder | null = null;
  protected checkinDays: QuickViewDay[] = [];
  protected handoverDays: QuickViewDay[] = [];
  protected selectedCheckinDayIndex = 0;
  protected selectedHandoverDayIndex = 0;
  protected selectedCheckinKey = '';
  protected selectedHandoverKey = '';
  protected selectedCheckin: QuickViewActivitySlot | null = null;
  protected selectedHandover: QuickViewHandoverSlot | null = null;
  protected workProposal: QuickViewWorkProposal | null = null;
  protected activeCheckinFilters = new Set<QuickViewSlotFilter>(['morning']);
  protected activeHandoverFilters = new Set<QuickViewSlotFilter>(['morning']);
  protected isLoading = true;
  protected isSaving = false;
  private isRestoringSelection = false;
  private resources: Resource[] = [];
  private entries: ScheduleEntry[] = [];
  private visibleWeekStart = this.getWeekStart(new Date('2024-04-15T08:00:00'));

  constructor(
    private route: ActivatedRoute,
    private workOrderRepo: WorkOrderRepository,
    private resourceRepo: ResourceRepository,
    private scheduleRepo: ScheduleRepository,
    private plannerSettings: PlannerSettingsService,
    private quickViewSelection: QuickViewSelectionService,
    private quickViewScheduler: QuickViewSchedulerService,
  ) {}

  ngOnInit(): void {
    const orderId = this.route.snapshot.paramMap.get('orderId');
    const from = new Date('2024-04-01T00:00:00');
    const to = new Date('2024-05-31T23:59:59');

    forkJoin({
      orders: this.workOrderRepo.getAll(),
      resources: this.resourceRepo.getAll(),
      entries: this.scheduleRepo.getEntries(from, to),
    }).subscribe(({ orders, resources, entries }) => {
      this.workOrder = orders.find(order => order.id === orderId || order.referenceNumber === orderId) ?? null;
      this.entries = entries;
      this.resources = this.getQuickViewResources(resources, entries);
      this.visibleWeekStart = this.getWeekStart(new Date(this.workOrder?.appointmentStart ?? '2024-04-15T08:00:00'));
      this.refreshDays();
      this.restoreExistingSelection();
      this.isLoading = false;
    });
  }

  private getQuickViewResources(resources: Resource[], entries: ScheduleEntry[]): Resource[] {
    if (!this.workOrder || !this.hasExistingPlannerBookings(entries)) return resources;
    const context = this.plannerSettings.resourceContext();
    if (!context) return resources;

    const viewResourceIds = context.resourceView?.resourceIds?.length
      ? new Set(context.resourceView.resourceIds)
      : null;
    const selectedTypeGroupIds = new Set(context.selectedResourceTypeGroupIds);
    const explicitlySelectedResourceIds = new Set(context.selectedResourceIds);
    const filtered = resources.filter(resource => {
      if (viewResourceIds && !viewResourceIds.has(resource.id)) return false;
      if (explicitlySelectedResourceIds.has(resource.id)) return true;
      if (
        context.viewPersonalCalendarOnTop &&
        resource.id === context.personalCalendarResourceId &&
        !!context.personalCalendarGroupId &&
        selectedTypeGroupIds.has(context.personalCalendarGroupId)
      ) {
        return true;
      }
      return !!resource.groupId && selectedTypeGroupIds.has(resource.groupId);
    });

    return filtered.length ? filtered : resources;
  }

  private hasExistingPlannerBookings(entries: ScheduleEntry[]): boolean {
    return !!this.workOrder && entries.some(entry =>
      entry.workOrderReference === this.workOrder?.referenceNumber ||
      entry.workOrderReference === this.workOrder?.id ||
      this.workOrder?.jobs.some(job => job.id === entry.jobId)
    );
  }

  protected getTotalDurationLabel(): string {
    const minutes = this.workOrder?.jobs.reduce((total, job) => total + job.estimatedDurationMinutes, 0) ?? 0;
    const hours = minutes / 60;
    const formatted = hours % 1 === 0 ? String(hours) : hours.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    return `${formatted} hrs`;
  }

  protected getMonthYearLabel(): string {
    const date = this.checkinDays[0]?.date ?? new Date('2024-04-15T08:00:00');
    return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(date);
  }

  protected selectCheckinDay(index: number): void {
    this.selectedCheckinDayIndex = index;
  }

  protected selectHandoverDay(index: number): void {
    this.selectedHandoverDayIndex = index;
  }

  protected previousMonth(): void {
    const nextDate = new Date(this.visibleWeekStart);
    nextDate.setMonth(nextDate.getMonth() - 1);
    this.visibleWeekStart = this.getWeekStart(nextDate);
    this.refreshDays();
  }

  protected nextMonth(): void {
    const nextDate = new Date(this.visibleWeekStart);
    nextDate.setMonth(nextDate.getMonth() + 1);
    this.visibleWeekStart = this.getWeekStart(nextDate);
    this.refreshDays();
  }

  protected previousWeek(): void {
    const nextDate = new Date(this.visibleWeekStart);
    nextDate.setDate(nextDate.getDate() - 7);
    this.visibleWeekStart = nextDate;
    this.refreshDays();
  }

  protected nextWeek(): void {
    const nextDate = new Date(this.visibleWeekStart);
    nextDate.setDate(nextDate.getDate() + 7);
    this.visibleWeekStart = nextDate;
    this.refreshDays();
  }

  protected toggleFilter(scope: SlotFilterScope, filter: QuickViewSlotFilter): void {
    const filters = this.getActiveFilters(scope);
    if (filters.has(filter)) {
      filters.delete(filter);
    } else {
      filters.add(filter);
    }
    this.setActiveFilters(scope, filters.size ? filters : new Set([filter]));
    this.persistFilterSelection();
  }

  protected isFilterActive(scope: SlotFilterScope, filter: QuickViewSlotFilter): boolean {
    return this.getActiveFilters(scope).has(filter);
  }

  protected getFilteredSlots(day: QuickViewDay, scope: SlotFilterScope): QuickViewActivitySlot[] {
    const filters = this.getActiveFilters(scope);
    return day.slots.filter(slot => Array.from(filters).some(filter => this.quickViewScheduler.slotMatchesFilter(slot, filter)));
  }

  protected selectCheckin(slot: QuickViewActivitySlot, dayIndex: number): void {
    if (!this.workOrder) return;
    const proposal = this.quickViewScheduler.buildWorkProposal(this.workOrder, this.resources, this.entries, slot);
    this.selectedCheckin = slot;
    this.selectedCheckinKey = slot.key;
    this.selectedCheckinDayIndex = dayIndex;
    this.workProposal = proposal;
    this.handoverDays = proposal
      ? this.quickViewScheduler.buildHandoverDays(this.workOrder, this.resources, this.entries, proposal, this.visibleWeekStart)
      : [];
    this.selectInitialHandoverSlot();
    if (!this.isRestoringSelection) {
      this.quickViewSelection.setDraftCheckin({
        orderId: this.workOrder.id,
        checkinStart: slot.start,
        checkinFilters: [...this.activeCheckinFilters],
        handoverFilters: [...this.activeHandoverFilters],
      });
    }
  }

  protected selectHandover(slot: QuickViewActivitySlot, dayIndex: number): void {
    if (!this.workOrder || !this.workProposal || this.isSaving) return;
    const selectedOrder = this.workOrder;
    const selectedProposal = this.workProposal;
    const handover = slot as QuickViewHandoverSlot;
    this.selectedHandover = handover;
    this.selectedHandoverKey = handover.key;
    this.selectedHandoverDayIndex = dayIndex;
    this.isSaving = true;
    this.quickViewScheduler.persistSelection(selectedOrder, selectedProposal, handover, this.entries).subscribe(({ workOrder, entries }) => {
      if (workOrder) this.workOrder = workOrder;
      this.entries = [
        ...this.entries.filter(entry => entry.workOrderReference !== selectedOrder.referenceNumber),
        ...entries,
      ];
      this.quickViewSelection.setSelection({
        orderId: selectedOrder.id,
        checkinStart: selectedProposal.checkin.start,
        handoverStart: handover.start,
        handoverEnd: handover.end,
        checkinFilters: [...this.activeCheckinFilters],
        handoverFilters: [this.getSlotFilter(handover)],
        hasDraftCheckin: false,
      });
      this.isSaving = false;
    });
  }

  protected formatSlot(slot: QuickViewActivitySlot): string {
    return this.quickViewScheduler.formatSlot(slot);
  }

  protected getWorkCompleteLabel(): string {
    return this.workProposal ? this.quickViewScheduler.formatDateTime(this.workProposal.workCompleteAt) : '';
  }

  protected getSelectedChoiceLabel(): string {
    if (!this.selectedCheckin && !this.selectedHandover) return 'No appointment selected';
    const parts = [];
    if (this.selectedCheckin) parts.push(`Check-In: ${this.quickViewScheduler.formatDateTime(this.selectedCheckin.start)}`);
    if (this.selectedHandover) parts.push(`Handover: ${this.quickViewScheduler.formatDateTime(this.selectedHandover.start)}`);
    return parts.join(' · ');
  }

  private refreshDays(): void {
    this.checkinDays = this.workOrder
      ? this.quickViewScheduler.buildCheckinDays(this.workOrder, this.resources, this.entries, this.visibleWeekStart)
      : [];
    this.selectedCheckinDayIndex = Math.min(this.selectedCheckinDayIndex, Math.max(0, this.checkinDays.length - 1));
    this.selectedHandoverDayIndex = Math.min(this.selectedHandoverDayIndex, Math.max(0, this.handoverDays.length - 1));
    if (this.workOrder && this.workProposal) {
      this.handoverDays = this.quickViewScheduler.buildHandoverDays(this.workOrder, this.resources, this.entries, this.workProposal, this.visibleWeekStart);
    }
  }

  private restoreExistingSelection(): void {
    if (!this.workOrder) return;
    const existing = this.quickViewScheduler.extractExistingSchedule(this.workOrder, this.entries);
    const selection = this.quickViewSelection.getSelection(this.workOrder.id);
    this.applyPersistedFilters(selection?.checkinFilters, selection?.handoverFilters);
    const selectedStart = existing.checkin?.start ?? selection?.checkinStart ?? this.workOrder.appointmentStart;
    if (!selectedStart) return;

    const checkinSlot = this.checkinDays.flatMap(day => day.slots).find(slot => slot.start.getTime() === new Date(selectedStart).getTime())
      ?? existing.checkin;
    if (!checkinSlot) return;

    this.isRestoringSelection = true;
    this.selectCheckin(checkinSlot, Math.max(0, this.checkinDays.findIndex(day => this.isSameDate(day.date, checkinSlot.start))));
    this.isRestoringSelection = false;

    const selectedHandoverEnd = existing.handover?.end ?? selection?.handoverEnd ?? this.workOrder.appointmentEnd;
    if (!selectedHandoverEnd) return;
    const handoverSlot = this.handoverDays.flatMap(day => day.slots).find(slot => slot.end.getTime() === new Date(selectedHandoverEnd).getTime())
      ?? existing.handover;
    if (handoverSlot) {
      this.selectedHandover = handoverSlot as QuickViewHandoverSlot;
      this.selectedHandoverKey = handoverSlot.key;
      const dayIndex = this.handoverDays.findIndex(day => this.isSameDate(day.date, handoverSlot.start));
      if (dayIndex >= 0) this.selectedHandoverDayIndex = dayIndex;
      this.activeHandoverFilters = new Set([this.getSlotFilter(handoverSlot)]);
    }
  }

  private selectInitialHandoverSlot(): void {
    const firstSlot = this.handoverDays.flatMap(day => day.slots)[0] as QuickViewHandoverSlot | undefined;
    if (!firstSlot) {
      this.selectedHandover = null;
      this.selectedHandoverKey = '';
      this.selectedHandoverDayIndex = 0;
      return;
    }

    this.selectedHandover = firstSlot;
    this.selectedHandoverKey = firstSlot.key;
    const dayIndex = this.handoverDays.findIndex(day => this.isSameDate(day.date, firstSlot.start));
    this.selectedHandoverDayIndex = Math.max(0, dayIndex);
    this.activeHandoverFilters = new Set([this.getSlotFilter(firstSlot)]);
  }

  private getActiveFilters(scope: SlotFilterScope): Set<QuickViewSlotFilter> {
    return scope === 'checkin' ? this.activeCheckinFilters : this.activeHandoverFilters;
  }

  private setActiveFilters(scope: SlotFilterScope, filters: Set<QuickViewSlotFilter>): void {
    if (scope === 'checkin') {
      this.activeCheckinFilters = new Set(filters);
    } else {
      this.activeHandoverFilters = new Set(filters);
    }
  }

  private persistFilterSelection(): void {
    if (!this.workOrder) return;
    this.quickViewSelection.setFilters(this.workOrder.id, {
      checkinFilters: [...this.activeCheckinFilters],
      handoverFilters: [...this.activeHandoverFilters],
    });
  }

  private applyPersistedFilters(checkinFilters?: QuickViewSlotFilter[], handoverFilters?: QuickViewSlotFilter[]): void {
    if (checkinFilters?.length) this.activeCheckinFilters = new Set(checkinFilters);
    if (handoverFilters?.length) this.activeHandoverFilters = new Set(handoverFilters);
  }

  private getSlotFilter(slot: QuickViewActivitySlot | Date): QuickViewSlotFilter {
    const date = slot instanceof Date ? slot : slot.start;
    const hour = date.getHours();
    if (hour >= 12 && hour < 16) return 'afternoon';
    if (hour >= 16) return 'evening';
    return 'morning';
  }

  private getWeekStart(date: Date): Date {
    const start = new Date(date);
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diff);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  private isSameDate(first: Date, second: Date): boolean {
    return first.getFullYear() === second.getFullYear()
      && first.getMonth() === second.getMonth()
      && first.getDate() === second.getDate();
  }
}
