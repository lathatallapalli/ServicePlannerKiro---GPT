import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ScheduleEntry } from '../models/schedule.model';

@Injectable()
export abstract class ScheduleRepository {
  abstract getEntries(from: Date, to: Date): Observable<ScheduleEntry[]>;
  abstract assign(entry: ScheduleEntry): Observable<ScheduleEntry>;
  abstract unassign(entryId: string): Observable<void>;
  abstract reschedule(entryId: string, start: Date, end: Date): Observable<ScheduleEntry>;
}
