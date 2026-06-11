import { Routes } from '@angular/router';
import { AppHomeComponent } from './features/app-home/app-home.component';
import { AppointmentSelectionComponent } from './features/appointment-selection/appointment-selection.component';
import { BookingCategoriesListComponent } from './features/booking-categories/booking-categories-list.component';
import { OrderSummaryComponent } from './features/order-summary/order-summary.component';
import { QuickViewComponent } from './features/quick-view/quick-view.component';
import { ResourceCatalogComponent } from './features/resource-catalog/resource-catalog.component';
import { ResourceCatalogGroupComponent } from './features/resource-catalog/resource-catalog-group.component';
import { ResourceViewEditorComponent } from './features/resource-view-editor/resource-view-editor.component';
import { ResourceViewsListComponent } from './features/resource-views/resource-views-list.component';
import { TransactionSummaryComponent } from './features/transaction-summary/transaction-summary.component';
import { TransactionsOfferComponent } from './features/transactions-offer/transactions-offer.component';

const loadServicePlanner = () =>
  import('./features/service-planner/service-planner.component').then(m => m.ServicePlannerComponent);

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: AppHomeComponent },
  { path: 'transactions/active', component: TransactionsOfferComponent },
  { path: 'transactions/offer', component: TransactionsOfferComponent },
  { path: 'transaction-summary', component: TransactionSummaryComponent },
  { path: 'transactions/:transactionId/summary', component: TransactionSummaryComponent },
  { path: 'orders/:orderId/summary', component: OrderSummaryComponent },
  { path: 'orders/:orderId/appointment-selection', component: AppointmentSelectionComponent },
  { path: 'orders/:orderId/quick-view', component: QuickViewComponent },
  { path: 'orders/:orderId/service-planner', loadComponent: loadServicePlanner },
  { path: 'service-planner', loadComponent: loadServicePlanner },
  { path: 'booking-categories', component: BookingCategoriesListComponent },
  { path: 'resource-views', component: ResourceViewsListComponent },
  { path: 'resource-views/:viewId/edit', component: ResourceViewEditorComponent },
  { path: 'resource-catalog', component: ResourceCatalogComponent },
  { path: 'resource-catalog/:groupId', component: ResourceCatalogGroupComponent },
  { path: '**', redirectTo: '' },
];
