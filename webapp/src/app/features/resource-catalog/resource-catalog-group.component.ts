import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { GenericListColumn, GenericListComponent } from '../../shared/components/generic-list/generic-list.component';
import { ResourceCatalogSelectionService } from './data/resource-catalog-selection.service';
import { getResourceCatalogGroup, ResourceCatalogResource } from './data/resource-catalog.mock';

interface ResourceCatalogRow extends ResourceCatalogResource, Record<string, unknown> {}

@Component({
  selector: 'app-resource-catalog-group',
  standalone: true,
  imports: [CommonModule, GenericListComponent],
  templateUrl: './resource-catalog-group.component.html',
  styleUrl: './resource-catalog-group.component.scss',
})
export class ResourceCatalogGroupComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly selectionService = inject(ResourceCatalogSelectionService);

  protected readonly group = computed(() => getResourceCatalogGroup(this.route.snapshot.paramMap.get('groupId')));
  protected readonly rows = computed<ResourceCatalogRow[]>(() =>
    (this.group()?.resources ?? []).map(resource => ({ ...resource }))
  );
  protected readonly selectedResources = new Set<string>();

  protected readonly columns: GenericListColumn<ResourceCatalogRow>[] = [
    { key: 'name', label: 'Resource', sortable: true, filterable: true, minWidth: '240px' },
    { key: 'code', label: 'Code', sortable: true, filterable: true, minWidth: '160px' },
    { key: 'description', label: 'Description', sortable: true, filterable: true, minWidth: '320px' },
    { key: 'status', label: 'Status', sortable: true, filterable: true, minWidth: '160px' },
  ];

  protected onSelectionChange(resources: ResourceCatalogRow[]): void {
    this.selectedResources.clear();
    resources.forEach(resource => this.selectedResources.add(resource.id));
    this.selectionService.setSelection(this.group(), resources);
  }
}
