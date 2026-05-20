import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MOCK_UNAVAILABILITY } from '../../core/services/mock/mock-data';
import { Resource } from '../../core/models/resource.model';
import { ScheduleEntry } from '../../core/models/schedule.model';
import { WorkOrder } from '../../core/models/work-order.model';
import { ResourceRepository } from '../../core/services/resource.repository';
import { ScheduleRepository } from '../../core/services/schedule.repository';
import { WorkOrderRepository } from '../../core/services/work-order.repository';
import { AutoSchedulerService } from '../service-planner/services/auto-scheduler.service';
import { QuickViewSelectionService } from './quick-view-selection.service';
import { AppointmentSyncService } from '../../core/services/appointment-sync.service';

interface QuickViewSlot {
  start: Date;
  end: Date;
  handoverEnd: Date;
  handoverStart: Date;
  checkinResourceId: string;
  handoverResourceId: string;
  mobilityResourceId: string;
  entries: ScheduleEntry[];
  label: string;
  title: string;
  key: string;
}

interface QuickViewDay {
  date: Date;
  dateLabel: string;
  dayLabel: string;
  slots: QuickViewSlot[];
}

@Component({
  selector: 'app-quick-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './quick-view.component.html',
  styleUrl: './quick-view.component.scss',
})
export class QuickViewComponent implements OnInit {
  protected workOrder: WorkOrder | null = null;
  protected days: QuickViewDay[] = [];
  protected selectedDayIndex = 0;
  protected selectedSlotKey = '';
  protected isLoading = true;
  private resources: Resource[] = [];
  private entries: ScheduleEntry[] = [];
  private visibleWeekStart = this.getWeekStart(new Date('2024-04-15T08:00:00'));

  constructor(
    private route: ActivatedRoute,
    private workOrderRepo: WorkOrderRepository,
    private resourceRepo: ResourceRepository,
    private scheduleRepo: ScheduleRepository,
    private autoScheduler: AutoSchedulerService,
    private quickViewSelection: QuickViewSelectionService,
    private appointmentSync: AppointmentSyncService,
  ) {}

  ngOnInit(): void {
    const orderId = this.route.snapshot.paramMap.get('orderId');
    const from = new Date('2024-04-15T08:00:00');
    const to = new Date('2024-04-22T18:00:00');

    forkJoin({
      orders: this.workOrderRepo.getAll(),
      resources: this.resourceRepo.getAll(),
      entries: this.scheduleRepo.getEntries(from, to),
    }).subscribe(({ orders, resources, entries }) => {
      this.workOrder = orders.find(order => order.id === orderId || order.referenceNumber === orderId) ?? null;
      this.resources = resources;
      this.entries = entries;
      this.visibleWeekStart = this.getWeekStart(new Date(this.workOrder?.appointmentStart ?? '2024-04-15T08:00:00'));
      this.refreshDays();
      this.isLoading = false;
    });
  }

  protected getTotalDurationLabel(): string {
    const minutes = this.workOrder?.jobs.reduce((total, job) => total + job.estimatedDurationMinutes, 0) ?? 0;
    const hours = minutes / 60;
    const formatted = hours % 1 === 0 ? String(hours) : hours.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    return `${formatted} hrs`;
  }

  protected getMonthYearLabel(): string {
    const date = this.days[0]?.date ?? new Date('2024-04-15T08:00:00');
    return new Intl.DateTimeFormat('en-GB', {
      month: 'long',
      year: 'numeric',
    }).format(date);
  }

  protected selectDay(index: number): void {
    this.selectedDayIndex = index;
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

  protected selectSlot(slot: QuickViewSlot): void {
    if (!this.workOrder) return;
    this.selectedSlotKey = slot.key;
    this.quickViewSelection.setSelection({
      orderId: this.workOrder.id,
      checkinStart: slot.start,
      handoverEnd: slot.handoverEnd,
    });
    this.persistSelection(slot);
  }

  private refreshDays(): void {
    this.days = this.workOrder
      ? this.buildDays(this.workOrder, this.resources, this.entries, this.visibleWeekStart)
      : [];
    this.selectedDayIndex = Math.min(this.selectedDayIndex, Math.max(0, this.days.length - 1));
    this.restoreSelectedSlot();
  }

  private buildDays(workOrder: WorkOrder, resources: Resource[], entries: ScheduleEntry[], weekStart: Date): QuickViewDay[] {

    return Array.from({ length: 7 }, (_, dayIndex) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + dayIndex);

      return {
        date,
        dateLabel: new Intl.DateTimeFormat('en-GB', { day: '2-digit' }).format(date),
        dayLabel: new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(date),
        slots: this.buildSlotsForDay(workOrder, resources, entries, date),
      };
    });
  }

  private buildSlotsForDay(
    workOrder: WorkOrder,
    resources: Resource[],
    entries: ScheduleEntry[],
    date: Date,
  ): QuickViewSlot[] {
    const slots = new Map<string, QuickViewSlot>();
    const dayStartHour = 8;
    const dayEndHour = 18;
    const cursor = new Date(date);
    cursor.setHours(dayStartHour, 0, 0, 0);

    while (cursor.getHours() < dayEndHour) {
      const result = this.autoScheduler.schedule({
        jobs: workOrder.jobs,
        resources,
        existingEntries: this.getSchedulingEntriesForOrder(workOrder, entries),
        unavailability: MOCK_UNAVAILABILITY,
        searchFrom: new Date(cursor),
        dayStartHour,
        dayEndHour,
      });

      if (result && this.isSameDate(result.checkinStart, date)) {
        const key = result.checkinStart.toISOString();
        slots.set(key, {
          start: result.checkinStart,
          end: result.checkinEnd,
          handoverEnd: result.handoverEnd,
          handoverStart: result.handoverStart,
          checkinResourceId: result.checkinResourceId,
          handoverResourceId: result.handoverResourceId,
          mobilityResourceId: result.mobilityResourceId,
          entries: result.entries,
          label: `Check-in: ${this.formatDateTime(result.checkinStart)}\nHandover: ${this.formatDateTime(result.handoverEnd)}`,
          title: `Check-in: ${this.formatDateTime(result.checkinStart)} | Handover: ${this.formatDateTime(result.handoverEnd)}`,
          key,
        });
      }

      cursor.setMinutes(cursor.getMinutes() + 60);
    }

    return Array.from(slots.values()).sort((a, b) => a.start.getTime() - b.start.getTime());
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

  private formatTime(date: Date): string {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date).replace(':', '.');
  }

  protected getSlotLines(slot: QuickViewSlot): string[] {
    return [`Check-in: ${this.formatDateTime(slot.start)}`, `Handover: ${this.formatDateTime(slot.handoverEnd)}`];
  }

  private formatDateTime(date: Date): string {
    const day = new Intl.DateTimeFormat('en-GB', { day: '2-digit' }).format(date);
    const month = new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(date).replace(/ /g, '');
    const year = new Intl.DateTimeFormat('en-GB', { year: '2-digit' }).format(date);
    const time = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date).replace(' ', '').toLowerCase();
    return `${day}.${month}.${year} ${time}`;
  }

  private getSchedulingEntriesForOrder(workOrder: WorkOrder, entries: ScheduleEntry[]): ScheduleEntry[] {
    return entries.filter(entry => entry.workOrderReference !== workOrder.referenceNumber);
  }

  private persistSelection(slot: QuickViewSlot): void {
    if (!this.workOrder) return;
    this.appointmentSync.updateAppointment(this.workOrder.id, slot.start, slot.handoverEnd).subscribe(savedOrder => {
      if (savedOrder) this.workOrder = savedOrder;
    });

    const existingEntryIds = this.entries
      .filter(entry => entry.workOrderReference === this.workOrder?.referenceNumber)
      .map(entry => entry.id);
    existingEntryIds.forEach(entryId => this.scheduleRepo.unassign(entryId).subscribe());

    const entries = this.buildScheduleEntriesForSlot(slot);
    this.entries = [
      ...this.entries.filter(entry => entry.workOrderReference !== this.workOrder?.referenceNumber),
      ...entries,
    ];
    entries.forEach(entry => this.scheduleRepo.assign(entry).subscribe());
  }

  private buildScheduleEntriesForSlot(slot: QuickViewSlot): ScheduleEntry[] {
    if (!this.workOrder) return [];
    const orderReference = this.workOrder.referenceNumber;
    return [
      this.createActivityEntry('act-checkin', 'Check-In', slot.checkinResourceId, slot.start, slot.end, orderReference),
      ...slot.entries.map(entry => ({
        ...entry,
        id: `quick-${entry.jobId}-${entry.resourceId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        title: this.workOrder?.jobs.find(job => job.id === entry.jobId)?.title ?? entry.jobId,
        kind: 'scheduled' as const,
        workOrderReference: orderReference,
        workorderItemStatus: 'scheduled' as const,
        workorderItemCategory: 'job' as const,
      })),
      this.createActivityEntry('act-handover', 'Handover', slot.handoverResourceId, slot.handoverStart, slot.handoverEnd, orderReference),
      this.createActivityEntry('act-mobility', 'Mobility Service', slot.mobilityResourceId, slot.end, slot.handoverEnd, orderReference),
    ];
  }

  private createActivityEntry(
    activityTemplateId: string,
    title: string,
    resourceId: string,
    start: Date,
    end: Date,
    workOrderReference: string,
  ): ScheduleEntry {
    return {
      id: `quick-${activityTemplateId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      jobId: `${this.workOrder?.id}:${activityTemplateId}`,
      resourceId,
      start: new Date(start),
      end: new Date(end),
      title,
      kind: 'scheduled',
      workOrderReference,
      workorderItemStatus: 'scheduled',
      workorderItemCategory: 'activity',
    };
  }

  private restoreSelectedSlot(): void {
    if (!this.workOrder) {
      this.selectedSlotKey = '';
      this.quickViewSelection.setSelection(null);
      return;
    }

    const selection = this.quickViewSelection.getSelection(this.workOrder.id);
    const selectedStart = selection?.checkinStart ?? this.workOrder.appointmentStart;
    const selectedEnd = selection?.handoverEnd ?? this.workOrder.appointmentEnd;
    if (!selectedStart || !selectedEnd) {
      this.selectedSlotKey = '';
      return;
    }

    const selectedTime = new Date(selectedStart).getTime();
    const selectedDayIndex = this.days.findIndex(day => this.isSameDate(day.date, new Date(selectedStart)));
    const selectedSlot = this.days
      .flatMap(day => day.slots)
      .find(slot => slot.start.getTime() === selectedTime);

    this.selectedSlotKey = selectedSlot?.key ?? new Date(selectedStart).toISOString();
    if (selectedDayIndex >= 0) this.selectedDayIndex = selectedDayIndex;
    if (!selection) {
      this.quickViewSelection.setSelection({
        orderId: this.workOrder.id,
        checkinStart: new Date(selectedStart),
        handoverEnd: new Date(selectedEnd),
      });
    }
  }
}
