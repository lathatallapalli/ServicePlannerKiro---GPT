import { Injectable, signal } from '@angular/core';
import { ResourceFavoriteView } from './planner-settings.service';
import { DEMO_RESOURCE_VIEWS } from '../data/resource-views.mock';

@Injectable({ providedIn: 'root' })
export class ResourceViewsService {
  private readonly viewsSignal = signal<ResourceFavoriteView[]>(DEMO_RESOURCE_VIEWS.map(view => ({
    ...view,
    resourceIds: [...view.resourceIds],
    groups: view.groups?.map(group => ({ ...group, children: [...group.children] })),
  })));

  readonly views = this.viewsSignal.asReadonly();

  getAll(): ResourceFavoriteView[] {
    return this.viewsSignal();
  }

  getByValue(value: string | null | undefined): ResourceFavoriteView | undefined {
    if (!value) return undefined;
    return this.viewsSignal().find(view => view.value === value);
  }

  upsert(view: ResourceFavoriteView): ResourceFavoriteView {
    const value = view.value ?? this.createValue(view.label);
    const normalized: ResourceFavoriteView = {
      ...view,
      value,
      resourceIds: [...view.resourceIds],
      groups: view.groups?.map(group => ({ ...group, children: [...group.children] })) ?? [],
    };

    this.viewsSignal.update(views => {
      const index = views.findIndex(candidate => candidate.value === value);
      if (index === -1) return [...views, normalized];
      return views.map((candidate, candidateIndex) => candidateIndex === index ? normalized : candidate);
    });

    return normalized;
  }

  rename(value: string, label: string): ResourceFavoriteView | undefined {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) return this.getByValue(value);

    let renamed: ResourceFavoriteView | undefined;
    this.viewsSignal.update(views => views.map(view => {
      if (view.value !== value) return view;
      renamed = { ...view, label: trimmedLabel };
      return renamed;
    }));
    return renamed;
  }

  createNewView(): ResourceFavoriteView {
    let index = 1;
    while (this.getByValue(`new-${index}`)) index++;
    return this.upsert({
      label: `New ${index}`,
      value: `new-${index}`,
      resourceIds: [],
      groups: [],
    });
  }

  private createValue(label: string): string {
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'resource-view';
    let value = slug;
    let suffix = 2;
    while (this.getByValue(value)) {
      value = `${slug}-${suffix++}`;
    }
    return value;
  }
}
