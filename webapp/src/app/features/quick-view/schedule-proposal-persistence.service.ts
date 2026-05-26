import { Injectable } from '@angular/core';
import { forkJoin, map, Observable, of, switchMap, tap } from 'rxjs';
import { ScheduleEntry } from '../../core/models/schedule.model';
import { WorkOrder } from '../../core/models/work-order.model';
import { AppointmentSyncService } from '../../core/services/appointment-sync.service';
import { ScheduleRepository } from '../../core/services/schedule.repository';
import { QuickViewSelectionService } from './quick-view-selection.service';
import { ScheduleProposal } from './schedule-proposal.service';

export interface PersistedScheduleProposal {
  savedOrder: WorkOrder | null;
  assignedEntries: ScheduleEntry[];
}

@Injectable({ providedIn: 'root' })
export class ScheduleProposalPersistenceService {
  constructor(
    private scheduleRepo: ScheduleRepository,
    private appointmentSync: AppointmentSyncService,
    private quickViewSelection: QuickViewSelectionService,
  ) {}

  saveProposal(proposal: ScheduleProposal, currentEntries: ScheduleEntry[]): Observable<PersistedScheduleProposal> {
    const existingEntryIds = currentEntries
      .filter(entry => entry.workOrderReference === proposal.orderReference)
      .map(entry => entry.id);

    return this.unassignEntries(existingEntryIds).pipe(
      switchMap(() => this.assignEntries(proposal.entries)),
      switchMap(assignedEntries => this.appointmentSync.updateAppointment(
        proposal.orderId,
        proposal.checkinStart,
        proposal.handoverStart,
      ).pipe(
        map(savedOrder => ({ savedOrder, assignedEntries })),
      )),
      tap(() => {
        this.quickViewSelection.setSelection({
          orderId: proposal.orderId,
          checkinStart: new Date(proposal.checkinStart),
          handoverStart: new Date(proposal.handoverStart),
          handoverEnd: new Date(proposal.handoverEnd),
        });
      }),
    );
  }

  private unassignEntries(entryIds: string[]): Observable<void> {
    if (!entryIds.length) return of(void 0);
    return forkJoin(entryIds.map(entryId => this.scheduleRepo.unassign(entryId))).pipe(map(() => void 0));
  }

  private assignEntries(entries: ScheduleEntry[]): Observable<ScheduleEntry[]> {
    if (!entries.length) return of([]);
    return forkJoin(entries.map(entry => this.scheduleRepo.assign(entry)));
  }
}
