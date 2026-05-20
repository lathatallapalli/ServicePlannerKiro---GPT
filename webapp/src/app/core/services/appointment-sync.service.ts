import { Injectable } from '@angular/core';
import { Observable, of, switchMap } from 'rxjs';
import { WorkOrder } from '../models/work-order.model';
import { WorkOrderRepository } from './work-order.repository';

@Injectable({ providedIn: 'root' })
export class AppointmentSyncService {
  constructor(private workOrderRepo: WorkOrderRepository) {}

  updateAppointment(orderIdOrReference: string, checkinStart: Date, handoverEnd: Date): Observable<WorkOrder | null> {
    return this.workOrderRepo.getById(orderIdOrReference).pipe(
      switchMap(order => {
        if (!order) return of(null);
        return this.workOrderRepo.update({
          ...order,
          appointmentStart: new Date(checkinStart),
          appointmentEnd: new Date(handoverEnd),
          updatedAt: new Date(),
        });
      }),
    );
  }
}
