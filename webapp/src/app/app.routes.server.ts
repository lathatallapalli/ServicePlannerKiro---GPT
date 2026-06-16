import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'transactions/:transactionId/summary',
    renderMode: RenderMode.Server,
  },
  {
    path: 'orders/:orderId/summary',
    renderMode: RenderMode.Server,
  },
  {
    path: 'orders/:orderId/appointment-selection',
    renderMode: RenderMode.Server,
  },
  {
    path: 'orders/:orderId/quick-view',
    renderMode: RenderMode.Server,
  },
  {
    path: 'orders/:orderId/service-planner',
    renderMode: RenderMode.Server,
  },
  {
    path: 'service-planner',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'booking-categories',
    renderMode: RenderMode.Server,
  },
  {
    path: 'booking-categories/:categoryId',
    renderMode: RenderMode.Server,
  },
  {
    path: 'resource-views/:viewId/edit',
    renderMode: RenderMode.Server,
  },
  {
    path: 'resource-catalog',
    renderMode: RenderMode.Server,
  },
  {
    path: 'resource-catalog/:groupId',
    renderMode: RenderMode.Server,
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
