import { Job } from './job.model';

export type WorkOrderStatus = 'new' | 'edit' | 'preparation' | 'complete' | 'settings' | 'handover' | 'follow-up';

export interface Vehicle {
  id: string;
  licensePlate: string;
  make: string;
  model: string;
  vin?: string;
  mileage?: number;
  location?: string;
}

export interface Customer {
  id: string;
  name: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
}

export interface WorkOrder {
  id: string;
  referenceNumber: string;
  status: WorkOrderStatus;
  vehicle: Vehicle;
  customer: Customer;
  billingParty?: Customer;
  jobs: Job[];
  createdAt: Date;
  updatedAt: Date;
  appointmentStart?: Date;
  appointmentEnd?: Date;
  notes?: string;
}
