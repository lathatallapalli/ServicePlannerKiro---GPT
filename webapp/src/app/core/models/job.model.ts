import { ResourceType, Qualification } from './resource.model';

export type JobStatus = 'unscheduled' | 'scheduled' | 'in-progress' | 'completed' | 'cancelled';

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
  estimatedDurationMinutes: number;
  // Legacy single-resource field (kept for backwards compat)
  requiredResourceType: ResourceType;
  requiredQualifications: Qualification[];
  // Multi-resource requirements
  resourceRequirements?: JobResourceRequirement[];
  status: JobStatus;
  assignedResourceId?: string;
  scheduledStart?: Date;
  scheduledEnd?: Date;
  actualStart?: Date;
  actualEnd?: Date;
}
