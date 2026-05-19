import { Provider } from '@angular/core';
import { WorkOrderRepository } from '../work-order.repository';
import { ResourceRepository } from '../resource.repository';
import { ScheduleRepository } from '../schedule.repository';
import { MockWorkOrderRepository } from './mock-work-order.repository';
import { MockResourceRepository } from './mock-resource.repository';
import { MockScheduleRepository } from './mock-schedule.repository';

/** Swap these providers for real API implementations when backend is ready */
export const MOCK_PROVIDERS: Provider[] = [
  { provide: WorkOrderRepository, useClass: MockWorkOrderRepository },
  { provide: ResourceRepository,  useClass: MockResourceRepository },
  { provide: ScheduleRepository,  useClass: MockScheduleRepository },
];
