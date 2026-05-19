import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DatePickerModule, RadioModule, TimePickerModule, TimePickerSelectModule } from 'carbon-components-angular';
import { WorkOrder } from '../../core/models/work-order.model';
import { WorkOrderRepository } from '../../core/services/work-order.repository';

@Component({
  selector: 'app-appointment-selection',
  standalone: true,
  imports: [CommonModule, DatePickerModule, RadioModule, TimePickerModule, TimePickerSelectModule],
  templateUrl: './appointment-selection.component.html',
  styleUrl: './appointment-selection.component.scss',
})
export class AppointmentSelectionComponent implements OnInit {
  protected workOrder: WorkOrder | null = null;

  constructor(
    private route: ActivatedRoute,
    private workOrderRepo: WorkOrderRepository,
  ) {}

  ngOnInit(): void {
    const orderId = this.route.snapshot.paramMap.get('orderId');
    if (!orderId) return;

    this.workOrderRepo.getAll().subscribe(orders => {
      this.workOrder = orders.find(order => order.id === orderId || order.referenceNumber === orderId) ?? null;
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
}
