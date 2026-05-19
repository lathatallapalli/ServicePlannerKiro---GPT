import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MOCK_WORK_ORDERS } from '../../core/services/mock/mock-data';
import { findTransactionById, MOCK_TRANSACTIONS } from '../../core/services/mock/mock-transactions';
import { GenericListColumn, GenericListComponent, GenericListRowAction } from '../../shared/components/generic-list/generic-list.component';

interface SummaryTag { label: string; value: string; }
interface SummaryMetric { label: string; value: string; trend?: 'positive' | 'negative'; }
interface SummaryTile { title: string; lines: string[]; footer: string; badge?: string; metrics: SummaryMetric[]; }
interface SummaryTableSection<T extends Record<string, unknown> = Record<string, unknown>> {
  title: string;
  chips: string[];
  columns: GenericListColumn<T>[];
  rows: T[];
  rowActions: GenericListRowAction[];
}
interface JobRow extends Record<string, unknown> {
  id: string; job: string; jobNo: string; category: string; quotations: string; qualification: string; payer: string; parts: string; labor: string; misc: string;
}
interface InvoiceRow extends Record<string, unknown> {
  id: string; customerType: string; customer: string; totalAmount: string; netAmount: string; taxAmount: string; status: string; customerNo: string; invoiceNo: string; postingDate: string;
}
interface ClockingRow extends Record<string, unknown> {
  id: string; mechanicId: string; mechanic: string; orderNo: string; job: string; totalHours: string; startingDate: string; startingTime: string; endingDate: string; endingTime: string;
}
interface QuotationRow extends Record<string, unknown> {
  id: string; status: string; closedDate: string; customerType: string; customer: string; totalAmount: string; netAmount: string; taxAmount: string; customerNo: string; quotationNo: string; dueDate: string;
}

@Component({
  selector: 'app-transaction-summary',
  standalone: true,
  imports: [CommonModule, GenericListComponent],
  templateUrl: './transaction-summary.component.html',
  styleUrl: './transaction-summary.component.scss',
})
export class TransactionSummaryComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly transaction = findTransactionById(this.getTransactionId()) ?? MOCK_TRANSACTIONS[0];
  protected readonly workOrder = MOCK_WORK_ORDERS.find(order => order.id === this.transaction.workOrderId) ?? MOCK_WORK_ORDERS[0];
  protected readonly vehicleTitle = this.workOrder.vehicle.licensePlate;
  protected readonly vehicleLines = [`${this.workOrder.vehicle.make} ${this.workOrder.vehicle.model}`, this.workOrder.vehicle.vin ?? ''];

  private getTransactionId(): string | null {
    return this.route.snapshot.paramMap.get('transactionId');
  }

  protected readonly vehicleTags: SummaryTag[] = [
    { label: 'Registration', value: '10/04/2024' },
    { label: 'Color', value: 'White' },
    { label: 'Remarks', value: this.workOrder.notes ?? 'Demo order' },
    { label: 'Model code', value: this.workOrder.vehicle.model },
    { label: 'Current mileage', value: `${this.workOrder.vehicle.mileage ?? 0} km` },
    { label: 'Labor type', value: 'Workshop' },
    { label: 'Model generation', value: '2024' },
  ];

  protected readonly summaryTiles: SummaryTile[] = [
    {
      title: this.workOrder.customer.name,
      lines: [this.workOrder.customer.address ?? '', this.workOrder.customer.city ?? '', this.workOrder.customer.country ?? ''].filter(Boolean),
      footer: 'Billing',
      metrics: [
        { label: 'Customer (100.00%)', value: this.transaction.totalAmount },
        { label: 'Contract', value: '0,00' },
        { label: 'Warranty', value: '0,00' },
        { label: 'Internal', value: '0,00' },
      ],
    },
    {
      title: this.transaction.id,
      lines: [`Order ${this.workOrder.referenceNumber}`, this.transaction.stage, this.transaction.status],
      footer: 'Transaction',
      badge: this.transaction.stage,
      metrics: [
        { label: 'Net Amount', value: this.transaction.netAmount },
        { label: 'Tax Amount', value: this.transaction.taxAmount },
        { label: 'Due Date', value: this.transaction.dueDate },
      ],
    },
  ];

  protected readonly openActions: GenericListRowAction[] = [
    { id: 'open', label: 'Open', icon: 'launch' },
  ];

  protected readonly jobsSection: SummaryTableSection<JobRow> = {
    title: 'Jobs',
    chips: [`${this.workOrder.jobs.length} jobs`, this.workOrder.referenceNumber],
    rowActions: this.openActions,
    columns: [
      { key: 'job', label: 'Job', width: '320px' },
      { key: 'jobNo', label: 'Job No.', width: '190px' },
      { key: 'category', label: 'Category', width: '170px' },
      { key: 'quotations', label: 'Quotations', width: '120px' },
      { key: 'qualification', label: 'Qualification', width: '220px' },
      { key: 'payer', label: 'Payer', width: '140px' },
      { key: 'parts', label: 'Parts', width: '90px' },
      { key: 'labor', label: 'Labor', width: '100px' },
      { key: 'misc', label: 'Misc', width: '90px' },
    ],
    rows: this.workOrder.jobs.map((job, index) => ({
      id: job.id,
      job: `${String(index + 1).padStart(2, '0')} - ${job.title}`,
      jobNo: job.id,
      category: job.requiredQualifications[0]?.name ?? 'Workshop',
      quotations: '1',
      qualification: job.resourceRequirements?.map(req => req.label ?? req.resourceType).join(' + ') ?? job.requiredResourceType,
      payer: 'Customer',
      parts: job.title.toLowerCase().includes('battery') ? '1' : '0',
      labor: `${job.estimatedDurationMinutes / 60} FRU`,
      misc: '0',
    })),
  };

  protected readonly invoicesSection: SummaryTableSection<InvoiceRow> = {
    title: 'Invoices',
    chips: [`${this.workOrder.customer.name} ${this.transaction.totalAmount}`],
    rowActions: this.openActions,
    columns: [
      { key: 'customerType', label: 'Customer Type', width: '150px' },
      { key: 'customer', label: 'Customer', width: '180px' },
      { key: 'totalAmount', label: 'Total Amount', width: '145px' },
      { key: 'netAmount', label: 'Net Amount', width: '145px' },
      { key: 'taxAmount', label: 'Tax Amount', width: '145px' },
      { key: 'status', label: 'Status', width: '130px' },
      { key: 'customerNo', label: 'Customer No.', width: '170px' },
      { key: 'invoiceNo', label: 'Invoice No.', width: '170px' },
      { key: 'postingDate', label: 'Posting Date', width: '150px' },
    ],
    rows: [
      { id: `invoice-${this.transaction.id}`, customerType: 'Customer', customer: this.workOrder.customer.name, totalAmount: this.transaction.totalAmount, netAmount: this.transaction.netAmount, taxAmount: this.transaction.taxAmount, status: 'Open', customerNo: this.workOrder.customer.id, invoiceNo: this.transaction.id, postingDate: this.transaction.dueDate },
    ],
  };

  protected readonly clockingSection: SummaryTableSection<ClockingRow> = {
    title: 'Clocking',
    chips: ['Offer stage / no clocking yet'],
    rowActions: [],
    columns: [
      { key: 'mechanicId', label: 'Mechanic ID', width: '130px' },
      { key: 'mechanic', label: 'Mechanic', width: '200px' },
      { key: 'orderNo', label: 'Order No.', width: '150px' },
      { key: 'job', label: 'Job', width: '180px' },
      { key: 'totalHours', label: 'Total Hours', width: '145px' },
      { key: 'startingDate', label: 'Starting Date', width: '155px' },
      { key: 'startingTime', label: 'Starting Time', width: '160px' },
      { key: 'endingDate', label: 'Ending Date', width: '155px' },
      { key: 'endingTime', label: 'Ending Time', width: '160px' },
    ],
    rows: [],
  };

  protected readonly quotationsSection: SummaryTableSection<QuotationRow> = {
    title: 'Quotations',
    chips: [`${this.workOrder.customer.name} ${this.transaction.totalAmount}`],
    rowActions: this.openActions,
    columns: [
      { key: 'status', label: 'Status', width: '130px' },
      { key: 'closedDate', label: 'Closed Date', width: '135px' },
      { key: 'customerType', label: 'Customer type', width: '155px' },
      { key: 'customer', label: 'Customer', width: '180px' },
      { key: 'totalAmount', label: 'Total Amount', width: '150px' },
      { key: 'netAmount', label: 'Net Amount', width: '145px' },
      { key: 'taxAmount', label: 'Tax Amount', width: '145px' },
      { key: 'customerNo', label: 'Customer No.', width: '170px' },
      { key: 'quotationNo', label: 'Quotation No.', width: '170px' },
      { key: 'dueDate', label: 'Due Date', width: '145px' },
    ],
    rows: [
      { id: `quote-${this.transaction.id}`, status: this.transaction.status, closedDate: this.transaction.dueDate, customerType: 'Customer', customer: this.workOrder.customer.name, totalAmount: this.transaction.totalAmount, netAmount: this.transaction.netAmount, taxAmount: this.transaction.taxAmount, customerNo: this.workOrder.customer.id, quotationNo: this.transaction.id, dueDate: this.transaction.dueDate },
    ],
  };

  protected readonly sections: SummaryTableSection<any>[] = [
    this.jobsSection,
    this.invoicesSection,
    this.clockingSection,
    this.quotationsSection,
  ];
}
