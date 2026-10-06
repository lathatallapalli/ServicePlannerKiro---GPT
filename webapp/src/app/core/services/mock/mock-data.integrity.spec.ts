import {
  MOCK_RESOURCES,
  MOCK_SCHEDULE_ENTRIES,
  MOCK_WORK_ORDERS,
} from './mock-data';

/**
 * Permanent integrity test for the mock-data location/reference fix (commit 4bc9cf7).
 *
 * The defect: the May 2024 planner demo bookings reused the Munich background
 * reference band 014826501-509 (which really belong to the April wo-bg-* orders)
 * and a dangling band 014826511-523 that backed no order at all. Because
 * entry->order resolution is reference-first, May-only Munich resources resolved
 * onto the April wo-bg-* orders, so a single workOrderReference leaked across
 * locations/orders.
 *
 * The fix re-pointed every May demo entry onto a dedicated unused band
 * 014900001-014900022 and added 22 standalone Munich orders (now wo-bg-1011..wo-bg-1032;
 * reference band 014900001-014900022, plus pending 014900023 -> wo-bg-1033) so each
 * reference resolves 1:1 to exactly one real order.
 *
 * This test asserts the integrity invariants that the fix established.
 */

type Location = 'vienna' | 'klagenfurt' | 'munich';

/** Prefix rule: vie- => vienna, klg- => klagenfurt, else munich. */
function locationForResourceId(resourceId: string): Location {
  if (resourceId.startsWith('vie-')) return 'vienna';
  if (resourceId.startsWith('klg-')) return 'klagenfurt';
  return 'munich';
}

function pad(reference: number): string {
  return String(reference).padStart(9, '0');
}

describe('Mock data location/reference integrity (regression for 4bc9cf7)', () => {
  // (a) Within each workOrderReference, the resource-location prefix is consistent.
  it('keeps one location per workOrderReference', () => {
    const locationByReference = new Map<string, Location>();
    for (const entry of MOCK_SCHEDULE_ENTRIES) {
      const reference = entry.workOrderReference;
      if (!reference) continue;
      const location = locationForResourceId(entry.resourceId);
      const existing = locationByReference.get(reference);
      if (existing === undefined) {
        locationByReference.set(reference, location);
      } else {
        expect(
          location,
          `reference ${reference} mixes locations ${existing} and ${location} ` +
            `(entry ${entry.id}, resource ${entry.resourceId})`,
        ).toBe(existing);
      }
    }
  });

  // (b) Every schedule entry reference resolves to exactly one existing WorkOrder.
  it('resolves every schedule entry reference to exactly one existing work order', () => {
    // referenceNumbers are unique across work orders (exactly-one resolution).
    const seen = new Set<string>();
    for (const order of MOCK_WORK_ORDERS) {
      expect(
        seen.has(order.referenceNumber),
        `duplicate work-order referenceNumber ${order.referenceNumber} (order ${order.id})`,
      ).toBe(false);
      seen.add(order.referenceNumber);
    }

    const workOrderReferences = new Set(MOCK_WORK_ORDERS.map(o => o.referenceNumber));
    for (const entry of MOCK_SCHEDULE_ENTRIES) {
      const reference = entry.workOrderReference;
      if (!reference) continue;
      expect(
        workOrderReferences.has(reference),
        `dangling reference ${reference} on schedule entry ${entry.id}`,
      ).toBe(true);
    }
  });

  describe('reference bands (c)', () => {
    const workOrdersByReference = new Map(MOCK_WORK_ORDERS.map(o => [o.referenceNumber, o]));

    // (c1) The May demo band 014900001-014900023 exists and maps 1:1 to wo-bg-1011..1033.
    it('maps the May band 014900001-014900023 to wo-bg-1011..1033', () => {
      for (let i = 1; i <= 23; i++) {
        const reference = pad(14900000 + i);
        const order = workOrdersByReference.get(reference);
        expect(order, `missing May work order for reference ${reference}`).toBeTruthy();
        const expectedId = `wo-bg-${1010 + i}`;
        expect(order!.id).toBe(expectedId);
      }
    });

    // (c2) References 014826501-509 appear ONLY on wo-bg-* orders and sch-bg-* entries.
    it('restricts 014826501-509 to wo-bg-* orders and sch-bg-* entries', () => {
      for (let i = 501; i <= 509; i++) {
        const reference = pad(14826000 + i);

        for (const order of MOCK_WORK_ORDERS) {
          if (order.referenceNumber === reference) {
            expect(
              order.id.startsWith('wo-bg-'),
              `reference ${reference} on non-Munich order ${order.id}`,
            ).toBe(true);
          }
        }

        for (const entry of MOCK_SCHEDULE_ENTRIES) {
          if (entry.workOrderReference === reference) {
            expect(
              entry.id.startsWith('sch-bg-'),
              `reference ${reference} on non-Munich entry ${entry.id}`,
            ).toBe(true);
          }
        }
      }
    });

    // (c3) References 014826511-523 do NOT exist at all.
    it('has no 014826511-523 references anywhere', () => {
      for (let i = 511; i <= 523; i++) {
        const reference = pad(14826000 + i);
        expect(
          MOCK_WORK_ORDERS.some(o => o.referenceNumber === reference),
          `work order unexpectedly carries retired reference ${reference}`,
        ).toBe(false);
        expect(
          MOCK_SCHEDULE_ENTRIES.some(e => e.workOrderReference === reference),
          `schedule entry unexpectedly carries retired reference ${reference}`,
        ).toBe(false);
      }
    });
  });
});
