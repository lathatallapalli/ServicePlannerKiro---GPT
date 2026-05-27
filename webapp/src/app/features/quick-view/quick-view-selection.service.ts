import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { QuickViewSlotFilter } from './quick-view.models';

export interface QuickViewSelection {
  orderId: string;
  checkinStart?: Date;
  handoverStart?: Date;
  handoverEnd?: Date;
  checkinFilters?: QuickViewSlotFilter[];
  handoverFilters?: QuickViewSlotFilter[];
  hasDraftCheckin?: boolean;
}

@Injectable({ providedIn: 'root' })
export class QuickViewSelectionService {
  private selectionSubject = new BehaviorSubject<QuickViewSelection | null>(null);
  readonly selection$ = this.selectionSubject.asObservable();

  setSelection(selection: QuickViewSelection | null): void {
    if (selection) {
      const current = this.selectionSubject.value;
      if (current?.orderId === selection.orderId) {
        this.selectionSubject.next({ ...current, ...selection });
        return;
      }
    }
    this.selectionSubject.next(selection);
  }

  setFilters(orderId: string, filters: Pick<QuickViewSelection, 'checkinFilters' | 'handoverFilters'>): void {
    const current = this.selectionSubject.value;
    this.setSelection({
      ...(current?.orderId === orderId ? current : { orderId }),
      ...filters,
    });
  }

  setDraftCheckin(selection: Pick<QuickViewSelection, 'orderId' | 'checkinStart' | 'checkinFilters' | 'handoverFilters'>): void {
    const current = this.selectionSubject.value;
    this.selectionSubject.next({
      ...(current?.orderId === selection.orderId ? current : { orderId: selection.orderId }),
      ...selection,
      handoverStart: undefined,
      handoverEnd: undefined,
      hasDraftCheckin: true,
    });
  }

  getSelection(orderId: string): QuickViewSelection | null {
    const selection = this.selectionSubject.value;
    if (!selection || selection.orderId !== orderId) return null;
    return selection;
  }

  consumeSelection(orderId: string): QuickViewSelection | null {
    return this.getSelection(orderId);
  }
}
