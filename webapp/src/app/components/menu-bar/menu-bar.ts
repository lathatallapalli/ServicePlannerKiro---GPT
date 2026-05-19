import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-menu-bar',
  imports: [CommonModule],
  templateUrl: './menu-bar.html',
  styleUrl: './menu-bar.scss',
})
export class MenuBar {
  menuItems = [
    'Masterdata', 'Aftersales', 'Cash and Receivables',
    'Parts Stock', 'Parts Purchase', 'Report', 'Administration', 'BMW Dealer',
  ];

  isFullMenuOpen = false;

  fullMenuFirstRow = [
    { title: 'Masterdata', items: ['Vehicles', 'Contacts', 'Customers'] },
    { title: 'Aftersales', items: ['Posted Invoices', 'Service Purchase Orders', 'Time Clocking', 'Clocking History', 'Service Planner'] },
    { title: 'Parts Stock', items: ['Parts Catalog', 'Parts on Stock', 'Parts Reservations', 'Parts Picking'] },
    { title: 'Parts Purchases', items: ['Open Parts Orders', 'Open Parts Receipts', 'Parts Invoices'] },
  ];

  fullMenuSecondRow = [
    { title: 'BMW Dealer', items: ['BMW Dealer Individual Parts'] },
    { title: 'Report', items: ['Reporting Server'] },
    { title: 'Cash and Receivables', items: ['Cash Journal'] },
  ];

  administrationMenu = {
    title: 'Administration',
    items: [
      'Aftersales Job Templates',
      'Data Privacy Setup',
      'Contact Templates',
      'Customer Templates',
      'Vehicle Templates',
      'Help Center Templates',
    ],
  };

  constructor(private router: Router) {}

  goHome(): void {
    this.router.navigate(['/']);
  }

  toggleFullMenu(): void {
    this.isFullMenuOpen = !this.isFullMenuOpen;
  }

  closeFullMenu(): void {
    this.isFullMenuOpen = false;
  }

  openFullMenuItem(item: string): void {
    this.closeFullMenu();

    if (item === 'Transactions') {
      this.router.navigate(['/transactions/offer']);
      return;
    }

    if (item === 'Service Planner') {
      this.router.navigate(['/service-planner']);
      return;
    }

    if (item === 'Resource Catalog') {
      this.router.navigate(['/resource-catalog']);
    }
  }
}
