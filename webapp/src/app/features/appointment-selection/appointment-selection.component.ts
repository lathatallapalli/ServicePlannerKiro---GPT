import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DatePickerModule, RadioModule, TimePickerModule, TimePickerSelectModule } from 'carbon-components-angular';
import { WorkOrder } from '../../core/models/work-order.model';
import { WorkOrderRepository } from '../../core/services/work-order.repository';
import { QuickViewSelectionService } from '../quick-view/quick-view-selection.service';

@Component({
  selector: 'app-appointment-selection',
  standalone: true,
  imports: [CommonModule, DatePickerModule, RadioModule, TimePickerModule, TimePickerSelectModule],
  templateUrl: './appointment-selection.component.html',
  styleUrl: './appointment-selection.component.scss',
})
export class AppointmentSelectionComponent implements OnInit {
  protected workOrder: WorkOrder | null = null;
  protected handoverStart: Date | undefined;
  protected showQuickViewDraftWarning = false;

  constructor(
    private route: ActivatedRoute,
    private workOrderRepo: WorkOrderRepository,
    private quickViewSelection: QuickViewSelectionService,
  ) {}

  ngOnInit(): void {
    const orderId = this.route.snapshot.paramMap.get('orderId');
    if (!orderId) return;

    this.workOrderRepo.getAll().subscribe(orders => {
      this.workOrder = orders.find(order => order.id === orderId || order.referenceNumber === orderId) ?? null;
      const selection = this.workOrder ? this.quickViewSelection.getSelection(this.workOrder.id) : null;
      this.showQuickViewDraftWarning = !!selection?.checkinStart && !selection?.handoverEnd;
      if (this.workOrder && selection) {
        this.workOrder = {
          ...this.workOrder,
          appointmentStart: selection.checkinStart ? new Date(selection.checkinStart) : this.workOrder.appointmentStart,
          appointmentEnd: selection.handoverEnd ? new Date(selection.handoverEnd) : this.workOrder.appointmentEnd,
        };
        this.handoverStart = selection.handoverStart
          ? new Date(selection.handoverStart)
          : this.getHandoverStart(this.workOrder.appointmentEnd);
      } else {
        this.handoverStart = this.getHandoverStart(this.workOrder?.appointmentEnd);
      }
    });
  }

  protected getDateValue(date?: Date): Date[] {
    return date ? [date] : [];
  }

  protected getTimeValue(date?: Date): string {
    if (!date) return '';
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }

  protected getMeridiem(date?: Date): string {
    if (!date) return 'AM';
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: true,
    }).formatToParts(date).find(part => part.type === 'dayPeriod')?.value ?? 'AM';
  }

  protected getTotalDurationHours(): number {
    return this.workOrder?.jobs.reduce((total, job) => total + this.getJobHours(job), 0) ?? 0;
  }

  protected getTotalDurationLabel(): string {
    const hours = this.getTotalDurationHours();
    const formatted = hours % 1 === 0 ? String(hours) : hours.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    return `${formatted} hrs`;
  }

  private getJobHours(job: WorkOrder['jobs'][number]): number {
    return Number(job.fru ?? (job as any).durationFru ?? Math.max(0.25, job.estimatedDurationMinutes / 60));
  }

  private getHandoverStart(handoverEnd?: Date): Date | undefined {
    if (!handoverEnd) return undefined;
    const start = new Date(handoverEnd);
    start.setMinutes(start.getMinutes() - 30);
    return start;
  }
}
