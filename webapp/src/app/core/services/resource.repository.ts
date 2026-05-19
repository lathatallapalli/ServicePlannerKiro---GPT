import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Resource, ResourceGroup, ResourceType } from '../models/resource.model';

@Injectable()
export abstract class ResourceRepository {
  abstract getAll(): Observable<Resource[]>;
  abstract getByType(type: ResourceType): Observable<Resource[]>;
  abstract getGroups(): Observable<ResourceGroup[]>;
  abstract getById(id: string): Observable<Resource | null>;
}
