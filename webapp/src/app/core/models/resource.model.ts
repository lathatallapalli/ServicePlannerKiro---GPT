export type ResourceType = 'mechanic' | 'bay' | 'advisor' | 'driver' | 'device';

export interface Qualification {
  id: string;
  name: string;
}

export interface ResourceGroup {
  id: string;
  name: string;
  resourceType: ResourceType;
}

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  qualifications: Qualification[];
  groupId?: string;
  avatarUrl?: string;
}
