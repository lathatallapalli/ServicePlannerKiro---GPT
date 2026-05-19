import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ResourceRepository } from '../resource.repository';
import { Resource, ResourceGroup, ResourceType } from '../../models/resource.model';
import { MOCK_RESOURCES, MOCK_GROUPS } from './mock-data';

@Injectable({ providedIn: 'root' })
export class MockResourceRepository extends ResourceRepository {
  private resources: Resource[] = MOCK_RESOURCES;
  private groups: ResourceGroup[] = MOCK_GROUPS;

  getAll(): Observable<Resource[]> {
    return of([...this.resources]);
  }

  getByType(type: ResourceType): Observable<Resource[]> {
    return of(this.resources.filter(r => r.type === type));
  }

  getGroups(): Observable<ResourceGroup[]> {
    return of([...this.groups]);
  }

  getById(id: string): Observable<Resource | null> {
    return of(this.resources.find(r => r.id === id) ?? null);
  }
}
