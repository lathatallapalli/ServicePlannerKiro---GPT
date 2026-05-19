import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface BreadcrumbItem {
  label: string;
  url?: string;
}

@Component({
  selector: 'app-page-title',
  imports: [CommonModule],
  templateUrl: './page-title.html',
  styleUrl: './page-title.scss',
})
export class PageTitle {
  @Input() title = 'Title';
  @Input() referenceInfo = 'Reference Infos';
  @Input() breadcrumbs: BreadcrumbItem[] = [
    { label: '...' },
    { label: '...' },
    { label: '...' },
    { label: '...' },
    { label: '...' },
    { label: '...' },
    { label: '...' },
  ];
}
