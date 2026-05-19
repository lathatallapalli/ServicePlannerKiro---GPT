import { EventEmitter } from '@angular/core';
import { Resource } from '../../../core/models/resource.model';
import { ScheduleEntry } from '../../../core/models/schedule.model';
import { Job } from '../../../core/models/job.model';

// ── What the scheduler displays ─────────────────────────────────────────────

export interface SchedulerResource {
  id: string;
  label: string;
  groupId?: string;
  groupLabel?: string;
  hasQualificationMatch?: boolean;
  meta?: Resource;
}

export interface SchedulerEvent {
  id: string;
  resourceId: string;
  start: Date;
  end: Date;
  title: string;
  color?: string;
  meta?: { job: Job; entry: ScheduleEntry };
}

export interface SchedulerGroup {
  id: string;
  label: string;
}

// ── What the scheduler emits ─────────────────────────────────────────────────

export interface EventMovePayload {
  eventId: string;
  resourceId: string;
  start: Date;
  end: Date;
}

export interface EventResizePayload {
  eventId: string;
  start: Date;
  end: Date;
}

export interface EventDropPayload {
  jobId: string;
  orderId?: string;
  dropType?: 'job' | 'order';
  resourceId: string;
  resourceType?: string;
  droppedResourceType?: string;
  start: Date;
  end: Date;
}

export interface EventClickPayload {
  eventId: string;
}

export interface ResourceSelectionChangePayload {
  resourceId: string;
  selected: boolean;
}

// ── The contract every scheduler implementation must satisfy ─────────────────

export abstract class SchedulerContract {
  // Inputs
  abstract resources: SchedulerResource[];
  abstract events: SchedulerEvent[];
  abstract groups: SchedulerGroup[];
  abstract viewStart: Date;
  abstract viewEnd: Date;
  abstract slotDurationMinutes: number;
  abstract readonly: boolean;

  // Outputs
  abstract eventMoved: EventEmitter<EventMovePayload>;
  abstract eventResized: EventEmitter<EventResizePayload>;
  abstract eventDropped: EventEmitter<EventDropPayload>;
  abstract eventClicked: EventEmitter<EventClickPayload>;
}
