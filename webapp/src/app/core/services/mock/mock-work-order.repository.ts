import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { WorkOrderRepository } from '../work-order.repository';
import { WorkOrder } from '../../models/work-order.model';
import { Job } from '../../models/job.model';
import { MOCK_WORK_ORDERS } from './mock-data';

@Injectable({ providedIn: 'root' })
export class MockWorkOrderRepository extends WorkOrderRepository {
  private orders: WorkOrder[] = structuredClone(MOCK_WORK_ORDERS);

  getAll(): Observable<WorkOrder[]> {
    return of([...this.orders]);
  }

  getById(id: string): Observable<WorkOrder | null> {
    return of(this.orders.find(o => o.id === id || o.referenceNumber === id) ?? null);
  }

  update(workOrder: WorkOrder): Observable<WorkOrder> {
    const idx = this.orders.findIndex(o => o.id === workOrder.id);
    if (idx !== -1) {
      this.orders[idx] = { ...workOrder, updatedAt: new Date() };
    }
    return of(this.orders[idx]);
  }

  updateJob(workOrderId: string, job: Job): Observable<Job> {
    const order = this.orders.find(o => o.id === workOrderId);
    if (order) {
      const idx = order.jobs.findIndex(j => j.id === job.id);
      if (idx !== -1) order.jobs[idx] = job;
    }
    return of(job);
  }
}
