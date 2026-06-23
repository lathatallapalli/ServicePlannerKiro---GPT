import { Injectable } from '@angular/core';
import { BookingCategory, BookingCategoryApplyScope } from '../../core/models/booking-category.model';

@Injectable({ providedIn: 'root' })
export class BookingCategoriesService {
  private readonly STORAGE_KEY = 'service-planner.booking-categories.v1';
  private categories: BookingCategory[];

  constructor() {
    this.categories = this.loadFromStorage();
  }

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

  private loadFromStorage(): BookingCategory[] {
    try {
      if (typeof localStorage === 'undefined') {
        return this.getDefaultCategories();
      }
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) {
        return this.getDefaultCategories();
      }
      const parsed = JSON.parse(raw) as BookingCategory[];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return this.getDefaultCategories();
      }
      return parsed;
    } catch {
      return this.getDefaultCategories();
    }
  }

  private persist(): void {
    try {
      if (typeof localStorage === 'undefined') {
        return;
      }
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.categories));
    } catch {
      // localStorage unavailable or full — operate in-memory only
    }
  }

  private getDefaultCategories(): BookingCategory[] {
    return [
      { id: 'cat-warranty', label: 'Warranty', color: '#8A3FFC', appliesTo: 'order', isSystem: true },
      { id: 'cat-waiting-parts', label: 'Waiting for parts', color: '#F1C21B', appliesTo: 'order', isSystem: true },
      { id: 'cat-customer-priority', label: 'Customer priority', color: '#DA1E28', appliesTo: 'order', isSystem: true },
      { id: 'cat-diagnosis', label: 'Diagnosis', color: '#0F62FE', appliesTo: 'booking-set', isSystem: true },
      { id: 'cat-internal', label: 'Internal', color: '#198038', appliesTo: 'entry', isSystem: true },
    ];
  }

  private getNextColor(): string {
    const colors = ['#0F62FE', '#8A3FFC', '#198038', '#F1C21B', '#FF832B', '#DA1E28', '#007D79'];
    return colors[this.categories.length % colors.length];
  }
}
