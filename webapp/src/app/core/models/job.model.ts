import { ResourceType, Qualification } from './resource.model';

export type JobStatus = 'unscheduled' | 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
export type WorkorderItemStatus = 'scheduled' | 'started' | 'completed';
export type WorkorderItemCategory = 'job' | 'activity';

export interface JobResourceRequirement {
  resourceType: ResourceType;
  requiredQualifications: Qualification[];
  label?: string; // display label e.g. "Mechanic", "Service Bay"
}

export interface Job {
  id: string;
  workOrderId: string;
  title: string;
  description?: string;
  fru: number;
  estimatedDurationMinutes: number;
  // Legacy single-resource field (kept for backwards compat)
  requiredResourceType: ResourceType;
  requiredQualifications: Qualification[];
  // Multi-resource requirements
  resourceRequirements?: JobResourceRequirement[];
  status: JobStatus;
  workorderItemStatus?: WorkorderItemStatus;
  workorderItemCategory?: WorkorderItemCategory;
  assignedResourceId?: string;
  scheduledStart?: Date;
  scheduledEnd?: Date;
  actualStart?: Date;
  actualEnd?: Date;
}
