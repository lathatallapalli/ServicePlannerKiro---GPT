import { WorkOrder } from '../../models/work-order.model';
import { MOCK_WORK_ORDERS } from './mock-data';

export interface MockTransaction {
  id: string;
  workOrderId: string;
  transactionType: string;
  stage: string;
  status: string;
  billing: string;
  totalAmount: string;
  netAmount: string;
  taxAmount: string;
  dueDate: string;
}

export const MOCK_TRANSACTIONS: MockTransaction[] = [
  {
    id: 'txn-014826312-offer',
    workOrderId: 'wo-014826312',
    transactionType: 'Workshop',
    stage: 'Offer',
    status: 'CREATED',
    billing: 'Alpha GMBH',
    totalAmount: '420,00',
    netAmount: '352,94',
    taxAmount: '67,06',
    dueDate: '15.04.2024',
  },
  {
    id: 'txn-014826455-offer',
    workOrderId: 'wo-014826455',
    transactionType: 'Workshop',
    stage: 'Offer',
    status: 'CREATED',
    billing: 'Beta Logistics',
    totalAmount: '860,00',
    netAmount: '722,69',
    taxAmount: '137,31',
    dueDate: '15.04.2024',
  },
  {
    id: 'txn-014826500-request',
    workOrderId: 'wo-bg-1001',
    transactionType: 'Workshop',
    stage: 'Request',
    status: 'OPEN',
    billing: 'Meyer Mobility',
    totalAmount: '380,00',
    netAmount: '319,33',
    taxAmount: '60,67',
    dueDate: '15.04.2024',
  },
  {
    id: 'txn-014826501-preparation',
    workOrderId: 'wo-bg-1002',
    transactionType: 'Workshop',
    stage: 'Preparation',
    status: 'PLANNED',
    billing: 'Autohaus Klein',
    totalAmount: '295,00',
    netAmount: '247,90',
    taxAmount: '47,10',
    dueDate: '15.04.2024',
  },
  {
    id: 'txn-014826502-checkin',
    workOrderId: 'wo-bg-1003',
    transactionType: 'Workshop',
    stage: 'Check-In',
    status: 'PLANNED',
    billing: 'Bavaria Fleet',
    totalAmount: '510,00',
    netAmount: '428,57',
    taxAmount: '81,43',
    dueDate: '15.04.2024',
  },
  {
    id: 'txn-014826503-execution',
    workOrderId: 'wo-bg-1004',
    transactionType: 'Workshop',
    stage: 'Execution',
    status: 'IN PROGRESS',
    billing: 'Urban Cars',
    totalAmount: '640,00',
    netAmount: '537,82',
    taxAmount: '102,18',
    dueDate: '15.04.2024',
  },
  {
    id: 'txn-014826504-handover',
    workOrderId: 'wo-bg-1005',
    transactionType: 'Workshop',
    stage: 'Handover',
    status: 'READY',
    billing: 'City Taxi GmbH',
    totalAmount: '730,00',
    netAmount: '613,45',
    taxAmount: '116,55',
    dueDate: '15.04.2024',
  },
  {
    id: 'txn-014826505-followup',
    workOrderId: 'wo-bg-1006',
    transactionType: 'Workshop',
    stage: 'Follow-Up',
    status: 'DONE',
    billing: 'Logistik Süd',
    totalAmount: '455,00',
    netAmount: '382,35',
    taxAmount: '72,65',
    dueDate: '16.04.2024',
  },
];

export function findWorkOrderByIdOrReference(idOrReference: string | null | undefined): WorkOrder | undefined {
  if (!idOrReference) return undefined;
  return MOCK_WORK_ORDERS.find(order => order.id === idOrReference || order.referenceNumber === idOrReference);
}

export function findTransactionById(id: string | null | undefined): MockTransaction | undefined {
  if (!id) return undefined;
  return MOCK_TRANSACTIONS.find(transaction => transaction.id === id);
}

export function getTransactionsForOrder(workOrderId: string): MockTransaction[] {
  return MOCK_TRANSACTIONS.filter(transaction => transaction.workOrderId === workOrderId);
}
