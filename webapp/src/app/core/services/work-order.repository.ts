import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { WorkOrder } from '../models/work-order.model';
import { Job } from '../models/job.model';

@Injectable()
export abstract class WorkOrderRepository {
  abstract getAll(): Observable<WorkOrder[]>;
  abstract getById(id: string): Observable<WorkOrder | null>;
  abstract update(workOrder: WorkOrder): Observable<WorkOrder>;
  abstract updateJob(workOrderId: string, job: Job): Observable<Job>;
}
