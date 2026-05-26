import { Injectable } from '@angular/core';
import { UnavailabilityBlock } from '../../core/models/availability.model';
import { Resource } from '../../core/models/resource.model';
import { ScheduleEntry } from '../../core/models/schedule.model';
import { WorkOrder } from '../../core/models/work-order.model';
import { AutoScheduleResult, AutoSchedulerService } from '../service-planner/services/auto-scheduler.service';

export type ScheduleProposalSource = 'quick-view' | 'planner-range';

export interface ScheduleProposalRequest {
  order: WorkOrder;
  resources: Resource[];
  existingEntries: ScheduleEntry[];
  unavailability: UnavailabilityBlock[];
  searchFrom: Date;
  dayStartHour: number;
  dayEndHour: number;
  source: ScheduleProposalSource;
  fixedCheckin?: {
    start: Date;
    end: Date;
    resourceId?: string;
  };
  handoverSearchFrom?: Date;
  appointmentWindow?: {
    from: Date;
    to: Date;
  };
}

export interface ScheduleProposal {
  orderId: string;
  orderReference: string;
  checkinStart: Date;
  checkinEnd: Date;
  checkinResourceId: string;
  handoverStart: Date;
  handoverEnd: Date;
  handoverResourceId: string;
  mobilityResourceId: string;
  jobEntries: ScheduleEntry[];
  entries: ScheduleEntry[];
  source: ScheduleProposalSource;
}

@Injectable({ providedIn: 'root' })
export class ScheduleProposalService {
  constructor(private autoScheduler: AutoSchedulerService) {}

  createProposal(request: ScheduleProposalRequest): ScheduleProposal | null {
    const result = this.autoScheduler.schedule({
      jobs: request.order.jobs,
      resources: request.resources,
      existingEntries: request.existingEntries,
      unavailability: request.unavailability,
      searchFrom: request.searchFrom,
      fixedCheckin: request.fixedCheckin,
      handoverSearchFrom: request.handoverSearchFrom,
      dayStartHour: request.dayStartHour,
      dayEndHour: request.dayEndHour,
    });

    if (!result) return null;
    if (request.appointmentWindow && !this.isInsideAppointmentWindow(result, request.appointmentWindow)) return null;

    return this.fromAutoScheduleResult(request.order, result, request.source);
  }

  fromAutoScheduleResult(order: WorkOrder, result: AutoScheduleResult, source: ScheduleProposalSource): ScheduleProposal {
    const orderReference = order.referenceNumber;
    const jobEntries = result.entries.map(entry => ({
      ...entry,
      id: this.createEntryId(`quick-${entry.jobId}-${entry.resourceId}`),
      title: order.jobs.find(job => job.id === entry.jobId)?.title ?? entry.jobId,
      kind: 'scheduled' as const,
      workOrderReference: orderReference,
      workorderItemStatus: 'scheduled' as const,
      workorderItemCategory: 'job' as const,
    }));

    const entries = [
      this.createActivityEntry(order.id, 'act-checkin', 'Check-In', result.checkinResourceId, result.checkinStart, result.checkinEnd, orderReference),
      ...jobEntries,
      this.createActivityEntry(order.id, 'act-handover', 'Handover', result.handoverResourceId, result.handoverStart, result.handoverEnd, orderReference),
      this.createActivityEntry(order.id, 'act-mobility', 'Mobility Service', result.mobilityResourceId, result.checkinEnd, result.handoverEnd, orderReference),
    ];

    return {
      orderId: order.id,
      orderReference,
      checkinStart: new Date(result.checkinStart),
      checkinEnd: new Date(result.checkinEnd),
      checkinResourceId: result.checkinResourceId,
      handoverStart: new Date(result.handoverStart),
      handoverEnd: new Date(result.handoverEnd),
      handoverResourceId: result.handoverResourceId,
      mobilityResourceId: result.mobilityResourceId,
      jobEntries,
      entries,
      source,
    };
  }

  private isInsideAppointmentWindow(result: AutoScheduleResult, window: { from: Date; to: Date }): boolean {
    return result.checkinStart.getTime() >= window.from.getTime()
      && result.handoverEnd.getTime() <= window.to.getTime();
  }

  private createActivityEntry(
    orderId: string,
    activityTemplateId: string,
    title: string,
    resourceId: string,
    start: Date,
    end: Date,
    workOrderReference: string,
  ): ScheduleEntry {
    return {
      id: this.createEntryId(`quick-${activityTemplateId}`),
      jobId: `${orderId}:${activityTemplateId}`,
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

  private createEntryId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
