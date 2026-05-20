import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface QuickViewSelection {
  orderId: string;
  checkinStart: Date;
  handoverEnd: Date;
}

@Injectable({ providedIn: 'root' })
export class QuickViewSelectionService {
  private selectionSubject = new BehaviorSubject<QuickViewSelection | null>(null);
  readonly selection$ = this.selectionSubject.asObservable();

  setSelection(selection: QuickViewSelection | null): void {
    this.selectionSubject.next(selection);
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
