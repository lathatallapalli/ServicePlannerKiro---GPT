import { Injectable } from '@angular/core';
import { Resource } from '../../../core/models/resource.model';
import { Job, JobResourceRequirement } from '../../../core/models/job.model';
import { ScheduleEntry } from '../../../core/models/schedule.model';
import { UnavailabilityBlock } from '../../../core/models/availability.model';

const MINUTES_PER_FRU = 60;
const CHECKIN_DURATION_MINUTES = 30;
const HANDOVER_DURATION_MINUTES = 30;

export interface AutoScheduleRequest {
  jobs: Job[];
  resources: Resource[];
  preferredResourceIds?: string[];
  existingEntries: ScheduleEntry[];       // already booked slots on the scheduler
  unavailability: UnavailabilityBlock[];  // known unavailability blocks
  searchFrom: Date;                       // earliest possible start
  dayStartHour: number;                   // e.g. 9
  dayEndHour: number;                     // e.g. 21
  vehicleGroups?: string[][];             // jobs grouped by vehicle — jobs in same group cannot overlap
}

export interface AutoScheduleResult {
  entries: ScheduleEntry[];               // one per job-resource requirement pair
  checkinStart: Date;
  checkinEnd: Date;
  checkinResourceId: string;
  handoverStart: Date;
  handoverEnd: Date;
  handoverResourceId: string;
  mobilityResourceId: string;
}

@Injectable({ providedIn: 'root' })
export class AutoSchedulerService {

  schedule(req: AutoScheduleRequest): AutoScheduleResult | null {
    const { jobs, resources, preferredResourceIds, existingEntries, unavailability, searchFrom, dayStartHour, dayEndHour } = req;
    const SLOT_MINUTES = 15;

    const allEntries: ScheduleEntry[] = [...existingEntries];
    const result: ScheduleEntry[] = [];

    let earliestJobStart: Date | null = null;
    let earliestCheckinStart: Date | null = null;
    let latestJobEnd: Date | null = null;

    const jobsByWorkOrder = this.groupJobsByWorkOrder(jobs);

    for (const workOrderJobs of jobsByWorkOrder) {
      const checkinSlot = this.findActivitySlot({
        resourceType: 'advisor',
        resources,
        allEntries,
        unavailability,
        searchFrom,
        durationMinutes: CHECKIN_DURATION_MINUTES,
        dayStartHour,
        dayEndHour,
        slotMinutes: SLOT_MINUTES,
      });
      if (!checkinSlot) return null;
      allEntries.push(this.createActivityHold('act-checkin', checkinSlot.resource.id, checkinSlot.start, checkinSlot.end));

      let workOrderCursor = new Date(checkinSlot.end);

      for (const job of workOrderJobs) {
        const requirements = this.getRequirements(job);
        const durationMs = this.getJobDurationMinutes(job) * 60000;

        const slot = this.findEarliestSlot({
          requirements,
          resources,
          preferredResourceIds: preferredResourceIds ?? [],
          durationMs,
          allEntries,
          unavailability,
          searchFrom: workOrderCursor,
          dayStartHour,
          dayEndHour,
          slotMinutes: SLOT_MINUTES,
        });

        if (!slot) {
          return null;
        }

        for (const { resource } of slot.assignments) {
          const entry: ScheduleEntry = {
            id: `auto-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            jobId: job.id,
            resourceId: resource.id,
            start: new Date(slot.start),
            end: new Date(slot.end),
            workorderItemStatus: 'scheduled',
            workorderItemCategory: 'job',
          };
          allEntries.push(entry);
          result.push(entry);
        }

        workOrderCursor = new Date(slot.end);

        if (!earliestCheckinStart || checkinSlot.start < earliestCheckinStart) earliestCheckinStart = new Date(checkinSlot.start);
        if (!earliestJobStart || slot.start < earliestJobStart) earliestJobStart = new Date(slot.start);
        if (!latestJobEnd || slot.end > latestJobEnd) latestJobEnd = new Date(slot.end);
      }

      if (!latestJobEnd) return null;
      const handoverSlot = this.findHandoverSlotWithMobility({
        resources,
        allEntries,
        unavailability,
        searchFrom: latestJobEnd,
        mobilityStart: checkinSlot.end,
        dayStartHour,
        dayEndHour,
        slotMinutes: SLOT_MINUTES,
      });
      if (!handoverSlot) return null;

      allEntries.push(this.createActivityHold('act-handover', handoverSlot.handoverResource.id, handoverSlot.start, handoverSlot.end));
      allEntries.push(this.createActivityHold('act-mobility', handoverSlot.mobilityResource.id, checkinSlot.end, handoverSlot.end));

      return {
        entries: result,
        checkinStart: new Date(checkinSlot.start),
        checkinEnd: new Date(checkinSlot.end),
        checkinResourceId: checkinSlot.resource.id,
        handoverStart: new Date(handoverSlot.start),
        handoverEnd: new Date(handoverSlot.end),
        handoverResourceId: handoverSlot.handoverResource.id,
        mobilityResourceId: handoverSlot.mobilityResource.id,
      };
    }

    if (!earliestCheckinStart || !earliestJobStart || !latestJobEnd) return null;

    return null;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private getRequirements(job: Job): JobResourceRequirement[] {
    if (job.resourceRequirements?.length) return job.resourceRequirements;
    return [{ resourceType: job.requiredResourceType, requiredQualifications: job.requiredQualifications }];
  }

  private getJobDurationMinutes(job: Job): number {
    return (job.fru ?? Math.max(0.25, job.estimatedDurationMinutes / MINUTES_PER_FRU)) * MINUTES_PER_FRU;
  }

  private groupJobsByWorkOrder(jobs: Job[]): Job[][] {
    const groups = new Map<string, Job[]>();

    for (const job of jobs) {
      const existing = groups.get(job.workOrderId) ?? [];
      existing.push(job);
      groups.set(job.workOrderId, existing);
    }

    return Array.from(groups.values()).map(group =>
      [...group].sort((a, b) => this.getJobDurationMinutes(a) - this.getJobDurationMinutes(b))
    );
  }

  private findEarliestSlot(params: {
    requirements: JobResourceRequirement[];
    resources: Resource[];
    preferredResourceIds: string[];
    durationMs: number;
    allEntries: ScheduleEntry[];
    unavailability: UnavailabilityBlock[];
    searchFrom: Date;
    dayStartHour: number;
    dayEndHour: number;
    slotMinutes: number;
  }): { start: Date; end: Date; assignments: { req: JobResourceRequirement; resource: Resource }[] } | null {

    const { requirements, resources, preferredResourceIds, durationMs, allEntries, unavailability,
            searchFrom, dayStartHour, dayEndHour, slotMinutes } = params;
    const preferredIds = new Set(preferredResourceIds);

    // For each requirement, find candidate resources (type + qualification match)
    const candidatesByReq = requirements.map(req => ({
      req,
      candidates: resources.filter(r =>
        r.type === req.resourceType &&
        req.requiredQualifications.every(q => r.qualifications.some(rq => rq.id === q.id))
      ).sort((a, b) => Number(preferredIds.has(b.id)) - Number(preferredIds.has(a.id))),
    }));

    // If any requirement has no candidates, bail
    if (candidatesByReq.some(c => c.candidates.length === 0)) return null;

    const slotMs = slotMinutes * 60000;
    const maxSearchEnd = new Date(searchFrom);
    maxSearchEnd.setDate(maxSearchEnd.getDate() + 365);
    let cursor = this.snapToSlot(searchFrom, slotMinutes, dayStartHour);

    while (cursor <= maxSearchEnd) {
      const start = new Date(cursor);
      if (!this.isWithinDay(start, dayStartHour, dayEndHour)) {
        cursor = this.nextDayStart(start, dayStartHour);
        continue;
      }

      const end = new Date(start.getTime() + durationMs);

      if (end.getHours() > dayEndHour || (end.getHours() === dayEndHour && end.getMinutes() > 0) || end.toDateString() !== start.toDateString()) {
        cursor = this.nextDayStart(start, dayStartHour);
        continue;
      }

      // Try to assign one candidate per requirement at this slot
      const assignments: { req: JobResourceRequirement; resource: Resource }[] = [];
      const usedResourceIds = new Set<string>();

      let slotValid = true;
      for (const { req, candidates } of candidatesByReq) {
        const free = candidates.find(r =>
          !usedResourceIds.has(r.id) &&
          this.isResourceFree(r.id, start, end, allEntries, unavailability)
        );
        if (!free) { slotValid = false; break; }
        assignments.push({ req, resource: free });
        usedResourceIds.add(free.id);
      }

      if (slotValid) return { start, end, assignments };
      cursor = new Date(cursor.getTime() + slotMs);
    }

    return null; // no slot found within search window
  }

  private nextDayStart(date: Date, dayStartHour: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    next.setHours(dayStartHour, 0, 0, 0);
    return next;
  }

  private findActivitySlot(params: {
    resourceType: string;
    resources: Resource[];
    allEntries: ScheduleEntry[];
    unavailability: UnavailabilityBlock[];
    searchFrom: Date;
    durationMinutes: number;
    dayStartHour: number;
    dayEndHour: number;
    slotMinutes: number;
  }): { start: Date; end: Date; resource: Resource } | null {
    const {
      resourceType,
      resources,
      allEntries,
      unavailability,
      searchFrom,
      durationMinutes,
      dayStartHour,
      dayEndHour,
      slotMinutes,
    } = params;
    const candidates = resources.filter(resource => resource.type === resourceType);
    if (!candidates.length) return null;

    let cursor = this.snapToSlot(searchFrom, slotMinutes, dayStartHour);
    const maxSearchEnd = new Date(searchFrom);
    maxSearchEnd.setDate(maxSearchEnd.getDate() + 365);

    while (cursor <= maxSearchEnd) {
      const end = new Date(cursor.getTime() + durationMinutes * 60000);
      if (
        this.isWithinDay(cursor, dayStartHour, dayEndHour) &&
        end.toDateString() === cursor.toDateString() &&
        this.isWithinDay(end, dayStartHour, dayEndHour)
      ) {
        const resource = candidates.find(candidate =>
          this.isResourceFree(candidate.id, cursor, end, allEntries, unavailability)
        );
        if (resource) return { start: new Date(cursor), end, resource };
      }

      cursor = new Date(cursor.getTime() + slotMinutes * 60000);
    }

    return null;
  }

  private findHandoverSlotWithMobility(params: {
    resources: Resource[];
    allEntries: ScheduleEntry[];
    unavailability: UnavailabilityBlock[];
    searchFrom: Date;
    mobilityStart: Date;
    dayStartHour: number;
    dayEndHour: number;
    slotMinutes: number;
  }): { start: Date; end: Date; handoverResource: Resource; mobilityResource: Resource } | null {
    const { resources, allEntries, unavailability, searchFrom, mobilityStart, dayStartHour, dayEndHour, slotMinutes } = params;
    const advisors = resources.filter(resource => resource.type === 'advisor');
    const mobilityResources = resources.filter(resource => resource.type === 'driver');
    if (!advisors.length || !mobilityResources.length) return null;

    let cursor = this.snapToSlot(searchFrom, slotMinutes, dayStartHour);
    const maxSearchEnd = new Date(searchFrom);
    maxSearchEnd.setDate(maxSearchEnd.getDate() + 365);

    while (cursor <= maxSearchEnd) {
      const end = new Date(cursor.getTime() + HANDOVER_DURATION_MINUTES * 60000);
      if (
        this.isWithinDay(cursor, dayStartHour, dayEndHour) &&
        end.toDateString() === cursor.toDateString() &&
        this.isWithinDay(end, dayStartHour, dayEndHour)
      ) {
        const handoverResource = advisors.find(resource =>
          this.isResourceFree(resource.id, cursor, end, allEntries, unavailability)
        );
        const mobilityResource = mobilityResources.find(resource =>
          this.isResourceFree(resource.id, mobilityStart, end, allEntries, unavailability)
        );
        if (handoverResource && mobilityResource) {
          return { start: new Date(cursor), end, handoverResource, mobilityResource };
        }
      }

      cursor = new Date(cursor.getTime() + slotMinutes * 60000);
    }

    return null;
  }

  private createActivityHold(jobId: string, resourceId: string, start: Date, end: Date): ScheduleEntry {
    return {
      id: `hold-${jobId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      jobId,
      resourceId,
      start: new Date(start),
      end: new Date(end),
      workorderItemStatus: 'scheduled',
      workorderItemCategory: 'activity',
    };
  }

  private isResourceFree(
    resourceId: string,
    start: Date,
    end: Date,
    entries: ScheduleEntry[],
    unavailability: UnavailabilityBlock[],
  ): boolean {
    const overlaps = (a: Date, b: Date, c: Date, d: Date) => a < d && c < b;

    const busyEntry = entries.find(e =>
      e.resourceId === resourceId && overlaps(start, end, e.start, e.end)
    );
    if (busyEntry) return false;

    const busyBlock = unavailability.find(u =>
      u.resourceId === resourceId && overlaps(start, end, u.start, u.end)
    );
    return !busyBlock;
  }

  private isWithinDay(date: Date, dayStartHour: number, dayEndHour: number): boolean {
    const h = date.getHours();
    const m = date.getMinutes();
    return h >= dayStartHour && (h < dayEndHour || (h === dayEndHour && m === 0));
  }

  private snapToSlot(date: Date, slotMinutes: number, dayStartHour: number): Date {
    const snapped = new Date(date);
    if (snapped.getHours() < dayStartHour) {
      snapped.setHours(dayStartHour, 0, 0, 0);
    } else {
      const mins = snapped.getMinutes();
      const snappedMins = Math.ceil(mins / slotMinutes) * slotMinutes;
      snapped.setMinutes(snappedMins, 0, 0);
    }
    return snapped;
  }
}
