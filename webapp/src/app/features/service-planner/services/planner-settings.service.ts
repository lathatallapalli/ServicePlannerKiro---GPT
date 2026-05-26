import { Injectable, signal } from '@angular/core';

export type PlannerViewMode = 'day' | 'week' | 'month';

export interface ResourceFavoriteView {
  label: string;
  resourceIds: string[];
  value?: string;
  groups?: Array<{ label: string; children: string[] }>;
}

@Injectable({ providedIn: 'root' })
export class PlannerSettingsService {
  slotDurationMinutes = signal<number>(60);
  viewMode = signal<PlannerViewMode>('day');
  selectedResourceView = signal<ResourceFavoriteView | null>(null);
  isSettingsModalOpen = signal<boolean>(false);
  viewPersonalCalendarOnTop = signal<boolean>(true);
  optimizeAdvisorActivityBookingForPersonalCalendar = signal<boolean>(false);

  // Incremented each time the user triggers undo from the ribbon.
  // The service planner watches this and pops the last booking.
  undoTrigger = signal<number>(0);

  setSlotDuration(minutes: number): void {
    this.slotDurationMinutes.set(minutes);
  }

  setViewMode(mode: PlannerViewMode): void {
    this.viewMode.set(mode);
  }

  setResourceView(view: ResourceFavoriteView | null): void {
    this.selectedResourceView.set(view);
  }

  triggerUndo(): void {
    this.undoTrigger.update(n => n + 1);
  }

  openSettings(): void {
    this.isSettingsModalOpen.set(true);
  }

  closeSettings(): void {
    this.isSettingsModalOpen.set(false);
  }

  setViewPersonalCalendarOnTop(enabled: boolean): void {
    this.viewPersonalCalendarOnTop.set(enabled);
  }

  setOptimizeAdvisorActivityBookingForPersonalCalendar(enabled: boolean): void {
    this.optimizeAdvisorActivityBookingForPersonalCalendar.set(enabled);
  }
}
