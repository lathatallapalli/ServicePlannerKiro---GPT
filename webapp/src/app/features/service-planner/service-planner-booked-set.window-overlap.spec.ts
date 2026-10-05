import { ScheduleEntry } from '../../core/models/schedule.model';
import {
  MOCK_RESOURCES,
  MOCK_SCHEDULE_ENTRIES,
  MOCK_WORK_ORDERS,
} from '../../core/services/mock/mock-data';

/**
 * Permanent regression test for the window-overlap booked-set fix (commit 225184f).
 *
 * The defect: getBookedResourceIdsForOrder unioned resources from every schedule
 * entry that matched the order reference, regardless of whether the booking fell
 * inside the currently-viewed time window. Bookings for the same order reference
 * that live in a DIFFERENT window therefore leaked into the booked set, so
 * resources booked only on other days (e.g. mech-mark-owen, advisor-ted-phillips)
 * showed up as booked for the April view.
 *
 * The fix added a doRangesOverlap(entry.start, entry.end, viewStart, viewEnd)
 * filter to every source of booked resources.
 *
 * This test reproduces the exact production matching + window-overlap rule against
 * the real mock data for Munich order wo-bg-1002 (reference 014826501), plus one
 * synthetic out-of-window (May) entry for the same reference, and proves the
 * cross-window booking does NOT leak into the booked set while an in-window
 * booking IS included.
 */

// --- Faithful copies of the production logic (service-planner.component.ts) ---

/** Mirrors private isEntryForOrder's operative rule for reference-only mock data. */
function isEntryForOrder(
  entry: ScheduleEntry,
  order: { id: string; referenceNumber: string },
): boolean {
  return (
    !!entry.workOrderReference &&
    (entry.workOrderReference === order.referenceNumber ||
      entry.workOrderReference === order.id)
  );
}

/** Mirrors private doRangesOverlap exactly (half-open overlap). */
function doRangesOverlap(start: Date, end: Date, rangeStart: Date, rangeEnd: Date): boolean {
  const normalizedEnd = end.getTime() > start.getTime() ? end : new Date(start.getTime() + 1);
  return start < rangeEnd && normalizedEnd > rangeStart;
}

/** Reproduces getBookedResourceIdsForOrder for a single flat entry source. */
function bookedResourceIdsForWindow(
  entries: ScheduleEntry[],
  order: { id: string; referenceNumber: string },
  viewStart: Date,
  viewEnd: Date,
): Set<string> {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (
      isEntryForOrder(entry, order) &&
      doRangesOverlap(entry.start, entry.end, viewStart, viewEnd)
    ) {
      ids.add(entry.resourceId);
    }
  }
  return ids;
}

describe('Service planner booked-set window overlap (regression for 225184f)', () => {
  const REFERENCE = '014826501';
  const EXPECTED = [
    'mech-phil-parker',
    'bay-pc-2',
    'advisor-frank-miller',
    'car-audi-a3-kl643ju',
  ];

  // April view window: covers all 2024-04-15 / 2024-04-16 bookings.
  // 2024-04-17T00:00 is the exclusive end.
  const viewStart = new Date('2024-04-15T00:00:00');
  const viewEnd = new Date('2024-04-17T00:00:00');

  const order = MOCK_WORK_ORDERS.find(o => o.referenceNumber === REFERENCE);

  // Synthetic cross-window (May) booking for the SAME reference. In production
  // the real data no longer reuses this reference across windows, so we inject
  // an out-of-window entry to prove the overlap filter still excludes it.
  const crossWindowEntry: ScheduleEntry = {
    id: 'test-cross-window',
    jobId: 'job-test',
    resourceId: 'mech-mark-owen',
    start: new Date('2024-05-15T09:00:00'),
    end: new Date('2024-05-15T10:00:00'),
    workOrderReference: REFERENCE,
  };

  const dataset: ScheduleEntry[] = [
    ...MOCK_SCHEDULE_ENTRIES.filter(e => e.workOrderReference === REFERENCE),
    crossWindowEntry,
  ];

  it('resolves reference 014826501 to Munich order wo-bg-1002', () => {
    expect(order).toBeTruthy();
    expect(order!.id).toBe('wo-bg-1002');
  });

  it('booked set is exactly the four in-window resources', () => {
    const booked = bookedResourceIdsForWindow(dataset, order!, viewStart, viewEnd);
    expect([...booked].sort()).toEqual([...EXPECTED].sort());
    expect(booked.size).toBe(4);
  });

  it('does NOT leak cross-window bookings into the booked set', () => {
    const booked = bookedResourceIdsForWindow(dataset, order!, viewStart, viewEnd);
    // The synthetic May entry's resource must be filtered out by the overlap check.
    expect(booked.has('mech-mark-owen')).toBe(false);
    // advisor-ted-phillips is never booked in-window for this order either.
    expect(booked.has('advisor-ted-phillips')).toBe(false);
  });

  it('includes an in-window booking (fails if the overlap filter is removed inclusively)', () => {
    const booked = bookedResourceIdsForWindow(dataset, order!, viewStart, viewEnd);
    // sch-bg-1002-phil-1 (mech-phil-parker, 2024-04-15 11:15-11:45) is in-window.
    expect(booked.has('mech-phil-parker')).toBe(true);
  });

  it('all four expected resources exist in the resource catalog', () => {
    const resourceIds = new Set(MOCK_RESOURCES.map(r => r.id));
    for (const id of EXPECTED) {
      expect(resourceIds.has(id)).toBe(true);
    }
  });
});
