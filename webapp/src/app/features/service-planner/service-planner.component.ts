import { Component, OnInit, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CustomSchedulerComponent } from '../../shared/components/scheduler/custom/custom-scheduler.component';
import { JobsPanelComponent, JobTile, JobBooking, ActivityTile } from './components/jobs-panel/jobs-panel.component';
import { SchedulerResource, SchedulerEvent, SchedulerGroup, EventMovePayload, EventResizePayload, EventDropPayload, EventClickPayload } from '../../shared/components/scheduler/scheduler.interface';
import { ResourceRepository } from '../../core/services/resource.repository';
import { ScheduleRepository } from '../../core/services/schedule.repository';
import { WorkOrderRepository } from '../../core/services/work-order.repository';
import { PlannerSettingsService } from './services/planner-settings.service';
import { AutoSchedulerService } from './services/auto-scheduler.service';
import { forkJoin } from 'rxjs';
import { MOCK_UNAVAILABILITY } from '../../core/services/mock/mock-data';
import { UnavailabilityBlock } from '../../core/models/availability.model';

@Component({
  selector: 'app-service-planner',
  standalone: true,
  imports: [CommonModule, CustomSchedulerComponent, JobsPanelComponent],
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
    { id: 'act-checkin',   title: 'Check-In',        resourceType: 'advisor', resourceLabel: 'Service Advisor', estimatedDurationMinutes: 30 },
    { id: 'act-handover',  title: 'Handover',         resourceType: 'advisor', resourceLabel: 'Service Advisor', estimatedDurationMinutes: 30 },
    { id: 'act-mobility',  title: 'Mobility Service', resourceType: 'driver',  resourceLabel: 'Courtesy Car',    estimatedDurationMinutes: 60 },
  ];
  bookings: JobBooking[] = [];
  hasPrevious = false;

  // Scheduling proposal history
  private proposalHistory: Date[] = [];   // searchFrom dates that produced results
  private currentProposalIndex = -1;
  private proposalEndHistory: Date[] = [];
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
    if (!this.isAutoProposalVisible) return this.resources;
    const bookedResourceIds = new Set(this.events.map(e => e.resourceId));
    return this.resources.filter(r => bookedResourceIds.has(r.id));
  }

  constructor(
    private resourceRepo: ResourceRepository,
    private scheduleRepo: ScheduleRepository,
    private workOrderRepo: WorkOrderRepository,
    private plannerSettings: PlannerSettingsService,
    private autoScheduler: AutoSchedulerService,
  ) {
    // Watch the undo trigger — each increment means undo the last booking
    effect(() => {
      const trigger = this.plannerSettings.undoTrigger();
      if (trigger === 0) return; // skip initial value
      this.undoLastBooking();
    });
  }

  ngOnInit(): void {
    forkJoin({
      resources: this.resourceRepo.getAll(),
      groups:    this.resourceRepo.getGroups(),
      entries:   this.scheduleRepo.getEntries(this.viewStart, this.viewEnd),
      orders:    this.workOrderRepo.getAll(),
    }).subscribe(({ resources, groups, entries, orders }) => {
      this.allOrders = orders;

      this.jobTiles = orders.flatMap((order: any) =>
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
        if (entry.kind === 'blocked-order') {
          return null;
        }

        const found = jobMap.get(entry.jobId) as any;
        return {
          id: entry.id,
          resourceId: entry.resourceId,
          start: entry.start,
          end: entry.end,
          title: entry.title ?? found?.job.title ?? entry.jobId,
          color: entry.color ?? '#4C68B1',
          meta: { job: found?.job, entry },
        };
      });

      this.events = mappedEvents.filter((event): event is SchedulerEvent => event !== null);

      this.unavailability = [
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
    console.log('Event clicked', payload);
  }

  onEventDropped(payload: EventDropPayload): void {
    this.isAutoProposalVisible = false;
    let start = payload.start;
    let end = payload.end;

    // Business rule: if this job already has a booking, snap to that booking's timeslot
    const existingJobBooking = this.bookings.find(b => b.jobId === payload.jobId);
    if (existingJobBooking) {
      const existingEvent = this.events.find(e => e.id === existingJobBooking.entryId);
      if (existingEvent) {
        start = existingEvent.start;
        end = existingEvent.end;
      }
    }

    // Business rule: mobility service spans from check-in start to handover end
    if (payload.jobId === 'act-mobility') {
      const span = this.getMobilitySpan();
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
      const resourceType = payload.resourceType ?? (resource?.meta as any)?.type ?? 'mechanic';

      // Add the event and booking first
      this.events = [...this.events, {
        id: assigned.id,
        resourceId: assigned.resourceId,
        start: assigned.start,
        end: assigned.end,
        title: found?.title ?? payload.jobId,
        color: '#4C68B1',
      }];

      this.bookings = [...this.bookings, {
        jobId: payload.jobId,
        resourceName: resource?.label ?? payload.resourceId,
        resourceType,
        entryId: assigned.id,
      }];

      // Business rule: after check-in or handover is booked, sync mobility span if it exists
      if (payload.jobId === 'act-checkin' || payload.jobId === 'act-handover') {
        this.syncMobilitySpan();
      }

      // Business rule: when mobility is dropped, snap its span to check-in→handover if both booked
      if (payload.jobId === 'act-mobility') {
        const span = this.getMobilitySpan();
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
    this.clearCurrentBookings();
    this.applyProposal(searchFrom, false, true);
  }

  private applyProposal(searchFrom: Date, resetHistory: boolean, isReplay = false): void {
    const targetWorkOrderId = this.getActiveWorkOrderId();
    const unscheduledTiles = this.jobTiles.filter(t => t.workOrder.id === targetWorkOrderId);
    const unscheduledJobs = unscheduledTiles.map(t => t.job);
    if (unscheduledJobs.length === 0) return;

    const rawResources = this.resources.map(r => r.meta as any).filter(Boolean);

    const result = this.autoScheduler.schedule({
      jobs: unscheduledJobs,
      resources: rawResources,
      existingEntries: [],  // ignore existing auto-bookings for fresh proposal
      unavailability: this.unavailability,
      searchFrom,
      dayStartHour: 9,
      dayEndHour: 21,
    });

    if (!result) return;

    // Clear previous auto-bookings before applying new proposal
    this.clearCurrentBookings();

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
    this.latestAutoBookingEntryIds = new Set<string>();
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
        }];
        this.bookings = [...this.bookings, {
          jobId: assigned.jobId, resourceName: resource?.label ?? assigned.resourceId,
          resourceType, entryId: assigned.id,
        }];
        this.latestAutoBookingEntryIds.add(assigned.id);
      });
    });

    // Activities
    const checkinEnd   = new Date(result.checkinStart);
    const checkinStart = new Date(checkinEnd.getTime() - 30 * 60000);
    const dayStart = new Date(checkinStart); dayStart.setHours(9, 0, 0, 0);
    if (checkinStart < dayStart) {
      checkinStart.setTime(dayStart.getTime());
      checkinEnd.setTime(checkinStart.getTime() + 30 * 60000);
    }
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

    if (checkinAdvisor)  this.bookActivity('act-checkin',  checkinAdvisor,  checkinStart,  checkinEnd);
    if (handoverAdvisor) this.bookActivity('act-handover', handoverAdvisor, handoverStart, handoverEnd);
    if (mobilityDriver)  this.bookActivity('act-mobility', mobilityDriver,  checkinStart,  handoverEnd);
  }

  private getActiveWorkOrderId(): string | null {
    return this.jobTiles[0]?.workOrder.id ?? null;
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
  private clearCurrentBookings(): void {
    const autoEntryIds = new Set(this.bookings.map(b => b.entryId));
    autoEntryIds.forEach(id => this.scheduleRepo.unassign(id).subscribe());
    this.events   = this.events.filter(e => !autoEntryIds.has(e.id));
    this.bookings = [];
    this.latestAutoBookingEntryIds.clear();
    this.isAutoProposalVisible = false;
  }

  private bookActivity(activityId: string, resource: any, start: Date, end: Date): void {
    const activityTitle = this.activityTiles.find(activity => activity.id === activityId)?.title ?? activityId;
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
      }];
      this.bookings = [...this.bookings, {
        jobId: activityId,
        resourceName: schedulerResource?.label ?? resource.name,
        resourceType: resource.type,
        entryId: assigned.id,
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
  private getMobilitySpan(): { start: Date; end: Date } | null {
    const checkinBooking  = this.bookings.find(b => b.jobId === 'act-checkin');
    const handoverBooking = this.bookings.find(b => b.jobId === 'act-handover');
    if (!checkinBooking || !handoverBooking) return null;

    const checkinEvent  = this.events.find(e => e.id === checkinBooking.entryId);
    const handoverEvent = this.events.find(e => e.id === handoverBooking.entryId);
    if (!checkinEvent || !handoverEvent) return null;

    return { start: checkinEvent.start, end: handoverEvent.end };
  }

  /** After check-in or handover moves, stretch the mobility event to match */
  private syncMobilitySpan(): void {
    const mobilityBooking = this.bookings.find(b => b.jobId === 'act-mobility');
    if (!mobilityBooking) return;

    const span = this.getMobilitySpan();
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
