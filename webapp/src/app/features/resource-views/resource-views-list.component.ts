import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GenericListColumn, GenericListComponent, GenericListRowAction, GenericListToolbarAction } from '../../shared/components/generic-list/generic-list.component';
import { ResourceFavoriteView } from '../service-planner/services/planner-settings.service';
import { PlannerSettingsService } from '../service-planner/services/planner-settings.service';
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
  protected editingCell: { rowId?: string; columnKey: string } | null = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private resourceViewsService: ResourceViewsService,
    private plannerSettings: PlannerSettingsService,
  ) {}

  protected get rows(): ResourceViewRow[] {
    return this.resourceViewsService.getAll().map((view, index) => this.toRow(view, index));
  }

  protected onAddView(): void {
    const newView = this.resourceViewsService.createNewView();
    this.selectedRows = [this.toRow(newView, this.rows.length)];
  }

  protected onSelectionChange(rows: ResourceViewRow[]): void {
    this.selectedRows = rows;
  }

  protected onToolbarAction(action: GenericListToolbarAction): void {
    if (action.id === 'edit') {
      this.editingCell = { columnKey: 'label' };
      return;
    }

    if (action.id === 'save') {
      this.saveInlineEdit();
    }
  }

  protected onEditValueChange(event: { row: ResourceViewRow; value: string }): void {
    if (!this.editingCell) return;
    const renamedView = this.resourceViewsService.rename(event.row.id, event.value);
    if (renamedView && this.plannerSettings.selectedResourceView()?.value === renamedView.value) {
      this.plannerSettings.setResourceView(renamedView);
    }
  }

  protected saveInlineEdit(): void {
    if (!this.editingCell) return;
    this.editingCell = null;
  }

  protected onOpenView(event: { action: GenericListRowAction; row: ResourceViewRow }): void {
    const returnTo = this.route.snapshot.queryParamMap.get('returnTo') ?? '/service-planner';
    const listReturnParams = new URLSearchParams({ returnTo });
    const selectedViewValue = this.route.snapshot.queryParamMap.get('selectedViewValue');
    if (selectedViewValue) listReturnParams.set('selectedViewValue', selectedViewValue);

    this.router.navigate(['/resource-views', event.row.value ?? event.row.id, 'edit'], {
      queryParams: {
        returnTo: `/resource-views?${listReturnParams.toString()}`,
        plannerReturnTo: returnTo,
        selectedViewValue,
      },
      state: { resourceView: event.row },
    });
  }

  private toRow(view: ResourceFavoriteView, index: number): ResourceViewRow {
    return {
      ...view,
      id: view.value ?? `resource-view-${index + 1}`,
      resourceCount: view.resourceIds.length,
    };
  }
}
