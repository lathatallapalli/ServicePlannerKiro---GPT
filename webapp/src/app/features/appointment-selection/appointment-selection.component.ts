import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DatePickerModule, RadioModule, TimePickerModule, TimePickerSelectModule } from 'carbon-components-angular';
import { WorkOrder } from '../../core/models/work-order.model';
import { AppointmentSyncService } from '../../core/services/appointment-sync.service';
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

  constructor(
    private route: ActivatedRoute,
    private workOrderRepo: WorkOrderRepository,
    private appointmentSync: AppointmentSyncService,
    private quickViewSelection: QuickViewSelectionService,
  ) {}

  ngOnInit(): void {
    const orderId = this.route.snapshot.paramMap.get('orderId');
    if (!orderId) return;

    this.workOrderRepo.getAll().subscribe(orders => {
      this.workOrder = orders.find(order => order.id === orderId || order.referenceNumber === orderId) ?? null;
      const selection = this.workOrder ? this.quickViewSelection.getSelection(this.workOrder.id) : null;
      if (this.workOrder && selection) {
        this.workOrder = {
          ...this.workOrder,
          appointmentStart: new Date(selection.checkinStart),
          appointmentEnd: new Date(selection.handoverStart ?? selection.handoverEnd),
        };
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

  protected onAppointmentDateChange(target: 'checkin' | 'handover' | 'agreed', value: Date[]): void {
    const date = value?.[0];
    if (!date) return;
    const current = target === 'checkin' ? this.workOrder?.appointmentStart : this.workOrder?.appointmentEnd;
    this.updateAppointmentPart(target, { date, time: current });
  }

  protected onAppointmentTimeChange(target: 'checkin' | 'handover' | 'agreed', value: string): void {
    const current = target === 'checkin' ? this.workOrder?.appointmentStart : this.workOrder?.appointmentEnd;
    this.updateAppointmentPart(target, { date: current, time: value });
  }

  protected onAppointmentMeridiemChange(target: 'checkin' | 'handover' | 'agreed', event: Event): void {
    const meridiem = (event.target as HTMLSelectElement | null)?.value;
    if (meridiem !== 'AM' && meridiem !== 'PM') return;
    const current = target === 'checkin' ? this.workOrder?.appointmentStart : this.workOrder?.appointmentEnd;
    if (!current) return;
    let hours = current.getHours();
    if (meridiem === 'AM' && hours >= 12) hours -= 12;
    if (meridiem === 'PM' && hours < 12) hours += 12;
    const updated = new Date(current);
    updated.setHours(hours, current.getMinutes(), 0, 0);
    this.updateAppointmentPart(target, { date: updated, time: updated });
  }

  protected onAppointmentFieldsDomChange(): void {
    window.setTimeout(() => this.persistAppointmentFromDomFields());
  }

  private updateAppointmentPart(
    target: 'checkin' | 'handover' | 'agreed',
    value: { date?: Date; time?: Date | string },
  ): void {
    if (!this.workOrder) return;
    const isCheckin = target === 'checkin';
    const current = new Date((isCheckin ? this.workOrder.appointmentStart : this.workOrder.appointmentEnd) ?? new Date());
    const dateSource = value.date ? new Date(value.date) : current;
    const timeSource = typeof value.time === 'string' ? this.parseTimeValue(value.time, current) : new Date(value.time ?? current);

    const updated = new Date(dateSource);
    updated.setHours(timeSource.getHours(), timeSource.getMinutes(), 0, 0);

    const appointmentStart = isCheckin ? updated : new Date(this.workOrder.appointmentStart ?? updated);
    const appointmentEnd = isCheckin ? new Date(this.workOrder.appointmentEnd ?? updated) : updated;

    this.workOrder = {
      ...this.workOrder,
      appointmentStart,
      appointmentEnd,
    };
    this.persistAppointmentSelection();
  }

  private parseTimeValue(value: string, fallback: Date): Date {
    const match = value.match(/^(\d{1,2}):(\d{2})/);
    const parsed = new Date(fallback);
    if (!match) return parsed;
    parsed.setHours(Number(match[1]), Number(match[2]), 0, 0);
    return parsed;
  }

  private persistAppointmentSelection(): void {
    if (!this.workOrder?.appointmentStart || !this.workOrder.appointmentEnd) return;

    const appointmentStart = new Date(this.workOrder.appointmentStart);
    const appointmentEnd = new Date(this.workOrder.appointmentEnd);
    this.quickViewSelection.setSelection({
      orderId: this.workOrder.id,
      checkinStart: appointmentStart,
      handoverStart: appointmentEnd,
      handoverEnd: new Date(appointmentEnd.getTime() + 30 * 60000),
    });
    this.appointmentSync.updateAppointment(this.workOrder.id, appointmentStart, appointmentEnd).subscribe(savedOrder => {
      if (savedOrder) this.workOrder = savedOrder;
    });
  }

  private persistAppointmentFromDomFields(): void {
    if (!this.workOrder || typeof document === 'undefined') return;

    const checkinDate = this.readDateInput('check-in-date') ?? this.workOrder.appointmentStart;
    const checkinTime = this.readTimeInput('check-in-time') ?? this.workOrder.appointmentStart;
    const handoverDate = this.readDateInput('handover-date') ?? this.readDateInput('agreed-date') ?? this.workOrder.appointmentEnd;
    const handoverTime = this.readTimeInput('handover-time') ?? this.readTimeInput('agreed-time') ?? this.workOrder.appointmentEnd;

    if (!checkinDate || !checkinTime || !handoverDate || !handoverTime) return;

    const appointmentStart = this.mergeDateAndTime(checkinDate, checkinTime, this.readMeridiemInput('check-in-time-period'));
    const appointmentEnd = this.mergeDateAndTime(handoverDate, handoverTime, this.readMeridiemInput('handover-time-period') ?? this.readMeridiemInput('agreed-time-period'));

    if (
      this.workOrder.appointmentStart?.getTime() === appointmentStart.getTime() &&
      this.workOrder.appointmentEnd?.getTime() === appointmentEnd.getTime()
    ) {
      return;
    }

    this.workOrder = {
      ...this.workOrder,
      appointmentStart,
      appointmentEnd,
    };
    this.persistAppointmentSelection();
  }

  private readDateInput(id: string): Date | null {
    const value = this.readInputValue(id);
    if (!value) return null;
    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    const localMatch = value.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2}|\d{4})$/);
    if (!localMatch) return null;
    const year = Number(localMatch[3].length === 2 ? `20${localMatch[3]}` : localMatch[3]);
    return new Date(year, Number(localMatch[2]) - 1, Number(localMatch[1]));
  }

  private readTimeInput(id: string): Date | null {
    const value = this.readInputValue(id);
    if (!value) return null;
    return this.parseTimeValue(value, new Date());
  }

  private readMeridiemInput(id: string): 'AM' | 'PM' | null {
    const value = this.readInputValue(id);
    return value === 'AM' || value === 'PM' ? value : null;
  }

  private readInputValue(id: string): string {
    const element = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
    return element?.value?.trim() ?? '';
  }

  private mergeDateAndTime(date: Date, time: Date, meridiem: 'AM' | 'PM' | null): Date {
    const merged = new Date(date);
    let hours = time.getHours();
    if (meridiem === 'AM' && hours >= 12) hours -= 12;
    if (meridiem === 'PM' && hours < 12) hours += 12;
    merged.setHours(hours, time.getMinutes(), 0, 0);
    return merged;
  }
}
