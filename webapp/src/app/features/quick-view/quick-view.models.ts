import { ScheduleEntry } from '../../core/models/schedule.model';

export type QuickViewActivityKind = 'checkin' | 'handover';
export type QuickViewSlotFilter = 'morning' | 'afternoon' | 'evening';

export interface QuickViewActivitySlot {
  kind: QuickViewActivityKind;
  start: Date;
  end: Date;
  resourceId: string;
  key: string;
}

export interface QuickViewHandoverSlot extends QuickViewActivitySlot {
  kind: 'handover';
  mobilityResourceId?: string;
}

export interface QuickViewDay {
  date: Date;
  dateLabel: string;
  dayLabel: string;
  slots: QuickViewActivitySlot[];
}

export interface QuickViewWorkProposal {
  checkin: QuickViewActivitySlot;
  jobEntries: ScheduleEntry[];
  workCompleteAt: Date;
}

export interface QuickViewExistingSchedule {
  checkin?: QuickViewActivitySlot;
  handover?: QuickViewHandoverSlot;
  jobEntries: ScheduleEntry[];
  mobilityEntry?: ScheduleEntry;
  entryIds: string[];
}
