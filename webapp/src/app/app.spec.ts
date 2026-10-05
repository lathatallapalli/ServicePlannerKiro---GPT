import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { WorkOrderRepository } from './core/services/work-order.repository';
import { ResourceRepository } from './core/services/resource.repository';
import { ScheduleRepository } from './core/services/schedule.repository';
import { MockWorkOrderRepository } from './core/services/mock/mock-work-order.repository';
import { MockResourceRepository } from './core/services/mock/mock-resource.repository';
import { MockScheduleRepository } from './core/services/mock/mock-schedule.repository';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      // Supply the abstract repository tokens the real App shell injects
      // (directly and transitively). Without these the shell throws
      // NG0201 "No provider found for _WorkOrderRepository". We bind them to
      // the same mock implementations the app uses at runtime, plus an empty
      // router so the RouterOutlet in the shell template resolves.
      providers: [
        provideRouter([]),
        { provide: WorkOrderRepository, useClass: MockWorkOrderRepository },
        { provide: ResourceRepository, useClass: MockResourceRepository },
        { provide: ScheduleRepository, useClass: MockScheduleRepository },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
