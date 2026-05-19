import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';

interface WorkspaceTab {
  label: string;
  active?: boolean;
}

interface ProcessTile {
  label: string;
  count: number;
  route?: string;
  selected?: boolean;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app-home.component.html',
  styleUrl: './app-home.component.scss',
})
export class AppHomeComponent {
  protected readonly tabs: WorkspaceTab[] = [
    { label: 'BMW Service', active: true },
    { label: 'Mini Service' },
    { label: 'Part Sales' },
    { label: 'Tire Hotel' },
    { label: 'Quick Service' },
  ];

  protected readonly processTiles: ProcessTile[] = [
    { label: 'Request', count: 2, selected: true },
    { label: 'Offer', count: 0, route: '/transactions/offer' },
    { label: 'Preparation', count: 1, route: '/service-planner' },
    { label: 'Check-In', count: 1 },
    { label: 'Execution', count: 0 },
    { label: 'Handover', count: 2 },
    { label: 'Follow Up', count: 0 },
  ];

  constructor(private router: Router) {}

  protected openTile(tile: ProcessTile): void {
    if (!tile.route) return;
    this.router.navigateByUrl(tile.route);
  }
}
