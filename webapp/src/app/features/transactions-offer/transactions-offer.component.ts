import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MOCK_WORK_ORDERS } from '../../core/services/mock/mock-data';
import { MOCK_TRANSACTIONS } from '../../core/services/mock/mock-transactions';
import { GenericListColumn, GenericListComponent, GenericListRowAction, GenericListToolbarAction } from '../../shared/components/generic-list/generic-list.component';

interface OfferTransactionRow extends Record<string, unknown> {
  id: string;
  workOrderId: string;
  orderNumber: string;
  customerName: string;
  transactionType: string;
  stage: string;
  status: string;
  licensePlate: string;
  brand: string;
  model: string;
  checkInDriver: string;
  billing: string;
  appointmentDate: string;
  vin: string;
  registrationDate: string;
}

@Component({
  selector: 'app-transactions-offer',
  standalone: true,
  imports: [CommonModule, GenericListComponent],
  templateUrl: './transactions-offer.component.html',
  styleUrl: './transactions-offer.component.scss',
})
export class TransactionsOfferComponent {
  constructor(private router: Router, private route: ActivatedRoute) {}

  protected get isActiveList(): boolean {
    return this.route.snapshot.routeConfig?.path === 'transactions/active';
  }

  protected get pageTitle(): string {
    return this.isActiveList ? 'Active Transactions' : 'Transactions - Offer';
  }

  protected get initialSearchTerm(): string {
    return this.isActiveList ? (this.route.snapshot.queryParamMap.get('q') ?? '') : '';
  }

  protected selectedRows: OfferTransactionRow[] = [];

  protected readonly columns: GenericListColumn<OfferTransactionRow>[] = [
    { key: 'orderNumber', label: 'Order Number', minWidth: '144px', sortable: true },
    { key: 'customerName', label: 'Customer', minWidth: '172px', sortable: true },
    { key: 'transactionType', label: 'Transaction Type', minWidth: '176px', sortable: true },
    { key: 'stage', label: 'Stage', minWidth: '96px', sortable: true },
    { key: 'status', label: 'Status', minWidth: '112px', sortable: true },
    { key: 'licensePlate', label: 'License Plate', minWidth: '144px', sortable: true },
    { key: 'brand', label: 'Brand', minWidth: '96px', sortable: true },
    { key: 'model', label: 'Model', minWidth: '172px', sortable: true },
    { key: 'checkInDriver', label: 'Check-In-Driver', minWidth: '172px', sortable: true },
    { key: 'billing', label: 'Billing', minWidth: '172px', sortable: true },
    { key: 'appointmentDate', label: 'Appointment Date', minWidth: '184px', sortable: true },
    { key: 'vin', label: 'VIN', minWidth: '224px', sortable: true },
    { key: 'registrationDate', label: 'Registration Date', minWidth: '176px' },
  ];

  protected get toolbarActions(): GenericListToolbarAction[] {
    return [
      ...(this.isActiveList
        ? [{ id: 'plan-selected', label: 'Plan selected', icon: 'launch' as const, disabled: this.selectedRows.length === 0 }]
        : []),
      { id: 'upload', label: 'Upload', icon: 'save' },
      { id: 'settings', label: 'View settings', icon: 'settings-view' },
      { id: 'clear-filter', label: 'Clear filters', icon: 'filter-remove' },
    ];
  }

  protected readonly rowActions: GenericListRowAction[] = [
    { id: 'resume', label: 'Resume transaction', icon: 'play' },
    { id: 'summary', label: 'Transaction summary', icon: 'launch' },
  ];

  protected get rows(): OfferTransactionRow[] {
    return MOCK_TRANSACTIONS
      .filter(transaction => this.isActiveList || transaction.stage.toLowerCase() === 'offer')
      .map(transaction => {
        const order = MOCK_WORK_ORDERS.find(candidate => candidate.id === transaction.workOrderId)!;
        return {
          id: transaction.id,
          workOrderId: transaction.workOrderId,
          orderNumber: this.formatOrderNumber(order),
          customerName: order.customer.name,
          transactionType: transaction.transactionType,
          stage: transaction.stage,
          status: transaction.status,
          licensePlate: order.vehicle.licensePlate,
          brand: order.vehicle.make,
          model: order.vehicle.model,
          checkInDriver: this.getCheckInDriver(order),
          billing: transaction.billing,
          appointmentDate: order.appointmentStart ? this.formatDate(order.appointmentStart) : this.getFallbackAppointmentDate(transaction.stage),
          vin: order.vehicle.vin ?? '',
          registrationDate: '10.04.2024',
        };
      });
  }

  protected onToolbarAction(action: GenericListToolbarAction): void {
    if (action.id === 'plan-selected') {
      this.router.navigate(['/service-planner'], {
        state: { selectedOrderIds: this.selectedRows.map(row => row.workOrderId) },
      });
      return;
    }

    if (action.id === 'clear-filter') {
      this.router.navigate([], { relativeTo: this.route, queryParams: {} });
      return;
    }

    console.log('Transactions toolbar action', action.id);
  }

  protected onSelectionChange(rows: OfferTransactionRow[]): void {
    this.selectedRows = rows;
  }

  protected onRowAction(event: { action: GenericListRowAction; row: OfferTransactionRow }): void {
    if (event.action.id === 'summary') {
      this.router.navigate(['/transactions', event.row.id, 'summary']);
      return;
    }

    this.router.navigate(['/orders', event.row.workOrderId, 'summary']);
  }

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  private formatOrderNumber(order: (typeof MOCK_WORK_ORDERS)[number]): string {
    if (order.demoLocationId === 'klagenfurt') return `${order.referenceNumber} (KLG)`;
    if (order.demoLocationId === 'vienna') return `${order.referenceNumber} (VIE)`;
    return order.referenceNumber;
  }

  private getCheckInDriver(order: (typeof MOCK_WORK_ORDERS)[number]): string {
    if (order.demoLocationId === 'vienna') return 'Frank Reynold';
    if (order.demoLocationId === 'klagenfurt') return 'Jeff';
    return 'Ted Phillips';
  }

  private getFallbackAppointmentDate(stage: string): string {
    return ['execution', 'handover', 'follow-up'].includes(stage.toLowerCase())
      ? '15.04.2024, 09:00'
      : 'Not scheduled';
  }
}


