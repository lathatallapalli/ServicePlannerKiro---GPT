import { WorkorderItemCategory, WorkorderItemStatus } from './job.model';

export interface ScheduleEntry {
  id: string;
  jobId: string;
  resourceId: string;
  start: Date;
  end: Date;
  title?: string;
  description?: string;
  color?: string;
  kind?: 'tentative' | 'blocked-order' | 'scheduled' | 'day-capacity' | 'resource-block';
  categoryIds?: string[];
  workOrderReference?: string;
  workorderItemStatus?: WorkorderItemStatus;
  workorderItemCategory?: WorkorderItemCategory;
  bookingSetId?: string;
  splitRootId?: string;
  splitParentBookingSetId?: string;
  splitSequence?: number;
}

export interface ScheduleConflict {
  resourceId: string;
  conflictingEntries: ScheduleEntry[];
  reason: string;
}
