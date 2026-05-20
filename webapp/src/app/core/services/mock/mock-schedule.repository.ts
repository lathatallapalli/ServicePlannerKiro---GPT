import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ScheduleRepository } from '../schedule.repository';
import { ScheduleEntry } from '../../models/schedule.model';
import { MOCK_SCHEDULE_ENTRIES } from './mock-data';

const ACTIVITY_DURATION_MINUTES: Record<string, number> = {
  'act-checkin': 30,
  'act-handover': 30,
};

@Injectable({ providedIn: 'root' })
export class MockScheduleRepository extends ScheduleRepository {
  private entries: ScheduleEntry[] = structuredClone(MOCK_SCHEDULE_ENTRIES).map(entry =>
    this.normalizeActivityDuration(entry)
  );

  getEntries(from: Date, to: Date): Observable<ScheduleEntry[]> {
    return of(this.entries.filter(e => e.start >= from && e.end <= to).map(entry => ({ ...entry })));
  }

  assign(entry: ScheduleEntry): Observable<ScheduleEntry> {
    const stored = this.normalizeActivityDuration({
      ...entry,
      start: new Date(entry.start),
      end: new Date(entry.end),
    });
    this.entries.push(stored);
    return of({ ...stored });
  }

  unassign(entryId: string): Observable<void> {
    this.entries = this.entries.filter(e => e.id !== entryId);
    return of(void 0);
  }

  reschedule(entryId: string, start: Date, end: Date): Observable<ScheduleEntry> {
    const entry = this.entries.find(e => e.id === entryId);
    if (entry) {
      entry.start = new Date(start);
      entry.end = new Date(end);
    }
    return of({ ...entry! });
  }

  private normalizeActivityDuration(entry: ScheduleEntry): ScheduleEntry {
    const durationMinutes = this.getActivityDurationMinutes(entry);
    if (!durationMinutes) return entry;
    return {
      ...entry,
      end: new Date(entry.start.getTime() + durationMinutes * 60000),
      workorderItemCategory: 'activity',
    };
  }

  private getActivityDurationMinutes(entry: ScheduleEntry): number | undefined {
    const activityTemplateId = entry.jobId.split(':').pop() ?? entry.jobId;
    if (ACTIVITY_DURATION_MINUTES[activityTemplateId]) {
      return ACTIVITY_DURATION_MINUTES[activityTemplateId];
    }

    const title = (entry.title ?? '').toLowerCase();
    if (title.startsWith('check-in')) return ACTIVITY_DURATION_MINUTES['act-checkin'];
    if (title.startsWith('handover')) return ACTIVITY_DURATION_MINUTES['act-handover'];
    return undefined;
  }
}
