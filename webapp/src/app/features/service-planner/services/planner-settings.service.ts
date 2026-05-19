import { Injectable, signal } from '@angular/core';

export interface ResourceFavoriteView {
  label: string;
  resourceIds: string[];
  value?: string;
  groups?: Array<{ label: string; children: string[] }>;
}

@Injectable({ providedIn: 'root' })
export class PlannerSettingsService {
  slotDurationMinutes = signal<number>(60);
  selectedResourceView = signal<ResourceFavoriteView | null>(null);

  // Incremented each time the user triggers undo from the ribbon.
  // The service planner watches this and pops the last booking.
  undoTrigger = signal<number>(0);

  setSlotDuration(minutes: number): void {
    this.slotDurationMinutes.set(minutes);
  }

  setResourceView(view: ResourceFavoriteView | null): void {
    this.selectedResourceView.set(view);
  }

  triggerUndo(): void {
    this.undoTrigger.update(n => n + 1);
  }
}
