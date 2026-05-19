import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { WorkOrder } from '../../core/models/work-order.model';
import { WorkOrderRepository } from '../../core/services/work-order.repository';
import { getTransactionsForOrder } from '../../core/services/mock/mock-transactions';

interface SummaryJob {
  scope: string;
  title: string;
  description: string;
  category: string;
  qualification: string;
  payer: string;
  labors: string;
  partLines: string;
  miscLines: string;
  netAmount: string;
  discount: string;
}

@Component({
  selector: 'app-order-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-summary.component.html',
  styleUrl: './order-summary.component.scss',
})
export class OrderSummaryComponent implements OnInit {
  protected workOrder: WorkOrder | null = null;
  protected jobs: SummaryJob[] = [];

  constructor(
    private route: ActivatedRoute,
    private workOrderRepo: WorkOrderRepository,
  ) {}

  ngOnInit(): void {
    const orderId = this.route.snapshot.paramMap.get('orderId');
    if (!orderId) return;

    this.workOrderRepo.getAll().subscribe(orders => {
      this.workOrder = orders.find(order => order.id === orderId || order.referenceNumber === orderId) ?? null;
      this.jobs = this.workOrder?.jobs.map((job, index) => this.toSummaryJob(job, index)) ?? [];
    });
  }

  private toSummaryJob(job: WorkOrder['jobs'][number], index: number): SummaryJob {
    const durationHours = job.estimatedDurationMinutes / 60;
    const transaction = getTransactionsForOrder(job.workOrderId)[0];
    const requirements = job.resourceRequirements?.map(req => req.label ?? req.resourceType).join(' + ');

    return {
      scope: index === 0 ? 'Initial scope' : 'Vehicle',
      title: `${String(index + 1).padStart(2, '0')} - ${job.title}`,
      description: job.description ?? `${job.title} planned for this service order.`,
      category: job.requiredQualifications[0]?.name ?? 'Workshop',
      qualification: requirements || job.requiredResourceType,
      payer: 'Customer',
      labors: `${durationHours % 1 === 0 ? durationHours : durationHours.toFixed(1)} FRU`,
      partLines: job.title.toLowerCase().includes('battery') ? '1' : '0',
      miscLines: job.title.toLowerCase().includes('courtesy') ? '1' : '0',
      netAmount: transaction?.netAmount ?? '0,00',
      discount: '0,00',
    };
  }
}
