import { Injectable } from '@angular/core';
import { forkJoin, map, Observable, of, switchMap } from 'rxjs';
import { ScheduleEntry } from '../../core/models/schedule.model';
import { Resource } from '../../core/models/resource.model';
import { WorkOrder } from '../../core/models/work-order.model';
import { MOCK_UNAVAILABILITY } from '../../core/services/mock/mock-data';
import { AppointmentSyncService } from '../../core/services/appointment-sync.service';
import { ScheduleRepository } from '../../core/services/schedule.repository';
import { AutoActivitySlot, AutoHandoverOption, AutoSchedulerService } from '../service-planner/services/auto-scheduler.service';
import {
  QuickViewActivitySlot,
  QuickViewDay,
  QuickViewExistingSchedule,
  QuickViewHandoverSlot,
  QuickViewWorkProposal,
} from './quick-view.models';

const DAY_START_HOUR = 8;
const DAY_END_HOUR = 18;
const SLOT_MINUTES = 30;
const CHECKIN_ACTIVITY_ID = 'act-checkin';
const HANDOVER_ACTIVITY_ID = 'act-handover';
const MOBILITY_ACTIVITY_ID = 'act-mobility';

@Injectable({ providedIn: 'root' })
export class QuickViewSchedulerService {
  constructor(
    private autoScheduler: AutoSchedulerService,
    private appointmentSync: AppointmentSyncService,
    private scheduleRepo: ScheduleRepository,
  ) {}

  buildCheckinDays(workOrder: WorkOrder, resources: Resource[], entries: ScheduleEntry[], weekStart: Date): QuickViewDay[] {
    const requiredResourceIds = this.getExistingBookingResourceIds(workOrder, entries);
    return this.buildDays(weekStart, date => {
      const from = this.dayBoundary(date, DAY_START_HOUR);
      const to = this.dayBoundary(date, DAY_END_HOUR);
      return this.autoScheduler.findCheckinSlots({
        jobs: workOrder.jobs,
        resources,
        requiredResourceIds,
        existingEntries: this.getSchedulingEntriesForOrder(workOrder, entries),
        unavailability: MOCK_UNAVAILABILITY,
        from,
        to,
        dayStartHour: DAY_START_HOUR,
        dayEndHour: DAY_END_HOUR,
        slotMinutes: SLOT_MINUTES,
      }).map(slot => this.toActivitySlot('checkin', slot));
    });
  }

  buildWorkProposal(workOrder: WorkOrder, resources: Resource[], entries: ScheduleEntry[], checkin: QuickViewActivitySlot): QuickViewWorkProposal | null {
    const schedulableJobs = this.getSchedulableJobs(workOrder);
    const requiredResourceIds = this.getExistingBookingResourceIds(workOrder, entries);
    const proposal = this.autoScheduler.buildWorkProposalFromCheckin({
      jobs: schedulableJobs,
      resources,
      requiredResourceIds,
      existingEntries: this.getSchedulingEntriesForOrder(workOrder, entries),
      unavailability: MOCK_UNAVAILABILITY,
      checkin,
      dayStartHour: DAY_START_HOUR,
      dayEndHour: DAY_END_HOUR,
    });

    if (!proposal) return null;
    return {
      checkin,
      jobEntries: proposal.entries,
      workCompleteAt: proposal.workCompleteAt,
    };
  }

  buildHandoverDays(workOrder: WorkOrder, resources: Resource[], entries: ScheduleEntry[], proposal: QuickViewWorkProposal, weekStart: Date): QuickViewDay[] {
    const requiredResourceIds = this.getExistingBookingResourceIds(workOrder, entries);
    const draftEntries = [
      this.createActivityEntry(workOrder, CHECKIN_ACTIVITY_ID, 'Check-In', proposal.checkin.resourceId, proposal.checkin.start, proposal.checkin.end),
      ...proposal.jobEntries,
    ];

    return this.buildDays(weekStart, date => {
      const from = new Date(Math.max(this.dayBoundary(date, DAY_START_HOUR).getTime(), proposal.workCompleteAt.getTime()));
      const to = this.dayBoundary(date, DAY_END_HOUR);
      if (from > to) return [];
      return this.autoScheduler.findHandoverOptions({
        resources,
        requiredResourceIds,
        existingEntries: this.getSchedulingEntriesForOrder(workOrder, entries),
        draftEntries,
        unavailability: MOCK_UNAVAILABILITY,
        mobilityStart: proposal.checkin.end,
        from,
        to,
        dayStartHour: DAY_START_HOUR,
        dayEndHour: DAY_END_HOUR,
        slotMinutes: SLOT_MINUTES,
        requiresMobility: this.requiresMobility(workOrder),
      }).map(option => this.toHandoverSlot(option));
    });
  }

  extractExistingSchedule(workOrder: WorkOrder, entries: ScheduleEntry[]): QuickViewExistingSchedule {
    const orderEntries = entries.filter(entry => entry.workOrderReference === workOrder.referenceNumber);
    const checkinEntry = orderEntries.find(entry => this.getActivityTemplateId(entry.jobId) === CHECKIN_ACTIVITY_ID);
    const handoverEntry = orderEntries.find(entry => this.getActivityTemplateId(entry.jobId) === HANDOVER_ACTIVITY_ID);
    const mobilityEntry = orderEntries.find(entry => this.getActivityTemplateId(entry.jobId) === MOBILITY_ACTIVITY_ID);

    return {
      checkin: checkinEntry ? this.toActivitySlot('checkin', {
        start: checkinEntry.start,
        end: checkinEntry.end,
        resourceId: checkinEntry.resourceId,
      }) : undefined,
      handover: handoverEntry ? {
        ...this.toActivitySlot('handover', {
          start: handoverEntry.start,
          end: handoverEntry.end,
          resourceId: handoverEntry.resourceId,
        }),
        kind: 'handover',
        mobilityResourceId: mobilityEntry?.resourceId ?? '',
      } : undefined,
      jobEntries: orderEntries.filter(entry => entry.workorderItemCategory === 'job' || !this.getActivityTemplateId(entry.jobId)),
      mobilityEntry,
      entryIds: orderEntries.map(entry => entry.id),
    };
  }

  persistSelection(workOrder: WorkOrder, proposal: QuickViewWorkProposal, handover: QuickViewHandoverSlot, currentEntries: ScheduleEntry[]): Observable<{ workOrder: WorkOrder | null; entries: ScheduleEntry[] }> {
    const existingEntryIds = currentEntries
      .filter(entry => this.isEntryForWorkOrder(entry, workOrder))
      .map(entry => entry.id);
    const nextEntries = this.buildScheduleEntries(workOrder, proposal, handover);
    if (!this.isCompleteBookingSet(workOrder, nextEntries)) {
      return of({ workOrder: null, entries: [] });
    }
    const unassign$ = existingEntryIds.length
      ? forkJoin(existingEntryIds.map(entryId => this.scheduleRepo.unassign(entryId)))
      : of([]);

    return unassign$.pipe(
      switchMap(() => nextEntries.length ? forkJoin(nextEntries.map(entry => this.scheduleRepo.assign(entry))) : of([])),
      switchMap(savedEntries => this.appointmentSync.updateAppointment(workOrder.id, proposal.checkin.start, handover.end).pipe(
        map(savedOrder => ({ workOrder: savedOrder, entries: savedEntries })),
      )),
    );
  }

  slotMatchesFilter(slot: QuickViewActivitySlot, filter: string): boolean {
    if (filter === 'morning') return slot.start.getHours() >= 9 && slot.start.getHours() < 12;
    if (filter === 'afternoon') return slot.start.getHours() >= 12 && slot.start.getHours() < 16;
    if (filter === 'evening') return slot.start.getHours() >= 16 && (slot.start.getHours() < 18 || (slot.start.getHours() === 18 && slot.start.getMinutes() <= 30));
    return true;
  }

  formatSlot(slot: QuickViewActivitySlot): string {
    return `${this.formatTime(slot.start)} - ${this.formatTime(slot.end)}`;
  }

  formatDateTime(date: Date): string {
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

  private buildScheduleEntries(workOrder: WorkOrder, proposal: QuickViewWorkProposal, handover: QuickViewHandoverSlot): ScheduleEntry[] {
    const entries = [
      this.createActivityEntry(workOrder, CHECKIN_ACTIVITY_ID, 'Check-In', proposal.checkin.resourceId, proposal.checkin.start, proposal.checkin.end),
      ...proposal.jobEntries.map(entry => ({
        ...entry,
        id: `quick-${entry.jobId}-${entry.resourceId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        title: workOrder.jobs.find(job => job.id === entry.jobId)?.title ?? entry.jobId,
        kind: 'scheduled' as const,
        workOrderReference: workOrder.referenceNumber,
        workorderItemStatus: 'scheduled' as const,
        workorderItemCategory: 'job' as const,
      })),
    ];

    if (this.requiresMobility(workOrder) && handover.mobilityResourceId) {
      entries.push(this.createActivityEntry(workOrder, MOBILITY_ACTIVITY_ID, 'Mobility Service', handover.mobilityResourceId, proposal.checkin.end, handover.end));
    }

    entries.push(this.createActivityEntry(workOrder, HANDOVER_ACTIVITY_ID, 'Handover', handover.resourceId, handover.start, handover.end));
    return entries;
  }

  private requiresMobility(workOrder: WorkOrder): boolean {
    return workOrder.jobs.some(job =>
      job.workorderItemCategory === 'activity' &&
      this.getActivityTemplateId(job.templateId ?? job.id) === MOBILITY_ACTIVITY_ID
    );
  }

  private isCompleteBookingSet(workOrder: WorkOrder, entries: ScheduleEntry[]): boolean {
    const requiredJobIds = this.getSchedulableJobs(workOrder).map(job => job.id);
    const requiredActivityIds = [CHECKIN_ACTIVITY_ID, HANDOVER_ACTIVITY_ID];
    if (this.requiresMobility(workOrder)) requiredActivityIds.push(MOBILITY_ACTIVITY_ID);

    return requiredJobIds.every(jobId => entries.some(entry => entry.jobId === jobId))
      && requiredActivityIds.every(activityId => entries.some(entry => this.getActivityTemplateId(entry.jobId) === activityId));
  }

  private getSchedulableJobs(workOrder: WorkOrder) {
    return workOrder.jobs.filter(job => (job.workorderItemCategory ?? 'job') !== 'activity');
  }

  private getExistingBookingResourceIds(workOrder: WorkOrder, entries: ScheduleEntry[]): string[] {
    const orderEntries = entries.filter(entry => this.isEntryForWorkOrder(entry, workOrder));
    return [...new Set(orderEntries
      .filter(entry => entry.workorderItemStatus !== 'cancelled')
      .filter(entry =>
        entry.workorderItemCategory === 'job' ||
        this.getActivityTemplateId(entry.jobId) === CHECKIN_ACTIVITY_ID ||
        this.getActivityTemplateId(entry.jobId) === HANDOVER_ACTIVITY_ID ||
        this.getActivityTemplateId(entry.jobId) === MOBILITY_ACTIVITY_ID
      )
      .map(entry => entry.resourceId)
      .filter(Boolean))];
  }

  private isEntryForWorkOrder(entry: ScheduleEntry, workOrder: WorkOrder): boolean {
    if (entry.workOrderReference === workOrder.referenceNumber || entry.workOrderReference === workOrder.id) return true;
    if (workOrder.jobs.some(job => job.id === entry.jobId)) return true;
    const activityOrderId = this.getOrderIdFromActivityJobId(entry.jobId);
    return activityOrderId === workOrder.id || activityOrderId === workOrder.referenceNumber;
  }

  private getOrderIdFromActivityJobId(jobId: string | undefined): string | null {
    if (!jobId?.includes(':act-')) return null;
    return jobId.split(':act-')[0] || null;
  }

  private createActivityEntry(workOrder: WorkOrder, activityTemplateId: string, title: string, resourceId: string, start: Date, end: Date): ScheduleEntry {
    return {
      id: `quick-${activityTemplateId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      jobId: `${workOrder.id}:${activityTemplateId}`,
      resourceId,
      start: new Date(start),
      end: new Date(end),
      title,
      kind: 'scheduled',
      workOrderReference: workOrder.referenceNumber,
      workorderItemStatus: 'scheduled',
      workorderItemCategory: 'activity',
    };
  }

  private buildDays(weekStart: Date, slotsForDate: (date: Date) => QuickViewActivitySlot[]): QuickViewDay[] {
    return Array.from({ length: 7 }, (_, dayIndex) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + dayIndex);
      return {
        date,
        dateLabel: new Intl.DateTimeFormat('en-GB', { day: '2-digit' }).format(date),
        dayLabel: new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(date),
        slots: slotsForDate(date),
      };
    });
  }

  private toActivitySlot(kind: 'checkin' | 'handover', slot: AutoActivitySlot): QuickViewActivitySlot {
    return {
      kind,
      start: new Date(slot.start),
      end: new Date(slot.end),
      resourceId: slot.resourceId,
      key: `${kind}-${slot.resourceId}-${new Date(slot.start).toISOString()}`,
    };
  }

  private toHandoverSlot(option: AutoHandoverOption): QuickViewHandoverSlot {
    return {
      ...this.toActivitySlot('handover', option),
      kind: 'handover',
      mobilityResourceId: option.mobilityResourceId,
    };
  }

  private getSchedulingEntriesForOrder(workOrder: WorkOrder, entries: ScheduleEntry[]): ScheduleEntry[] {
    return entries.filter(entry => entry.workOrderReference !== workOrder.referenceNumber);
  }

  private getActivityTemplateId(jobId: string): string {
    return jobId.includes(':') ? jobId.split(':').pop() ?? jobId : jobId;
  }

  private dayBoundary(date: Date, hour: number): Date {
    const boundary = new Date(date);
    boundary.setHours(hour, 0, 0, 0);
    return boundary;
  }

  private formatTime(date: Date): string {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date).replace(':', '.');
  }
}
