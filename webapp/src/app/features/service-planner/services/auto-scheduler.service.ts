import { Injectable } from '@angular/core';
import { Resource } from '../../../core/models/resource.model';
import { Job, JobResourceRequirement } from '../../../core/models/job.model';
import { ScheduleEntry } from '../../../core/models/schedule.model';
import { UnavailabilityBlock } from '../../../core/models/availability.model';

const MINUTES_PER_FRU = 60;
const CHECKIN_DURATION_MINUTES = 30;
const HANDOVER_DURATION_MINUTES = 30;

export interface AutoActivitySlot {
  start: Date;
  end: Date;
  resourceId: string;
}

export interface AutoWorkProposal {
  checkin: AutoActivitySlot;
  entries: ScheduleEntry[];
  workCompleteAt: Date;
}

export interface AutoHandoverOption extends AutoActivitySlot {
  mobilityResourceId?: string;
}

export interface AutoScheduleRequest {
  jobs: Job[];
  resources: Resource[];
  preferredResourceIds?: string[];
  requiredResourceIds?: string[];
  requiresMobility?: boolean;
  existingEntries: ScheduleEntry[];       // already booked slots on the scheduler
  unavailability: UnavailabilityBlock[];  // known unavailability blocks
  searchFrom: Date;                       // earliest possible start
  dayStartHour: number;                   // e.g. 9
  dayEndHour: number;                     // e.g. 21
  bookingWindow?: { start: Date; end: Date };
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

  findCheckinSlots(req: Omit<AutoScheduleRequest, 'searchFrom'> & { from: Date; to: Date; slotMinutes?: number }): AutoActivitySlot[] {
    return this.findActivitySlots({
      resourceType: 'advisor',
      resources: req.resources,
      requiredResourceIds: req.requiredResourceIds ?? [],
      allEntries: [...req.existingEntries],
      unavailability: req.unavailability,
      from: req.from,
      to: req.to,
      durationMinutes: CHECKIN_DURATION_MINUTES,
      dayStartHour: req.dayStartHour,
      dayEndHour: req.dayEndHour,
      slotMinutes: req.slotMinutes ?? 30,
    }).map(slot => ({ start: slot.start, end: slot.end, resourceId: slot.resource.id }));
  }

  buildWorkProposalFromCheckin(req: Omit<AutoScheduleRequest, 'searchFrom'> & { checkin: AutoActivitySlot; slotMinutes?: number }): AutoWorkProposal | null {
    const allEntries: ScheduleEntry[] = [
      ...req.existingEntries,
      this.createActivityHold('act-checkin', req.checkin.resourceId, req.checkin.start, req.checkin.end),
    ];
    const result: ScheduleEntry[] = [];
    let workOrderCursor = new Date(req.checkin.end);
    let latestJobEnd: Date | null = null;

    const jobsByWorkOrder = this.groupJobsByWorkOrder(this.getSchedulableJobs(req.jobs));
    const workOrderJobs = jobsByWorkOrder[0] ?? [];

    for (const job of workOrderJobs) {
      const slot = this.findEarliestSlot({
        requirements: this.getRequirements(job),
        resources: req.resources,
        preferredResourceIds: req.preferredResourceIds ?? [],
        requiredResourceIds: req.requiredResourceIds ?? [],
        durationMs: this.getJobDurationMinutes(job) * 60000,
        allEntries,
        unavailability: req.unavailability,
        searchFrom: workOrderCursor,
        dayStartHour: req.dayStartHour,
        dayEndHour: req.dayEndHour,
        slotMinutes: req.slotMinutes ?? 15,
      });
      if (!slot) return null;

      const bookingSetId = `${job.workOrderId}:${job.id}:${slot.start.getTime()}-${slot.end.getTime()}`;
      for (const { resource } of slot.assignments) {
        const entry: ScheduleEntry = {
          id: `auto-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          jobId: job.id,
          resourceId: resource.id,
          start: new Date(slot.start),
          end: new Date(slot.end),
          workorderItemStatus: 'scheduled',
          workorderItemCategory: 'job',
          bookingSetId,
        };
        allEntries.push(entry);
        result.push(entry);
      }

      workOrderCursor = new Date(slot.end);
      if (!latestJobEnd || slot.end > latestJobEnd) latestJobEnd = new Date(slot.end);
    }

    if (!latestJobEnd) return null;
    return {
      checkin: {
        start: new Date(req.checkin.start),
        end: new Date(req.checkin.end),
        resourceId: req.checkin.resourceId,
      },
      entries: result,
      workCompleteAt: latestJobEnd,
    };
  }

  findHandoverOptions(req: {
    resources: Resource[];
    existingEntries: ScheduleEntry[];
    draftEntries: ScheduleEntry[];
    unavailability: UnavailabilityBlock[];
    mobilityStart: Date;
    from: Date;
    to: Date;
    dayStartHour: number;
    dayEndHour: number;
    slotMinutes?: number;
    requiresMobility?: boolean;
    requiredResourceIds?: string[];
  }): AutoHandoverOption[] {
    const allEntries = [...req.existingEntries, ...req.draftEntries];
    const requiresMobility = req.requiresMobility ?? true;
    const advisors = this.getActivityCandidates(req.resources, 'advisor', req.requiredResourceIds ?? []);
    const mobilityResources = this.getActivityCandidates(req.resources, 'driver', req.requiredResourceIds ?? []);
    if (!advisors.length || (requiresMobility && !mobilityResources.length)) return [];

    const options: AutoHandoverOption[] = [];
    let cursor = this.snapToSlot(req.from, req.slotMinutes ?? 30, req.dayStartHour);
    const maxSearchEnd = new Date(req.to);

    while (cursor <= maxSearchEnd) {
      const end = new Date(cursor.getTime() + HANDOVER_DURATION_MINUTES * 60000);
      if (
        this.isWithinDay(cursor, req.dayStartHour, req.dayEndHour) &&
        end.toDateString() === cursor.toDateString() &&
        this.isWithinDay(end, req.dayStartHour, req.dayEndHour)
      ) {
        const handoverResource = advisors.find(resource =>
          this.isResourceFree(resource.id, cursor, end, allEntries, req.unavailability)
        );
        const mobilityResource = requiresMobility
          ? mobilityResources.find(resource =>
              this.isResourceFree(resource.id, req.mobilityStart, end, allEntries, req.unavailability)
            )
          : undefined;
        if (handoverResource && (!requiresMobility || mobilityResource)) {
          options.push({
            start: new Date(cursor),
            end,
            resourceId: handoverResource.id,
            mobilityResourceId: mobilityResource?.id,
          });
        }
      }

      cursor = new Date(cursor.getTime() + (req.slotMinutes ?? 30) * 60000);
    }

    return options;
  }

  schedule(req: AutoScheduleRequest): AutoScheduleResult | null {
    const { jobs, resources, preferredResourceIds, requiredResourceIds, existingEntries, unavailability, dayStartHour, dayEndHour } = req;
    const requiresMobility = req.requiresMobility ?? true;
    const SLOT_MINUTES = 15;
    const bookingWindow = this.normalizeBookingWindow(req.bookingWindow);
    const searchFrom = bookingWindow
      ? new Date(Math.max(req.searchFrom.getTime(), bookingWindow.start.getTime()))
      : req.searchFrom;

    const allEntries: ScheduleEntry[] = [...existingEntries];
    const result: ScheduleEntry[] = [];

    let earliestJobStart: Date | null = null;
    let earliestCheckinStart: Date | null = null;
    let latestJobEnd: Date | null = null;

    const jobsByWorkOrder = this.groupJobsByWorkOrder(this.getSchedulableJobs(jobs));

    for (const workOrderJobs of jobsByWorkOrder) {
      const checkinSlot = this.findActivitySlot({
        resourceType: 'advisor',
        resources,
        requiredResourceIds: requiredResourceIds ?? [],
        allEntries,
        unavailability,
        searchFrom,
        durationMinutes: CHECKIN_DURATION_MINUTES,
        dayStartHour,
        dayEndHour,
        slotMinutes: SLOT_MINUTES,
        searchUntil: bookingWindow?.end,
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
          requiredResourceIds: requiredResourceIds ?? [],
          durationMs,
          allEntries,
          unavailability,
          searchFrom: workOrderCursor,
          dayStartHour,
          dayEndHour,
          slotMinutes: SLOT_MINUTES,
          searchUntil: bookingWindow?.end,
        });

        if (!slot) {
          return null;
        }

        const bookingSetId = `${job.workOrderId}:${job.id}:${slot.start.getTime()}-${slot.end.getTime()}`;
        for (const { resource } of slot.assignments) {
          const entry: ScheduleEntry = {
            id: `auto-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            jobId: job.id,
            resourceId: resource.id,
            start: new Date(slot.start),
            end: new Date(slot.end),
            workorderItemStatus: 'scheduled',
            workorderItemCategory: 'job',
            bookingSetId,
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
        requiredResourceIds: requiredResourceIds ?? [],
        allEntries,
        unavailability,
        searchFrom: latestJobEnd,
        mobilityStart: checkinSlot.end,
        dayStartHour,
        dayEndHour,
        slotMinutes: SLOT_MINUTES,
        requiresMobility,
        searchUntil: bookingWindow?.end,
      });
      if (!handoverSlot) return null;
      if (bookingWindow && (checkinSlot.start < bookingWindow.start || handoverSlot.end > bookingWindow.end)) return null;

      allEntries.push(this.createActivityHold('act-handover', handoverSlot.handoverResource.id, handoverSlot.start, handoverSlot.end));
      if (handoverSlot.mobilityResource) {
        allEntries.push(this.createActivityHold('act-mobility', handoverSlot.mobilityResource.id, checkinSlot.end, handoverSlot.end));
      }

      return {
        entries: result,
        checkinStart: new Date(checkinSlot.start),
        checkinEnd: new Date(checkinSlot.end),
        checkinResourceId: checkinSlot.resource.id,
        handoverStart: new Date(handoverSlot.start),
        handoverEnd: new Date(handoverSlot.end),
        handoverResourceId: handoverSlot.handoverResource.id,
        mobilityResourceId: handoverSlot.mobilityResource?.id ?? '',
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

  private getSchedulableJobs(jobs: Job[]): Job[] {
    return jobs.filter(job => (job.workorderItemCategory ?? 'job') !== 'activity');
  }

  private findEarliestSlot(params: {
    requirements: JobResourceRequirement[];
    resources: Resource[];
    preferredResourceIds: string[];
    requiredResourceIds: string[];
    durationMs: number;
    allEntries: ScheduleEntry[];
    unavailability: UnavailabilityBlock[];
    searchFrom: Date;
    dayStartHour: number;
    dayEndHour: number;
    slotMinutes: number;
    searchUntil?: Date;
  }): { start: Date; end: Date; assignments: { req: JobResourceRequirement; resource: Resource }[] } | null {

    const { requirements, resources, preferredResourceIds, requiredResourceIds, durationMs, allEntries, unavailability,
            searchFrom, dayStartHour, dayEndHour, slotMinutes } = params;
    const preferredIds = new Set(preferredResourceIds);
    const requiredIds = new Set(requiredResourceIds);

    // For each requirement, find candidate resources (type + qualification match)
    const candidatesByReq = requirements.map((req, index) => {
      const matchingResources = resources.filter(r =>
        r.type === req.resourceType &&
        req.requiredQualifications.every(q => r.qualifications.some(rq => rq.id === q.id))
      );
      const requiredMatches = matchingResources.filter(resource => requiredIds.has(resource.id));
      return {
        req,
        index,
        candidates: (requiredMatches.length ? requiredMatches : matchingResources)
          .sort((a, b) => Number(preferredIds.has(b.id)) - Number(preferredIds.has(a.id))),
      };
    });

    candidatesByReq.sort((first, second) => {
      const firstRequired = first.candidates.some(resource => requiredIds.has(resource.id));
      const secondRequired = second.candidates.some(resource => requiredIds.has(resource.id));
      return Number(secondRequired) - Number(firstRequired);
    });

    // If any requirement has no candidates, bail
    if (candidatesByReq.some(c => c.candidates.length === 0)) return null;

    const slotMs = slotMinutes * 60000;
    const maxSearchEnd = params.searchUntil ? new Date(params.searchUntil) : new Date(searchFrom);
    if (!params.searchUntil) maxSearchEnd.setDate(maxSearchEnd.getDate() + 365);
    let cursor = this.snapToSlot(searchFrom, slotMinutes, dayStartHour);

    while (cursor <= maxSearchEnd) {
      const start = new Date(cursor);
      if (!this.isWithinDay(start, dayStartHour, dayEndHour)) {
        cursor = this.nextDayStart(start, dayStartHour);
        continue;
      }

      const end = new Date(start.getTime() + durationMs);
      if (params.searchUntil && end > params.searchUntil) return null;

      if (end.getHours() > dayEndHour || (end.getHours() === dayEndHour && end.getMinutes() > 0) || end.toDateString() !== start.toDateString()) {
        cursor = this.nextDayStart(start, dayStartHour);
        continue;
      }

      // Try to assign one candidate per requirement at this slot
      const assignments: { req: JobResourceRequirement; resource: Resource; index: number }[] = [];
      const usedResourceIds = new Set<string>();

      let slotValid = true;
      for (const { req, candidates, index } of candidatesByReq) {
        const free = candidates.find(r =>
          !usedResourceIds.has(r.id) &&
          this.isResourceFree(r.id, start, end, allEntries, unavailability)
        );
        if (!free) { slotValid = false; break; }
        assignments.push({ req, resource: free, index });
        usedResourceIds.add(free.id);
      }

      if (slotValid) {
        return {
          start,
          end,
          assignments: assignments
            .sort((first, second) => first.index - second.index)
            .map(({ req, resource }) => ({ req, resource })),
        };
      }
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
    requiredResourceIds?: string[];
    allEntries: ScheduleEntry[];
    unavailability: UnavailabilityBlock[];
    searchFrom: Date;
    durationMinutes: number;
    dayStartHour: number;
    dayEndHour: number;
    slotMinutes: number;
    searchUntil?: Date;
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
    const candidates = this.getActivityCandidates(resources, resourceType, params.requiredResourceIds ?? []);
    if (!candidates.length) return null;

    let cursor = this.snapToSlot(searchFrom, slotMinutes, dayStartHour);
    const maxSearchEnd = params.searchUntil ? new Date(params.searchUntil) : new Date(searchFrom);
    if (!params.searchUntil) maxSearchEnd.setDate(maxSearchEnd.getDate() + 365);

    while (cursor <= maxSearchEnd) {
      const end = new Date(cursor.getTime() + durationMinutes * 60000);
      if (params.searchUntil && end > params.searchUntil) return null;
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

  private findActivitySlots(params: {
    resourceType: string;
    resources: Resource[];
    requiredResourceIds?: string[];
    allEntries: ScheduleEntry[];
    unavailability: UnavailabilityBlock[];
    from: Date;
    to: Date;
    durationMinutes: number;
    dayStartHour: number;
    dayEndHour: number;
    slotMinutes: number;
  }): { start: Date; end: Date; resource: Resource }[] {
    const candidates = this.getActivityCandidates(params.resources, params.resourceType, params.requiredResourceIds ?? []);
    if (!candidates.length) return [];

    const slots: { start: Date; end: Date; resource: Resource }[] = [];
    let cursor = this.snapToSlot(params.from, params.slotMinutes, params.dayStartHour);
    const maxSearchEnd = new Date(params.to);

    while (cursor <= maxSearchEnd) {
      const end = new Date(cursor.getTime() + params.durationMinutes * 60000);
      if (
        this.isWithinDay(cursor, params.dayStartHour, params.dayEndHour) &&
        end.toDateString() === cursor.toDateString() &&
        this.isWithinDay(end, params.dayStartHour, params.dayEndHour)
      ) {
        const resource = candidates.find(candidate =>
          this.isResourceFree(candidate.id, cursor, end, params.allEntries, params.unavailability)
        );
        if (resource) slots.push({ start: new Date(cursor), end, resource });
      }

      cursor = new Date(cursor.getTime() + params.slotMinutes * 60000);
    }

    return slots;
  }

  private findHandoverSlotWithMobility(params: {
    resources: Resource[];
    requiredResourceIds?: string[];
    allEntries: ScheduleEntry[];
    unavailability: UnavailabilityBlock[];
    searchFrom: Date;
    mobilityStart: Date;
    dayStartHour: number;
    dayEndHour: number;
    slotMinutes: number;
    requiresMobility?: boolean;
    searchUntil?: Date;
  }): { start: Date; end: Date; handoverResource: Resource; mobilityResource?: Resource } | null {
    const { resources, allEntries, unavailability, searchFrom, mobilityStart, dayStartHour, dayEndHour, slotMinutes } = params;
    const requiresMobility = params.requiresMobility ?? true;
    const advisors = this.getActivityCandidates(resources, 'advisor', params.requiredResourceIds ?? []);
    const mobilityResources = this.getActivityCandidates(resources, 'driver', params.requiredResourceIds ?? []);
    if (!advisors.length || (requiresMobility && !mobilityResources.length)) return null;

    let cursor = this.snapToSlot(searchFrom, slotMinutes, dayStartHour);
    const maxSearchEnd = params.searchUntil ? new Date(params.searchUntil) : new Date(searchFrom);
    if (!params.searchUntil) maxSearchEnd.setDate(maxSearchEnd.getDate() + 365);

    while (cursor <= maxSearchEnd) {
      const end = new Date(cursor.getTime() + HANDOVER_DURATION_MINUTES * 60000);
      if (params.searchUntil && end > params.searchUntil) return null;
      if (
        this.isWithinDay(cursor, dayStartHour, dayEndHour) &&
        end.toDateString() === cursor.toDateString() &&
        this.isWithinDay(end, dayStartHour, dayEndHour)
      ) {
        const handoverResource = advisors.find(resource =>
          this.isResourceFree(resource.id, cursor, end, allEntries, unavailability)
        );
        const mobilityResource = requiresMobility
          ? mobilityResources.find(resource => this.isResourceFree(resource.id, mobilityStart, end, allEntries, unavailability))
          : undefined;
        if (handoverResource && (!requiresMobility || mobilityResource)) {
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

  private normalizeBookingWindow(window: AutoScheduleRequest['bookingWindow']): { start: Date; end: Date } | null {
    if (!window || window.end <= window.start) return null;
    return { start: new Date(window.start), end: new Date(window.end) };
  }

  private getActivityCandidates(resources: Resource[], resourceType: string, requiredResourceIds: string[]): Resource[] {
    const matchingResources = resources.filter(resource => resource.type === resourceType);
    const requiredIds = new Set(requiredResourceIds);
    const requiredMatches = matchingResources.filter(resource => requiredIds.has(resource.id));
    return requiredMatches.length ? requiredMatches : matchingResources;
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
