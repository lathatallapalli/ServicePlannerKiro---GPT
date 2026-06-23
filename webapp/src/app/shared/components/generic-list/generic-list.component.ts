import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

export type GenericListActionId = 'settings' | 'clear-filter' | 'edit' | 'delete' | 'save' | 'add' | string;

export interface GenericListColumn<T = Record<string, unknown>> {
  key: keyof T & string;
  label: string;
  cellType?: 'text' | 'color' | 'input' | 'select';
  options?: Array<{ label: string; value: string }>;
  width?: string;
  minWidth?: string;
  maxWidth?: string;
  sortable?: boolean;
  filterable?: boolean;
  formatter?: (row: T) => string;
}

export interface GenericListToolbarAction {
  id: GenericListActionId;
  label: string;
  icon: 'settings-view' | 'filter-remove' | 'edit' | 'trash-can' | 'save' | 'add' | 'launch' | 'search';
  disabled?: boolean;
  variant?: 'icon' | 'primary' | 'secondary';
}

export interface GenericListRowAction {
  id: string;
  label: string;
  icon?: 'launch' | 'edit' | 'trash-can' | 'play';
  disabled?: boolean;
}

export interface GenericListSort<T = Record<string, unknown>> {
  key: keyof T & string;
  direction: 'asc' | 'desc';
}

@Component({
  selector: 'app-generic-list',
  imports: [CommonModule, FormsModule],
  templateUrl: './generic-list.component.html',
  styleUrl: './generic-list.component.scss',
})
export class GenericListComponent<T extends Record<string, unknown> = Record<string, unknown>> {
  @Input() columns: GenericListColumn<T>[] = [];
  @Input() rows: T[] = [];
  @Input() rowIdKey: keyof T & string = 'id';
  @Input() searchTerm = '';
  @Input() searchPlaceholder = 'Search input text';
  @Input() searchButtonLabel = 'Search';
  @Input() addButtonLabel = 'Add new';
  @Input() showAddButton = true;
  @Input() selectable = true;
  @Input() fitContent = false;
  @Input() inlineEditEnabled = false;
  @Input() editableCell?: { rowId?: string; columnKey: string; value?: string } | null = null;
  @Input() rowActions: GenericListRowAction[] = [{ id: 'open', label: 'Open', icon: 'launch' }];
  @Input() toolbarActions: GenericListToolbarAction[] = [
    { id: 'settings', label: 'View settings', icon: 'settings-view' },
    { id: 'clear-filter', label: 'Clear filters', icon: 'filter-remove', disabled: true },
    { id: 'edit', label: 'Edit', icon: 'edit' },
    { id: 'delete', label: 'Delete', icon: 'trash-can', disabled: true },
    { id: 'save', label: 'Save', icon: 'save', disabled: true },
  ];

  @Output() search = new EventEmitter<string>();
  @Output() add = new EventEmitter<void>();
  @Output() toolbarAction = new EventEmitter<GenericListToolbarAction>();
  @Output() rowAction = new EventEmitter<{ action: GenericListRowAction; row: T }>();
  @Output() selectionChange = new EventEmitter<T[]>();
  @Output() sortChange = new EventEmitter<GenericListSort<T>>();
  @Output() editableCellValueChange = new EventEmitter<{ row: T; value: string; columnKey?: string }>();

  selectedRowIds = new Set<string>();
  sortState: GenericListSort<T> | null = null;

  get filteredRows(): T[] {
    const term = this.searchTerm.trim().toLowerCase();
    const sourceRows = term
      ? this.rows.filter(row => this.columns.some(column => this.getCellValue(row, column).toLowerCase().includes(term)))
      : [...this.rows];

    if (!this.sortState) return sourceRows;

    return sourceRows.sort((first, second) => {
      const firstValue = this.getCellValue(first, this.getColumn(this.sortState!.key)).toLowerCase();
      const secondValue = this.getCellValue(second, this.getColumn(this.sortState!.key)).toLowerCase();
      const direction = this.sortState!.direction === 'asc' ? 1 : -1;
      return firstValue.localeCompare(secondValue) * direction;
    });
  }

  get allVisibleSelected(): boolean {
    return this.filteredRows.length > 0 && this.filteredRows.every(row => this.selectedRowIds.has(this.getRowId(row)));
  }

  get hasSelection(): boolean {
    return this.selectedRowIds.size > 0;
  }

  onSearch(): void {
    this.search.emit(this.searchTerm);
  }

  onToolbarAction(action: GenericListToolbarAction): void {
    if (action.disabled) return;

    if (action.id === 'add') {
      this.add.emit();
      return;
    }

    this.toolbarAction.emit(action);
  }

  onAdd(): void {
    this.add.emit();
  }

  onRowAction(action: GenericListRowAction, row: T): void {
    if (!action.disabled) this.rowAction.emit({ action, row });
  }

  isEditingCell(row: T, column: GenericListColumn<T>): boolean {
    return this.editableCell?.columnKey === column.key && (!this.editableCell.rowId || this.editableCell.rowId === this.getRowId(row));
  }

  getEditableCellValue(row: T, column: GenericListColumn<T>): string {
    return this.editableCell?.rowId === this.getRowId(row) && this.editableCell.value !== undefined
      ? this.editableCell.value
      : this.getCellValue(row, column);
  }

  toggleSort(column: GenericListColumn<T>): void {
    if (!column.sortable) return;

    const direction = this.sortState?.key === column.key && this.sortState.direction === 'asc' ? 'desc' : 'asc';
    this.sortState = { key: column.key, direction };
    this.sortChange.emit(this.sortState);
  }

  toggleAllVisible(): void {
    if (this.allVisibleSelected) {
      this.filteredRows.forEach(row => this.selectedRowIds.delete(this.getRowId(row)));
    } else {
      this.filteredRows.forEach(row => this.selectedRowIds.add(this.getRowId(row)));
    }
    this.emitSelection();
  }

  toggleRow(row: T): void {
    const rowId = this.getRowId(row);
    if (this.selectedRowIds.has(rowId)) {
      this.selectedRowIds.delete(rowId);
    } else {
      this.selectedRowIds.add(rowId);
    }
    this.emitSelection();
  }

  isSelected(row: T): boolean {
    return this.selectedRowIds.has(this.getRowId(row));
  }

  getCellValue(row: T, column: GenericListColumn<T> | undefined): string {
    if (!column) return '';
    if (column.formatter) return column.formatter(row);
    const value = row[column.key];
    if (value === null || value === undefined) return '';
    return String(value);
  }

  getSelectOptionLabel(row: T, column: GenericListColumn<T>): string {
    const value = this.getCellValue(row, column);
    return column.options?.find(option => option.value === value)?.label ?? value;
  }

  getRowId(row: T): string {
    const value = row[this.rowIdKey];
    return value === null || value === undefined ? JSON.stringify(row) : String(value);
  }

  trackColumn(_: number, column: GenericListColumn<T>): string {
    return column.key;
  }

  trackRow = (_: number, row: T): string => this.getRowId(row);

  trackAction(_: number, action: GenericListToolbarAction | GenericListRowAction): string {
    return action.id;
  }

  private emitSelection(): void {
    this.selectionChange.emit(this.rows.filter(row => this.selectedRowIds.has(this.getRowId(row))));
  }

  private getColumn(key: string): GenericListColumn<T> | undefined {
    return this.columns.find(column => column.key === key);
  }
}


