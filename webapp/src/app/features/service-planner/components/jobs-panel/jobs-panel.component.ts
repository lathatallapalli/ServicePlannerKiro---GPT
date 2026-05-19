import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WorkOrder } from '../../../../core/models/work-order.model';
import { Job, JobResourceRequirement } from '../../../../core/models/job.model';

export interface JobTile {
  workOrder: WorkOrder;
  job: Job;
}

export interface ActivityTile {
  id: string;
  title: string;
  resourceType: string;
  resourceLabel: string;
  estimatedDurationMinutes: number;
}

export interface JobBooking {
  jobId: string;
  resourceType: string;
  resourceName: string;
  entryId: string;
  orderId?: string;
}

@Component({
  selector: 'app-jobs-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './jobs-panel.component.html',
  styleUrl: './jobs-panel.component.scss',
})
export class JobsPanelComponent {
  @Input() jobTiles: JobTile[] = [];
  @Input() activityTiles: ActivityTile[] = [];
  @Input() bookings: JobBooking[] = [];
  @Input() hasPrevious = false;
  @Input() bookFirstDisabled = false;
  searchQuery = '';
  @Output() jobDragStart = new EventEmitter<{ job: Job; resourceType: string }>();
  @Output() jobClicked = new EventEmitter<Job>();
  @Output() undoBooking = new EventEmitter<JobBooking>();
  @Output() bookFirstAvailability = new EventEmitter<void>();
  @Output() bookNext = new EventEmitter<void>();
  @Output() bookPrevious = new EventEmitter<void>();

  onBookClick(): void {
    this.bookFirstAvailability.emit();
  }

  get filteredJobTiles(): JobTile[] {
    const query = this.searchQuery.trim().toLowerCase();
    if (!query) return this.jobTiles;
    return this.jobTiles.filter(tile => {
      const searchable = [
        tile.job.title,
        tile.job.description,
        tile.workOrder.referenceNumber,
        tile.workOrder.vehicle?.licensePlate,
      ].filter(Boolean).join(' ').toLowerCase();
      return searchable.includes(query);
    });
  }

  onDragStart(event: DragEvent, id: string, resourceType: string, durationMinutes: number): void {
    event.dataTransfer?.setData('jobId', id);
    event.dataTransfer?.setData('dropType', 'job');
    event.dataTransfer?.setData('durationMinutes', durationMinutes.toString());
    event.dataTransfer?.setData('resourceType', resourceType);
  }

  getRequirements(job: Job): JobResourceRequirement[] {
    if (job.resourceRequirements?.length) return job.resourceRequirements;
    return [{ resourceType: job.requiredResourceType, requiredQualifications: job.requiredQualifications }];
  }

  getRequirementLabel(req: JobResourceRequirement): string {
    if (req.label) return req.label;
    return req.resourceType.charAt(0).toUpperCase() + req.resourceType.slice(1);
  }

  getBookingForRequirement(jobId: string, resourceType: string): JobBooking | undefined {
    return this.bookings.find(b => b.jobId === jobId && b.resourceType === resourceType);
  }

  getFruLabel(durationMinutes: number): string {
    const hours = durationMinutes / 60;
    return `${hours % 1 === 0 ? hours : hours.toFixed(1)} FRU`;
  }

  isFullyBooked(job: Job): boolean {
    return this.getRequirements(job).every(req =>
      this.bookings.some(b => b.jobId === job.id && b.resourceType === req.resourceType)
    );
  }

  getActivityBooking(activityId: string): JobBooking | undefined {
    return this.bookings.find(b => b.jobId === activityId && !!b.orderId);
  }

  isActivityBooked(activityId: string): boolean {
    return !!this.getActivityBooking(activityId);
  }
}
