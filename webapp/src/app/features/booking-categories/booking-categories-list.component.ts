import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BookingCategory, BookingCategoryApplyScope } from '../../core/models/schedule.model';
import { GenericListColumn, GenericListComponent, GenericListRowAction, GenericListToolbarAction } from '../../shared/components/generic-list/generic-list.component';
import { BookingCategoriesService } from './booking-categories.service';

interface BookingCategoryRow extends Record<string, unknown>, BookingCategory {
  scopeLabel: string;
}

@Component({
  selector: 'app-booking-categories-list',
  standalone: true,
  imports: [CommonModule, FormsModule, GenericListComponent],
  templateUrl: './booking-categories-list.component.html',
  styleUrl: './booking-categories-list.component.scss',
})
export class BookingCategoriesListComponent {
  readonly scopes: Array<{ value: BookingCategoryApplyScope; label: string }> = [
    { value: 'entry', label: 'Selected booking only' },
    { value: 'booking-set', label: 'Related booking set' },
    { value: 'order', label: 'Whole order' },
  ];

  readonly columns: GenericListColumn<BookingCategoryRow>[] = [
    { key: 'label', label: 'Category', cellType: 'input', sortable: true, filterable: true, minWidth: '220px' },
    { key: 'color', label: 'Hex', cellType: 'color', sortable: true, filterable: true, minWidth: '140px' },
    { key: 'appliesTo', label: 'Apply scope', cellType: 'select', options: this.scopes, sortable: true, filterable: true, minWidth: '240px' },
    { key: 'description', label: 'Description', cellType: 'input', sortable: true, filterable: true, minWidth: '360px' },
  ];

  readonly rowActions: GenericListRowAction[] = [
    { id: 'launch', label: 'Open category card', icon: 'launch' },
  ];

  get toolbarActions(): GenericListToolbarAction[] {
    return [
      { id: 'edit', label: 'Edit categories', icon: 'edit', disabled: false },
      { id: 'delete', label: 'Delete', icon: 'trash-can', disabled: this.selectedRows.length === 0 },
      { id: 'save', label: 'Save', icon: 'save', disabled: !this.inlineEditEnabled && !this.editingCell },
    ];
  }

  searchTerm = '';
  selectedRows: BookingCategoryRow[] = [];
  inlineEditEnabled = false;
  editingCell: { rowId?: string; columnKey: string } | null = null;

  constructor(
    private categoriesService: BookingCategoriesService,
    private router: Router,
  ) {}

  get rows(): BookingCategoryRow[] {
    const query = this.searchTerm.trim().toLowerCase();
    const categories = this.categoriesService.getAll().map(category => this.toRow(category));
    if (!query) return categories;
    return categories.filter(category =>
      [category.label, category.description, category.scopeLabel, category.color]
        .filter(Boolean)
        .some(value => value!.toLowerCase().includes(query))
    );
  }

  addCategory(): void {
    this.categoriesService.createNewCategory();
  }

  updateCategory(category: BookingCategoryRow | BookingCategory, changes: Partial<BookingCategory>): void {
    this.categoriesService.update(category.id, changes);
  }

  deleteCategory(category: BookingCategoryRow | BookingCategory): void {
    if (category.isSystem) return;
    this.categoriesService.delete(category.id);
  }

  onSelectionChange(rows: BookingCategoryRow[]): void {
    this.selectedRows = rows;
  }

  onToolbarAction(action: GenericListToolbarAction): void {
    if (action.id === 'edit') {
      this.inlineEditEnabled = true;
      return;
    }
    if (action.id === 'delete' && this.selectedRows.length > 0) {
      this.selectedRows.forEach(row => this.deleteCategory(row));
      this.selectedRows = [];
      return;
    }
    if (action.id === 'save') this.saveInlineEdit();
  }

  onRowAction(event: { action: { id: string }; row: BookingCategoryRow }): void {
    if (event.action.id === 'launch') {
      this.router.navigate(['/booking-categories', event.row.id]);
      return;
    }
    if (event.action.id === 'edit') {
      this.selectedRows = [event.row];
      this.editingCell = { rowId: event.row.id, columnKey: 'label' };
      return;
    }
    if (event.action.id === 'delete') this.deleteCategory(event.row);
  }

  onEditValueChange(event: { row: BookingCategoryRow; value: string; columnKey?: string }): void {
    if (event.columnKey === 'appliesTo') {
      this.updateCategory(event.row, { appliesTo: event.value as BookingCategoryApplyScope });
      return;
    }
    if (event.columnKey === 'description') {
      this.updateCategory(event.row, { description: event.value });
      return;
    }
    if (event.columnKey === 'color') {
      this.updateCategory(event.row, { color: event.value });
      return;
    }
    this.updateCategory(event.row, { label: event.value });
  }

  saveInlineEdit(): void {
    this.inlineEditEnabled = false;
    this.editingCell = null;
  }

  close(): void {
    this.router.navigate(['/service-planner']);
  }

  getScopeLabel(scope: BookingCategoryApplyScope): string {
    return this.scopes.find(candidate => candidate.value === scope)?.label ?? scope;
  }

  private toRow(category: BookingCategory): BookingCategoryRow {
    return {
      ...category,
      scopeLabel: this.getScopeLabel(category.appliesTo),
      description: category.description ?? '',
    };
  }
}
