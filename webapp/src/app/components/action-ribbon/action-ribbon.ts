import { Component, Input, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface DropdownOption {
  label: string;
  value: string;
  resourceIds?: string[];
  groups?: ResourceViewGroup[];
}

export interface ResourceViewGroup {
  label: string;
  children: Array<string | ResourceViewGroup>;
}

export interface ActionRibbonItem {
  label: string;
  type: 'link' | 'dropdown';
  icon?: string | string[];
  iconViewBox?: string;
  disabled?: boolean;
  variant?: 'default' | 'resource-view';
  options?: DropdownOption[];
  selectedValue?: string;
  action?: () => void;
  onSelect?: (option: DropdownOption) => void;
  onAddView?: () => void;
  onEditView?: (option: DropdownOption | undefined) => void;
}

@Component({
  selector: 'app-action-ribbon',
  imports: [CommonModule],
  templateUrl: './action-ribbon.html',
  styleUrl: './action-ribbon.scss',
})
export class ActionRibbon {
  @Input() items: ActionRibbonItem[] = [
    {
      label: 'Undo',
      type: 'link',
      icon: 'M15 7.5H5.86117L8.55172 4.81058L7.5 3.75L3 8.25L7.5 12.75L8.55172 11.689L5.86343 9H15C16.1935 9 17.3381 9.47411 18.182 10.318C19.0259 11.1619 19.5 12.3065 19.5 13.5C19.5 14.6935 19.0259 15.8381 18.182 16.682C17.3381 17.5259 16.1935 18 15 18H9V19.5H15C16.5913 19.5 18.1174 18.8679 19.2426 17.7426C20.3679 16.6174 21 15.0913 21 13.5C21 11.9087 20.3679 10.3826 19.2426 9.25736C18.1174 8.13214 16.5913 7.5 15 7.5Z',
    },
    {
      label: 'View',
      type: 'dropdown',
      options: [
        { label: 'Day', value: 'day' },
        { label: 'Week', value: 'week' },
        { label: 'Month', value: 'month' },
      ],
      selectedValue: 'week',
    },
    {
      label: 'Scheduler Timescale',
      type: 'dropdown',
      options: [
        { label: '15 minutes', value: '15min' },
        { label: '30 minutes', value: '30min' },
        { label: '1 hour', value: '1hr' },
        { label: '2 hours', value: '2hr' },
      ],
      selectedValue: '1hr',
    },
    {
      label: 'Settings',
      type: 'link',
      iconViewBox: '0 0 32 32',
      icon: [
        'M27,16.76c0-.25,0-.5,0-.76s0-.51,0-.77l1.92-1.68A2,2,0,0,0,29.3,11L26.94,7a2,2,0,0,0-1.73-1,2,2,0,0,0-.64.1l-2.43.82a11.35,11.35,0,0,0-1.31-.75l-.51-2.52a2,2,0,0,0-2-1.61H13.64a2,2,0,0,0-2,1.61l-.51,2.52a11.48,11.48,0,0,0-1.32.75L7.43,6.06A2,2,0,0,0,6.79,6,2,2,0,0,0,5.06,7L2.7,11a2,2,0,0,0,.41,2.51L5,15.24c0,.25,0,.5,0,.76s0,.51,0,.77L3.11,18.45A2,2,0,0,0,2.7,21L5.06,25a2,2,0,0,0,1.73,1,2,2,0,0,0,.64-.1l2.43-.82a11.35,11.35,0,0,0,1.31.75l.51,2.52a2,2,0,0,0,2,1.61h4.72a2,2,0,0,0,2-1.61l.51-2.52a11.48,11.48,0,0,0,1.32-.75l2.42.82a2,2,0,0,0,.64.1,2,2,0,0,0,1.73-1L29.3,21a2,2,0,0,0-.41-2.51ZM25.21,24l-3.43-1.16a8.86,8.86,0,0,1-2.71,1.57L18.36,28H13.64l-.71-3.55a9.36,9.36,0,0,1-2.7-1.57L6.79,24,4.43,20l2.72-2.4a8.9,8.9,0,0,1,0-3.13L4.43,12,6.79,8l3.43,1.16a8.86,8.86,0,0,1,2.71-1.57L13.64,4h4.72l.71,3.55a9.36,9.36,0,0,1,2.7,1.57L25.21,8,27.57,12l-2.72,2.4a8.9,8.9,0,0,1,0,3.13L27.57,20Z',
        'M16,22a6,6,0,1,1,6-6A5.94,5.94,0,0,1,16,22Zm0-10a3.91,3.91,0,0,0-4,4,3.91,3.91,0,0,0,4,4,3.91,3.91,0,0,0,4-4A3.91,3.91,0,0,0,16,12Z',
      ],
    },
  ];

  readonly chevronPath = 'M12 16.5031L4.5 9.00313L5.55 7.95312L12 14.4031L18.45 7.95312L19.5 9.00313L12 16.5031Z';
  readonly chevronUpPath = 'M12 7.50078L19.5 15.0008L18.45 16.0508L12 9.60078L5.55 16.0508L4.5 15.0008L12 7.50078Z';
  readonly checkmarkPath = 'M8.125 15.0009L2.5 9.37594L3.38375 8.49219L8.125 13.2328L16.6163 4.74219L17.5 5.62594L8.125 15.0009Z';
  readonly checkboxPath = 'M16.25 2.5H3.75C3.41848 2.5 3.10054 2.6317 2.86612 2.86612C2.6317 3.10054 2.5 3.41848 2.5 3.75V16.25C2.5 16.5815 2.6317 16.8995 2.86612 17.1339C3.10054 17.3683 3.41848 17.5 3.75 17.5H16.25C16.5815 17.5 16.8995 17.3683 17.1339 17.1339C17.3683 16.8995 17.5 16.5815 17.5 16.25V3.75C17.5 3.41848 17.3683 3.10054 17.1339 2.86612C16.8995 2.6317 16.5815 2.5 16.25 2.5ZM3.75 16.25V3.75H16.25V16.25H3.75Z';
  readonly checkedCheckboxPath = 'M16.25 2.5H3.75C3.41848 2.5 3.10054 2.6317 2.86612 2.86612C2.6317 3.10054 2.5 3.41848 2.5 3.75V16.25C2.5 16.5815 2.6317 16.8995 2.86612 17.1339C3.10054 17.3683 3.41848 17.5 3.75 17.5H16.25C16.5815 17.5 16.8995 17.3683 17.1339 17.1339C17.3683 16.8995 17.5 16.5815 17.5 16.25V3.75C17.5 3.41848 17.3683 3.10054 17.1339 2.86612C16.8995 2.6317 16.5815 2.5 16.25 2.5ZM8.75 13.4375L5.625 10.3392L6.61925 9.375L8.75 11.466L13.3804 6.875L14.3753 7.86075L8.75 13.4375Z';
  readonly chevronRightPath = 'M13.75 10L7.5 16.25L6.625 15.375L12 10L6.625 4.625L7.5 3.75L13.75 10Z';
  readonly addAltPath = 'M1.25 10C1.25 5.1875 5.1875 1.25 10 1.25C14.8125 1.25 18.75 5.1875 18.75 10C18.75 14.8125 14.8125 18.75 10 18.75C5.1875 18.75 1.25 14.8125 1.25 10ZM10 2.5C14.125 2.5 17.5 5.875 17.5 10C17.5 14.125 14.125 17.5 10 17.5C5.875 17.5 2.5 14.125 2.5 10C2.5 5.875 5.875 2.5 10 2.5ZM15.25 9.625H10.875V5.25H9.625V9.625H5.25V10.875H9.625V15.25H10.875V10.875H15.25V9.625Z';
  readonly launchPath = 'M16.25 17.5H3.75C3.06003 17.4991 2.50093 16.94 2.5 16.25V3.75C2.50093 3.06003 3.06003 2.50093 3.75 2.5H10V3.75H3.75V16.25H16.25V10H17.5V16.25C17.4991 16.94 16.94 17.4991 16.25 17.5ZM12.5 1.25V2.5H16.6163L11.25 7.86625L12.1337 8.75L17.5 3.38375V7.5H18.75V1.25H12.5Z';

  iconPaths(icon: string | string[] | undefined): string[] {
    if (!icon) return [];
    return Array.isArray(icon) ? icon : [icon];
  }

  openDropdownIndex: number | null = null;
  previewResourceViewValue: string | null = null;

  toggleDropdown(index: number, event: Event): void {
    event.stopPropagation();
    if (this.items[index]?.disabled) return;
    if (this.openDropdownIndex === index) {
      this.openDropdownIndex = null;
      this.previewResourceViewValue = null;
      return;
    }
    this.openDropdownIndex = index;
    this.previewResourceViewValue = null;
  }

  selectOption(item: ActionRibbonItem, option: DropdownOption, event: Event): void {
    event.stopPropagation();
    item.selectedValue = option.value;
    if (item.variant !== 'resource-view') {
      this.openDropdownIndex = null;
    }
    item.onSelect?.(option);
  }

  selectResourceView(item: ActionRibbonItem, option: DropdownOption, event: Event): void {
    event.stopPropagation();
    item.selectedValue = option.value;
    item.onSelect?.(option);
  }

  previewResourceView(option: DropdownOption, event: Event): void {
    event.stopPropagation();
    this.previewResourceViewValue = option.value;
  }

  addResourceView(item: ActionRibbonItem, event: Event): void {
    event.stopPropagation();
    item.onAddView?.();
  }

  editResourceView(item: ActionRibbonItem, event: Event): void {
    event.stopPropagation();
    item.onEditView?.(this.getActiveResourceView(item));
  }

  getSelectedResourceView(item: ActionRibbonItem): DropdownOption | undefined {
    return item.options?.find(option => option.value === this.previewResourceViewValue);
  }

  getActiveResourceView(item: ActionRibbonItem): DropdownOption | undefined {
    return item.options?.find(option => option.value === (this.previewResourceViewValue ?? item.selectedValue));
  }

  isResourceViewGroup(child: string | ResourceViewGroup): child is ResourceViewGroup {
    return typeof child !== 'string';
  }

  @HostListener('document:click')
  closeDropdowns(): void {
    this.openDropdownIndex = null;
    this.previewResourceViewValue = null;
  }
}
