import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import Bookmark32 from '@carbon/icons/es/bookmark/32';
import Calendar32 from '@carbon/icons/es/calendar/32';
import CalendarTools32 from '@carbon/icons/es/calendar--tools/32';
import Car32 from '@carbon/icons/es/car/32';
import CarFront32 from '@carbon/icons/es/car--front/32';
import Category32 from '@carbon/icons/es/category/32';
import CategoryAdd32 from '@carbon/icons/es/category--add/32';
import CheckmarkOutline32 from '@carbon/icons/es/checkmark--outline/32';
import DataView32 from '@carbon/icons/es/data--view/32';
import Document32 from '@carbon/icons/es/document/32';
import DocumentTasks32 from '@carbon/icons/es/document--tasks/32';
import Email32 from '@carbon/icons/es/email/32';
import Flag32 from '@carbon/icons/es/flag/32';
import Hourglass32 from '@carbon/icons/es/hourglass/32';
import Information32 from '@carbon/icons/es/information/32';
import InventoryManagement32 from '@carbon/icons/es/inventory-management/32';
import Location32 from '@carbon/icons/es/location/32';
import Money32 from '@carbon/icons/es/money/32';
import Notification32 from '@carbon/icons/es/notification/32';
import Phone32 from '@carbon/icons/es/phone/32';
import Power32 from '@carbon/icons/es/power/32';
import Search32 from '@carbon/icons/es/search/32';
import Settings32 from '@carbon/icons/es/settings/32';
import Star32 from '@carbon/icons/es/star/32';
import Tag32 from '@carbon/icons/es/tag/32';
import TagEdit32 from '@carbon/icons/es/tag--edit/32';
import Task32 from '@carbon/icons/es/task/32';
import TaskComplete32 from '@carbon/icons/es/task--complete/32';
import ToolBox32 from '@carbon/icons/es/tool-box/32';
import Tools32 from '@carbon/icons/es/tools/32';
import User32 from '@carbon/icons/es/user/32';
import UserMultiple32 from '@carbon/icons/es/user--multiple/32';
import View32 from '@carbon/icons/es/view/32';
import Warning32 from '@carbon/icons/es/warning/32';
import { BookingCategory, BookingCategoryApplyScope } from '../../core/models/booking-category.model';
import { BookingCategoriesService } from './booking-categories.service';

interface CarbonIconNode {
  elem?: string;
  attrs?: Record<string, unknown>;
  content?: unknown[];
}

interface CarbonIcon extends CarbonIconNode {
  name?: string;
  size?: number;
  content?: unknown[];
}

interface CategoryCardIcon {
  id: string;
  label: string;
  icon: CarbonIcon;
}

interface CategoryColorOption {
  label: string;
  value: string;
  tagBackground: string;
  tagColor: string;
  backgroundHex: string;
  textHex: string;
}

@Component({
  selector: 'app-booking-category-card',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './booking-category-card.component.html',
  styleUrl: './booking-category-card.component.scss',
})
export class BookingCategoryCardComponent implements OnInit {
  category: BookingCategory | null = null;
  searchTerm = '';
  iconFilter = 'All icons';
  selectedIcon = 'tag';
  isTagColorDropdownOpen = false;
  isCustomTagColor = false;
  customTagBackgroundColor = '#E0E0E0';
  customTagTextColor = '#161616';
  openSections = new Set(['category', 'tag-settings', 'tag-icon']);

  readonly scopes: Array<{ value: BookingCategoryApplyScope; label: string }> = [
    { value: 'entry', label: 'Selected booking only' },
    { value: 'booking-set', label: 'Related booking set' },
    { value: 'order', label: 'Whole order' },
  ];

  readonly colors: CategoryColorOption[] = [
    { label: 'Blue', value: '#0F62FE', tagBackground: 'var(--Tag-Blue-tag-background-blue, #D0E2FF)', tagColor: 'var(--Tag-Blue-tag-color-blue, #0043CE)', backgroundHex: '#D0E2FF', textHex: '#0043CE' },
    { label: 'Cyan', value: '#0072C3', tagBackground: 'var(--Tag-Cyan-tag-background-cyan, #BAE6FF)', tagColor: 'var(--Tag-Cyan-tag-color-cyan, #00539A)', backgroundHex: '#BAE6FF', textHex: '#00539A' },
    { label: 'Magenta', value: '#D02670', tagBackground: 'var(--Tag-Magenta-tag-background-magenta, #FFD6E8)', tagColor: 'var(--Tag-Magenta-tag-color-magenta, #9F1853)', backgroundHex: '#FFD6E8', textHex: '#9F1853' },
    { label: 'Purple', value: '#8A3FFC', tagBackground: 'var(--Tag-Purple-tag-background-purple, #E8DAFF)', tagColor: 'var(--Tag-Purple-tag-color-purple, #6929C4)', backgroundHex: '#E8DAFF', textHex: '#6929C4' },
    { label: 'Red', value: '#DA1E28', tagBackground: 'var(--Tag-Red-tag-background-red, #FFD7D9)', tagColor: 'var(--Tag-Red-tag-color-red, #A2191F)', backgroundHex: '#FFD7D9', textHex: '#A2191F' },
    { label: 'Teal', value: '#007D79', tagBackground: 'var(--Tag-Teal-tag-background-teal, #9EF0F0)', tagColor: 'var(--Tag-Teal-tag-color-teal, #005D5D)', backgroundHex: '#9EF0F0', textHex: '#005D5D' },
    { label: 'Green', value: '#198038', tagBackground: 'var(--Tag-Green-tag-background-green, #A7F0BA)', tagColor: 'var(--Tag-Green-tag-color-green, #0E6027)', backgroundHex: '#A7F0BA', textHex: '#0E6027' },
    { label: 'Yellow', value: '#F1C21B', tagBackground: 'var(--Tag-Yellow-tag-background-yellow, #FDDC69)', tagColor: 'var(--Tag-Yellow-tag-color-yellow, #684E00)', backgroundHex: '#FDDC69', textHex: '#684E00' },
    { label: 'Orange', value: '#FF832B', tagBackground: 'var(--Tag-Orange-tag-background-orange, #FFD9BE)', tagColor: 'var(--Tag-Orange-tag-color-orange, #8A3800)', backgroundHex: '#FFD9BE', textHex: '#8A3800' },
  ];

  readonly icons: CategoryCardIcon[] = [
    { id: 'tag', label: 'Tag', icon: Tag32 },
    { id: 'tag-edit', label: 'Tag edit', icon: TagEdit32 },
    { id: 'category', label: 'Category', icon: Category32 },
    { id: 'category-add', label: 'Category add', icon: CategoryAdd32 },
    { id: 'bookmark', label: 'Bookmark', icon: Bookmark32 },
    { id: 'star', label: 'Star', icon: Star32 },
    { id: 'flag', label: 'Flag', icon: Flag32 },
    { id: 'warning', label: 'Warning', icon: Warning32 },
    { id: 'checkmark-outline', label: 'Checkmark outline', icon: CheckmarkOutline32 },
    { id: 'information', label: 'Information', icon: Information32 },
    { id: 'calendar', label: 'Calendar', icon: Calendar32 },
    { id: 'calendar-tools', label: 'Calendar tools', icon: CalendarTools32 },
    { id: 'task', label: 'Task', icon: Task32 },
    { id: 'task-complete', label: 'Task complete', icon: TaskComplete32 },
    { id: 'document', label: 'Document', icon: Document32 },
    { id: 'document-tasks', label: 'Document tasks', icon: DocumentTasks32 },
    { id: 'tools', label: 'Tools', icon: Tools32 },
    { id: 'tool-box', label: 'Tool box', icon: ToolBox32 },
    { id: 'inventory-management', label: 'Inventory management', icon: InventoryManagement32 },
    { id: 'car', label: 'Car', icon: Car32 },
    { id: 'car-front', label: 'Car front', icon: CarFront32 },
    { id: 'user', label: 'User', icon: User32 },
    { id: 'user-multiple', label: 'User multiple', icon: UserMultiple32 },
    { id: 'email', label: 'Email', icon: Email32 },
    { id: 'phone', label: 'Phone', icon: Phone32 },
    { id: 'notification', label: 'Notification', icon: Notification32 },
    { id: 'location', label: 'Location', icon: Location32 },
    { id: 'money', label: 'Money', icon: Money32 },
    { id: 'data-view', label: 'Data view', icon: DataView32 },
    { id: 'view', label: 'View', icon: View32 },
    { id: 'search', label: 'Search', icon: Search32 },
    { id: 'settings', label: 'Settings', icon: Settings32 },
    { id: 'hourglass', label: 'Hourglass', icon: Hourglass32 },
    { id: 'power', label: 'Power', icon: Power32 },
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private categoriesService: BookingCategoriesService,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('categoryId');
    const category = id ? this.categoriesService.getById(id) : undefined;
    if (!category) {
      this.router.navigate(['/booking-categories']);
      return;
    }
    this.category = { ...category, description: category.description ?? '' };
    this.isCustomTagColor = !!category.tagBackgroundColor || !!category.tagTextColor;
    this.customTagBackgroundColor = category.tagBackgroundColor ?? this.selectedColorOption?.backgroundHex ?? this.customTagBackgroundColor;
    this.customTagTextColor = category.tagTextColor ?? this.selectedColorOption?.textHex ?? category.color ?? this.customTagTextColor;
  }

  get previewBackground(): string {
    if (this.isCustomTagColor) return this.customTagBackgroundColor;
    return this.selectedColorOption?.tagBackground ?? '#E0E0E0';
  }

  get previewColor(): string {
    if (this.isCustomTagColor) return this.customTagTextColor;
    return this.selectedColorOption?.tagColor ?? this.category?.color ?? '#525252';
  }

  get selectedColorOption(): CategoryColorOption | undefined {
    return this.colors.find(color => color.value.toLowerCase() === this.category?.color?.toLowerCase());
  }

  get selectedColorLabel(): string {
    if (this.isCustomTagColor) return 'Custom';
    return this.selectedColorOption?.label ?? 'Choose an option';
  }

  get tagBackgroundFieldValue(): string {
    return this.isCustomTagColor ? this.customTagBackgroundColor : this.selectedColorOption?.backgroundHex ?? '# Selected Hex';
  }

  get tagTextFieldValue(): string {
    return this.isCustomTagColor ? this.customTagTextColor : this.selectedColorOption?.textHex ?? '# Selected Hex';
  }

  get contrastRatio(): number {
    return this.getContrastRatio(this.normalizeHex(this.customTagBackgroundColor), this.normalizeHex(this.customTagTextColor));
  }

  get showContrastWarning(): boolean {
    if (!this.isCustomTagColor) return false;
    return this.contrastRatio > 0 && this.contrastRatio < 4.5;
  }

  get contrastRatioLabel(): string {
    return this.contrastRatio ? this.contrastRatio.toFixed(2) : '0.00';
  }

  toggleTagColorDropdown(): void {
    this.isTagColorDropdownOpen = !this.isTagColorDropdownOpen;
  }

  isSectionOpen(sectionId: string): boolean {
    return this.openSections.has(sectionId);
  }

  toggleSection(sectionId: string): void {
    if (this.openSections.has(sectionId)) {
      this.openSections.delete(sectionId);
      return;
    }
    this.openSections.add(sectionId);
  }

  selectColor(color: string): void {
    if (!this.category) return;
    const option = this.colors.find(candidate => candidate.value === color);
    this.isCustomTagColor = false;
    this.category = {
      ...this.category,
      color,
      tagBackgroundColor: undefined,
      tagTextColor: undefined,
    };
    if (option) {
      this.customTagBackgroundColor = option.backgroundHex;
      this.customTagTextColor = option.textHex;
    }
    this.isTagColorDropdownOpen = false;
  }

  selectCustomColor(): void {
    if (!this.category) return;
    this.isCustomTagColor = true;
    this.customTagBackgroundColor = this.selectedColorOption?.backgroundHex ?? this.customTagBackgroundColor;
    this.customTagTextColor = this.selectedColorOption?.textHex ?? this.category.color ?? this.customTagTextColor;
    this.category = {
      ...this.category,
      color: this.customTagTextColor,
      tagBackgroundColor: this.customTagBackgroundColor,
      tagTextColor: this.customTagTextColor,
    };
    this.isTagColorDropdownOpen = false;
  }

  updateCustomTagBackground(color: string): void {
    if (!this.category) return;
    this.isCustomTagColor = true;
    this.customTagBackgroundColor = this.normalizeHex(color);
    this.category = { ...this.category, tagBackgroundColor: this.customTagBackgroundColor };
  }

  updateCustomTagText(color: string): void {
    if (!this.category) return;
    this.isCustomTagColor = true;
    this.customTagTextColor = this.normalizeHex(color);
    this.category = { ...this.category, color: this.customTagTextColor, tagTextColor: this.customTagTextColor };
  }

  getIconPaths(icon: CarbonIcon): string[] {
    return this.collectIconPaths(icon.content);
  }

  private collectIconPaths(nodes: unknown[] = []): string[] {
    const paths: string[] = [];
    for (const candidate of nodes) {
      if (!candidate || typeof candidate !== 'object') continue;
      const node = candidate as CarbonIconNode;
      if (node.elem === 'path' && typeof node.attrs?.['d'] === 'string') paths.push(node.attrs['d']);
      if (node.content?.length) paths.push(...this.collectIconPaths(node.content));
    }
    return paths;
  }

  save(): void {
    if (!this.category) return;
    this.categoriesService.update(this.category.id, {
      label: this.category.label,
      appliesTo: this.category.appliesTo,
      color: this.isCustomTagColor ? this.customTagTextColor : this.category.color,
      tagBackgroundColor: this.isCustomTagColor ? this.customTagBackgroundColor : undefined,
      tagTextColor: this.isCustomTagColor ? this.customTagTextColor : undefined,
      description: this.category.description ?? '',
    });
  }

  private normalizeHex(value: string): string {
    const trimmed = value.trim();
    if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toUpperCase();
    return trimmed;
  }

  private getContrastRatio(background: string, foreground: string): number {
    const bg = this.hexToRgb(background);
    const fg = this.hexToRgb(foreground);
    if (!bg || !fg) return 0;
    const first = this.getRelativeLuminance(bg);
    const second = this.getRelativeLuminance(fg);
    const lighter = Math.max(first, second);
    const darker = Math.min(first, second);
    return (lighter + 0.05) / (darker + 0.05);
  }

  private hexToRgb(value: string): [number, number, number] | null {
    const match = value.match(/^#([0-9a-f]{6})$/i);
    if (!match) return null;
    const hex = match[1];
    return [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16)) as [number, number, number];
  }

  private getRelativeLuminance([red, green, blue]: [number, number, number]): number {
    const [r, g, b] = [red, green, blue].map(channel => {
      const normalized = channel / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : Math.pow((normalized + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  saveAndClose(): void {
    this.save();
    this.close();
  }

  close(): void {
    this.router.navigate(['/booking-categories']);
  }
}
