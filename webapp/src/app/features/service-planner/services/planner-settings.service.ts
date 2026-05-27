import { Injectable, signal } from '@angular/core';

export interface ResourceFavoriteView {
  label: string;
  resourceIds: string[];
  value?: string;
  groups?: Array<{ label: string; children: string[] }>;
}

export interface PlannerResourceContext {
  resourceView: ResourceFavoriteView | null;
  selectedResourceTypeGroupIds: string[];
  selectedResourceIds: string[];
  viewPersonalCalendarOnTop: boolean;
  personalCalendarResourceId?: string;
  personalCalendarGroupId?: string;
}

@Injectable({ providedIn: 'root' })
export class PlannerSettingsService {
  slotDurationMinutes = signal<number>(60);
  selectedResourceView = signal<ResourceFavoriteView | null>(null);
  resourceContext = signal<PlannerResourceContext | null>(null);
  isSettingsModalOpen = signal<boolean>(false);
  viewPersonalCalendarOnTop = signal<boolean>(true);
  optimizeAdvisorActivityBookingForPersonalCalendar = signal<boolean>(false);

  // Incremented each time the user triggers undo from the ribbon.
  // The service planner watches this and pops the last booking.
  undoTrigger = signal<number>(0);

  setSlotDuration(minutes: number): void {
    this.slotDurationMinutes.set(minutes);
  }

  setResourceView(view: ResourceFavoriteView | null): void {
    this.selectedResourceView.set(view);
  }

  setResourceContext(context: PlannerResourceContext): void {
    this.resourceContext.set({
      ...context,
      selectedResourceTypeGroupIds: [...context.selectedResourceTypeGroupIds],
      selectedResourceIds: [...context.selectedResourceIds],
      resourceView: context.resourceView
        ? { ...context.resourceView, resourceIds: [...context.resourceView.resourceIds], groups: context.resourceView.groups?.map(group => ({ ...group, children: [...group.children] })) }
        : null,
    });
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
