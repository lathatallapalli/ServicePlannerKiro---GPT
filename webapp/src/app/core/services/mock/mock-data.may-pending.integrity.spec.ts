import {
  MOCK_RESOURCES,
  MOCK_SCHEDULE_ENTRIES,
  MOCK_WORK_ORDERS,
} from './mock-data';

/**
 * Permanent integrity test for the "booked May orders leak into Pending" fix.
 *
 * The defect: the 22 Munich May-planner demo orders wo-may-1001..wo-may-1022
 * (reference band 014900001-014900022) each had two May booking schedule entries,
 * but those entries carried jobIds `job-may-dNN-1/-2` while the orders' work-order
 * items were generated as `job-wo-may-10NN-1/-2`. Planning state attaches a
 * schedule entry to an order item only when BOTH
 *   entry.workOrderReference === order.referenceNumber
 *   AND (entry.jobId === item.id  OR, for activities, templateId matches)
 * The references matched but the jobIds never did, so every item resolved to
 * `unscheduled` -> getOrderPlanningState() returned `unscheduled` ->
 * isOrderPlanned() false -> the order fell into the (status-based, not
 * date-scoped) Pending panel section.
 *
 * The fix (DATA-ONLY, mock-data.ts) reconciled each order's two work-order item
 * ids to the booking jobIds, modeling the `category: 'activity'` booking rows as
 * activity items (workorderItemCategory: 'activity', act-checkin / act-mobility
 * templateId) so getActivityScheduleEntryStatus matches them.
 *
 * This spec reproduces the production attachment + status-rollup logic (faithful
 * copies of the relevant helpers from service-planner.component.ts) against the
 * exported mock arrays and asserts that ZERO wo-may-* orders resolve to
 * `unscheduled` (i.e. none would appear in Pending). It also re-asserts the
 * reference-band integrity invariants that must not regress.
 */

type CanonicalStatus =
  | 'unscheduled'
  | 'reserved'
  | 'scheduled'
  | 'in-progress'
  | 'completed'
  | 'cancelled';

// --- Faithful copies of the production helpers (service-planner.component.ts) ---

/** getActivityTemplateId: the part after the last ':' (or the id itself). */
function getActivityTemplateId(activityId: string): string {
  return activityId.split(':').pop() ?? activityId;
}

/** isActivityId: template id begins with 'act-'. */
function isActivityId(id: string): boolean {
  return getActivityTemplateId(id).startsWith('act-');
}

/** getSchedulingRole: boundary/span activities vs plain work. */
function getSchedulingRole(item: any): 'start-boundary' | 'end-boundary' | 'span' | 'work' {
  const templateId = getActivityTemplateId(item.templateId ?? item.id ?? '');
  if (templateId === 'act-checkin') return 'start-boundary';
  if (templateId === 'act-handover') return 'end-boundary';
  if (templateId === 'act-mobility') return 'span';
  return 'work';
}

function getCanonicalWorkOrderItemStatus(status: unknown): CanonicalStatus {
  if (status === 'completed') return 'completed';
  if (status === 'in-progress' || status === 'started') return 'in-progress';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'scheduled') return 'scheduled';
  if (status === 'reserved') return 'reserved';
  return 'unscheduled';
}

const RESOURCE_TYPE_BY_ID = new Map(MOCK_RESOURCES.map(r => [r.id, r.type]));

function entriesForOrder(order: any): any[] {
  return MOCK_SCHEDULE_ENTRIES.filter(entry => entry.workOrderReference === order.referenceNumber);
}

function isJobScheduleEntry(entry: any): boolean {
  return (
    !!entry &&
    entry.workorderItemCategory !== 'activity' &&
    !isActivityId(entry.jobId)
  );
}

/** getJobRequirements: resourceRequirements -> {label, resourceType}, else default. */
function getJobRequirements(job: any): Array<{ label: string; resourceType?: string }> {
  const requirements = job.requirements ?? job.resourceRequirements;
  if (Array.isArray(requirements) && requirements.length) {
    return requirements.map((requirement: any) => ({
      label: requirement.label ?? requirement.resourceLabel ?? requirement.type ?? 'Resource',
      resourceType: requirement.resourceType ?? requirement.type,
    }));
  }
  return [{ label: 'Technician', resourceType: 'mechanic' }];
}

/** getExistingScheduleBookingForJob (bookings are empty under mock data). */
function hasExistingScheduleBookingForJob(job: any, order: any, resourceType?: string): boolean {
  const entries = MOCK_SCHEDULE_ENTRIES.filter(
    entry =>
      entry.jobId === job.id &&
      entry.workOrderReference === order.referenceNumber &&
      (entry.kind === 'blocked-order' || entry.kind === 'scheduled'),
  );
  if (!entries.length) return false;
  return entries.some(entry => {
    const type = RESOURCE_TYPE_BY_ID.get(entry.resourceId);
    return !resourceType || type === resourceType;
  });
}

/** isJobScheduledForOrder: every requirement has a schedule booking. */
function isJobScheduledForOrder(job: any, order: any): boolean {
  const requirements = getJobRequirements(job);
  return requirements.every(requirement =>
    hasExistingScheduleBookingForJob(job, order, requirement.resourceType),
  );
}

/** getActivityScheduleEntryStatus: match by item id or template id. */
function getActivityScheduleEntryStatus(order: any, item: any): CanonicalStatus {
  const templateId = item.templateId ?? getActivityTemplateId(item.id);
  const entry = entriesForOrder(order).find(
    candidate =>
      candidate.jobId === item.id || getActivityTemplateId(candidate.jobId) === templateId,
  );
  return getCanonicalWorkOrderItemStatus(entry?.workorderItemStatus);
}

function hasActivityAllocation(order: any, item: any): boolean {
  const templateId = getActivityTemplateId(item.id);
  // mobility maps to a day-span; others fall back to title matching. The May
  // bookings always set workorderItemStatus explicitly, so entry-status (above)
  // settles the result before allocation is consulted. Still, model it faithfully:
  const titlePrefixByActivity: Record<string, string> = {
    'act-checkin': 'check-in',
    'act-handover': 'handover',
    'act-mobility': 'courtesy car',
  };
  const titlePrefix = titlePrefixByActivity[templateId];
  if (!titlePrefix) return false;
  return entriesForOrder(order).some(
    candidate =>
      (candidate.kind === 'blocked-order' || candidate.kind === 'scheduled') &&
      (candidate.title ?? '').toLowerCase().startsWith(titlePrefix),
  );
}

function isItemOnlyDayCapacity(order: any, item: any): boolean {
  const jobId = item.id;
  const entries = MOCK_SCHEDULE_ENTRIES.filter(
    entry =>
      (entry.jobId === jobId || getActivityTemplateId(entry.jobId) === getActivityTemplateId(jobId)) &&
      entry.workOrderReference === order.referenceNumber,
  );
  return entries.length > 0 && entries.every(entry => entry.workorderItemStatus === 'reserved');
}

/** resolveActivityItemStatus mirror. */
function resolveActivityItemStatus(order: any, item: any): CanonicalStatus {
  const explicit = getCanonicalWorkOrderItemStatus(
    item.workorderItemStatus ?? item.status,
  );
  if (explicit !== 'unscheduled') return explicit;

  const entryStatus = getActivityScheduleEntryStatus(order, item);
  if (entryStatus !== 'unscheduled') return entryStatus;

  if (!hasActivityAllocation(order, item)) return 'unscheduled';
  return isItemOnlyDayCapacity(order, item) ? 'reserved' : 'scheduled';
}

/** getEffectiveWorkOrderItemStatus mirror. */
function effectiveItemStatus(order: any, item: any): CanonicalStatus {
  const kind: 'job' | 'activity' =
    item.workorderItemCategory === 'activity' || isActivityId(item.id) ? 'activity' : 'job';
  if (kind === 'activity') return resolveActivityItemStatus(order, item);

  const explicit = getCanonicalWorkOrderItemStatus(item.workorderItemStatus ?? item.status);
  if (explicit !== 'unscheduled') return explicit;
  if (!isJobScheduledForOrder(item, order)) return 'unscheduled';
  return isItemOnlyDayCapacity(order, item) ? 'reserved' : 'scheduled';
}

/** getWorkOrderItems mirror: job items (role 'work') + activity items. */
function getWorkOrderItems(order: any): any[] {
  const jobs: any[] = order.jobs ?? [];
  const jobItems = jobs.filter(
    job => getSchedulingRole(job) === 'work' && (job.workorderItemCategory ?? 'job') !== 'activity',
  );
  const activityItems = jobs.filter(
    job => job.workorderItemCategory === 'activity' || isActivityId(job.id),
  );
  return [...jobItems, ...activityItems];
}

/** getOrderPlanningState mirror (status rollup). */
function getOrderPlanningState(order: any): CanonicalStatus | 'partiallyScheduled' {
  const items = getWorkOrderItems(order).filter(
    item => getCanonicalWorkOrderItemStatus(item.workorderItemStatus ?? item.status) !== 'cancelled',
  );
  if (!items.length) return 'unscheduled';

  const statuses = items.map(item => {
    const baseStatus = effectiveItemStatus(order, item);
    if (baseStatus === 'reserved') {
      const jobId = item.id;
      const hasTimedEntry = MOCK_SCHEDULE_ENTRIES.some(
        entry =>
          (entry.jobId === jobId ||
            getActivityTemplateId(entry.jobId) === getActivityTemplateId(jobId)) &&
          entry.workOrderReference === order.referenceNumber &&
          (entry.kind === 'scheduled' || entry.kind === 'blocked-order'),
      );
      if (hasTimedEntry) return 'scheduled' as CanonicalStatus;
    }
    return baseStatus;
  });

  if (statuses.length > 0 && statuses.every(s => s === 'completed')) return 'completed';
  if (statuses.some(s => s === 'in-progress')) return 'in-progress';
  if (statuses.every(s => s === 'scheduled' || s === 'completed')) return 'scheduled';
  if (statuses.every(s => s === 'reserved' || s === 'scheduled' || s === 'completed')) return 'reserved';
  if (statuses.some(s => s === 'scheduled' || s === 'completed' || s === 'reserved'))
    return 'partiallyScheduled';
  return 'unscheduled';
}

function isOrderPlanned(order: any): boolean {
  return getOrderPlanningState(order) !== 'unscheduled';
}

const allWoMayOrders = MOCK_WORK_ORDERS.filter(o => /^wo-may-10\d+$/.test(o.id));
// wo-may-1001..1022 are the booked May demo orders (must be planned).
// wo-may-1023 is an intentionally-pending standalone order (no schedule entries).
const wayMayOrders = allWoMayOrders.filter(o => o.id !== 'wo-may-1023');
const pendingByDesign = allWoMayOrders.filter(o => o.id === 'wo-may-1023');

describe('May booked orders do not leak into Pending (regression)', () => {
  it('finds all 23 wo-may-* orders (22 booked + 1 intentionally pending)', () => {
    expect(allWoMayOrders.length).toBe(23);
    expect(wayMayOrders.length).toBe(22);
    expect(pendingByDesign.length).toBe(1);
  });

  it('attaches at least one schedule entry to every wo-may-* order item', () => {
    for (const order of wayMayOrders) {
      for (const item of order.jobs ?? []) {
        const isActivity = item.workorderItemCategory === 'activity' || isActivityId(item.id);
        const templateId = item.templateId ?? getActivityTemplateId(item.id);
        const attached = MOCK_SCHEDULE_ENTRIES.some(
          entry =>
            entry.workOrderReference === order.referenceNumber &&
            (entry.jobId === item.id ||
              (isActivity && getActivityTemplateId(entry.jobId) === templateId)),
        );
        expect(
          attached,
          `order ${order.id} item ${item.id} has no matching schedule entry`,
        ).toBe(true);
      }
    }
  });

  it('resolves every wo-may-* order as planned (scheduled/reserved), never unscheduled', () => {
    const unscheduled = wayMayOrders.filter(o => getOrderPlanningState(o) === 'unscheduled');
    expect(
      unscheduled.map(o => o.id),
      `these wo-may orders still resolve to unscheduled (would appear in Pending): ${unscheduled
        .map(o => o.id)
        .join(', ')}`,
    ).toEqual([]);

    for (const order of wayMayOrders) {
      const state = getOrderPlanningState(order);
      expect(
        state === 'scheduled' || state === 'reserved',
        `order ${order.id} resolved to ${state}, expected scheduled or reserved`,
      ).toBe(true);
      expect(isOrderPlanned(order)).toBe(true);
    }
  });

  it('reports zero booked wo-may-* orders in the (status-based) Pending set', () => {
    const pending = wayMayOrders.filter(o => !isOrderPlanned(o));
    expect(pending.length).toBe(0);
  });

  it('keeps wo-may-1023 as an intentionally-pending order with a courtesy-car activity', () => {
    const order = pendingByDesign[0];
    expect(order, 'wo-may-1023 should exist').toBeTruthy();
    // It is pending: no schedule entries reference it, so it is not planned.
    expect(isOrderPlanned(order)).toBe(false);
    expect(
      MOCK_SCHEDULE_ENTRIES.some(e => e.workOrderReference === order.referenceNumber),
      'wo-may-1023 must have no schedule entries (it is pending)',
    ).toBe(false);
    // Courtesy car is modeled as an act-mobility ACTIVITY, not a job requirement.
    const items = order.jobs ?? [];
    const mobility = items.find(item => item.templateId === 'act-mobility');
    expect(mobility, 'wo-may-1023 must have an act-mobility (courtesy car) activity').toBeTruthy();
    expect(mobility!.workorderItemCategory).toBe('activity');
    const jobsWithDriverReq = items.filter(item =>
      item.workorderItemCategory !== 'activity' &&
      (item.resourceRequirements ?? []).some(req => req.resourceType === 'driver'),
    );
    expect(jobsWithDriverReq.map(j => j.id), 'no job should carry a courtesy-car requirement').toEqual([]);
    // Suspension Repair is 2 hours.
    const suspension = items.find(item => item.title === 'Suspension Repair');
    expect(suspension?.estimatedDurationMinutes).toBe(120);
  });
});

describe('May pending fix preserves reference-band integrity', () => {
  const pad = (reference: number) => String(reference).padStart(9, '0');
  const workOrdersByReference = new Map(MOCK_WORK_ORDERS.map(o => [o.referenceNumber, o]));

  it('maps the May band 014900001-014900023 to wo-may-1001..1023 one-to-one', () => {
    for (let i = 1; i <= 23; i++) {
      const reference = pad(14900000 + i);
      const order = workOrdersByReference.get(reference);
      expect(order, `missing May work order for reference ${reference}`).toBeTruthy();
      expect(order!.id).toBe(`wo-may-${1000 + i}`);
    }
  });

  it('keeps 014826501-509 only on wo-bg-* orders and sch-bg-* entries', () => {
    for (let i = 501; i <= 509; i++) {
      const reference = pad(14826000 + i);
      for (const order of MOCK_WORK_ORDERS) {
        if (order.referenceNumber === reference) {
          expect(order.id.startsWith('wo-bg-'), `reference ${reference} on ${order.id}`).toBe(true);
        }
      }
      for (const entry of MOCK_SCHEDULE_ENTRIES) {
        if (entry.workOrderReference === reference) {
          expect(entry.id.startsWith('sch-bg-'), `reference ${reference} on ${entry.id}`).toBe(true);
        }
      }
    }
  });

  it('has no 014826511-523 references anywhere', () => {
    for (let i = 511; i <= 523; i++) {
      const reference = pad(14826000 + i);
      expect(MOCK_WORK_ORDERS.some(o => o.referenceNumber === reference)).toBe(false);
      expect(MOCK_SCHEDULE_ENTRIES.some(e => e.workOrderReference === reference)).toBe(false);
    }
  });
});
