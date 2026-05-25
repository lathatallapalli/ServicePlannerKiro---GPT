import { UnavailabilityBlock } from '../../models/availability.model';
import { Qualification, Resource, ResourceGroup } from '../../models/resource.model';
import { ScheduleEntry } from '../../models/schedule.model';
import { WorkOrder } from '../../models/work-order.model';
import { JobResourceRequirement } from '../../models/job.model';

export const QUALIFICATIONS = {
  generalService: { id: 'q-general-service', name: 'General Service' },
  diagnostics: { id: 'q-diagnostics', name: 'Diagnostics' },
  tyres: { id: 'q-tyres', name: 'Tyres' },
  battery: { id: 'q-battery', name: 'Battery' },
  mot: { id: 'q-mot', name: 'MOT' },
  emissions: { id: 'q-emissions', name: 'Emissions' },
  brakes: { id: 'q-brakes', name: 'Brakes' },
} satisfies Record<string, Qualification>;

export const MOCK_GROUPS: ResourceGroup[] = [
  { id: 'group-mechanics', name: 'Mechanics', resourceType: 'mechanic' },
  { id: 'group-advisors', name: 'Service Advisors', resourceType: 'advisor' },
  { id: 'group-bays', name: 'Bays', resourceType: 'bay' },
  { id: 'group-devices', name: 'Devices', resourceType: 'device' },
  { id: 'group-courtesy-cars', name: 'Courtesy Car', resourceType: 'driver' },
];

export const MOCK_RESOURCES: Resource[] = [
  {
    id: 'mech-scenario-flex',
    name: 'Scenario Flex Mechanic',
    type: 'mechanic',
    groupId: 'group-mechanics',
    qualifications: [QUALIFICATIONS.generalService, QUALIFICATIONS.diagnostics, QUALIFICATIONS.tyres, QUALIFICATIONS.battery, QUALIFICATIONS.mot, QUALIFICATIONS.emissions, QUALIFICATIONS.brakes],
  },
  { id: 'advisor-scenario-lead', name: 'Scenario Service Advisor', type: 'advisor', groupId: 'group-advisors', qualifications: [] },
  { id: 'bay-scenario-express', name: 'Scenario Express Bay', type: 'bay', groupId: 'group-bays', qualifications: [] },
  { id: 'car-scenario-courtesy', name: 'Scenario Courtesy Car', type: 'driver', groupId: 'group-courtesy-cars', qualifications: [] },
  {
    id: 'mech-mark-owen',
    name: 'Mark Owen',
    type: 'mechanic',
    groupId: 'group-mechanics',
    qualifications: [QUALIFICATIONS.generalService, QUALIFICATIONS.tyres, QUALIFICATIONS.battery, QUALIFICATIONS.diagnostics],
  },
  {
    id: 'mech-phil-parker',
    name: 'Phil Parker',
    type: 'mechanic',
    groupId: 'group-mechanics',
    qualifications: [QUALIFICATIONS.generalService, QUALIFICATIONS.brakes, QUALIFICATIONS.diagnostics],
  },
  {
    id: 'mech-greg-jackson',
    name: 'Greg Jackson',
    type: 'mechanic',
    groupId: 'group-mechanics',
    qualifications: [QUALIFICATIONS.generalService, QUALIFICATIONS.mot, QUALIFICATIONS.emissions],
  },
  {
    id: 'mech-jeff-goldberg',
    name: 'Jeff Goldberg',
    type: 'mechanic',
    groupId: 'group-mechanics',
    qualifications: [QUALIFICATIONS.generalService, QUALIFICATIONS.brakes, QUALIFICATIONS.diagnostics],
  },
  {
    id: 'mech-kelly-hanson',
    name: 'Kelly Hanson',
    type: 'mechanic',
    groupId: 'group-mechanics',
    qualifications: [QUALIFICATIONS.generalService, QUALIFICATIONS.battery, QUALIFICATIONS.diagnostics],
  },
  { id: 'advisor-ted-phillips', name: 'Ted Phillips', type: 'advisor', groupId: 'group-advisors', qualifications: [] },
  { id: 'advisor-frank-miller', name: 'Frank Miller', type: 'advisor', groupId: 'group-advisors', qualifications: [] },
  { id: 'bay-pc-1', name: 'PC Bay 1', type: 'bay', groupId: 'group-bays', qualifications: [] },
  { id: 'bay-pc-2', name: 'PC Bay 2', type: 'bay', groupId: 'group-bays', qualifications: [] },
  { id: 'bay-pc-3', name: 'PC Bay 3', type: 'bay', groupId: 'group-bays', qualifications: [] },
  { id: 'bay-lt-1', name: 'LT Bay 1', type: 'bay', groupId: 'group-bays', qualifications: [] },
  { id: 'bay-pc-alignment', name: 'PC Alignment', type: 'bay', groupId: 'group-bays', qualifications: [] },
  { id: 'device-bea-950', name: 'BEA 950 Emission Tester', type: 'device', groupId: 'group-devices', qualifications: [QUALIFICATIONS.emissions] },
  { id: 'device-eps-708', name: 'EPS 708 Diesel Tester', type: 'device', groupId: 'group-devices', qualifications: [QUALIFICATIONS.diagnostics] },
  { id: 'car-audi-a4-kl657og', name: 'Audi A4 KL 657 OG', type: 'driver', groupId: 'group-courtesy-cars', qualifications: [] },
  { id: 'car-audi-a3-kl643ju', name: 'Audi A3 KL 643 JU', type: 'driver', groupId: 'group-courtesy-cars', qualifications: [] },
  { id: 'car-bmw-320-mw112ab', name: 'BMW 320i MW 112 AB', type: 'driver', groupId: 'group-courtesy-cars', qualifications: [] },
];

const baseDate = new Date('2024-04-10');
const mockCurrentTime = new Date('2024-04-15T09:00:00');

const getTimedExecutionStatus = (start: Date, end: Date) => {
  if (end <= mockCurrentTime) return 'completed' as const;
  if (start <= mockCurrentTime && mockCurrentTime < end) return 'in-progress' as const;
  return 'scheduled' as const;
};

const defaultActivityItems = [
  { templateId: 'act-checkin', title: 'Check-In', resourceType: 'advisor' as const, resourceLabel: 'Service Advisor', fru: 0.5, estimatedDurationMinutes: 30 },
  { templateId: 'act-handover', title: 'Handover', resourceType: 'advisor' as const, resourceLabel: 'Service Advisor', fru: 0.5, estimatedDurationMinutes: 30 },
];

const optionalActivityItems = [
  { templateId: 'act-mobility', title: 'Mobility Service', resourceType: 'driver' as const, resourceLabel: 'Courtesy Car', fru: 1, estimatedDurationMinutes: 60 },
];

const orderLifecycleScenarios: Record<string, {
  status: WorkOrder['status'];
  workflowState: NonNullable<WorkOrder['workflowState']>;
}> = {
  '014826455': { status: 'new', workflowState: 'request' },
  '014826312': { status: 'edit', workflowState: 'offer' },
  '014826500': { status: 'preparation', workflowState: 'preparation' },
  '014826501': { status: 'preparation', workflowState: 'preparation' },
  '014826502': { status: 'preparation', workflowState: 'preparation' },
  '014826503': { status: 'preparation', workflowState: 'checkin' },
  '014826504': { status: 'preparation', workflowState: 'preparation' },
  '014826505': { status: 'preparation', workflowState: 'execution' },
  '014826506': { status: 'preparation', workflowState: 'preparation' },
  '014826507': { status: 'preparation', workflowState: 'preparation' },
  '014826508': { status: 'preparation', workflowState: 'preparation' },
  '014826509': { status: 'preparation', workflowState: 'preparation' },
};

const defaultBackgroundJobRequirements: JobResourceRequirement[] = [
  { resourceType: 'mechanic' as const, requiredQualifications: [QUALIFICATIONS.generalService], label: 'Mechanic' },
  { resourceType: 'bay' as const, requiredQualifications: [], label: 'PC Bay' },
];

const backgroundJobRequirementsByOrder: Record<string, [JobResourceRequirement[], JobResourceRequirement[]]> = {
  '014826500': [defaultBackgroundJobRequirements, defaultBackgroundJobRequirements],
  '014826501': [defaultBackgroundJobRequirements, defaultBackgroundJobRequirements],
  '014826502': [defaultBackgroundJobRequirements, defaultBackgroundJobRequirements],
  '014826503': [
    defaultBackgroundJobRequirements,
    [{ resourceType: 'mechanic' as const, requiredQualifications: [QUALIFICATIONS.generalService], label: 'Mechanic' }],
  ],
  '014826504': [
    [
      ...defaultBackgroundJobRequirements,
      { resourceType: 'device' as const, requiredQualifications: [QUALIFICATIONS.diagnostics], label: 'EPS 708 Diesel Tester' },
    ],
    defaultBackgroundJobRequirements,
  ],
  '014826505': [
    defaultBackgroundJobRequirements,
    [
      { resourceType: 'mechanic' as const, requiredQualifications: [QUALIFICATIONS.generalService], label: 'Mechanic' },
      { resourceType: 'device' as const, requiredQualifications: [QUALIFICATIONS.diagnostics], label: 'EPS 708 Diesel Tester' },
    ],
  ],
  '014826506': [
    defaultBackgroundJobRequirements,
    [{ resourceType: 'mechanic' as const, requiredQualifications: [QUALIFICATIONS.generalService], label: 'Mechanic' }],
  ],
  '014826507': [
    defaultBackgroundJobRequirements,
    [{ resourceType: 'mechanic' as const, requiredQualifications: [QUALIFICATIONS.generalService], label: 'Mechanic' }],
  ],
  '014826508': [
    [
      { resourceType: 'mechanic' as const, requiredQualifications: [QUALIFICATIONS.generalService], label: 'Mechanic' },
      { resourceType: 'device' as const, requiredQualifications: [QUALIFICATIONS.diagnostics], label: 'EPS 708 Diesel Tester' },
    ],
    [{ resourceType: 'mechanic' as const, requiredQualifications: [QUALIFICATIONS.generalService], label: 'Mechanic' }],
  ],
  '014826509': [defaultBackgroundJobRequirements, defaultBackgroundJobRequirements],
};

export const MOCK_WORK_ORDERS: WorkOrder[] = [
  {
    id: 'wo-014826312',
    referenceNumber: '014826312',
    status: 'edit',
    vehicle: {
      id: 'vehicle-014826312',
      licensePlate: 'KL 653 P3',
      make: 'BMW',
      model: 'X5 xDrive',
      vin: 'WBAXX010758219999',
      mileage: 150000,
      location: 'Munich',
    },
    customer: {
      id: 'customer-alpha-gmbh',
      name: 'Alpha GMBH',
      address: 'St. Martin Straße 56',
      city: 'Munich',
      country: 'Germany',
      phone: '+49 89 123456',
      email: 'fleet@alpha.example',
    },
    billingParty: {
      id: 'customer-alpha-gmbh',
      name: 'Alpha GMBH',
      address: 'St. Martin Straße 56',
      city: 'Munich',
      country: 'Germany',
    },
    jobs: [
      {
        id: 'job-014826312-tire-change',
        workOrderId: 'wo-014826312',
        title: 'Tire Change',
        description: 'Replace customer tires while the customer waits at the dealership.',
        fru: 0.5,
        estimatedDurationMinutes: 30,
        requiredResourceType: 'mechanic',
        requiredQualifications: [QUALIFICATIONS.tyres],
        resourceRequirements: [
          { resourceType: 'mechanic', requiredQualifications: [QUALIFICATIONS.tyres], label: 'Mechanic' },
          { resourceType: 'bay', requiredQualifications: [], label: 'PC Bay' },
        ],
        status: 'unscheduled',
      },
      {
        id: 'job-014826312-battery-replacement',
        workOrderId: 'wo-014826312',
        title: 'Battery Replacement',
        description: 'Replace the vehicle battery; this may be extended during execution in Scenario 4.',
        fru: 0.5,
        estimatedDurationMinutes: 30,
        requiredResourceType: 'mechanic',
        requiredQualifications: [QUALIFICATIONS.battery],
        resourceRequirements: [
          { resourceType: 'mechanic', requiredQualifications: [QUALIFICATIONS.battery], label: 'Mechanic' },
          { resourceType: 'bay', requiredQualifications: [], label: 'PC Bay' },
        ],
        status: 'unscheduled',
      },
    ],
    createdAt: baseDate,
    updatedAt: baseDate,
    notes: 'Scenario 1/3/4: customer waits; Ted Phillips plans, reschedules, then extends battery replacement.',
  },
  {
    id: 'wo-014826455',
    referenceNumber: '014826455',
    status: 'edit',
    vehicle: {
      id: 'vehicle-014826455',
      licensePlate: 'M FM 455',
      make: 'BMW',
      model: '320d Touring',
      vin: 'WBA8K31070A455000',
      mileage: 75000,
      location: 'Munich',
    },
    customer: {
      id: 'customer-beta-logistics',
      name: 'Beta Logistics',
      city: 'Munich',
      country: 'Germany',
      phone: '+49 89 455000',
      email: 'service@beta.example',
    },
    jobs: [
      {
        id: 'job-014826455-standard-service',
        workOrderId: 'wo-014826455',
        title: 'Standard Service every 25,000km / Yearly',
        description: 'Routine yearly/25,000km service.',
        fru: 1.5,
        estimatedDurationMinutes: 90,
        requiredResourceType: 'mechanic',
        requiredQualifications: [QUALIFICATIONS.generalService],
        resourceRequirements: [
          { resourceType: 'mechanic', requiredQualifications: [QUALIFICATIONS.generalService], label: 'Mechanic' },
          { resourceType: 'bay', requiredQualifications: [], label: 'PC Bay' },
        ],
        status: 'unscheduled',
      },
      {
        id: 'job-014826455-mot-emission-test',
        workOrderId: 'wo-014826455',
        title: 'MOT Check - Emission Test',
        description: 'MOT emission measurement using the BEA 950 Emission Tester.',
        fru: 0.25,
        estimatedDurationMinutes: 15,
        requiredResourceType: 'mechanic',
        requiredQualifications: [QUALIFICATIONS.emissions],
        resourceRequirements: [
          { resourceType: 'mechanic', requiredQualifications: [QUALIFICATIONS.emissions], label: 'Mechanic' },
          { resourceType: 'bay', requiredQualifications: [], label: 'PC Bay' },
          { resourceType: 'device', requiredQualifications: [QUALIFICATIONS.emissions], label: 'BEA 950 Emission Tester' },
        ],
        status: 'unscheduled',
      },
      {
        id: 'job-014826455-mot-brake-test',
        workOrderId: 'wo-014826455',
        title: 'MOT Check - Brake Test',
        description: 'MOT brake system test and safety check.',
        fru: 0.5,
        estimatedDurationMinutes: 30,
        requiredResourceType: 'mechanic',
        requiredQualifications: [QUALIFICATIONS.brakes],
        resourceRequirements: [
          { resourceType: 'mechanic', requiredQualifications: [QUALIFICATIONS.brakes], label: 'Mechanic' },
          { resourceType: 'bay', requiredQualifications: [], label: 'PC Bay' },
        ],
        status: 'unscheduled',
      },
    ],
    createdAt: baseDate,
    updatedAt: baseDate,
    notes: 'Scenario 2: offer-stage order; customer requested drop-off near 08:30 and return near 17:00, but no booking is pre-planned.',
  },
  ...[
    ['wo-bg-1001', '014826500', 'Müller GmbH', 'M-BG 500', 'Oil Leak Diagnosis', 'Engine Bay Inspection', 'mech-mark-owen'],
    ['wo-bg-1002', '014826501', 'Schneider AG', 'M-BG 501', 'Windshield Washer Repair', 'Wiper Blade Replacement', 'mech-phil-parker'],
    ['wo-bg-1003', '014826502', 'Weber Logistics', 'M-BG 502', 'Air Conditioning Diagnosis', 'Cabin Filter Replacement', 'mech-greg-jackson'],
    ['wo-bg-1004', '014826503', 'Klein Fleet', 'M-BG 503', 'Suspension Noise Investigation', 'Shock Absorber Inspection', 'mech-jeff-goldberg'],
    ['wo-bg-1005', '014826504', 'Bauer GmbH', 'M-BG 504', 'Control Unit Scan', 'Software Update', 'mech-kelly-hanson'],
    ['wo-bg-1006', '014826505', 'Neumann Auto', 'M-BG 505', 'Door Lock Repair', 'Key Fob Programming', 'mech-mark-owen'],
    ['wo-bg-1007', '014826506', 'Hofmann Services', 'M-BG 506', 'Coolant Leak Check', 'Pressure Test', 'mech-phil-parker'],
    ['wo-bg-1008', '014826507', 'Adler Transport', 'M-BG 507', 'Noise From Rear Axle', 'Road Test', 'mech-greg-jackson'],
    ['wo-bg-1009', '014826508', 'Stein & Partner', 'M-BG 508', 'Navigation System Update', 'Connectivity Check', 'mech-jeff-goldberg'],
    ['wo-bg-1010', '014826509', 'Wolf Leasing', 'M-BG 509', 'Seat Heating Diagnosis', 'Interior Trim Repair', 'mech-kelly-hanson'],
  ].map(([id, referenceNumber, customerName, licensePlate, firstJob, secondJob, resourceId]) => ({
    id,
    referenceNumber,
    status: 'preparation' as const,
    vehicle: {
      id: `vehicle-${id}`,
      licensePlate,
      make: 'BMW',
      model: 'Workshop Vehicle',
      mileage: 60000,
    },
    customer: {
      id: `customer-${id}`,
      name: customerName,
      city: 'Munich',
      country: 'Germany',
    },
    jobs: [
      {
        id: `job-${id}-1`,
        workOrderId: id,
        title: firstJob,
        fru: 0.75,
        estimatedDurationMinutes: 45,
        requiredResourceType: 'mechanic' as const,
        requiredQualifications: [QUALIFICATIONS.generalService],
        resourceRequirements: backgroundJobRequirementsByOrder[referenceNumber][0],
        status: 'scheduled' as const,
        assignedResourceId: resourceId,
      },
      {
        id: `job-${id}-2`,
        workOrderId: id,
        title: secondJob,
        fru: 0.5,
        estimatedDurationMinutes: 30,
        requiredResourceType: 'mechanic' as const,
        requiredQualifications: [QUALIFICATIONS.generalService],
        resourceRequirements: backgroundJobRequirementsByOrder[referenceNumber][1],
        status: 'scheduled' as const,
        assignedResourceId: resourceId,
      },
    ],
    createdAt: baseDate,
    updatedAt: baseDate,
  })).map(order => order.referenceNumber === '014826500'
    ? {
        ...order,
        jobs: order.jobs.map(job => {
          const { assignedResourceId, ...unscheduledJob } = job;
          return {
            ...unscheduledJob,
            status: 'unscheduled' as const,
          };
        }),
      }
    : order),
];

export const MOCK_SCHEDULE_ENTRIES: ScheduleEntry[] = [
  { id: 'sch-bg-1001-frank-checkin', jobId: 'wo-bg-1001:act-checkin', resourceId: 'advisor-frank-miller', start: new Date('2024-04-15T09:00:00'), end: new Date('2024-04-15T09:30:00'), title: 'Check-In 014826500', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826500' },
  { id: 'sch-bg-1001-mark-1', jobId: 'job-wo-bg-1001-1', resourceId: 'mech-mark-owen', start: new Date('2024-04-15T09:30:00'), end: new Date('2024-04-15T10:15:00'), title: 'Oil Leak Diagnosis', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826500' },
  { id: 'sch-bg-1001-bay-1', jobId: 'job-wo-bg-1001-1', resourceId: 'bay-pc-1', start: new Date('2024-04-15T09:30:00'), end: new Date('2024-04-15T10:15:00'), title: 'Oil Leak Diagnosis', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826500' },
  { id: 'sch-bg-1001-mark-2', jobId: 'job-wo-bg-1001-2', resourceId: 'mech-mark-owen', start: new Date('2024-04-15T10:15:00'), end: new Date('2024-04-15T10:45:00'), title: 'Engine Bay Inspection', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826500' },
  { id: 'sch-bg-1001-bay-2', jobId: 'job-wo-bg-1001-2', resourceId: 'bay-pc-1', start: new Date('2024-04-15T10:15:00'), end: new Date('2024-04-15T10:45:00'), title: 'Engine Bay Inspection', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826500' },
  { id: 'sch-bg-1001-frank-handover', jobId: 'wo-bg-1001:act-handover', resourceId: 'advisor-frank-miller', start: new Date('2024-04-15T10:45:00'), end: new Date('2024-04-15T11:15:00'), title: 'Handover 014826500', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826500' },
  { id: 'sch-bg-1002-phil-1', jobId: 'job-wo-bg-1002-1', resourceId: 'mech-phil-parker', start: new Date('2024-04-15T11:15:00'), end: new Date('2024-04-15T11:45:00'), title: 'Windshield Washer Repair', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826501' },
  { id: 'sch-bg-1002-bay-1', jobId: 'job-wo-bg-1002-1', resourceId: 'bay-pc-2', start: new Date('2024-04-15T11:15:00'), end: new Date('2024-04-15T11:45:00'), title: 'Windshield Washer Repair', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826501' },
  { id: 'sch-bg-1002-phil-2', jobId: 'job-wo-bg-1002-2', resourceId: 'mech-phil-parker', start: new Date('2024-04-15T11:45:00'), end: new Date('2024-04-15T12:00:00'), title: 'Wiper Blade Replacement', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826501' },
  { id: 'sch-bg-1002-bay-2', jobId: 'job-wo-bg-1002-2', resourceId: 'bay-pc-2', start: new Date('2024-04-15T11:45:00'), end: new Date('2024-04-15T12:00:00'), title: 'Wiper Blade Replacement', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826501' },
  { id: 'sch-bg-1003-greg-1', jobId: 'job-wo-bg-1003-1', resourceId: 'mech-greg-jackson', start: new Date('2024-04-15T13:30:00'), end: new Date('2024-04-15T14:15:00'), title: 'Air Conditioning Diagnosis', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826502' },
  { id: 'sch-bg-1003-bay-1', jobId: 'job-wo-bg-1003-1', resourceId: 'bay-pc-3', start: new Date('2024-04-15T13:30:00'), end: new Date('2024-04-15T14:15:00'), title: 'Air Conditioning Diagnosis', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826502' },
  { id: 'sch-bg-1003-greg-2', jobId: 'job-wo-bg-1003-2', resourceId: 'mech-greg-jackson', start: new Date('2024-04-15T14:15:00'), end: new Date('2024-04-15T14:30:00'), title: 'Cabin Filter Replacement', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826502' },
  { id: 'sch-bg-1003-bay-2', jobId: 'job-wo-bg-1003-2', resourceId: 'bay-pc-3', start: new Date('2024-04-15T14:15:00'), end: new Date('2024-04-15T14:30:00'), title: 'Cabin Filter Replacement', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826502' },
  { id: 'sch-bg-1004-jeff-1', jobId: 'job-wo-bg-1004-1', resourceId: 'mech-jeff-goldberg', start: new Date('2024-04-15T13:30:00'), end: new Date('2024-04-15T14:30:00'), title: 'Suspension Noise Investigation', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826503' },
  { id: 'sch-bg-1004-bay-1', jobId: 'job-wo-bg-1004-1', resourceId: 'bay-lt-1', start: new Date('2024-04-15T13:30:00'), end: new Date('2024-04-15T14:30:00'), title: 'Suspension Noise Investigation', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826503' },
  { id: 'sch-bg-1004-jeff-2', jobId: 'job-wo-bg-1004-2', resourceId: 'mech-jeff-goldberg', start: new Date('2024-04-15T14:30:00'), end: new Date('2024-04-15T15:00:00'), title: 'Shock Absorber Inspection', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826503' },
  { id: 'sch-bg-1005-kelly-1', jobId: 'job-wo-bg-1005-1', resourceId: 'mech-kelly-hanson', start: new Date('2024-04-15T16:00:00'), end: new Date('2024-04-15T16:45:00'), title: 'Control Unit Scan', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826504' },
  { id: 'sch-bg-1005-bay-1', jobId: 'job-wo-bg-1005-1', resourceId: 'bay-pc-1', start: new Date('2024-04-15T16:00:00'), end: new Date('2024-04-15T16:45:00'), title: 'Control Unit Scan', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826504' },
  { id: 'sch-bg-1005-eps-1', jobId: 'job-wo-bg-1005-1', resourceId: 'device-eps-708', start: new Date('2024-04-15T16:00:00'), end: new Date('2024-04-15T16:45:00'), title: 'Control Unit Scan', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826504' },
  { id: 'sch-bg-1005-kelly-2', jobId: 'job-wo-bg-1005-2', resourceId: 'mech-kelly-hanson', start: new Date('2024-04-15T16:45:00'), end: new Date('2024-04-15T17:15:00'), title: 'Software Update', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826504' },
  { id: 'sch-bg-1005-bay-2', jobId: 'job-wo-bg-1005-2', resourceId: 'bay-pc-1', start: new Date('2024-04-15T16:45:00'), end: new Date('2024-04-15T17:15:00'), title: 'Software Update', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826504' },
  { id: 'sch-bg-1006-mark-1', jobId: 'job-wo-bg-1006-1', resourceId: 'mech-mark-owen', start: new Date('2024-04-16T09:15:00'), end: new Date('2024-04-16T10:00:00'), title: 'Door Lock Repair', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826505' },
  { id: 'sch-bg-1006-bay-1', jobId: 'job-wo-bg-1006-1', resourceId: 'bay-pc-2', start: new Date('2024-04-16T09:15:00'), end: new Date('2024-04-16T10:00:00'), title: 'Door Lock Repair', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826505' },
  { id: 'sch-bg-1006-mark-2', jobId: 'job-wo-bg-1006-2', resourceId: 'mech-mark-owen', start: new Date('2024-04-16T10:00:00'), end: new Date('2024-04-16T10:30:00'), title: 'Key Fob Programming', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826505' },
  { id: 'sch-bg-1006-eps-1', jobId: 'job-wo-bg-1006-2', resourceId: 'device-eps-708', start: new Date('2024-04-16T10:00:00'), end: new Date('2024-04-16T10:30:00'), title: 'Key Fob Programming', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826505' },
  { id: 'sch-bg-1007-phil-1', jobId: 'job-wo-bg-1007-1', resourceId: 'mech-phil-parker', start: new Date('2024-04-16T10:15:00'), end: new Date('2024-04-16T11:00:00'), title: 'Coolant Leak Check', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826506' },
  { id: 'sch-bg-1007-bay-1', jobId: 'job-wo-bg-1007-1', resourceId: 'bay-pc-3', start: new Date('2024-04-16T10:15:00'), end: new Date('2024-04-16T11:00:00'), title: 'Coolant Leak Check', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826506' },
  { id: 'sch-bg-1007-phil-2', jobId: 'job-wo-bg-1007-2', resourceId: 'mech-phil-parker', start: new Date('2024-04-16T11:00:00'), end: new Date('2024-04-16T11:30:00'), title: 'Pressure Test', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826506' },
  { id: 'sch-bg-1008-greg-1', jobId: 'job-wo-bg-1008-1', resourceId: 'mech-greg-jackson', start: new Date('2024-04-16T13:15:00'), end: new Date('2024-04-16T14:00:00'), title: 'Noise From Rear Axle', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826507' },
  { id: 'sch-bg-1008-bay-1', jobId: 'job-wo-bg-1008-1', resourceId: 'bay-lt-1', start: new Date('2024-04-16T13:15:00'), end: new Date('2024-04-16T14:00:00'), title: 'Noise From Rear Axle', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826507' },
  { id: 'sch-bg-1008-greg-2', jobId: 'job-wo-bg-1008-2', resourceId: 'mech-greg-jackson', start: new Date('2024-04-16T14:00:00'), end: new Date('2024-04-16T14:30:00'), title: 'Road Test', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826507' },
  { id: 'sch-bg-1009-jeff-1', jobId: 'job-wo-bg-1009-1', resourceId: 'mech-jeff-goldberg', start: new Date('2024-04-16T14:45:00'), end: new Date('2024-04-16T15:15:00'), title: 'Navigation System Update', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826508' },
  { id: 'sch-bg-1009-eps-1', jobId: 'job-wo-bg-1009-1', resourceId: 'device-eps-708', start: new Date('2024-04-16T14:45:00'), end: new Date('2024-04-16T15:15:00'), title: 'Navigation System Update', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826508' },
  { id: 'sch-bg-1009-jeff-2', jobId: 'job-wo-bg-1009-2', resourceId: 'mech-jeff-goldberg', start: new Date('2024-04-16T15:15:00'), end: new Date('2024-04-16T15:45:00'), title: 'Connectivity Check', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826508' },
  { id: 'sch-bg-1010-kelly-1', jobId: 'job-wo-bg-1010-1', resourceId: 'mech-kelly-hanson', start: new Date('2024-04-16T16:15:00'), end: new Date('2024-04-16T17:00:00'), title: 'Seat Heating Diagnosis', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826509' },
  { id: 'sch-bg-1010-bay-1', jobId: 'job-wo-bg-1010-1', resourceId: 'bay-pc-1', start: new Date('2024-04-16T16:15:00'), end: new Date('2024-04-16T17:00:00'), title: 'Seat Heating Diagnosis', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826509' },
  { id: 'sch-bg-1010-kelly-2', jobId: 'job-wo-bg-1010-2', resourceId: 'mech-kelly-hanson', start: new Date('2024-04-16T17:00:00'), end: new Date('2024-04-16T17:30:00'), title: 'Interior Trim Repair', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826509' },
  { id: 'sch-bg-1010-bay-2', jobId: 'job-wo-bg-1010-2', resourceId: 'bay-pc-1', start: new Date('2024-04-16T17:00:00'), end: new Date('2024-04-16T17:30:00'), title: 'Interior Trim Repair', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826509' },
  { id: 'sch-bg-1002-frank-checkin', jobId: 'wo-bg-1002:act-checkin', resourceId: 'advisor-frank-miller', start: new Date('2024-04-15T10:45:00'), end: new Date('2024-04-15T11:15:00'), title: 'Check-In 014826501', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826501' },
  { id: 'sch-bg-1002-frank-handover', jobId: 'wo-bg-1002:act-handover', resourceId: 'advisor-frank-miller', start: new Date('2024-04-15T12:00:00'), end: new Date('2024-04-15T12:30:00'), title: 'Handover 014826501', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826501' },
  { id: 'sch-bg-1002-courtesy', jobId: 'wo-bg-1002:act-mobility', resourceId: 'car-audi-a3-kl643ju', start: new Date('2024-04-15T11:15:00'), end: new Date('2024-04-15T12:30:00'), title: 'Courtesy Car 014826501', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826501' },
  { id: 'sch-bg-1003-ted-checkin', jobId: 'wo-bg-1003:act-checkin', resourceId: 'advisor-ted-phillips', start: new Date('2024-04-15T13:00:00'), end: new Date('2024-04-15T13:30:00'), title: 'Check-In 014826502', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826502' },
  { id: 'sch-bg-1003-ted-handover', jobId: 'wo-bg-1003:act-handover', resourceId: 'advisor-ted-phillips', start: new Date('2024-04-15T14:30:00'), end: new Date('2024-04-15T15:00:00'), title: 'Handover 014826502', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826502' },
  { id: 'sch-bg-1003-courtesy', jobId: 'wo-bg-1003:act-mobility', resourceId: 'car-audi-a4-kl657og', start: new Date('2024-04-15T13:30:00'), end: new Date('2024-04-15T15:00:00'), title: 'Courtesy Car 014826502', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826502' },
  { id: 'sch-bg-1004-frank-checkin', jobId: 'wo-bg-1004:act-checkin', resourceId: 'advisor-frank-miller', start: new Date('2024-04-15T13:00:00'), end: new Date('2024-04-15T13:30:00'), title: 'Check-In 014826503', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826503' },
  { id: 'sch-bg-1004-frank-handover', jobId: 'wo-bg-1004:act-handover', resourceId: 'advisor-frank-miller', start: new Date('2024-04-15T15:00:00'), end: new Date('2024-04-15T15:30:00'), title: 'Handover 014826503', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826503' },
  { id: 'sch-bg-1004-courtesy', jobId: 'wo-bg-1004:act-mobility', resourceId: 'car-audi-a3-kl643ju', start: new Date('2024-04-15T13:30:00'), end: new Date('2024-04-15T15:30:00'), title: 'Courtesy Car 014826503', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826503' },
  { id: 'sch-bg-1005-ted-checkin', jobId: 'wo-bg-1005:act-checkin', resourceId: 'advisor-ted-phillips', start: new Date('2024-04-15T15:30:00'), end: new Date('2024-04-15T16:00:00'), title: 'Check-In 014826504', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826504' },
  { id: 'sch-bg-1005-ted-handover', jobId: 'wo-bg-1005:act-handover', resourceId: 'advisor-ted-phillips', start: new Date('2024-04-15T17:15:00'), end: new Date('2024-04-15T17:45:00'), title: 'Handover 014826504', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826504' },
  { id: 'sch-bg-1006-frank-handover', jobId: 'wo-bg-1006:act-handover', resourceId: 'advisor-frank-miller', start: new Date('2024-04-16T10:30:00'), end: new Date('2024-04-16T11:00:00'), title: 'Handover 014826505', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826505' },
  { id: 'sch-bg-1005-courtesy', jobId: 'wo-bg-1005:act-mobility', resourceId: 'car-audi-a4-kl657og', start: new Date('2024-04-15T16:00:00'), end: new Date('2024-04-15T17:45:00'), title: 'Courtesy Car 014826504', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826504' },
  { id: 'sch-bg-1006-frank-checkin', jobId: 'wo-bg-1006:act-checkin', resourceId: 'advisor-frank-miller', start: new Date('2024-04-16T08:45:00'), end: new Date('2024-04-16T09:15:00'), title: 'Check-In 014826505', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826505' },
  { id: 'sch-bg-1006-courtesy', jobId: 'wo-bg-1006:act-mobility', resourceId: 'car-bmw-320-mw112ab', start: new Date('2024-04-16T09:15:00'), end: new Date('2024-04-16T11:00:00'), title: 'Courtesy Car 014826505', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826505' },
  { id: 'sch-bg-1007-ted-checkin', jobId: 'wo-bg-1007:act-checkin', resourceId: 'advisor-ted-phillips', start: new Date('2024-04-16T09:45:00'), end: new Date('2024-04-16T10:15:00'), title: 'Check-In 014826506', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826506' },
  { id: 'sch-bg-1007-ted-handover', jobId: 'wo-bg-1007:act-handover', resourceId: 'advisor-ted-phillips', start: new Date('2024-04-16T11:30:00'), end: new Date('2024-04-16T12:00:00'), title: 'Handover 014826506', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826506' },
  { id: 'sch-bg-1007-courtesy', jobId: 'wo-bg-1007:act-mobility', resourceId: 'car-audi-a4-kl657og', start: new Date('2024-04-16T10:15:00'), end: new Date('2024-04-16T12:00:00'), title: 'Courtesy Car 014826506', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826506' },
  { id: 'sch-bg-1008-ted-checkin', jobId: 'wo-bg-1008:act-checkin', resourceId: 'advisor-ted-phillips', start: new Date('2024-04-16T12:45:00'), end: new Date('2024-04-16T13:15:00'), title: 'Check-In 014826507', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826507' },
  { id: 'sch-bg-1008-ted-handover', jobId: 'wo-bg-1008:act-handover', resourceId: 'advisor-ted-phillips', start: new Date('2024-04-16T14:30:00'), end: new Date('2024-04-16T15:00:00'), title: 'Handover 014826507', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826507' },
  { id: 'sch-bg-1008-courtesy', jobId: 'wo-bg-1008:act-mobility', resourceId: 'car-audi-a3-kl643ju', start: new Date('2024-04-16T13:15:00'), end: new Date('2024-04-16T15:00:00'), title: 'Courtesy Car 014826507', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826507' },
  { id: 'sch-bg-1009-frank-checkin', jobId: 'wo-bg-1009:act-checkin', resourceId: 'advisor-frank-miller', start: new Date('2024-04-16T14:15:00'), end: new Date('2024-04-16T14:45:00'), title: 'Check-In 014826508', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826508' },
  { id: 'sch-bg-1009-frank-handover', jobId: 'wo-bg-1009:act-handover', resourceId: 'advisor-frank-miller', start: new Date('2024-04-16T15:45:00'), end: new Date('2024-04-16T16:15:00'), title: 'Handover 014826508', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826508' },
  { id: 'sch-bg-1009-courtesy', jobId: 'wo-bg-1009:act-mobility', resourceId: 'car-audi-a4-kl657og', start: new Date('2024-04-16T14:45:00'), end: new Date('2024-04-16T16:15:00'), title: 'Courtesy Car 014826508', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826508' },
  { id: 'sch-bg-1010-ted-checkin', jobId: 'wo-bg-1010:act-checkin', resourceId: 'advisor-ted-phillips', start: new Date('2024-04-16T15:45:00'), end: new Date('2024-04-16T16:15:00'), title: 'Check-In 014826509', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826509' },
  { id: 'sch-bg-1010-ted-handover', jobId: 'wo-bg-1010:act-handover', resourceId: 'advisor-ted-phillips', start: new Date('2024-04-16T17:30:00'), end: new Date('2024-04-16T18:00:00'), title: 'Handover 014826509', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826509' },
  { id: 'sch-bg-1010-courtesy', jobId: 'wo-bg-1010:act-mobility', resourceId: 'car-audi-a3-kl643ju', start: new Date('2024-04-16T16:15:00'), end: new Date('2024-04-16T18:00:00'), title: 'Courtesy Car 014826509', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826509' },
];

MOCK_WORK_ORDERS.forEach(order => {
  const scheduledActivityTemplateIds = new Set(
    MOCK_SCHEDULE_ENTRIES
      .filter(entry => entry.workOrderReference === order.referenceNumber && entry.jobId.includes(':act-'))
      .map(entry => entry.jobId.split(':').pop() ?? entry.jobId)
  );
  const activityDefinitions = [
    ...defaultActivityItems,
    ...optionalActivityItems.filter(activity => scheduledActivityTemplateIds.has(activity.templateId)),
  ];
  const existingActivityTemplateIds = new Set(
    order.jobs
      .filter(job => job.workorderItemCategory === 'activity' || job.id.includes(':act-'))
      .map(job => job.templateId ?? job.id.split(':').pop() ?? job.id)
  );

  for (const activity of activityDefinitions) {
    if (existingActivityTemplateIds.has(activity.templateId)) continue;
    order.jobs.push({
      id: `${order.id}:${activity.templateId}`,
      workOrderId: order.id,
      title: activity.title,
      fru: activity.fru,
      estimatedDurationMinutes: activity.estimatedDurationMinutes,
      requiredResourceType: activity.resourceType,
      requiredQualifications: [],
      resourceRequirements: [{ resourceType: activity.resourceType, requiredQualifications: [], label: activity.resourceLabel }],
      resourceLabel: activity.resourceLabel,
      status: 'unscheduled',
      workorderItemStatus: 'unscheduled',
      workorderItemCategory: 'activity',
      templateId: activity.templateId,
    });
  }
});

MOCK_WORK_ORDERS.forEach(order => {
  const scenario = orderLifecycleScenarios[order.referenceNumber];
  if (scenario) {
    order.status = scenario.status;
    order.workflowState = scenario.workflowState;
  } else {
    order.workflowState ??= order.status === 'handover'
      ? 'handover'
      : order.status === 'follow-up' || order.status === 'complete'
        ? 'followup'
        : order.status === 'preparation'
          ? 'preparation'
          : 'offer';
  }

  order.jobs.forEach(job => {
    job.workorderItemCategory ??= 'job';
    job.workorderItemStatus ??= job.status;
  });
});

const workOrderByReference = new Map(MOCK_WORK_ORDERS.map(order => [order.referenceNumber, order]));
const workOrderByJobId = new Map(MOCK_WORK_ORDERS.flatMap(order => order.jobs.map(job => [job.id, order])));
const jobStatusById = new Map<string, 'unscheduled' | 'scheduled' | 'in-progress' | 'completed' | 'cancelled'>();

MOCK_SCHEDULE_ENTRIES
  .filter(entry => !entry.jobId.includes(':act-'))
  .forEach(entry => {
    const currentStatus = jobStatusById.get(entry.jobId);
    const timedStatus = getTimedExecutionStatus(entry.start, entry.end);
    if (currentStatus === 'in-progress' || timedStatus === 'in-progress') {
      jobStatusById.set(entry.jobId, 'in-progress');
    } else if (currentStatus === 'scheduled' || timedStatus === 'scheduled') {
      jobStatusById.set(entry.jobId, 'scheduled');
    } else {
      jobStatusById.set(entry.jobId, 'completed');
    }
  });

MOCK_WORK_ORDERS.forEach(order => {
  order.jobs.forEach(job => {
    const status = jobStatusById.get(job.id) ?? job.status;
    job.status = status;
    job.workorderItemStatus = status;
  });

  const statuses = order.jobs.map(job => job.workorderItemStatus ?? job.status);
  const hasTimedBooking = order.jobs.some(job => jobStatusById.has(job.id));
  if (hasTimedBooking) {
    if (statuses.some(status => status === 'in-progress')) {
      order.workflowState = 'execution';
    } else if (statuses.length > 0 && statuses.every(status => status === 'completed')) {
      order.workflowState = 'handover';
      order.status = 'handover';
    } else if (statuses.some(status => status === 'scheduled' || status === 'completed')) {
      order.workflowState = 'preparation';
      order.status = 'preparation';
    }
  }
});

const getActivityStatusForOrder = (order: WorkOrder | undefined, activityId: string) => {
  const templateId = activityId.split(':').pop();
  if (!order) return 'scheduled' as const;
  if (templateId === 'act-checkin') return getTimedExecutionStatusFromActivity(order, 'act-checkin');
  if (templateId === 'act-handover') {
    return getTimedExecutionStatusFromActivity(order, 'act-handover');
  }
  if (templateId === 'act-mobility') return getTimedExecutionStatusFromActivity(order, 'act-mobility');
  return 'scheduled' as const;
};

function getTimedExecutionStatusFromActivity(order: WorkOrder, activityTemplateId: string) {
  const entry = MOCK_SCHEDULE_ENTRIES.find(candidate =>
    candidate.workOrderReference === order.referenceNumber && candidate.jobId.endsWith(`:${activityTemplateId}`)
  );
  return entry ? getTimedExecutionStatus(entry.start, entry.end) : 'unscheduled' as const;
}

MOCK_SCHEDULE_ENTRIES.forEach(entry => {
  const title = (entry.title ?? '').toLowerCase();
  if (title.startsWith('check-in') || title.startsWith('handover')) {
    entry.end = new Date(entry.start.getTime() + 30 * 60000);
  }
  entry.workorderItemCategory ??= title.startsWith('check-in') ||
    title.startsWith('handover') ||
    title.startsWith('courtesy car')
      ? 'activity'
      : 'job';
  const order = entry.workOrderReference ? workOrderByReference.get(entry.workOrderReference) : undefined;
  entry.workorderItemStatus = entry.workorderItemCategory === 'activity'
    ? getActivityStatusForOrder(order, entry.jobId)
    : jobStatusById.get(entry.jobId) ?? 'scheduled';
  if (entry.workorderItemCategory === 'job') {
    entry.bookingSetId ??= `${entry.workOrderReference ?? ''}:${entry.jobId}:${entry.start.getTime()}-${entry.end.getTime()}`;
  }
});

MOCK_WORK_ORDERS.forEach(order => {
  order.jobs.forEach(item => {
    if (item.workorderItemCategory !== 'activity') return;
    const templateId = item.templateId ?? item.id.split(':').pop() ?? item.id;
    const entry = MOCK_SCHEDULE_ENTRIES.find(candidate =>
      candidate.workOrderReference === order.referenceNumber && candidate.jobId.endsWith(`:${templateId}`)
    );
    const status = entry?.workorderItemStatus ?? 'unscheduled';
    item.status = status === 'started' ? 'in-progress' : status;
    item.workorderItemStatus = item.status;
  });
});

MOCK_WORK_ORDERS.forEach(order => {
  const entries = MOCK_SCHEDULE_ENTRIES.filter(entry => entry.workOrderReference === order.referenceNumber);
  if (!entries.length) return;

  const inProgressEntry = entries.find(entry => entry.workorderItemStatus === 'in-progress');
  if (inProgressEntry) {
    const activityTemplateId = inProgressEntry.jobId.split(':').pop();
    order.workflowState = activityTemplateId === 'act-checkin'
      ? 'checkin'
      : activityTemplateId === 'act-handover'
        ? 'handover'
        : 'execution';
    order.status = order.workflowState === 'handover' ? 'handover' : 'preparation';
    return;
  }

  const handoverEntry = entries.find(entry => entry.jobId.endsWith(':act-handover'));
  if (handoverEntry?.workorderItemStatus === 'completed') {
    order.workflowState = 'followup';
    order.status = 'complete';
    return;
  }

  const checkinEntry = entries.find(entry => entry.jobId.endsWith(':act-checkin'));
  if (checkinEntry?.workorderItemStatus === 'completed') {
    order.workflowState = 'execution';
    order.status = 'preparation';
    return;
  }

  order.workflowState = 'preparation';
  order.status = 'preparation';
});

export const MOCK_UNAVAILABILITY: UnavailabilityBlock[] = [
  { resourceId: 'advisor-frank-miller', start: new Date('2024-04-15T08:30:00'), end: new Date('2024-04-15T09:00:00'), reason: 'Team Meeting', title: 'Team Meeting', color: '#A6C8FF' },
  { resourceId: 'device-bea-950', start: new Date('2024-04-15T15:00:00'), end: new Date('2024-04-15T16:00:00'), reason: 'Calibration', title: 'Calibration', color: '#A6C8FF' },
  { resourceId: 'bay-pc-3', start: new Date('2024-04-16T08:00:00'), end: new Date('2024-04-16T08:30:00'), reason: 'Cleaning', title: 'Cleaning', color: '#A6C8FF' },
  { resourceId: 'mech-kelly-hanson', start: new Date('2024-04-16T13:00:00'), end: new Date('2024-04-16T14:00:00'), reason: 'Training', title: 'Training', color: '#A6C8FF' },
  { resourceId: 'mech-mark-owen', start: new Date('2024-04-15T12:00:00'), end: new Date('2024-04-15T13:00:00'), reason: 'Lunch', title: 'Lunch', color: '#C6C6C6' },
  { resourceId: 'mech-phil-parker', start: new Date('2024-04-15T12:00:00'), end: new Date('2024-04-15T13:00:00'), reason: 'Lunch', title: 'Lunch', color: '#C6C6C6' },
  { resourceId: 'mech-greg-jackson', start: new Date('2024-04-15T12:00:00'), end: new Date('2024-04-15T13:00:00'), reason: 'Lunch', title: 'Lunch', color: '#C6C6C6' },
  { resourceId: 'mech-jeff-goldberg', start: new Date('2024-04-15T12:00:00'), end: new Date('2024-04-15T13:00:00'), reason: 'Lunch', title: 'Lunch', color: '#C6C6C6' },
  { resourceId: 'mech-kelly-hanson', start: new Date('2024-04-15T12:00:00'), end: new Date('2024-04-15T13:00:00'), reason: 'Lunch', title: 'Lunch', color: '#C6C6C6' },
  { resourceId: 'mech-scenario-flex', start: new Date('2024-04-15T12:00:00'), end: new Date('2024-04-15T13:00:00'), reason: 'Lunch', title: 'Lunch', color: '#C6C6C6' },
  { resourceId: 'advisor-ted-phillips', start: new Date('2024-04-15T12:00:00'), end: new Date('2024-04-15T13:00:00'), reason: 'Lunch', title: 'Lunch', color: '#C6C6C6' },
  { resourceId: 'advisor-frank-miller', start: new Date('2024-04-15T12:00:00'), end: new Date('2024-04-15T13:00:00'), reason: 'Lunch', title: 'Lunch', color: '#C6C6C6' },
  { resourceId: 'advisor-scenario-lead', start: new Date('2024-04-15T12:00:00'), end: new Date('2024-04-15T13:00:00'), reason: 'Lunch', title: 'Lunch', color: '#C6C6C6' },
];


