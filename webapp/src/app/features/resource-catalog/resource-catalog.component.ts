import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { RESOURCE_CATALOG_GROUPS } from './data/resource-catalog.mock';

@Component({
  selector: 'app-resource-catalog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './resource-catalog.component.html',
  styleUrl: './resource-catalog.component.scss',
})
export class ResourceCatalogComponent {
  protected readonly catalogGroups = RESOURCE_CATALOG_GROUPS;

  constructor(private router: Router, private route: ActivatedRoute) {}

  protected openGroup(groupId: string): void {
    const returnTo = this.route.snapshot.queryParamMap.get('returnTo');
    const plannerReturnTo = this.route.snapshot.queryParamMap.get('plannerReturnTo');
    const listReturnTo = this.route.snapshot.queryParamMap.get('listReturnTo');
    this.router.navigate(['/resource-catalog', groupId], {
      queryParams: returnTo
        ? { returnTo, ...(plannerReturnTo ? { plannerReturnTo } : {}), ...(listReturnTo ? { listReturnTo } : {}) }
        : undefined,
      state: history.state,
    });
  }
}
