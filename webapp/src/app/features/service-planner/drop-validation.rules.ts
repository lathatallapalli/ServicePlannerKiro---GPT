import { JobResourceRequirement } from '../../core/models/job.model';
import { Resource } from '../../core/models/resource.model';
import { SchedulerResource } from '../../shared/components/scheduler/scheduler.interface';
import { ResourceFavoriteView } from './services/planner-settings.service';

export type DropValidationKind = 'job' | 'activity' | 'order';

/** First requirement the resource satisfies (type + every required qualification). */
export function getRequirementForResource(requirements: JobResourceRequirement[], resource: Resource): JobResourceRequirement | null {
  return requirements.find(requirement =>
    resource.type === requirement.resourceType &&
    requirement.requiredQualifications.every(qualification =>
      resource.qualifications.some(resourceQualification => resourceQualification.id === qualification.id)
    )
  ) ?? null;
}

/**
 * Capacity-lane rule for a single resource. Order drags on an advisor are valid because the
 * order drop books activities on advisors (mirrors onOrderDayCapacityDropped).
 */
export function isCapacityResourceCompatible(kind: DropValidationKind, requirements: JobResourceRequirement[], resource: Resource): boolean {
  return (kind === 'order' && resource.type === 'advisor') || !!getRequirementForResource(requirements, resource);
}

/**
 * Group-capacity-lane rule: the group's type must match a requirement that at least one
 * resource of the group satisfies. Activities and untyped groups are never rejected.
 */
export function isCapacityGroupCompatible(
  kind: DropValidationKind,
  group: { id: string; resourceType?: string },
  requirements: JobResourceRequirement[],
  resources: SchedulerResource[],
): boolean {
  if (kind === 'activity' || !group.resourceType) return true;
  if (kind === 'order' && group.resourceType === 'advisor') return true;
  return requirements.some(requirement =>
    requirement.resourceType === group.resourceType &&
    resources.some(resource => {
      const raw = resource.meta as Resource | undefined;
      return resource.groupId === group.id && !!raw && !!getRequirementForResource([requirement], raw);
    })
  );
}

/** Remap resource groups according to a view's groupMerges (e.g. Technicians A + B → Technicians). */
export function applyGroupMerges(resources: SchedulerResource[], groupMerges?: ResourceFavoriteView['groupMerges']): SchedulerResource[] {
  if (!groupMerges?.length) return resources;

  const mergeByGroupId = new Map<string, { into: string; label: string }>();
  for (const merge of groupMerges) {
    for (const from of [merge.into, ...merge.from]) mergeByGroupId.set(from, { into: merge.into, label: merge.label });
  }
  return resources.map(resource => {
    const merge = resource.groupId ? mergeByGroupId.get(resource.groupId) : undefined;
    return merge ? { ...resource, groupId: merge.into, groupLabel: merge.label } : resource;
  });
}
