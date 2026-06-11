import { Injectable } from '@angular/core';
import { BookingCategory, BookingCategoryApplyScope } from '../../core/models/schedule.model';

const STORAGE_KEY = 'service-planner.booking-categories.v1';

const DEFAULT_CATEGORIES: BookingCategory[] = [
  { id: 'cat-warranty', label: 'Warranty', color: '#8A3FFC', appliesTo: 'order', isSystem: true },
  { id: 'cat-waiting-parts', label: 'Waiting for parts', color: '#F1C21B', appliesTo: 'order', isSystem: true },
  { id: 'cat-customer-priority', label: 'Customer priority', color: '#DA1E28', appliesTo: 'order', isSystem: true },
  { id: 'cat-diagnosis', label: 'Diagnosis', color: '#0F62FE', appliesTo: 'booking-set', isSystem: true },
  { id: 'cat-internal', label: 'Internal', color: '#198038', appliesTo: 'entry', isSystem: true },
];

@Injectable({ providedIn: 'root' })
export class BookingCategoriesService {
  private categories: BookingCategory[] = this.restoreCategories();

  getAll(): BookingCategory[] {
    return this.categories.map(category => ({ ...category }));
  }

  getById(id: string): BookingCategory | undefined {
    const category = this.categories.find(candidate => candidate.id === id);
    return category ? { ...category } : undefined;
  }

  createNewCategory(): BookingCategory {
    const category: BookingCategory = {
      id: `cat-${Date.now()}`,
      label: 'New category',
      color: this.getNextColor(),
      appliesTo: 'entry',
      description: '',
    };
    this.categories = [...this.categories, category];
    this.persist();
    return { ...category };
  }

  update(id: string, changes: Partial<BookingCategory>): BookingCategory | undefined {
    let updated: BookingCategory | undefined;
    this.categories = this.categories.map(category => {
      if (category.id !== id) return category;
      updated = {
        ...category,
        ...changes,
        color: changes.color ?? category.color,
        appliesTo: (changes.appliesTo as BookingCategoryApplyScope | undefined) ?? category.appliesTo,
      };
      return updated;
    });
    this.persist();
    return updated ? { ...updated } : undefined;
  }

  delete(id: string): void {
    this.categories = this.categories.filter(category => category.id !== id || category.isSystem);
    this.persist();
  }

  private restoreCategories(): BookingCategory[] {
    if (typeof localStorage === 'undefined') return DEFAULT_CATEGORIES.map(category => ({ ...category }));
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CATEGORIES.map(category => ({ ...category }));
    try {
      const parsed = JSON.parse(raw) as BookingCategory[];
      return parsed.length ? parsed : DEFAULT_CATEGORIES.map(category => ({ ...category }));
    } catch {
      return DEFAULT_CATEGORIES.map(category => ({ ...category }));
    }
  }

  private persist(): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.categories));
  }

  private getNextColor(): string {
    const colors = ['#0F62FE', '#8A3FFC', '#198038', '#F1C21B', '#FF832B', '#DA1E28', '#007D79'];
    return colors[this.categories.length % colors.length];
  }
}
