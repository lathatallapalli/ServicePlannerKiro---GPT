import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ScheduleRepository } from '../schedule.repository';
import { ScheduleEntry } from '../../models/schedule.model';
import { MOCK_SCHEDULE_ENTRIES } from './mock-data';

@Injectable({ providedIn: 'root' })
export class MockScheduleRepository extends ScheduleRepository {
  private entries: ScheduleEntry[] = structuredClone(MOCK_SCHEDULE_ENTRIES);

  getEntries(from: Date, to: Date): Observable<ScheduleEntry[]> {
    return of(this.entries.filter(e => e.start >= from && e.end <= to));
  }

  assign(entry: ScheduleEntry): Observable<ScheduleEntry> {
    const stored: ScheduleEntry = {
      ...entry,
      start: new Date(entry.start),
      end: new Date(entry.end),
    };
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
}
