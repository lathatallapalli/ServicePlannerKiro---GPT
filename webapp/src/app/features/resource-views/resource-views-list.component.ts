import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GenericListColumn, GenericListComponent, GenericListRowAction, GenericListToolbarAction } from '../../shared/components/generic-list/generic-list.component';
import { ResourceFavoriteView } from '../service-planner/services/planner-settings.service';
import { ResourceViewsService } from '../service-planner/services/resource-views.service';

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

  protected get toolbarActions(): GenericListToolbarAction[] {
    return [
      { id: 'settings', label: 'View settings', icon: 'settings-view' },
      { id: 'clear-filter', label: 'Clear filters', icon: 'filter-remove', disabled: true },
      { id: 'edit', label: 'Edit', icon: 'edit' },
      { id: 'delete', label: 'Delete', icon: 'trash-can', disabled: true },
      { id: 'save', label: 'Save', icon: 'save', disabled: !this.editingCell },
    ];
  }

  protected selectedRows: ResourceViewRow[] = [];
  protected editingCell: { columnKey: string } | null = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private resourceViewsService: ResourceViewsService,
  ) {}

  protected get rows(): ResourceViewRow[] {
    return this.resourceViewsService.getAll().map((view, index) => ({
      ...view,
      id: view.value ?? `resource-view-${index + 1}`,
      resourceCount: view.resourceIds.length,
    }));
  }

  protected onAddView(): void {
    const returnTo = this.route.snapshot.queryParamMap.get('returnTo') ?? '/service-planner';
    const newView = this.resourceViewsService.createNewView();
    this.router.navigate(['/resource-catalog'], {
      queryParams: { returnTo: `/resource-views/${newView.value}/edit`, plannerReturnTo: returnTo, listReturnTo: '/resource-views' },
      state: { resourceView: newView },
    });
  }

  protected onSelectionChange(rows: ResourceViewRow[]): void {
    this.selectedRows = rows;
  }

  protected onToolbarAction(action: GenericListToolbarAction): void {
    if (action.id === 'edit') {
      const row = this.selectedRows[0] ?? this.rows[0];
      if (!row) return;
      this.editingCell = { columnKey: 'label' };
      return;
    }

    if (action.id === 'save') {
      this.saveInlineEdit();
    }
  }

  protected onEditValueChange(event: { row: ResourceViewRow; value: string }): void {
    if (!this.editingCell) return;
    this.resourceViewsService.rename(event.row.id, event.value);
  }

  protected saveInlineEdit(): void {
    if (!this.editingCell) return;
    this.editingCell = null;
  }

  protected onOpenView(event: { action: GenericListRowAction; row: ResourceViewRow }): void {
    const returnTo = this.route.snapshot.queryParamMap.get('returnTo') ?? '/service-planner';
    this.router.navigate(['/resource-views', event.row.value ?? event.row.id, 'edit'], {
      queryParams: { returnTo: '/resource-views', plannerReturnTo: returnTo },
      state: { resourceView: event.row },
    });
  }
}
