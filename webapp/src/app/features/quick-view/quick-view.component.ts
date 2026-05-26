import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MOCK_UNAVAILABILITY } from '../../core/services/mock/mock-data';
import { Resource } from '../../core/models/resource.model';
import { ScheduleEntry } from '../../core/models/schedule.model';
import { WorkOrder } from '../../core/models/work-order.model';
import { ResourceRepository } from '../../core/services/resource.repository';
import { ScheduleRepository } from '../../core/services/schedule.repository';
import { WorkOrderRepository } from '../../core/services/work-order.repository';
import { QuickViewSelectionService } from './quick-view-selection.service';
import { ScheduleProposal, ScheduleProposalService } from './schedule-proposal.service';
import { ScheduleProposalPersistenceService } from './schedule-proposal-persistence.service';

interface QuickViewTimeSlot {
  start: Date;
  end: Date;
  label: string;
  title: string;
  key: string;
  proposal?: ScheduleProposal;
}

interface QuickViewDay {
  date: Date;
  dateLabel: string;
  dayLabel: string;
  slots: QuickViewTimeSlot[];
}

@Component({
  selector: 'app-quick-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './quick-view.component.html',
  styleUrl: './quick-view.component.scss',
})
export class QuickViewComponent implements OnInit {
  @ViewChild('handoverSlots') private handoverSlots?: ElementRef<HTMLElement>;

  protected workOrder: WorkOrder | null = null;
  protected checkinDays: QuickViewDay[] = [];
  protected handoverDays: QuickViewDay[] = [];
  protected selectedCheckinDayIndex = 0;
  protected selectedHandoverDayIndex = 0;
  protected selectedCheckinSlotKey = '';
  protected selectedHandoverSlotKey = '';
  protected isLoading = true;
  protected isSaving = false;
  protected saveError = '';
  private resources: Resource[] = [];
  private entries: ScheduleEntry[] = [];
  private proposals: ScheduleProposal[] = [];
  private visibleWeekStart = this.getWeekStart(new Date('2024-04-15T08:00:00'));

  constructor(
    private route: ActivatedRoute,
    private workOrderRepo: WorkOrderRepository,
    private resourceRepo: ResourceRepository,
    private scheduleRepo: ScheduleRepository,
    private quickViewSelection: QuickViewSelectionService,
    private proposalService: ScheduleProposalService,
    private proposalPersistence: ScheduleProposalPersistenceService,
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
      const selection = this.workOrder ? this.quickViewSelection.getSelection(this.workOrder.id) : null;
      if (this.workOrder && selection) {
        this.workOrder = {
          ...this.workOrder,
          appointmentStart: new Date(selection.checkinStart),
          appointmentEnd: new Date(selection.handoverEnd),
        };
      }
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
    const date = this.checkinDays[0]?.date ?? new Date('2024-04-15T08:00:00');
    return new Intl.DateTimeFormat('en-GB', {
      month: 'long',
      year: 'numeric',
    }).format(date);
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

  protected selectCheckinSlot(dayIndex: number, slot: QuickViewTimeSlot): void {
    this.selectedCheckinDayIndex = dayIndex;
    this.selectedCheckinSlotKey = slot.key;
    this.selectedHandoverSlotKey = '';
    this.saveError = '';
    this.refreshHandoverDays();
    this.scrollToHandoverSection();
  }

  protected selectHandoverSlot(dayIndex: number, slot: QuickViewTimeSlot): void {
    this.selectedHandoverDayIndex = dayIndex;
    this.selectedHandoverSlotKey = slot.key;
    if (slot.proposal) this.persistProposal(slot.proposal);
  }

  private refreshDays(): void {
    this.proposals = this.workOrder
      ? this.buildProposals(this.workOrder, this.resources, this.entries, this.visibleWeekStart)
      : [];
    this.checkinDays = this.workOrder
      ? this.buildDays(this.visibleWeekStart, this.proposals, 'checkin')
      : [];
    this.selectedCheckinDayIndex = Math.min(this.selectedCheckinDayIndex, Math.max(0, this.checkinDays.length - 1));
    this.restoreSelectedSlot();
  }

  private refreshHandoverDays(weekStart?: Date): void {
    const selectedCheckinSlot = this.getSelectedCheckinSlot();
    const handoverStart = weekStart ?? (selectedCheckinSlot ? this.getDayStart(selectedCheckinSlot.start) : this.visibleWeekStart);
    this.handoverDays = this.buildDays(handoverStart, this.buildHandoverProposalsForSelectedCheckin(handoverStart), 'handover');
    this.selectedHandoverDayIndex = Math.min(this.selectedHandoverDayIndex, Math.max(0, this.handoverDays.length - 1));
  }

  private buildDays(weekStart: Date, proposals: ScheduleProposal[], slotType: 'checkin' | 'handover'): QuickViewDay[] {
    return Array.from({ length: 7 }, (_, dayIndex) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + dayIndex);

      return {
        date,
        dateLabel: new Intl.DateTimeFormat('en-GB', { day: '2-digit' }).format(date),
        dayLabel: new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(date),
        slots: this.buildSlotsForDay(proposals, date, slotType),
      };
    });
  }

  private buildProposals(workOrder: WorkOrder, resources: Resource[], entries: ScheduleEntry[], weekStart: Date): ScheduleProposal[] {
    const proposals = new Map<string, ScheduleProposal>();

    Array.from({ length: 7 }, (_, dayIndex) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + dayIndex);
      this.buildProposalsForDay(workOrder, resources, entries, date).forEach(proposal => {
        const key = `${proposal.checkinStart.toISOString()}|${proposal.handoverEnd.toISOString()}`;
        proposals.set(key, proposal);
      });
    });

    return Array.from(proposals.values()).sort((a, b) => a.checkinStart.getTime() - b.checkinStart.getTime());
  }

  private buildProposalsForDay(
    workOrder: WorkOrder,
    resources: Resource[],
    entries: ScheduleEntry[],
    date: Date,
  ): ScheduleProposal[] {
    if (this.isSunday(date)) return [];

    const proposals: ScheduleProposal[] = [];
    const dayStartHour = 8;
    const dayEndHour = 18;
    const cursor = new Date(date);
    cursor.setHours(dayStartHour, 0, 0, 0);

    while (cursor.getHours() < dayEndHour) {
      const proposal = this.proposalService.createProposal({
        order: workOrder,
        resources,
        existingEntries: this.getSchedulingEntriesForOrder(workOrder, entries),
        unavailability: MOCK_UNAVAILABILITY,
        searchFrom: new Date(cursor),
        dayStartHour,
        dayEndHour,
        source: 'quick-view',
      });

      if (proposal && this.isSameDate(proposal.checkinStart, date)) proposals.push(proposal);

      cursor.setMinutes(cursor.getMinutes() + 30);
    }

    return proposals;
  }

  private buildSlotsForDay(proposals: ScheduleProposal[], date: Date, slotType: 'checkin' | 'handover'): QuickViewTimeSlot[] {
    if (this.isSunday(date)) return [];

    const slots = new Map<string, QuickViewTimeSlot>();

    proposals.forEach(proposal => {
      const start = slotType === 'checkin' ? proposal.checkinStart : proposal.handoverStart;
      const end = slotType === 'checkin' ? proposal.checkinEnd : proposal.handoverEnd;
      if (!this.isSameDate(start, date)) return;
      const key = start.toISOString();
      if (slots.has(key)) return;
      slots.set(key, {
        start,
        end,
        label: this.formatSlotRange(start, end),
        title: `${slotType === 'checkin' ? 'Check-In' : 'Handover'}: ${this.formatDateTime(start)} - ${this.formatDateTime(end)}`,
        key,
        proposal,
      });
    });

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

  private formatSlotRange(start: Date, end: Date): string {
    return `${this.formatTime(start)} - ${this.formatTime(end)}`;
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

  private restoreSelectedSlot(): void {
    if (!this.workOrder) {
      this.selectedCheckinSlotKey = '';
      this.selectedHandoverSlotKey = '';
      this.quickViewSelection.setSelection(null);
      return;
    }

    const selection = this.quickViewSelection.getSelection(this.workOrder.id);
    const selectedStart = selection?.checkinStart ?? this.workOrder.appointmentStart;
    const selectedHandoverStart = selection?.handoverStart ?? this.workOrder.appointmentEnd;
    const selectedHandoverEnd = selection?.handoverEnd ?? (selectedHandoverStart ? new Date(new Date(selectedHandoverStart).getTime() + 30 * 60000) : undefined);
    if (!selectedStart || !selectedHandoverStart || !selectedHandoverEnd) {
      this.selectedCheckinSlotKey = '';
      this.selectedHandoverSlotKey = '';
      this.handoverDays = this.buildDays(this.visibleWeekStart, [], 'handover');
      return;
    }

    const selectedTime = new Date(selectedStart).getTime();
    const selectedSlot = this.checkinDays
      .flatMap(day => day.slots)
      .find(slot => slot.start.getTime() === selectedTime);

    const restoredCheckinSlot = selectedSlot ?? this.addRestoredCheckinSlot(new Date(selectedStart));
    this.selectedCheckinSlotKey = selectedSlot?.key ?? restoredCheckinSlot?.key ?? '';
    const resolvedCheckinDayIndex = this.checkinDays.findIndex(day => this.isSameDate(day.date, new Date(selectedStart)));
    if (resolvedCheckinDayIndex >= 0) this.selectedCheckinDayIndex = resolvedCheckinDayIndex;
    this.refreshHandoverDays(this.getWeekStart(new Date(selectedHandoverStart)));
    const selectedHandoverTime = new Date(selectedHandoverStart).getTime();
    const selectedHandoverSlot = this.handoverDays
      .flatMap(day => day.slots)
      .find(slot => slot.start.getTime() === selectedHandoverTime);
    const restoredHandoverSlot = selectedHandoverSlot
      ?? this.addRestoredHandoverSlot(new Date(selectedHandoverStart), new Date(selectedHandoverEnd));
    this.selectedHandoverSlotKey = selectedHandoverSlot?.key ?? restoredHandoverSlot?.key ?? '';
    const selectedHandoverDayIndex = this.handoverDays.findIndex(day => this.isSameDate(day.date, new Date(selectedHandoverStart)));
    if (selectedHandoverDayIndex >= 0) this.selectedHandoverDayIndex = selectedHandoverDayIndex;
    if (!selection) {
      this.quickViewSelection.setSelection({
        orderId: this.workOrder.id,
        checkinStart: new Date(selectedStart),
        handoverStart: new Date(selectedHandoverStart),
        handoverEnd: new Date(selectedHandoverEnd),
      });
    }
  }

  private getSelectedCheckinSlot(): QuickViewTimeSlot | null {
    if (!this.selectedCheckinSlotKey) return null;
    return this.checkinDays
      .flatMap(day => day.slots)
      .find(slot => slot.key === this.selectedCheckinSlotKey) ?? null;
  }

  private buildHandoverProposalsForSelectedCheckin(weekStart?: Date): ScheduleProposal[] {
    if (!this.workOrder) return [];
    const selectedSlot = this.getSelectedCheckinSlot();
    if (!selectedSlot) return [];
    const selectedProposal = selectedSlot.proposal;
    if (!selectedProposal) return [];

    const proposals = new Map<string, ScheduleProposal>();
    const selectedDayStart = weekStart ? this.getDayStart(weekStart) : this.getDayStart(selectedSlot.start);

    for (let dayOffset = 0; dayOffset < 7 && proposals.size < 5; dayOffset += 1) {
      const handoverSearchFrom = new Date(selectedDayStart);
      handoverSearchFrom.setDate(selectedDayStart.getDate() + dayOffset);
      const firstHandoverSearch = selectedSlot.proposal?.handoverStart ?? selectedSlot.end;
      const isCheckinDay = this.isSameDate(handoverSearchFrom, selectedSlot.start);
      handoverSearchFrom.setHours(isCheckinDay ? firstHandoverSearch.getHours() : 8, isCheckinDay ? firstHandoverSearch.getMinutes() : 0, 0, 0);

      const proposal = this.proposalService.createProposal({
        order: this.workOrder,
        resources: this.resources,
        existingEntries: this.getSchedulingEntriesForOrder(this.workOrder, this.entries),
        unavailability: MOCK_UNAVAILABILITY,
        searchFrom: selectedSlot.start,
        fixedCheckin: {
          start: selectedProposal.checkinStart,
          end: selectedProposal.checkinEnd,
          resourceId: selectedProposal.checkinResourceId,
        },
        handoverSearchFrom,
        dayStartHour: 8,
        dayEndHour: 18,
        source: 'quick-view',
      });

      if (!proposal) continue;
      const key = `${proposal.handoverStart.toISOString()}|${proposal.handoverEnd.toISOString()}`;
      proposals.set(key, proposal);
    }

    return Array.from(proposals.values()).sort((a, b) => a.handoverStart.getTime() - b.handoverStart.getTime());
  }

  private addRestoredCheckinSlot(checkinStart: Date): QuickViewTimeSlot | null {
    if (this.isSunday(checkinStart)) return null;
    const day = this.checkinDays.find(candidate => this.isSameDate(candidate.date, checkinStart));
    if (!day) return null;
    const existing = day.slots.find(slot => slot.start.getTime() === checkinStart.getTime());
    if (existing) return existing;

    const checkinEnd = new Date(checkinStart.getTime() + 30 * 60000);
    const slot: QuickViewTimeSlot = {
      start: checkinStart,
      end: checkinEnd,
      label: this.formatSlotRange(checkinStart, checkinEnd),
      title: `Saved Check-In: ${this.formatDateTime(checkinStart)} - ${this.formatDateTime(checkinEnd)}`,
      key: checkinStart.toISOString(),
    };
    const updatedSlots = [...day.slots, slot].sort((first, second) => first.start.getTime() - second.start.getTime());
    this.checkinDays = this.checkinDays.map(candidate =>
      this.isSameDate(candidate.date, day.date)
        ? { ...candidate, slots: updatedSlots }
        : candidate
    );
    return slot;
  }

  private addRestoredHandoverSlot(handoverStart: Date, handoverEnd: Date): QuickViewTimeSlot | null {
    if (this.isSunday(handoverStart)) return null;
    const day = this.handoverDays.find(candidate => this.isSameDate(candidate.date, handoverStart));
    if (!day) return null;
    const existing = day.slots.find(slot => slot.start.getTime() === handoverStart.getTime());
    if (existing) return existing;

    const slot: QuickViewTimeSlot = {
      start: handoverStart,
      end: handoverEnd,
      label: this.formatSlotRange(handoverStart, handoverEnd),
      title: `Saved Handover: ${this.formatDateTime(handoverStart)} - ${this.formatDateTime(handoverEnd)}`,
      key: handoverStart.toISOString(),
    };
    const updatedSlots = [...day.slots, slot].sort((first, second) => first.start.getTime() - second.start.getTime());
    this.handoverDays = this.handoverDays.map(candidate =>
      this.isSameDate(candidate.date, day.date)
        ? { ...candidate, slots: updatedSlots }
        : candidate
    );
    return slot;
  }

  private getDayStart(date: Date): Date {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  private isSunday(date: Date): boolean {
    return date.getDay() === 0;
  }

  private persistProposal(proposal: ScheduleProposal): void {
    if (!this.workOrder || this.isSaving) return;
    this.isSaving = true;
    this.saveError = '';
    this.proposalPersistence.saveProposal(proposal, this.entries).subscribe({
      next: ({ savedOrder, assignedEntries }) => {
        if (savedOrder) this.workOrder = savedOrder;
        this.entries = [
          ...this.entries.filter(entry => entry.workOrderReference !== proposal.orderReference),
          ...assignedEntries,
        ];
        this.isSaving = false;
      },
      error: () => {
        this.saveError = 'Unable to save the selected appointment timeslot.';
        this.isSaving = false;
      },
    });
  }

  private scrollToHandoverSection(): void {
    window.setTimeout(() => {
      this.handoverSlots?.nativeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }
}
