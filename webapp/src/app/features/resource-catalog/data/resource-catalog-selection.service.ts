import { Injectable } from '@angular/core';
import { ResourceCatalogGroup, ResourceCatalogResource } from './resource-catalog.mock';

export interface PendingCatalogResource {
  id: string;
  name: string;
  group: string;
  subgroup: string;
  status: string;
}

@Injectable({ providedIn: 'root' })
export class ResourceCatalogSelectionService {
  private pendingResources: PendingCatalogResource[] = [];

  setSelection(group: ResourceCatalogGroup | undefined, resources: ResourceCatalogResource[]): void {
    this.pendingResources = group
      ? resources.map(resource => ({
          id: resource.id,
          name: resource.name,
          group: group.label,
          subgroup: 'NA',
          status: 'Active',
        }))
      : [];
  }

  consumeSelection(): PendingCatalogResource[] {
    const resources = [...this.pendingResources];
    this.pendingResources = [];
    return resources;
  }

  clear(): void {
    this.pendingResources = [];
  }
}
