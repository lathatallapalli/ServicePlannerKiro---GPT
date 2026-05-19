export interface ScheduleEntry {
  id: string;
  jobId: string;
  resourceId: string;
  start: Date;
  end: Date;
  title?: string;
  color?: string;
  kind?: 'tentative' | 'blocked-order' | 'scheduled';
  workOrderReference?: string;
}

export interface ScheduleConflict {
  resourceId: string;
  conflictingEntries: ScheduleEntry[];
  reason: string;
}
