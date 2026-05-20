import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GenericListColumn, GenericListComponent } from '../../shared/components/generic-list/generic-list.component';
import { PendingCatalogResource } from '../resource-catalog/data/resource-catalog-selection.service';
import { RESOURCE_CATALOG_GROUPS } from '../resource-catalog/data/resource-catalog.mock';
import { ResourceViewsService } from '../service-planner/services/resource-views.service';

interface ResourceViewGroup {
  label: string;
  children: Array<string | ResourceViewGroup>;
}

interface ResourceViewState {
  label?: string;
  value?: string;
  resourceIds?: string[];
  groups?: ResourceViewGroup[];
}

interface ResourceRow extends Record<string, unknown> {
  id: string;
  name: string;
  group: string;
  subgroup: string;
  status: string;
}


@Component({
  selector: 'app-resource-view-editor',
  standalone: true,
  imports: [CommonModule, GenericListComponent],
  templateUrl: './resource-view-editor.component.html',
  styleUrl: './resource-view-editor.component.scss',
})
export class ResourceViewEditorComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly resourceViewsService = inject(ResourceViewsService);
  private readonly catalogResourcesByName = new Map(
    RESOURCE_CATALOG_GROUPS.flatMap(group => group.resources.map(resource => [resource.name, resource] as const))
  );

  protected readonly columns: GenericListColumn<ResourceRow>[] = [
    { key: 'name', label: 'Resource', sortable: true, filterable: true, minWidth: '220px' },
    { key: 'group', label: 'Group', sortable: true, filterable: true, minWidth: '180px' },
    { key: 'subgroup', label: 'Subgroup', sortable: true, filterable: true, minWidth: '220px' },
    { key: 'status', label: 'Status', sortable: true, filterable: true, minWidth: '140px' },
  ];

  protected readonly resourceView = computed<ResourceViewState>(() => {
    const navigationState = history.state?.resourceView as ResourceViewState | undefined;
    const routeViewId = this.route.snapshot.paramMap.get('viewId') ?? this.route.snapshot.queryParamMap.get('view') ?? undefined;
    const fallbackView = this.resourceViewsService.getByValue(routeViewId);

    return {
      label: navigationState?.label ?? fallbackView?.label ?? this.route.snapshot.queryParamMap.get('label') ?? (routeViewId === 'new' ? 'New View' : 'Resource View'),
      value: navigationState?.value ?? fallbackView?.value ?? (routeViewId === 'new' ? 'new-view' : routeViewId),
      resourceIds: navigationState?.resourceIds ?? fallbackView?.resourceIds ?? [],
      groups: navigationState?.groups ?? fallbackView?.groups ?? [],
    };
  });

  protected readonly addedResources = signal<ResourceRow[]>(this.getAddedResources());

  protected readonly resourceRows = computed<ResourceRow[]>(() =>
    this.mergeRows(this.flattenGroups(this.resourceView().groups ?? []), this.addedResources())
  );

  protected isGroup(child: string | ResourceViewGroup): child is ResourceViewGroup {
    return typeof child !== 'string';
  }

  protected onListAction(event: unknown): void {
    console.log('Resource list action', event);
  }

  protected onAddResource(): void {
    const viewId = this.resourceView().value;
    const returnTo = this.route.snapshot.queryParamMap.get('returnTo');
    const editorReturnTo = viewId ? `/resource-views/${viewId}/edit` : undefined;
    this.router.navigate(['/resource-catalog'], {
      queryParams: editorReturnTo
        ? { returnTo: editorReturnTo, ...(returnTo ? { plannerReturnTo: returnTo } : {}) }
        : undefined,
      state: { resourceView: this.resourceView() },
    });
  }

  private getAddedResources(): ResourceRow[] {
    const addedResources = history.state?.addedResources as PendingCatalogResource[] | undefined;
    return (addedResources ?? []).map(resource => ({
      id: resource.id,
      name: resource.name,
      group: resource.group,
      subgroup: resource.subgroup || 'NA',
      status: resource.status || 'Active',
    }));
  }

  private mergeRows(existingRows: ResourceRow[], addedRows: ResourceRow[]): ResourceRow[] {
    const existingIds = new Set(existingRows.map(row => row.id));
    return [...existingRows, ...addedRows.filter(row => !existingIds.has(row.id))];
  }

  private flattenGroups(groups: ResourceViewGroup[]): ResourceRow[] {
    return groups.flatMap(group => this.flattenChildren(group.children, group.label));
  }

  private flattenChildren(children: Array<string | ResourceViewGroup>, group: string, subgroup = ''): ResourceRow[] {
    return children.flatMap(child => {
      if (this.isGroup(child)) {
        return this.flattenChildren(child.children, group, child.label);
      }

      return [{
        id: this.catalogResourcesByName.get(child)?.id ?? `${group}-${subgroup}-${child}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: child,
        group,
        subgroup: subgroup || 'NA',
        status: 'Active',
      }];
    });
  }

}




