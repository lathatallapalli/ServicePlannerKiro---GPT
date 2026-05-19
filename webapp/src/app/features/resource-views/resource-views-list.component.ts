import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GenericListColumn, GenericListComponent, GenericListRowAction } from '../../shared/components/generic-list/generic-list.component';
import { DEMO_RESOURCE_VIEWS } from '../service-planner/data/resource-views.mock';
import { ResourceFavoriteView } from '../service-planner/services/planner-settings.service';

interface ResourceViewRow extends Record<string, unknown>, ResourceFavoriteView {
  id: string;
  resourceCount: number;
}

@Component({
  selector: 'app-resource-views-list',
  standalone: true,
  imports: [CommonModule, GenericListComponent],
  templateUrl: './resource-views-list.component.html',
  styleUrl: './resource-views-list.component.scss',
})
export class ResourceViewsListComponent {
  protected readonly columns: GenericListColumn<ResourceViewRow>[] = [
    { key: 'label', label: 'Resource view', sortable: true, filterable: true, minWidth: '240px' },
    { key: 'resourceCount', label: 'Resources', sortable: true, filterable: true, minWidth: '140px' },
  ];

  protected readonly rowActions: GenericListRowAction[] = [
    { id: 'open', label: 'Open', icon: 'launch' },
  ];

  protected readonly rows: ResourceViewRow[] = DEMO_RESOURCE_VIEWS.map((view, index) => ({
    ...view,
    id: view.value ?? `resource-view-${index + 1}`,
    resourceCount: view.resourceIds.length,
  }));

  constructor(private router: Router, private route: ActivatedRoute) {}

  protected onOpenView(event: { action: GenericListRowAction; row: ResourceViewRow }): void {
    const returnTo = this.route.snapshot.queryParamMap.get('returnTo') ?? '/service-planner';
    this.router.navigate(['/resource-views', event.row.value ?? event.row.id, 'edit'], {
      queryParams: { returnTo: '/resource-views', plannerReturnTo: returnTo },
      state: { resourceView: event.row },
    });
  }
}
