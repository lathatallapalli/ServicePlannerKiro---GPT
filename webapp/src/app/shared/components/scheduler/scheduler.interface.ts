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
  displayTags?: string[];
  meta?: Resource;
}

export interface SchedulerEvent {
  id: string;
  resourceId: string;
  start: Date;
  end: Date;
  title: string;
  color?: string;
  meta?: { job?: Job; order?: unknown; entry?: ScheduleEntry };
}

export interface SchedulerCapacityBlock {
  id: string;
  resourceId: string;
  date: Date;
  durationMinutes: number;
  title: string;
  color?: string;
  meta?: { job?: Job; order?: unknown; entry?: ScheduleEntry };
}

export interface SchedulerGroup {
  id: string;
  label: string;
}

export interface SchedulerInvalidDropRange {
  resourceId: string;
  start: Date;
  end: Date;
  reason?: string;
}

export interface SchedulerInvalidCapacityResource {
  resourceId: string;
  date?: Date;
}

export interface SchedulerDropVisualContext {
  durationMinutes: number;
  anchoredStart?: Date;
  anchoredEnd?: Date;
  pointerOffsetMinutes?: number;
  segments?: SchedulerDropVisualSegment[];
  invalid?: boolean;
  keepPreviewRangeStable?: boolean;
}

export interface SchedulerDropVisualSegment {
  resourceId?: string;
  resourceType?: string;
  requiredQualificationIds?: string[];
  entryId?: string;
  jobId?: string;
  start: Date;
  end: Date;
  active?: boolean;
  absolute?: boolean;
}

// ── What the scheduler emits ─────────────────────────────────────────────────

export interface EventMovePayload {
  eventId: string;
  resourceId: string;
  start: Date;
  end: Date;
  dropMode?: 'timed' | 'day-capacity';
  date?: Date;
  durationMinutes?: number;
}

export interface EventResizePayload {
  eventId: string;
  start: Date;
  end: Date;
}

export interface EventResizeDragPayload {
  eventId: string;
}

export interface EventDropPayload {
  jobId: string;
  orderId?: string;
  dropType?: 'job' | 'order' | 'activity';
  dropMode?: 'timed' | 'day-capacity';
  resourceId: string;
  resourceType?: string;
  droppedResourceType?: string;
  start: Date;
  end: Date;
  date?: Date;
  durationMinutes?: number;
}

export interface EventClickPayload {
  eventId: string;
}

export interface OrderFocusPayload {
  orderId?: string;
  eventId: string;
}

export interface EventContextMenuPayload {
  eventId: string;
  x: number;
  y: number;
}

export interface EventDragPayload {
  eventId: string;
  dropMode?: 'timed' | 'day-capacity';
  pointerOffsetMinutes?: number;
}

export interface SchedulerDropPreviewPayload {
  resourceId: string;
  start: Date;
  end: Date;
  dropType?: 'job' | 'order' | 'activity' | 'event';
  jobId?: string;
  orderId?: string;
}

export interface SchedulerTimeRangePayload {
  start: Date;
  end: Date;
}

export interface ResourceSelectionChangePayload {
  resourceId: string;
  selected: boolean;
}

export interface ResourceTypeSelectionChangePayload {
  groupIds: string[];
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
  abstract eventResizeStarted: EventEmitter<EventResizeDragPayload>;
  abstract eventResizeEnded: EventEmitter<EventResizeDragPayload>;
  abstract eventDropped: EventEmitter<EventDropPayload>;
  abstract eventClicked: EventEmitter<EventClickPayload>;
  abstract eventContextMenu: EventEmitter<EventContextMenuPayload>;
}


