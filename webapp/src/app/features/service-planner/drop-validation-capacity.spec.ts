import { MOCK_RESOURCES, MOCK_SCHEDULE_ENTRIES, MOCK_WORK_ORDERS } from '../../core/services/mock/mock-data';
import { JobResourceRequirement } from '../../core/models/job.model';
import { Resource } from '../../core/models/resource.model';
import { SchedulerResource } from '../../shared/components/scheduler/scheduler.interface';
import { DEMO_RESOURCE_VIEWS } from './data/resource-views.mock';
import {
  applyGroupMerges,
  getRequirementForResource,
  isCapacityGroupCompatible,
  isCapacityResourceCompatible,
} from './drop-validation.rules';

/**
 * Permanent spec for the capacity / group-lane drop-validation rules. The planner component
 * delegates to these helpers for both rendering (invalid lanes) and the drop itself.
 */

const resourceById = (id: string): Resource => {
  const resource = MOCK_RESOURCES.find(r => r.id === id);
  if (!resource) throw new Error(`Missing resource ${id}`);
  return resource;
};

const toSchedulerResource = (r: Resource): SchedulerResource => ({ id: r.id, label: r.name, groupId: r.groupId, meta: r });

/** Mirrors service-planner getSchedulingRequirements (resourceRequirements first). */
const requirementsForJob = (job: any): JobResourceRequirement[] =>
  job.resourceRequirements?.length
    ? job.resourceRequirements
    : [{ resourceType: job.requiredResourceType, requiredQualifications: job.requiredQualifications ?? [] }];

/** Mirrors service-planner getAllOrderSchedulingRequirements (de-duplicated union). */
const orderRequirements = (order: any): JobResourceRequirement[] => {
  const seen = new Set<string>();
  const result: JobResourceRequirement[] = [];
  for (const job of order.jobs ?? []) {
    for (const req of requirementsForJob(job)) {
      const key = `${req.resourceType}:${req.requiredQualifications.map(q => q.id).sort().join(',')}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(req);
      }
    }
  }
  return result;
};

const findOrder = (reference: string): any => {
  const order = MOCK_WORK_ORDERS.find(o => o.referenceNumber === reference);
  if (!order) throw new Error(`Missing order ${reference}`);
  return order;
};

const findJob = (reference: string, title: string): any => {
  const job = (findOrder(reference).jobs as any[]).find(j => j.title === title);
  if (!job) throw new Error(`Missing job ${title} on ${reference}`);
  return job;
};

const viewByValue = (value: string) => {
  const view = DEMO_RESOURCE_VIEWS.find(v => v.value === value);
  if (!view) throw new Error(`Missing view ${value}`);
  return view;
};

/** Mirrors service-planner resourcesForSelectedView. */
const viewResources = (value: string): SchedulerResource[] => {
  const view = viewByValue(value);
  const ids = new Set(view.resourceIds);
  const inView = MOCK_RESOURCES
    .filter(r => ids.has(r.id) && (view.demoLocationId ? r.demoLocationId === view.demoLocationId : !r.demoLocationId))
    .map(toSchedulerResource);
  return applyGroupMerges(inView, view.groupMerges);
};

const groupOf = (id: string, resourceType: string) => ({ id, resourceType });

describe('drop validation: capacity lanes', () => {
  const controlUnit = requirementsForJob(findJob('014826706', 'Control Unit Programming'));

  it('rejects non-electrician Vienna technicians and painters for Control Unit Programming', () => {
    const rejected = MOCK_RESOURCES.filter(r =>
      r.demoLocationId === 'vienna' &&
      r.type === 'mechanic' &&
      !r.qualifications.some(q => q.id === 'q-electrician'),
    );
    expect(rejected.map(r => r.id)).toEqual(expect.arrayContaining(['vie-tech-mark-owen', 'vie-painter-jeff-meyer', 'vie-painter-claus-ford']));
    for (const resource of rejected) {
      expect(isCapacityResourceCompatible('job', controlUnit, resource)).toBe(false);
    }
  });

  it('accepts Kelly Hanson, Lisa Smith and a PC bay; rejects the LT bay', () => {
    expect(isCapacityResourceCompatible('job', controlUnit, resourceById('vie-tech-kelly-hanson'))).toBe(true);
    expect(isCapacityResourceCompatible('job', controlUnit, resourceById('vie-tech-lisa-smith'))).toBe(true);
    expect(isCapacityResourceCompatible('job', controlUnit, resourceById('vie-bay-pc-1'))).toBe(true);
    expect(isCapacityResourceCompatible('job', controlUnit, resourceById('vie-bay-lt-1'))).toBe(false);
  });

  it('order drags use the union of job requirements plus the advisor exception (same as the drop)', () => {
    const reqs = orderRequirements(findOrder('014826706'));
    expect(isCapacityResourceCompatible('order', reqs, resourceById('vie-painter-jeff-meyer'))).toBe(false);
    expect(isCapacityResourceCompatible('order', reqs, resourceById('vie-tech-kelly-hanson'))).toBe(true);
    expect(isCapacityResourceCompatible('order', reqs, resourceById('vie-advisor-frank-reynold'))).toBe(true);
    // The advisor exception is order-only
    expect(isCapacityResourceCompatible('job', controlUnit, resourceById('vie-advisor-frank-reynold'))).toBe(false);
  });

  it('Munich background job bay requirement only accepts PC bays', () => {
    const oilService = requirementsForJob(findJob('014826500', 'Engine Oil and Filter Service'));
    expect(isCapacityResourceCompatible('job', oilService, resourceById('bay-pc-1'))).toBe(true);
    expect(isCapacityResourceCompatible('job', oilService, resourceById('bay-lt-1'))).toBe(false);
    expect(isCapacityResourceCompatible('job', oilService, resourceById('bay-pc-alignment'))).toBe(false);
  });
});

describe('drop validation: group capacity lanes', () => {
  const controlUnit = requirementsForJob(findJob('014826706', 'Control Unit Programming'));

  it('Service Center Vienna (merged Technicians): Painter invalid, Technicians valid', () => {
    const resources = viewResources('view-service-center-vienna');
    expect(resources.find(r => r.id === 'vie-tech-lisa-smith')?.groupId).toBe('group-vienna-technicians');
    expect(isCapacityGroupCompatible('job', groupOf('group-vienna-painters', 'mechanic'), controlUnit, resources)).toBe(false);
    expect(isCapacityGroupCompatible('job', groupOf('group-vienna-technicians', 'mechanic'), controlUnit, resources)).toBe(true);
  });

  it('Vienna Split View: Technicians B valid via Lisa, advisors invalid for a job', () => {
    const resources = viewResources('view-vienna-split');
    expect(isCapacityGroupCompatible('job', groupOf('group-vienna-technicians-b', 'mechanic'), controlUnit, resources)).toBe(true);
    expect(isCapacityGroupCompatible('job', groupOf('group-vienna-painters', 'mechanic'), controlUnit, resources)).toBe(false);
    expect(isCapacityGroupCompatible('job', groupOf('group-vienna-advisors', 'advisor'), controlUnit, resources)).toBe(false);
  });

  it('the groupMerges remap is what makes the merged Technicians group valid without Kelly', () => {
    const view = viewByValue('view-service-center-vienna');
    const withoutKelly = MOCK_RESOURCES
      .filter(r => view.resourceIds.includes(r.id) && r.id !== 'vie-tech-kelly-hanson' && r.demoLocationId === 'vienna')
      .map(toSchedulerResource);
    const technicians = groupOf('group-vienna-technicians', 'mechanic');
    expect(isCapacityGroupCompatible('job', technicians, controlUnit, applyGroupMerges(withoutKelly, undefined))).toBe(false);
    expect(isCapacityGroupCompatible('job', technicians, controlUnit, applyGroupMerges(withoutKelly, view.groupMerges))).toBe(true);
  });

  it('order drags: painter group invalid, advisor group valid; activities and untyped groups never flagged', () => {
    const resources = viewResources('view-service-center-vienna');
    const reqs = orderRequirements(findOrder('014826706'));
    expect(isCapacityGroupCompatible('order', groupOf('group-vienna-painters', 'mechanic'), reqs, resources)).toBe(false);
    expect(isCapacityGroupCompatible('order', groupOf('group-vienna-advisors', 'advisor'), reqs, resources)).toBe(true);
    expect(isCapacityGroupCompatible('activity', groupOf('group-vienna-painters', 'mechanic'), controlUnit, resources)).toBe(true);
    expect(isCapacityGroupCompatible('job', { id: 'group-without-type' }, controlUnit, resources)).toBe(true);
  });
});

describe('drop validation: mock data consistency', () => {
  it('every booked bay satisfies the bay requirement of its job', () => {
    const jobsById = new Map<string, any>();
    for (const order of MOCK_WORK_ORDERS) for (const job of order.jobs as any[]) jobsById.set(job.id, job);
    const offenders: string[] = [];
    for (const entry of MOCK_SCHEDULE_ENTRIES) {
      const bay = MOCK_RESOURCES.find(r => r.id === entry.resourceId);
      const job = entry.jobId ? jobsById.get(entry.jobId) : undefined;
      if (!bay || bay.type !== 'bay' || !job) continue;
      const bayReqs = requirementsForJob(job).filter(req => req.resourceType === 'bay');
      if (!bayReqs.length) continue;
      if (!getRequirementForResource(bayReqs, bay)) offenders.push(`${entry.id} -> ${bay.id}`);
    }
    expect(offenders).toEqual([]);
  });

  it('every view resource id exists, and Vienna Split View includes painters, LT and alignment bays', () => {
    const ids = new Set(MOCK_RESOURCES.map(r => r.id));
    for (const view of DEMO_RESOURCE_VIEWS) {
      expect(view.resourceIds.filter(id => !ids.has(id))).toEqual([]);
    }
    expect(viewByValue('view-vienna-split').resourceIds).toEqual(expect.arrayContaining([
      'vie-painter-jeff-meyer', 'vie-painter-claus-ford', 'vie-bay-lt-1', 'vie-bay-pc-alignment-1',
    ]));
  });
});
