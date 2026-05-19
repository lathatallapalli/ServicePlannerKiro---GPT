import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface TopPanelTile {
  type: 'vehicle' | 'billing' | 'payer' | 'custom';
  label: string;         // footer label e.g. "Vehicle"
  primaryValue: string;  // bold value in collapsed state e.g. "KL 653 P3"
  details?: string[];    // detail lines shown in expanded state
  payerRows?: { label: string; value: string }[]; // for payer tile
  iconSvg: string;       // SVG paths string
  iconClipId?: string;
}

@Component({
  selector: 'app-top-panel',
  imports: [CommonModule],
  templateUrl: './top-panel.html',
  styleUrl: './top-panel.scss',
})
export class TopPanel {
  @Input() tiles: TopPanelTile[] = [];
  expanded = true;

  toggle(): void {
    this.expanded = !this.expanded;
  }
}
