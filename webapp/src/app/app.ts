import { Component, OnInit, computed, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { ActionRibbon } from './components/action-ribbon/action-ribbon';
import { MenuBar } from './components/menu-bar/menu-bar';
import { Stepper } from './components/stepper/stepper';
import { TopPanel, TopPanelTile } from './components/top-panel/top-panel';
import { Footer } from './components/footer/footer';
import { PageTitle } from './components/page-title/page-title';
import { ResourceCatalogSelectionService } from './features/resource-catalog/data/resource-catalog-selection.service';
import { QuickViewSelectionService } from './features/quick-view/quick-view-selection.service';
import { PlannerSettingsService } from './features/service-planner/services/planner-settings.service';
import { ResourceViewsService } from './features/service-planner/services/resource-views.service';
import { MOCK_WORK_ORDERS } from './core/services/mock/mock-data';
import { findTransactionById, findWorkOrderByIdOrReference } from './core/services/mock/mock-transactions';
import { WorkOrder } from './core/models/work-order.model';
import { WorkOrderRepository } from './core/services/work-order.repository';
import { AppointmentSyncService } from './core/services/appointment-sync.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ActionRibbon, MenuBar, Stepper, TopPanel, Footer, PageTitle],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected readonly title = signal('webapp');
  protected readonly isHomePage = signal(false);
  protected readonly isTransactionsPage = signal(false);
  protected readonly isTransactionsOfferPage = signal(false);
  protected readonly isTransactionSummaryPage = signal(false);
  protected readonly isOrderWorkflowPage = signal(false);
  protected readonly isAppointmentSelectionPage = signal(false);
  protected readonly isQuickViewPage = signal(false);
  protected readonly isOrderSummaryPage = signal(false);
  protected readonly isServicePlannerPage = signal(false);
  protected readonly isOrderServicePlannerPage = signal(false);
  protected readonly isFullServicePlannerPage = signal(false);
  protected readonly isResourceEditorPage = signal(false);
  protected readonly isResourceCatalogPage = signal(false);
  protected readonly shellTitle = signal('Service Planner');
  protected readonly shellReference = signal('014826312');
  protected readonly shellBreadcrumbs = signal([{ label: 'Appointment Selection' }]);
  protected readonly resourceEditorReference = signal('');
  protected readonly activeOrder = signal<WorkOrder | null>(findWorkOrderByIdOrReference('014826312') ?? null);
  protected readonly visibleActionRibbonItems = computed(() =>
    this.isHomePage() || this.isTransactionsPage() || this.isQuickViewPage()
      ? []
      : this.isTransactionSummaryPage()
        ? this.transactionSummaryActionRibbonItems
        : this.isAppointmentSelectionPage()
        ? this.appointmentSelectionActionRibbonItems
        : this.isOrderSummaryPage()
          ? this.orderSummaryActionRibbonItems
      : this.isResourceEditorPage() || this.isResourceCatalogPage() ? this.resourceEditorActionRibbonItems : this.actionRibbonItems
  );

  private readonly favoriteResourceViews = [
    {
      label: 'Fav View 1',
      value: 'fav-1',
      resourceIds: ['mech-mark-owen', 'mech-phil-parker', 'mech-greg-jackson', 'advisor-ted-phillips', 'advisor-frank-miller', 'bay-pc-1', 'bay-pc-2', 'device-bea-950', 'car-audi-a4-kl657og'],
      groups: [
        { label: 'Mechanics', children: [
          { label: 'Mechanic Group A', children: ['Hans Müller', 'Klaus Weber'] },
          { label: 'Mechanic Group B', children: ['Stefan Braun'] },
        ] },
        { label: 'Service Advisors', children: ['John Doe', 'Maria Schmidt'] },
        { label: 'Bays', children: ['Bay 1', 'Bay 2'] },
        { label: 'Devices', children: ['Diagnostic Tool A'] },
        { label: 'Courtesy Cars', children: ['Courtesy Car 1'] },
      ],
    },
    {
      label: 'Group A View',
      value: 'fav-2',
      resourceIds: ['mech-mark-owen', 'mech-phil-parker', 'advisor-ted-phillips', 'advisor-frank-miller', 'bay-pc-1', 'bay-pc-2', 'bay-pc-3', 'bay-lt-1', 'device-bea-950', 'device-eps-708', 'car-audi-a4-kl657og', 'car-audi-a3-kl643ju'],
      groups: [
        { label: 'Mechanics', children: [
          { label: 'Mechanic Group A', children: ['Hans Müller', 'Klaus Weber'] },
        ] },
        { label: 'Service Advisors', children: ['John Doe', 'Maria Schmidt'] },
        { label: 'Bays', children: ['Bay 1', 'Bay 2', 'Bay 3', 'Bay 4'] },
        { label: 'Devices', children: ['Diagnostic Tool A', 'Diagnostic Tool B', 'Emission Tester'] },
        { label: 'Courtesy Cars', children: ['Courtesy Car 1', 'Courtesy Car 2', 'Courtesy Car 3'] },
      ],
    },
    {
      label: 'Group B View',
      value: 'fav-3',
      resourceIds: ['mech-greg-jackson', 'mech-jeff-goldberg', 'advisor-ted-phillips', 'advisor-frank-miller', 'bay-pc-1', 'bay-pc-2', 'bay-pc-3', 'bay-lt-1', 'device-bea-950', 'device-eps-708', 'car-audi-a4-kl657og', 'car-audi-a3-kl643ju'],
      groups: [
        { label: 'Mechanics', children: [
          { label: 'Mechanic Group B', children: ['Stefan Braun', 'Erik Hoffmann'] },
        ] },
        { label: 'Service Advisors', children: ['John Doe', 'Maria Schmidt'] },
        { label: 'Bays', children: ['Bay 1', 'Bay 2', 'Bay 3', 'Bay 4'] },
        { label: 'Devices', children: ['Diagnostic Tool A', 'Diagnostic Tool B', 'Emission Tester'] },
        { label: 'Courtesy Cars', children: ['Courtesy Car 1', 'Courtesy Car 2', 'Courtesy Car 3'] },
      ],
    },
    {
      label: 'Book Next Demo',
      value: 'book-next-demo',
      resourceIds: ['mech-mark-owen', 'mech-greg-jackson', 'bay-pc-1', 'advisor-ted-phillips', 'advisor-frank-miller', 'car-audi-a4-kl657og', 'car-audi-a3-kl643ju'],
      groups: [
        { label: 'Mechanics', children: [
          { label: 'Mechanic Group A', children: ['Hans M�ller'] },
          { label: 'Mechanic Group B', children: ['Stefan Braun'] },
        ] },
        { label: 'Service Advisors', children: ['John Doe', 'Maria Schmidt'] },
        { label: 'Bays', children: ['Bay 1'] },
        { label: 'Courtesy Cars', children: ['Courtesy Car 1', 'Courtesy Car 2'] },
      ],
    },
    {
      label: 'Fav View 4',
      value: 'fav-4',
      resourceIds: ['mech-mark-owen', 'mech-phil-parker', 'mech-greg-jackson', 'mech-jeff-goldberg', 'advisor-ted-phillips', 'advisor-frank-miller', 'bay-pc-1', 'bay-pc-2', 'bay-pc-3', 'bay-lt-1', 'device-bea-950', 'device-eps-708'],
      groups: [
        { label: 'Mechanics', children: [
          { label: 'Mechanic Group A', children: ['Hans Müller', 'Klaus Weber'] },
          { label: 'Mechanic Group B', children: ['Stefan Braun', 'Erik Hoffmann'] },
        ] },
        { label: 'Service Advisors', children: ['John Doe', 'Maria Schmidt'] },
        { label: 'Bays', children: ['Bay 1', 'Bay 2', 'Bay 3', 'Bay 4'] },
        { label: 'Devices', children: ['Diagnostic Tool A', 'Diagnostic Tool B', 'Emission Tester'] },
      ],
    },
  ];

  private readonly canonicalResourceViews = [
    {
      label: 'Main Workshop',
      value: 'view-main-workshop',
      resourceIds: ['mech-scenario-flex', 'mech-mark-owen', 'mech-phil-parker', 'mech-greg-jackson', 'mech-jeff-goldberg', 'mech-kelly-hanson', 'advisor-scenario-lead', 'advisor-ted-phillips', 'advisor-frank-miller', 'bay-scenario-express', 'bay-pc-1', 'bay-pc-2', 'bay-pc-3'],
      groups: [
        { label: 'Mechanics', children: ['Scenario Flex Mechanic', 'Mark Owen', 'Phil Parker', 'Greg Jackson', 'Jeff Goldberg', 'Kelly Hanson'] },
        { label: 'Service Advisors', children: ['Scenario Service Advisor', 'Ted Phillips', 'Frank Miller'] },
        { label: 'Bays', children: ['Scenario Express Bay', 'PC Bay 1', 'PC Bay 2', 'PC Bay 3'] },
      ],
    },
    {
      label: 'MOT / Emissions',
      value: 'view-mot-emissions',
      resourceIds: ['mech-scenario-flex', 'mech-greg-jackson', 'mech-jeff-goldberg', 'advisor-scenario-lead', 'advisor-frank-miller', 'bay-scenario-express', 'bay-pc-1', 'bay-pc-2', 'bay-pc-3', 'device-bea-950'],
      groups: [
        { label: 'Mechanics', children: ['Scenario Flex Mechanic', 'Greg Jackson', 'Jeff Goldberg'] },
        { label: 'Service Advisors', children: ['Scenario Service Advisor', 'Frank Miller'] },
        { label: 'Bays', children: ['Scenario Express Bay', 'PC Bay 1', 'PC Bay 2', 'PC Bay 3'] },
        { label: 'Devices', children: ['BEA 950 Emission Tester'] },
      ],
    },
    {
      label: 'Mobility',
      value: 'view-mobility',
      resourceIds: ['advisor-scenario-lead', 'advisor-ted-phillips', 'advisor-frank-miller', 'car-scenario-courtesy', 'car-audi-a4-kl657og', 'car-audi-a3-kl643ju', 'car-bmw-320-mw112ab'],
      groups: [
        { label: 'Service Advisors', children: ['Scenario Service Advisor', 'Ted Phillips', 'Frank Miller'] },
        { label: 'Courtesy Car', children: ['Scenario Courtesy Car', 'Audi A4 KL 657 OG', 'Audi A3 KL 643 JU', 'BMW 320i MW 112 AB'] },
      ],
    },
    {
      label: 'Full Planner',
      value: 'view-full',
      resourceIds: MOCK_WORK_ORDERS.length ? ['mech-scenario-flex', 'mech-mark-owen', 'mech-phil-parker', 'mech-greg-jackson', 'mech-jeff-goldberg', 'mech-kelly-hanson', 'advisor-scenario-lead', 'advisor-ted-phillips', 'advisor-frank-miller', 'bay-scenario-express', 'bay-pc-1', 'bay-pc-2', 'bay-pc-3', 'bay-lt-1', 'bay-pc-alignment', 'device-bea-950', 'device-eps-708', 'car-scenario-courtesy', 'car-audi-a4-kl657og', 'car-audi-a3-kl643ju', 'car-bmw-320-mw112ab'] : [],
      groups: [
        { label: 'Mechanics', children: ['Scenario Flex Mechanic', 'Mark Owen', 'Phil Parker', 'Greg Jackson', 'Jeff Goldberg', 'Kelly Hanson'] },
        { label: 'Service Advisors', children: ['Scenario Service Advisor', 'Ted Phillips', 'Frank Miller'] },
        { label: 'Bays', children: ['Scenario Express Bay', 'PC Bay 1', 'PC Bay 2', 'PC Bay 3', 'LT Bay 1', 'PC Alignment'] },
        { label: 'Devices', children: ['BEA 950 Emission Tester', 'EPS 708 Diesel Tester'] },
        { label: 'Courtesy Car', children: ['Scenario Courtesy Car', 'Audi A4 KL 657 OG', 'Audi A3 KL 643 JU', 'BMW 320i MW 112 AB'] },
      ],
    },
  ];

  constructor(
    private plannerSettings: PlannerSettingsService,
    private resourceViewsService: ResourceViewsService,
    private router: Router,
    private resourceCatalogSelection: ResourceCatalogSelectionService,
    private quickViewSelection: QuickViewSelectionService,
    private workOrderRepo: WorkOrderRepository,
    private appointmentSync: AppointmentSyncService,
  ) {}

  ngOnInit(): void {
    const defaultView = this.resourceViewsService.getByValue('view-full') ?? this.resourceViewsService.getAll()[0];
    this.plannerSettings.setResourceView(defaultView);
    this.updateShellForUrl(this.router.url);
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(event => this.updateShellForUrl(event.urlAfterRedirects));
  }

  actionRibbonItems = [
    {
      label: 'Undo Booking', type: 'link' as const,
      icon: 'M15 7.5H5.86117L8.55172 4.81058L7.5 3.75L3 8.25L7.5 12.75L8.55172 11.689L5.86343 9H15C16.1935 9 17.3381 9.47411 18.182 10.318C19.0259 11.1619 19.5 12.3065 19.5 13.5C19.5 14.6935 19.0259 15.8381 18.182 16.682C17.3381 17.5259 16.1935 18 15 18H9V19.5H15C16.5913 19.5 18.1174 18.8679 19.2426 17.7426C20.3679 16.6174 21 15.0913 21 13.5C21 11.9087 20.3679 10.3826 19.2426 9.25736C18.1174 8.13214 16.5913 7.5 15 7.5Z',
      action: () => this.plannerSettings.triggerUndo(),
    },
    {
      label: 'View', type: 'dropdown' as const,
      options: [
        { label: 'Day', value: 'day' },
        { label: 'Week', value: 'week' },
        { label: 'Month', value: 'month' },
      ],
      selectedValue: 'week',
    },
    {
      label: 'Scheduler Timescale', type: 'dropdown' as const,
      options: [
        { label: '15 minutes', value: '15' },
        { label: '30 minutes', value: '30' },
        { label: '1 hour',     value: '60' },
        { label: '2 hours',    value: '120' },
      ],
      selectedValue: '60',
      onSelect: (opt: any) => this.plannerSettings.setSlotDuration(parseInt(opt.value, 10)),
    },
    {
      label: 'Settings', type: 'link' as const,
      iconViewBox: '0 0 32 32',
      icon: [
        'M27,16.76c0-.25,0-.5,0-.76s0-.51,0-.77l1.92-1.68A2,2,0,0,0,29.3,11L26.94,7a2,2,0,0,0-1.73-1,2,2,0,0,0-.64.1l-2.43.82a11.35,11.35,0,0,0-1.31-.75l-.51-2.52a2,2,0,0,0-2-1.61H13.64a2,2,0,0,0-2,1.61l-.51,2.52a11.48,11.48,0,0,0-1.32.75L7.43,6.06A2,2,0,0,0,6.79,6,2,2,0,0,0,5.06,7L2.7,11a2,2,0,0,0,.41,2.51L5,15.24c0,.25,0,.5,0,.76s0,.51,0,.77L3.11,18.45A2,2,0,0,0,2.7,21L5.06,25a2,2,0,0,0,1.73,1,2,2,0,0,0,.64-.1l2.43-.82a11.35,11.35,0,0,0,1.31.75l.51,2.52a2,2,0,0,0,2,1.61h4.72a2,2,0,0,0,2-1.61l.51-2.52a11.48,11.48,0,0,0,1.32-.75l2.42.82a2,2,0,0,0,.64.1,2,2,0,0,0,1.73-1L29.3,21a2,2,0,0,0-.41-2.51ZM25.21,24l-3.43-1.16a8.86,8.86,0,0,1-2.71,1.57L18.36,28H13.64l-.71-3.55a9.36,9.36,0,0,1-2.7-1.57L6.79,24,4.43,20l2.72-2.4a8.9,8.9,0,0,1,0-3.13L4.43,12,6.79,8l3.43,1.16a8.86,8.86,0,0,1,2.71-1.57L13.64,4h4.72l.71,3.55a9.36,9.36,0,0,1,2.7,1.57L25.21,8,27.57,12l-2.72,2.4a8.9,8.9,0,0,1,0,3.13L27.57,20Z',
        'M16,22a6,6,0,1,1,6-6A5.94,5.94,0,0,1,16,22Zm0-10a3.91,3.91,0,0,0-4,4,3.91,3.91,0,0,0,4,4,3.91,3.91,0,0,0,4-4A3.91,3.91,0,0,0,16,12Z',
      ],
      action: () => this.plannerSettings.openSettings(),
    },
  ];



  orderSummaryActionRibbonItems = [
    { label: 'Add Job', type: 'link' as const, iconViewBox: '0 0 24 24', icon: 'M1.5 12C1.5 6.225 6.225 1.5 12 1.5C17.775 1.5 22.5 6.225 22.5 12C22.5 17.775 17.775 22.5 12 22.5C6.225 22.5 1.5 17.775 1.5 12ZM12 3C16.95 3 21 7.05 21 12C21 16.95 16.95 21 12 21C7.05 21 3 16.95 3 12C3 7.05 7.05 3 12 3ZM18.3 11.55H13.05V6.3H11.55V11.55H6.3V13.05H11.55V18.3H13.05V13.05H18.3V11.55Z' },
    { label: 'Recommended Jobs', type: 'link' as const, iconViewBox: '0 0 24 24', icon: 'M10.5 15.135L7.8075 12.4425L6.75 13.5L10.5 17.25L17.25 10.5L16.1925 9.435L10.5 15.135ZM18.75 3.75H16.5V3C16.5 2.17157 15.8284 1.5 15 1.5H9C8.17157 1.5 7.5 2.17157 7.5 3V3.75H5.25C4.42157 3.75 3.75 4.42157 3.75 5.25V21C3.75 21.8284 4.42157 22.5 5.25 22.5H18.75C19.5784 22.5 20.25 21.8284 20.25 21V5.25C20.25 4.42157 19.5784 3.75 18.75 3.75ZM9 3H15V6H9V3ZM5.25 21H18.75V5.25H16.5V7.5H7.5V5.25H5.25V21Z' },
    { label: 'Findings', type: 'link' as const, iconViewBox: '0 0 24 24', icon: 'M21.7499 20.6925L16.0859 15.0285C18.9133 11.6341 18.5707 6.61613 15.3082 3.63745C12.0458 0.658765 7.01746 0.773029 3.89366 3.89683C0.769855 7.02063 0.655591 12.0489 3.63427 15.3114C6.61295 18.5739 11.6309 18.9164 15.0253 16.089L20.6894 21.7531L21.7499 20.6925ZM2.99994 9.75312C2.99994 6.02519 6.02202 3.00312 9.74994 3.00312C13.4779 3.00312 16.4999 6.02519 16.4999 9.75312C16.4999 13.481 13.4779 16.5031 9.74994 16.5031C6.02373 16.499 3.00408 13.4793 2.99994 9.75312Z' },
    { label: 'Add Footer Text', type: 'link' as const, iconViewBox: '0 0 24 24', icon: 'M1.5 12C1.5 6.225 6.225 1.5 12 1.5C17.775 1.5 22.5 6.225 22.5 12C22.5 17.775 17.775 22.5 12 22.5C6.225 22.5 1.5 17.775 1.5 12ZM12 3C16.95 3 21 7.05 21 12C21 16.95 16.95 21 12 21C7.05 21 3 16.95 3 12C3 7.05 7.05 3 12 3ZM18.3 11.55H13.05V6.3H11.55V11.55H6.3V13.05H11.55V18.3H13.05V13.05H18.3V11.55Z' },
    { label: 'Order Details', type: 'link' as const, iconViewBox: '0 0 24 24', icon: 'M17.25 22.5H12V21H17.25V22.5ZM8.37793 3C8.7775 2.9998 9.16065 3.15903 9.44238 3.44238L12 6H21C21.8284 6 22.5 6.67157 22.5 7.5V13.5H21V7.5H11.3779L10.9424 7.05762L8.37793 4.5H3V19.5H10.5V21H3C2.17157 21 1.5 20.3284 1.5 19.5V4.5C1.5 3.67157 2.17157 3 3 3H8.37793ZM22.5 19.5H12V18H22.5V19.5ZM22.5 16.5H12V15H22.5V16.5Z' },
    { label: 'Print Service Order', type: 'link' as const, iconViewBox: '0 0 24 24', icon: 'M21 6.75H18.75V2.25H5.25V6.75H3C2.17157 6.75 1.5 7.42157 1.5 8.25V15.75C1.5 16.5784 2.17157 17.25 3 17.25H5.25V21.75H18.75V17.25H21C21.8284 17.25 22.5 16.5784 22.5 15.75V8.25C22.5 7.42157 21.8284 6.75 21 6.75ZM6.75 3.75H17.25V6.75H6.75V3.75ZM17.25 20.25H6.75V12.75H17.25V20.25ZM21 15.75H18.75V11.25H5.25V15.75H3V8.25H21V15.75Z' },
  ];
  transactionSummaryActionRibbonItems = [
    { label: 'Resume Workflow', type: 'link' as const, iconViewBox: '0 0 20 20', icon: 'M8.75 12.5L12.5 10L8.75 7.5V12.5ZM10 1.875C5.5125 1.875 1.875 5.5125 1.875 10C1.875 14.4875 5.5125 18.125 10 18.125C14.4875 18.125 18.125 14.4875 18.125 10C18.125 5.5125 14.4875 1.875 10 1.875Z', action: () => this.router.navigate(['/orders', this.currentOrderReference(), 'summary']) },
    { label: 'Order Summary', type: 'link' as const, iconViewBox: '0 0 20 20', icon: 'M3.75 2.5H16.25V17.5H3.75V2.5ZM5 3.75V16.25H15V3.75H5ZM6.25 6.25H13.75V7.5H6.25V6.25ZM6.25 9.375H13.75V10.625H6.25V9.375ZM6.25 12.5H11.25V13.75H6.25V12.5Z' },
    { label: 'Alerts', type: 'link' as const, iconViewBox: '0 0 20 20', icon: 'M10 1.875L1.875 16.25H18.125L10 1.875ZM10.625 14.375H9.375V13.125H10.625V14.375ZM10.625 11.875H9.375V6.875H10.625V11.875Z' },
    { label: 'Remarks', type: 'link' as const, iconViewBox: '0 0 20 20', icon: 'M3.75 3.75H16.25V13.75H6.25L3.75 16.25V3.75ZM5 5V13.2325L5.7325 12.5H15V5H5Z' },
    { label: 'Attachments', type: 'link' as const, iconViewBox: '0 0 20 20', icon: 'M6.25 15.625C4.525 15.625 3.125 14.225 3.125 12.5V5.625C3.125 3.9 4.525 2.5 6.25 2.5H13.75C15.475 2.5 16.875 3.9 16.875 5.625V14.375H15.625V5.625C15.625 4.5875 14.7875 3.75 13.75 3.75H6.25C5.2125 3.75 4.375 4.5875 4.375 5.625V12.5C4.375 13.5375 5.2125 14.375 6.25 14.375H13.125V15.625H6.25Z' },
    { label: 'Cancel Transaction', type: 'link' as const, iconViewBox: '0 0 20 20', icon: 'M10 1.875C5.5125 1.875 1.875 5.5125 1.875 10C1.875 14.4875 5.5125 18.125 10 18.125C14.4875 18.125 18.125 14.4875 18.125 10C18.125 5.5125 14.4875 1.875 10 1.875ZM13.125 13.75L10 10.625L6.875 13.75L6.25 13.125L9.375 10L6.25 6.875L6.875 6.25L10 9.375L13.125 6.25L13.75 6.875L10.625 10L13.75 13.125L13.125 13.75Z' },
  ];
  appointmentSelectionActionRibbonItems = [
    {
      label: 'Open in Service Planner', type: 'link' as const,
      iconViewBox: '0 0 24 24',
      icon: 'M19.5 3H16.5V1.5H15V3H9V1.5H7.5V3H4.5C3.675 3 3 3.675 3 4.5V19.5C3 20.325 3.675 21 4.5 21H19.5C20.325 21 21 20.325 21 19.5V4.5C21 3.675 20.325 3 19.5 3ZM19.5 19.5H4.5V9H19.5V19.5ZM19.5 7.5H4.5V4.5H7.5V6H9V4.5H15V6H16.5V4.5H19.5V7.5Z',
      action: () => this.router.navigate(['/orders', this.currentOrderReference(), 'service-planner']),
    },
    {
      label: 'Quick view', type: 'link' as const,
      iconViewBox: '0 0 24 24',
      icon: ['M12 22.5C9.9233 22.5 7.89323 21.8842 6.16652 20.7304C4.4398 19.5767 3.09399 17.9368 2.29927 16.0182C1.50455 14.0996 1.29661 11.9884 1.70176 9.95156C2.1069 7.91476 3.10693 6.04383 4.57538 4.57538C6.04383 3.10693 7.91476 2.1069 9.95156 1.70176C11.9884 1.29661 14.0996 1.50455 16.0182 2.29927C17.9368 3.09399 19.5767 4.4398 20.7304 6.16652C21.8842 7.89323 22.5 9.9233 22.5 12C22.5 14.7848 21.3938 17.4555 19.4246 19.4246C17.4555 21.3938 14.7848 22.5 12 22.5ZM12 3C10.22 3 8.47992 3.52785 6.99987 4.51678C5.51983 5.50571 4.36628 6.91132 3.68509 8.55585C3.0039 10.2004 2.82567 12.01 3.17294 13.7558C3.5202 15.5016 4.37737 17.1053 5.63604 18.364C6.89472 19.6226 8.49836 20.4798 10.2442 20.8271C11.99 21.1743 13.7996 20.9961 15.4442 20.3149C17.0887 19.6337 18.4943 18.4802 19.4832 17.0001C20.4722 15.5201 21 13.78 21 12C21 9.61306 20.0518 7.32387 18.364 5.63604C16.6761 3.94822 14.387 3 12 3Z', 'M15.4425 16.5L11.25 12.3075V5.25H12.75V11.685L16.5 15.4425L15.4425 16.5Z'],
      action: () => this.router.navigate(['/orders', this.currentOrderReference(), 'quick-view']),
    },
  ];
  resourceEditorActionRibbonItems = [
    {
      label: 'Add Resource', type: 'link' as const,
      iconViewBox: '0 0 20 20',
      icon: 'M15.25 9.625H10.875V5.25H9.625V9.625H5.25V10.875H9.625V15.25H10.875V10.875H15.25V9.625Z',
      action: () => this.openResourceCatalogForCurrentView(),
    },
    {
      label: 'Filter', type: 'link' as const,
      iconViewBox: '0 0 20 20',
      icon: 'M11.25 15H8.75V13.75H11.25V15ZM15 10.625H5V9.375H15V10.625ZM17.5 6.25H2.5V5H17.5V6.25Z',
      action: () => console.log('Filter resources'),
    },
    {
      label: 'Columns', type: 'link' as const,
      iconViewBox: '0 0 20 20',
      icon: 'M3.75 3.75V16.25H7.5V3.75H3.75ZM2.5 3.75C2.5 3.05964 3.05964 2.5 3.75 2.5H16.25C16.9404 2.5 17.5 3.05964 17.5 3.75V16.25C17.5 16.9404 16.9404 17.5 16.25 17.5H3.75C3.05964 17.5 2.5 16.9404 2.5 16.25V3.75ZM8.75 16.25H11.25V3.75H8.75V16.25ZM12.5 16.25H16.25V3.75H12.5V16.25Z',
      action: () => console.log('Configure columns'),
    },
  ];

  topPanelTiles: TopPanelTile[] = this.buildTopPanelTiles(this.activeOrder());

  private buildTopPanelTiles(order: WorkOrder | null): TopPanelTile[] {
    if (!order) return [];
    return [
    {
      type: 'vehicle',
      label: 'Vehicle',
      primaryValue: order.vehicle.licensePlate,
      details: [
        `${order.vehicle.make} ${order.vehicle.model}`,
        order.vehicle.location ?? order.customer.city ?? '',
        order.vehicle.mileage ? `${order.vehicle.mileage} km` : '',
      ].filter(Boolean),
      iconSvg: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="16" height="16" fill="white" style="mix-blend-mode:multiply"/><path fill-rule="evenodd" clip-rule="evenodd" d="M14.67 7.97L10.805 6.58L9.185 4.55C8.90029 4.2021 8.47455 4.00025 8.025 4H4.025C3.5296 4.00256 3.06742 4.24956 2.79 4.66L1.435 6.66C1.15431 7.0713 1.00284 7.55705 1 8.055V12C1 12.2761 1.22386 12.5 1.5 12.5H2.57C2.8067 13.371 3.59743 13.9755 4.5 13.9755C5.40257 13.9755 6.1933 13.371 6.43 12.5H9.57C9.8067 13.371 10.5974 13.9755 11.5 13.9755C12.4026 13.9755 13.1933 13.371 13.43 12.5H14.5C14.7761 12.5 15 12.2761 15 12V8.44C14.9999 8.22949 14.868 8.04157 14.67 7.97ZM4.5 13C3.94772 13 3.5 12.5523 3.5 12C3.5 11.4477 3.94772 11 4.5 11C5.05228 11 5.5 11.4477 5.5 12C5.5 12.5523 5.05228 13 4.5 13ZM11.5 13C10.9477 13 10.5 12.5523 10.5 12C10.5 11.4477 10.9477 11 11.5 11C12.0523 11 12.5 11.4477 12.5 12C12.5 12.5523 12.0523 13 11.5 13ZM14 11.5H13.43C13.1933 10.629 12.4026 10.0245 11.5 10.0245C10.5974 10.0245 9.8067 10.629 9.57 11.5H6.43C6.1933 10.629 5.40257 10.0245 4.5 10.0245C3.59743 10.0245 2.8067 10.629 2.57 11.5H2V8.055C1.99981 7.75361 2.09041 7.45915 2.26 7.21L3.615 5.21C3.71037 5.076 3.86555 4.99748 4.03 5H8.03C8.17872 4.99976 8.31982 5.06573 8.415 5.18L10.115 7.315C10.1736 7.38607 10.2493 7.44112 10.335 7.475L14 8.79V11.5Z" fill="black"/></svg>`,
    },
    {
      type: 'billing',
      label: 'Billing',
      primaryValue: order.billingParty?.name ?? order.customer.name,
      details: [
        order.billingParty?.address ?? order.customer.address ?? '',
        order.billingParty?.city ?? order.customer.city ?? '',
        order.billingParty?.country ?? order.customer.country ?? '',
      ].filter(Boolean),
      iconSvg: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 8.99825C15.001 8.49758 14.8767 8.00461 14.6384 7.56428C14.4001 7.12396 14.0554 6.75028 13.6357 6.4773C13.2159 6.20433 12.7346 6.04074 12.2354 6.00144C11.7363 5.96215 11.2353 6.0484 10.778 6.25234C10.3208 6.45627 9.92182 6.77141 9.61755 7.16902C9.31328 7.56663 9.11336 8.03407 9.03601 8.52874C8.95867 9.0234 9.00636 9.52956 9.17473 10.0011C9.34311 10.4726 9.62681 10.8945 9.99999 11.2283V14.9983L12 14.052L14 14.9983V11.2283C14.3143 10.9479 14.5659 10.6044 14.7382 10.2201C14.9106 9.83579 14.9998 9.41942 15 8.99825Z" fill="#161616"/><path d="M8 7H4.5V8H8V7Z" fill="black"/><path d="M9.5 4H4.5V5H9.5V4Z" fill="black"/><path d="M3 15C2.73487 14.9997 2.48068 14.8943 2.2932 14.7068C2.10572 14.5193 2.00028 14.2651 2 14V2C2.00028 1.73487 2.10572 1.48068 2.2932 1.2932C2.48068 1.10572 2.73487 1.00028 3 1H11C11.2651 1.00028 11.5193 1.10572 11.7068 1.2932C11.8943 1.48068 11.9997 1.73487 12 2V4H11V2H3V14H8V15H3Z" fill="black"/></svg>`,
    },
    {
      type: 'payer',
      label: 'Assigned payer',
      primaryValue: 'Customer',
      payerRows: [
        { label: 'Customer', value: '3,50' },
        { label: 'Contract', value: '0,00' },
        { label: 'Warranty', value: '0,00' },
        { label: 'Internal', value: '0,00' },
      ],
      iconSvg: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4.5 7C4.00555 7 3.5222 6.85338 3.11108 6.57867C2.69996 6.30397 2.37952 5.91352 2.19031 5.45671C2.00109 4.99989 1.95158 4.49723 2.04804 4.01228C2.1445 3.52732 2.38261 3.08187 2.73224 2.73223C3.08187 2.3826 3.52733 2.1445 4.01228 2.04804C4.49723 1.95157 4.9999 2.00108 5.45671 2.1903C5.91353 2.37952 6.30397 2.69995 6.57868 3.11108C6.85338 3.5222 7 4.00555 7 4.5C6.99928 5.16282 6.73565 5.79828 6.26697 6.26696C5.79828 6.73565 5.16282 6.99927 4.5 7Z" fill="#161616"/><path d="M13.293 2.00002L2 13.293L2.70704 14L14 2.70706L13.293 2.00002Z" fill="#161616"/><path d="M11.5 14C11.0056 14 10.5222 13.8534 10.1111 13.5787C9.69996 13.304 9.37953 12.9135 9.19031 12.4567C9.00109 11.9999 8.95158 11.4972 9.04804 11.0123C9.14451 10.5273 9.38261 10.0819 9.73224 9.73223C10.0819 9.3826 10.5273 9.1445 11.0123 9.04804C11.4972 8.95157 11.9999 9.00108 12.4567 9.1903C12.9135 9.37952 13.304 9.69995 13.5787 10.1111C13.8534 10.5222 14 11.0055 14 11.5C13.9993 12.1628 13.7357 12.7983 13.267 13.267C12.7983 13.7356 12.1628 13.9993 11.5 14Z" fill="#161616"/></svg>`,
    },
    ];
  }

  onPause(): void { console.log('Pause Workflow'); }
  onPrevious(): void {
    const cleanUrl = this.router.url.split('?')[0].split('#')[0];

    if (cleanUrl.includes('/appointment-selection')) {
      this.router.navigate(['/orders', this.currentOrderReference(), 'summary']);
      return;
    }

    if (cleanUrl.includes('/summary')) {
      this.router.navigate(['/transactions', 'offer']);
      return;
    }

    console.log('Previous Task');
  }

  onNext(): void {
    const cleanUrl = this.router.url.split('?')[0].split('#')[0];

    if (cleanUrl.includes('/summary')) {
      this.router.navigate(['/orders', this.currentOrderReference(), 'appointment-selection']);
      return;
    }

    if (cleanUrl.includes('/appointment-selection')) {
      this.router.navigate(['/orders', this.currentOrderReference(), 'service-planner']);
      return;
    }

    console.log('Next Task');
  }
  onCloseSubpage(): void { this.closeCurrentSubpage(); }
  onSaveAndCloseSubpage(): void { this.saveAndCloseCurrentSubpage(); }

  private openResourceViewEditor(option: any): void {
    if (!option?.value) return;
    const returnTo = this.getResourceEditorReturnUrl();

    this.router.navigate(['/resource-views', option.value, 'edit'], {
      queryParams: { label: option.label, returnTo },
      state: { resourceView: this.resourceViewsService.getByValue(option.value) ?? option },
    });
  }

  private getResourceEditorReturnUrl(): string {
    const cleanUrl = this.router.url.split('?')[0].split('#')[0];
    return cleanUrl.startsWith('/orders/') ? cleanUrl : '/service-planner';
  }

  private getResourceEditorReturnTarget(): string {
    const queryParams = this.router.parseUrl(this.router.url).queryParams;
    const returnTo = queryParams['plannerReturnTo'] ?? queryParams['returnTo'] ?? history.state?.plannerReturnTo;
    return typeof returnTo === 'string' && returnTo.startsWith('/') ? returnTo : '/service-planner';
  }

  private getResourceViewsListReturnTarget(): string {
    const returnTo = this.router.parseUrl(this.router.url).queryParams['returnTo'];
    return typeof returnTo === 'string' && returnTo.startsWith('/') ? returnTo : '/service-planner';
  }

  private openResourceCatalogForCurrentView(): void {
    const cleanUrl = this.router.url.split('?')[0].split('#')[0];
    const newView = cleanUrl.startsWith('/resource-views/') ? null : this.resourceViewsService.createNewView();
    const returnTo = cleanUrl.startsWith('/resource-views/') ? cleanUrl : `/resource-views/${newView!.value}/edit`;
    const queryParams = this.router.parseUrl(this.router.url).queryParams;
    const plannerReturnTo = queryParams['plannerReturnTo'] ?? queryParams['returnTo'] ?? '/service-planner';
    const viewId = returnTo.match(/^\/resource-views\/([^/]+)\/edit/)?.[1];
    const resourceView = this.resourceViewsService.getByValue(viewId) ?? newView ?? this.resourceViewsService.createNewView();

    this.router.navigate(['/resource-catalog'], {
      queryParams: { returnTo, plannerReturnTo, listReturnTo: '/resource-views' },
      state: { resourceView },
    });
  }

  private currentOrderReference(): string {
    return this.activeOrder()?.referenceNumber ?? '014826312';
  }

  private resolveOrderForUrl(cleanUrl: string): WorkOrder | null {
    const orderId = cleanUrl.match(/^\/orders\/([^/]+)/)?.[1];
    if (orderId) {
      const decodedOrderId = decodeURIComponent(orderId);
      this.workOrderRepo.getById(decodedOrderId).subscribe(order => {
        if (!order) return;
        this.activeOrder.set(order);
        this.topPanelTiles = this.buildTopPanelTiles(order);
      });
      const activeOrder = this.activeOrder();
      return activeOrder?.id === decodedOrderId || activeOrder?.referenceNumber === decodedOrderId
        ? activeOrder
        : findWorkOrderByIdOrReference(decodedOrderId) ?? null;
    }

    const transactionId = cleanUrl.match(/^\/transactions\/([^/]+)\/summary/)?.[1];
    const transaction = findTransactionById(transactionId);
    if (transaction) return findWorkOrderByIdOrReference(transaction.workOrderId) ?? null;

    return this.activeOrder() ?? findWorkOrderByIdOrReference('014826312') ?? null;
  }

  private updateShellForUrl(url: string): void {
    const cleanUrl = url.split('?')[0].split('#')[0];
    const contextOrder = this.resolveOrderForUrl(cleanUrl);
    this.activeOrder.set(contextOrder);
    this.topPanelTiles = this.buildTopPanelTiles(contextOrder);
    const isHome = cleanUrl === '/';
    const isTransactionSummary = cleanUrl === '/transaction-summary' || /^\/transactions\/[^/]+\/summary$/.test(cleanUrl);
    const isTransactions = cleanUrl.startsWith('/transactions/') && !isTransactionSummary;
    const isTransactionsOffer = cleanUrl === '/transactions/offer';
    const isOrderWorkflow = cleanUrl.startsWith('/orders/');
    const isAppointmentSelection = cleanUrl.includes('/appointment-selection');
    const isQuickView = /^\/orders\/[^/]+\/quick-view$/.test(cleanUrl);
    const isOrderSummary = isOrderWorkflow && cleanUrl.includes('/summary');
    const isFullServicePlanner = cleanUrl === '/service-planner';
    const isOrderServicePlanner = /^\/orders\/[^/]+\/service-planner$/.test(cleanUrl);
    const isServicePlanner = isFullServicePlanner || isOrderServicePlanner;
    const isResourceViewsList = cleanUrl === '/resource-views';
    const isResourceEditor = cleanUrl.startsWith('/resource-views/');
    const isResourceCatalog = cleanUrl.startsWith('/resource-catalog');
    this.isHomePage.set(isHome);
    this.isTransactionsPage.set(isTransactions);
    this.isTransactionsOfferPage.set(isTransactionsOffer);
    this.isTransactionSummaryPage.set(isTransactionSummary);
    this.isOrderWorkflowPage.set(isOrderWorkflow);
    this.isAppointmentSelectionPage.set(isAppointmentSelection);
    this.isQuickViewPage.set(isQuickView);
    this.isOrderSummaryPage.set(isOrderSummary);
    this.isServicePlannerPage.set(isServicePlanner);
    this.isOrderServicePlannerPage.set(isOrderServicePlanner);
    this.isFullServicePlannerPage.set(isFullServicePlanner);
    this.isResourceEditorPage.set(isResourceEditor || isResourceViewsList);
    this.isResourceCatalogPage.set(isResourceCatalog);
    const viewId = cleanUrl.match(/^\/resource-views\/([^/?#]+)\/edit/)?.[1];
    const view = this.resourceViewsService.getByValue(viewId);
    this.resourceEditorReference.set(view?.label ?? '');

    if (isResourceViewsList) {
      this.shellTitle.set('Resource views');
      this.shellReference.set('Service Planner');
      this.shellBreadcrumbs.set([{ label: 'Service Planner' }]);
      return;
    }

    if (isResourceEditor) {
      this.shellTitle.set('Resources');
      this.shellReference.set(view?.label ?? '');
      this.shellBreadcrumbs.set([{ label: 'Service Planner' }]);
      return;
    }

    if (isServicePlanner) {
      this.shellTitle.set('Service Planner');
      this.shellReference.set(isOrderServicePlanner ? this.currentOrderReference() : '');
      this.shellBreadcrumbs.set([]);
      return;
    }

    if (isResourceCatalog) {
      const groupId = cleanUrl.match(/^\/resource-catalog\/([^/?#]+)/)?.[1];
      const groupLabel = groupId ? this.toTitleCase(decodeURIComponent(groupId).replace(/-/g, ' ')) : '';
      this.shellTitle.set(groupLabel || 'Resource Catalog');
      this.shellReference.set(groupLabel ? 'Resource Catalog' : 'Catalog List');
      this.shellBreadcrumbs.set(groupLabel
        ? [{ label: 'Service Planner' }, { label: 'Resources' }, { label: 'Resource Catalog' }]
        : [{ label: 'Service Planner' }, { label: 'Resources' }]
      );
      return;
    }

    if (isHome || isTransactions) {
      this.shellTitle.set('');
      this.shellReference.set('');
      this.shellBreadcrumbs.set([]);
      return;
    }

    if (isTransactionSummary) {
      this.shellTitle.set('Transaction Summary');
      this.shellReference.set(this.currentOrderReference());
      this.shellBreadcrumbs.set([]);
      return;
    }

    if (isOrderSummary) {
      this.shellTitle.set('Order Summary');
      this.shellReference.set(this.currentOrderReference());
      this.shellBreadcrumbs.set([]);
      return;
    }

    if (isAppointmentSelection) {
      this.shellTitle.set('Appointment Selection');
      this.shellReference.set(this.currentOrderReference());
      this.shellBreadcrumbs.set([]);
      return;
    }

    if (isQuickView) {
      this.shellTitle.set('Appointment Timeslots - Quick view');
      this.shellReference.set(this.currentOrderReference());
      this.shellBreadcrumbs.set([]);
      return;
    }

    this.shellTitle.set('Service Planner');
    this.shellReference.set(this.currentOrderReference());
    this.shellBreadcrumbs.set([]);
  }

  private closeCurrentSubpage(): void {
    const cleanUrl = this.router.url.split('?')[0].split('#')[0];

    if (/^\/orders\/[^/]+\/service-planner$/.test(cleanUrl)) {
      this.router.navigate(['/orders', this.currentOrderReference(), 'appointment-selection']);
      return;
    }

    if (/^\/orders\/[^/]+\/quick-view$/.test(cleanUrl)) {
      this.saveQuickViewSelectionAndReturn();
      return;
    }

    if (cleanUrl === '/service-planner') {
      this.router.navigate(['/']);
      return;
    }

    if (cleanUrl === '/resource-views') {
      this.router.navigateByUrl(this.getResourceViewsListReturnTarget());
      return;
    }

    if (cleanUrl.startsWith('/resource-views/')) {
      const viewId = cleanUrl.match(/^\/resource-views\/([^/]+)\/edit/)?.[1];
      const resourceView = viewId ? this.resourceViewsService.getByValue(decodeURIComponent(viewId)) : undefined;
      this.router.navigateByUrl(this.getResourceEditorReturnTarget());
      return;
    }

    if (this.router.url.startsWith('/transactions/')) {
      this.router.navigate(['/']);
      return;
    }

    if (this.router.url.startsWith('/resource-catalog')) {
      this.resourceCatalogSelection.clear();
    }

    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    this.router.navigate(['/']);
  }

  private saveAndCloseCurrentSubpage(): void {
    const cleanUrl = this.router.url.split('?')[0].split('#')[0];

    if (this.router.url.startsWith('/transactions/')) {
      this.router.navigate(['/']);
      return;
    }

    if (/^\/orders\/[^/]+\/quick-view$/.test(cleanUrl)) {
      this.router.navigate(['/orders', this.currentOrderReference(), 'appointment-selection']);
      return;
    }

    if (cleanUrl === '/resource-views') {
      this.router.navigateByUrl(this.getResourceViewsListReturnTarget());
      return;
    }

    if (cleanUrl.startsWith('/resource-views/')) {
      this.router.navigateByUrl(this.getResourceEditorReturnTarget());
      return;
    }

    if (this.router.url.startsWith('/resource-catalog')) {
      const queryParams = this.router.parseUrl(this.router.url).queryParams;
      const returnTo = queryParams['returnTo'];
      const plannerReturnTo = queryParams['plannerReturnTo'];
      const listReturnTo = queryParams['listReturnTo'];
      const selectedResources = this.resourceCatalogSelection.consumeSelection();
      const updatedView = this.addResourcesToCurrentView(returnTo, selectedResources);
      const isNewResourceView = typeof returnTo === 'string' && /^\/resource-views\/new-\d+\/edit$/.test(returnTo);
      const navigationState = {
        ...(selectedResources.length ? { addedResources: selectedResources } : {}),
        ...(updatedView ? { resourceView: updatedView } : {}),
        ...(typeof plannerReturnTo === 'string' ? { plannerReturnTo } : {}),
      };

      const target = isNewResourceView && typeof listReturnTo === 'string' ? listReturnTo : returnTo;
      this.router.navigateByUrl(target || '/', {
        state: Object.keys(navigationState).length ? navigationState : undefined,
      });
      return;
    }

    this.router.navigate(['/']);
  }

  private toTitleCase(value: string): string {
    return value.replace(/\b\w/g, character => character.toUpperCase());
  }

  private addResourcesToCurrentView(returnTo: unknown, selectedResources: Array<{ id: string; name: string; group: string; subgroup?: string }>): any | null {
    if (!selectedResources.length) return null;
    const viewId = typeof returnTo === 'string' ? returnTo.match(/^\/resource-views\/([^/]+)\/edit/)?.[1] : undefined;
    const existingView = this.resourceViewsService.getByValue(viewId);
    const navigationView = history.state?.resourceView;
    const baseView = existingView ?? navigationView ?? this.resourceViewsService.createNewView();
    const ids = new Set(baseView.resourceIds ?? []);
    const groups: Array<{ label: string; children: string[] }> = (baseView.groups ?? []).map((group: { label: string; children: string[] }) => ({ ...group, children: [...group.children] }));

    selectedResources.forEach(resource => {
      ids.add(resource.id);
      const group = groups.find((candidate: { label: string; children: string[] }) => candidate.label === resource.group);
      if (!group) {
        groups.push({ label: resource.group, children: [resource.name] });
        return;
      }
      if (!group.children.some((child: string) => child === resource.name)) group.children.push(resource.name);
    });

    const updatedView = this.resourceViewsService.upsert({
      ...baseView,
      label: baseView.label || 'New 1',
      value: baseView.value ?? viewId,
      resourceIds: [...ids],
      groups,
    });
    return updatedView;
  }

  private saveQuickViewSelectionAndReturn(): void {
    const order = this.activeOrder();
    const selection = order ? this.quickViewSelection.consumeSelection(order.id) : null;
    const target = ['/orders', this.currentOrderReference(), 'appointment-selection'];

    if (!order || !selection) {
      this.router.navigate(target);
      return;
    }

    this.appointmentSync.updateAppointment(order.id, selection.checkinStart, selection.handoverEnd).subscribe(savedOrder => {
      if (savedOrder) {
        this.activeOrder.set(savedOrder);
        this.topPanelTiles = this.buildTopPanelTiles(savedOrder);
      }
      this.router.navigate(target);
    });
  }
}
