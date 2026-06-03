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
  mechanic: { id: 'q-mechanic', name: 'Mechanic' },
  electrician: { id: 'q-electrician', name: 'Electrician' },
  painter: { id: 'q-painter', name: 'Painter' },
  pcBay: { id: 'q-pc-bay', name: 'PC Bay' },
  pcAlignmentBay: { id: 'q-pc-alignment-bay', name: 'PC Alignm. Bay' },
  ltBay: { id: 'q-lt-bay', name: 'LT Bay' },
  emissionTester: { id: 'q-emission-tester', name: 'Emission Tester' },
  dieselTester: { id: 'q-diesel-tester', name: 'Diesel tester' },
} satisfies Record<string, Qualification>;

const mechanicJobDescriptions: Record<string, string> = {
  'Oil Leak Diagnosis': 'Inspect engine bay, sump, oil filter housing, and underbody for leak traces; clean affected area and confirm source after idle test.',
  'Engine Bay Inspection': 'Check visible engine components, hoses, belts, fluid levels, and mounting points; document any wear, leaks, or loose fittings.',
  'Windshield Washer Repair': 'Test washer pump operation, inspect reservoir, hoses, jets, and fuse; clear blockage or replace failed washer components.',
  'Wiper Blade Replacement': 'Remove worn blades, inspect wiper arms for damage, fit replacement blades, and verify clean sweep pattern on wet screen.',
  'Air Conditioning Diagnosis': 'Run A/C performance test, check vent temperature, scan HVAC faults, inspect refrigerant pressure, and identify leak or compressor issues.',
  'Cabin Filter Replacement': 'Remove cabin filter, clean filter housing, install new filter in correct airflow direction, and verify blower operation.',
  'Suspension Noise Investigation': 'Road test to reproduce noise, inspect control arms, bushings, links, struts, and mounts; mark failed components for repair.',
  'Shock Absorber Inspection': 'Inspect shock absorbers for leakage, mounting play, damaged boots, and uneven damping; compare axle-side wear.',
  'Control Unit Scan': 'Connect diagnostic tester, perform full vehicle fault scan, save fault memory, and identify control units requiring follow-up.',
  'Software Update': 'Check current control unit software levels, connect charger, apply approved updates, and confirm no post-programming faults remain.',
  'Door Lock Repair': 'Inspect latch, actuator, wiring, handle operation, and central locking response; repair or replace faulty lock components.',
  'Key Fob Programming': 'Register key fob to vehicle, verify remote lock/unlock and start authorization, and confirm spare key status if available.',
  'Coolant Leak Check': 'Pressure test cooling system, inspect radiator, hoses, expansion tank, water pump, and heater circuit for visible leaks.',
  'Pressure Test': 'Apply system pressure to manufacturer specification, monitor pressure drop, and locate leaks before releasing vehicle.',
  'Noise From Rear Axle': 'Road test and inspect rear axle mounts, wheel bearings, suspension links, differential area, and brake hardware for noise source.',
  'Road Test': 'Perform controlled road test to verify customer complaint, check drivability, braking, steering, and confirm repair outcome.',
  'Navigation System Update': 'Check navigation software/map version, install approved update package, and verify route calculation after reboot.',
  'Connectivity Check': 'Test Bluetooth, Wi-Fi, telematics, USB, and paired-device functions; record any module or pairing faults.',
  'Seat Heating Diagnosis': 'Check seat heater switch, fuse, wiring, heating mat resistance, and control module faults; isolate failed circuit.',
  'Interior Trim Repair': 'Inspect loose or damaged trim, refit clips or fasteners, correct rattles, and confirm panels sit flush without noise.',
};

function getMechanicJobDescription(title: string): string {
  return mechanicJobDescriptions[title] ?? `Inspect and complete ${title.toLowerCase()} according to workshop procedure; record findings and required follow-up.`;
}

export const MOCK_GROUPS: ResourceGroup[] = [
  { id: 'group-mechanics', name: 'Mechanics', resourceType: 'mechanic' },
  { id: 'group-advisors', name: 'Service Advisors', resourceType: 'advisor' },
  { id: 'group-bays', name: 'Bays', resourceType: 'bay' },
  { id: 'group-devices', name: 'Devices', resourceType: 'device' },
  { id: 'group-courtesy-cars', name: 'Courtesy Car', resourceType: 'driver' },
  { id: 'group-klagenfurt-mechanics', name: 'Mechanics', resourceType: 'mechanic' },
  { id: 'group-klagenfurt-advisors', name: 'Service Advisors', resourceType: 'advisor' },
  { id: 'group-klagenfurt-courtesy-cars', name: 'Courtesy Cars', resourceType: 'driver' },
  { id: 'group-vienna-technicians', name: 'Technicians', resourceType: 'mechanic' },
  { id: 'group-vienna-painters', name: 'Painter', resourceType: 'mechanic' },
  { id: 'group-vienna-advisors', name: 'Service Advisors', resourceType: 'advisor' },
  { id: 'group-vienna-bays', name: 'Bays', resourceType: 'bay' },
  { id: 'group-vienna-devices', name: 'Devices', resourceType: 'device' },
  { id: 'group-vienna-courtesy-cars', name: 'Courtesy Cars', resourceType: 'driver' },
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
  { id: 'klg-mech-frank', name: 'Frank', type: 'mechanic', groupId: 'group-klagenfurt-mechanics', qualifications: [QUALIFICATIONS.generalService, QUALIFICATIONS.diagnostics, QUALIFICATIONS.tyres, QUALIFICATIONS.brakes], demoLocationId: 'klagenfurt' },
  { id: 'klg-mech-mike', name: 'Mike', type: 'mechanic', groupId: 'group-klagenfurt-mechanics', qualifications: [QUALIFICATIONS.generalService, QUALIFICATIONS.battery, QUALIFICATIONS.diagnostics], demoLocationId: 'klagenfurt' },
  { id: 'klg-mech-john', name: 'John', type: 'mechanic', groupId: 'group-klagenfurt-mechanics', qualifications: [QUALIFICATIONS.generalService, QUALIFICATIONS.mot, QUALIFICATIONS.emissions], demoLocationId: 'klagenfurt' },
  { id: 'klg-mech-peter', name: 'Peter', type: 'mechanic', groupId: 'group-klagenfurt-mechanics', qualifications: [QUALIFICATIONS.generalService, QUALIFICATIONS.brakes, QUALIFICATIONS.tyres], demoLocationId: 'klagenfurt' },
  { id: 'klg-advisor-jeff', name: 'Jeff', type: 'advisor', groupId: 'group-klagenfurt-advisors', qualifications: [], demoLocationId: 'klagenfurt' },
  { id: 'klg-advisor-tom', name: 'Tom', type: 'advisor', groupId: 'group-klagenfurt-advisors', qualifications: [], demoLocationId: 'klagenfurt' },
  { id: 'klg-car-audi-a4-k657pj', name: 'Audi A4 - K 657 PJ', type: 'driver', groupId: 'group-klagenfurt-courtesy-cars', qualifications: [], demoLocationId: 'klagenfurt' },
  { id: 'klg-car-audi-a3-k336uh', name: 'Audi A3 - K 336 UH', type: 'driver', groupId: 'group-klagenfurt-courtesy-cars', qualifications: [], demoLocationId: 'klagenfurt' },
  { id: 'vie-tech-mark-owen', name: 'Mark Owen', type: 'mechanic', groupId: 'group-vienna-technicians', qualifications: [QUALIFICATIONS.mechanic, QUALIFICATIONS.generalService], displayTags: ['Mechanic'], demoLocationId: 'vienna' },
  { id: 'vie-tech-phil-parker', name: 'Phil Parker', type: 'mechanic', groupId: 'group-vienna-technicians', qualifications: [QUALIFICATIONS.mechanic, QUALIFICATIONS.generalService], displayTags: ['Mechanic'], demoLocationId: 'vienna' },
  { id: 'vie-tech-greg-jackson', name: 'Greg Jackson', type: 'mechanic', groupId: 'group-vienna-technicians', qualifications: [QUALIFICATIONS.mechanic, QUALIFICATIONS.generalService], displayTags: ['Mechanic'], demoLocationId: 'vienna' },
  { id: 'vie-tech-jeff-goldberg', name: 'Jeff Goldberg', type: 'mechanic', groupId: 'group-vienna-technicians', qualifications: [QUALIFICATIONS.mechanic, QUALIFICATIONS.brakes], displayTags: ['Mechanic'], demoLocationId: 'vienna' },
  { id: 'vie-tech-kelly-hanson', name: 'Kelly Hanson', type: 'mechanic', groupId: 'group-vienna-technicians', qualifications: [QUALIFICATIONS.mechanic, QUALIFICATIONS.electrician, QUALIFICATIONS.diagnostics], displayTags: ['Mechanic', 'Electrician'], demoLocationId: 'vienna' },
  { id: 'vie-tech-brenda-miller', name: 'Brenda Miller', type: 'mechanic', groupId: 'group-vienna-technicians', qualifications: [QUALIFICATIONS.mechanic, QUALIFICATIONS.generalService], displayTags: ['Mechanic'], demoLocationId: 'vienna' },
  { id: 'vie-tech-mark-peterson', name: 'Mark Peterson', type: 'mechanic', groupId: 'group-vienna-technicians', qualifications: [QUALIFICATIONS.mechanic, QUALIFICATIONS.generalService], displayTags: ['Mechanic'], demoLocationId: 'vienna' },
  { id: 'vie-tech-lisa-smith', name: 'Lisa Smith', type: 'mechanic', groupId: 'group-vienna-technicians', qualifications: [QUALIFICATIONS.mechanic, QUALIFICATIONS.electrician, QUALIFICATIONS.diagnostics], displayTags: ['Mechanic', 'Electrician'], demoLocationId: 'vienna' },
  { id: 'vie-tech-samuel-frazor', name: 'Samuel Frazor', type: 'mechanic', groupId: 'group-vienna-technicians', qualifications: [QUALIFICATIONS.mechanic, QUALIFICATIONS.generalService], displayTags: ['Mechanic'], demoLocationId: 'vienna' },
  { id: 'vie-painter-jeff-meyer', name: 'Jeff Meyer', type: 'mechanic', groupId: 'group-vienna-painters', qualifications: [QUALIFICATIONS.painter], displayTags: ['Painter'], demoLocationId: 'vienna' },
  { id: 'vie-painter-claus-ford', name: 'Claus Ford', type: 'mechanic', groupId: 'group-vienna-painters', qualifications: [QUALIFICATIONS.painter], displayTags: ['Painter'], demoLocationId: 'vienna' },
  { id: 'vie-advisor-frank-reynold', name: 'Frank Reynold', type: 'advisor', groupId: 'group-vienna-advisors', qualifications: [], demoLocationId: 'vienna' },
  { id: 'vie-advisor-tom-hunter', name: 'Tom Hunter', type: 'advisor', groupId: 'group-vienna-advisors', qualifications: [], demoLocationId: 'vienna' },
  { id: 'vie-advisor-phil-wilson', name: 'Phil Wilson', type: 'advisor', groupId: 'group-vienna-advisors', qualifications: [], demoLocationId: 'vienna' },
  { id: 'vie-advisor-brandon-richards', name: 'Brandon Richards', type: 'advisor', groupId: 'group-vienna-advisors', qualifications: [], demoLocationId: 'vienna' },
  { id: 'vie-bay-pc-1', name: 'PC Bay 1', type: 'bay', groupId: 'group-vienna-bays', qualifications: [QUALIFICATIONS.pcBay], displayTags: ['PC Bay'], demoLocationId: 'vienna' },
  { id: 'vie-bay-pc-2', name: 'PC Bay 2', type: 'bay', groupId: 'group-vienna-bays', qualifications: [QUALIFICATIONS.pcBay], displayTags: ['PC Bay'], demoLocationId: 'vienna' },
  { id: 'vie-bay-pc-3', name: 'PC Bay 3', type: 'bay', groupId: 'group-vienna-bays', qualifications: [QUALIFICATIONS.pcBay], displayTags: ['PC Bay'], demoLocationId: 'vienna' },
  { id: 'vie-bay-pc-4', name: 'PC Bay 4', type: 'bay', groupId: 'group-vienna-bays', qualifications: [QUALIFICATIONS.pcBay], displayTags: ['PC Bay'], demoLocationId: 'vienna' },
  { id: 'vie-bay-pc-5', name: 'PC Bay 5', type: 'bay', groupId: 'group-vienna-bays', qualifications: [QUALIFICATIONS.pcBay], displayTags: ['PC Bay'], demoLocationId: 'vienna' },
  { id: 'vie-bay-pc-6', name: 'PC Bay 6', type: 'bay', groupId: 'group-vienna-bays', qualifications: [QUALIFICATIONS.pcBay], displayTags: ['PC Bay'], demoLocationId: 'vienna' },
  { id: 'vie-bay-pc-alignment-1', name: 'PC Alignment Bay 1', type: 'bay', groupId: 'group-vienna-bays', qualifications: [QUALIFICATIONS.pcAlignmentBay], displayTags: ['PC Alignm. Bay'], demoLocationId: 'vienna' },
  { id: 'vie-bay-lt-1', name: 'LT Bay 1', type: 'bay', groupId: 'group-vienna-bays', qualifications: [QUALIFICATIONS.ltBay], displayTags: ['LT Bay'], demoLocationId: 'vienna' },
  { id: 'vie-device-bea-950-1', name: 'BEA 950 Emission Tester 1', type: 'device', groupId: 'group-vienna-devices', qualifications: [QUALIFICATIONS.emissionTester], displayTags: ['Emission Tester'], demoLocationId: 'vienna' },
  { id: 'vie-device-eps-708', name: 'EPS 708 Diesel Tester', type: 'device', groupId: 'group-vienna-devices', qualifications: [QUALIFICATIONS.dieselTester], displayTags: ['Diesel tester'], demoLocationId: 'vienna' },
  { id: 'vie-car-audi-a4-w54223x', name: 'Audi A4 - W 54223 X', type: 'driver', groupId: 'group-vienna-courtesy-cars', qualifications: [], displayTags: ['Courtesy Car'], demoLocationId: 'vienna' },
  { id: 'vie-car-audi-a4-w54224r', name: 'Audi A4 - W 54224 R', type: 'driver', groupId: 'group-vienna-courtesy-cars', qualifications: [], displayTags: ['Courtesy Car'], demoLocationId: 'vienna' },
  { id: 'vie-car-audi-a4-w12781a', name: 'Audi A4 - W 12781 A', type: 'driver', groupId: 'group-vienna-courtesy-cars', qualifications: [], displayTags: ['Courtesy Car'], demoLocationId: 'vienna' },
  { id: 'vie-car-audi-a4-w85322x', name: 'Audi A4 - W 85322 X', type: 'driver', groupId: 'group-vienna-courtesy-cars', qualifications: [], displayTags: ['Courtesy Car'], demoLocationId: 'vienna' },
  { id: 'vie-car-audi-a5-w11092r', name: 'Audi A5 - W 11092 R', type: 'driver', groupId: 'group-vienna-courtesy-cars', qualifications: [], displayTags: ['Courtesy Car'], demoLocationId: 'vienna' },
  { id: 'vie-car-bmw-x3-w32464u', name: 'BMW X3 - W 32464 U', type: 'driver', groupId: 'group-vienna-courtesy-cars', qualifications: [], displayTags: ['Courtesy Car'], demoLocationId: 'vienna' },
  { id: 'vie-car-bmw-x3-w32422t', name: 'BMW X3 - W 32422 T', type: 'driver', groupId: 'group-vienna-courtesy-cars', qualifications: [], displayTags: ['Courtesy Car'], demoLocationId: 'vienna' },
];

const baseDate = new Date('2024-04-10');
const mockCurrentTime = new Date('2024-04-15T09:00:00');

const getTimedExecutionStatus = (start: Date, end: Date) => {
  if (end <= mockCurrentTime) return 'completed' as const;
  if (start <= mockCurrentTime && mockCurrentTime < end) return 'in-progress' as const;
  return 'scheduled' as const;
};

const mayPlannerDemoBookings: Array<{
  day: number;
  reference: string;
  jobId: string;
  resourceId: string;
  start: string;
  end: string;
  title: string;
  kind?: ScheduleEntry['kind'];
  category?: ScheduleEntry['workorderItemCategory'];
}> = [
  { day: 1, reference: '014826501', jobId: 'job-wo-bg-1002-1', resourceId: 'mech-mark-owen', start: '09:15', end: '11:15', title: 'May service inspection' },
  { day: 1, reference: '014826501', jobId: 'job-wo-bg-1002-2', resourceId: 'advisor-ted-phillips', start: '09:00', end: '10:30', title: 'Customer intake', category: 'activity' },
  { day: 2, reference: '014826502', jobId: 'job-wo-bg-1003-1', resourceId: 'mech-phil-parker', start: '10:00', end: '14:30', title: 'Brake noise diagnosis' },
  { day: 2, reference: '014826502', jobId: 'job-wo-bg-1003-2', resourceId: 'car-audi-a4-kl657og', start: '09:00', end: '17:30', title: 'Courtesy car reservation', category: 'activity' },
  { day: 5, reference: '014826503', jobId: 'job-wo-bg-1004-1', resourceId: 'mech-greg-jackson', start: '09:00', end: '16:30', title: 'MOT preparation' },
  { day: 5, reference: '014826503', jobId: 'job-wo-bg-1004-2', resourceId: 'advisor-frank-miller', start: '14:00', end: '16:00', title: 'Repair approval calls', category: 'activity' },
  { day: 6, reference: '014826504', jobId: 'job-wo-bg-1005-1', resourceId: 'mech-jeff-goldberg', start: '09:30', end: '12:30', title: 'Suspension repair' },
  { day: 6, reference: '014826504', jobId: 'job-wo-bg-1005-2', resourceId: 'car-audi-a3-kl643ju', start: '10:00', end: '18:00', title: 'Courtesy car reservation', category: 'activity' },
  { day: 7, reference: '014826505', jobId: 'job-wo-bg-1006-1', resourceId: 'mech-kelly-hanson', start: '11:00', end: '15:00', title: 'Control unit diagnostics' },
  { day: 7, reference: '014826505', jobId: 'job-wo-bg-1006-2', resourceId: 'advisor-ted-phillips', start: '09:00', end: '13:00', title: 'Service advisor appointments', category: 'activity' },
  { day: 8, reference: '014826506', jobId: 'job-wo-bg-1007-1', resourceId: 'mech-scenario-flex', start: '09:00', end: '18:00', title: 'High-priority workshop support' },
  { day: 8, reference: '014826506', jobId: 'job-wo-bg-1007-2', resourceId: 'car-bmw-320-mw112ab', start: '09:00', end: '21:00', title: 'Courtesy car all day', category: 'activity' },
  { day: 9, reference: '014826507', jobId: 'job-wo-bg-1008-1', resourceId: 'mech-mark-owen', start: '09:30', end: '11:30', title: 'Tyre pressure warning' },
  { day: 9, reference: '014826507', jobId: 'job-wo-bg-1008-2', resourceId: 'mech-phil-parker', start: '13:00', end: '17:00', title: 'Brake pad replacement' },
  { day: 12, reference: '014826508', jobId: 'job-wo-bg-1009-1', resourceId: 'advisor-frank-miller', start: '09:00', end: '16:30', title: 'Reception coverage', category: 'activity' },
  { day: 12, reference: '014826508', jobId: 'job-wo-bg-1009-2', resourceId: 'mech-greg-jackson', start: '10:00', end: '12:30', title: 'Emissions fault diagnosis' },
  { day: 13, reference: '014826509', jobId: 'job-wo-bg-1010-1', resourceId: 'mech-jeff-goldberg', start: '09:00', end: '11:00', title: 'Steering vibration check' },
  { day: 13, reference: '014826509', jobId: 'job-wo-bg-1010-2', resourceId: 'car-scenario-courtesy', start: '09:00', end: '15:00', title: 'Short courtesy car booking', category: 'activity' },
  { day: 14, reference: '014826501', jobId: 'job-wo-bg-1002-1', resourceId: 'mech-kelly-hanson', start: '09:00', end: '12:00', title: 'Battery draw test' },
  { day: 14, reference: '014826501', jobId: 'job-wo-bg-1002-2', resourceId: 'advisor-ted-phillips', start: '13:00', end: '17:00', title: 'Customer handover block', category: 'activity' },
  { day: 15, reference: '014826502', jobId: 'job-wo-bg-1003-1', resourceId: 'mech-phil-parker', start: '09:00', end: '21:00', title: 'Major repair day' },
  { day: 15, reference: '014826502', jobId: 'job-wo-bg-1003-2', resourceId: 'car-audi-a4-kl657og', start: '09:00', end: '21:00', title: 'Courtesy car all day', category: 'activity' },
  { day: 16, reference: '014826503', jobId: 'job-wo-bg-1004-1', resourceId: 'mech-mark-owen', start: '10:00', end: '13:00', title: 'Final inspection' },
  { day: 16, reference: '014826503', jobId: 'job-wo-bg-1004-2', resourceId: 'advisor-frank-miller', start: '09:00', end: '11:00', title: 'Check-in wave', category: 'activity' },
  { day: 19, reference: '014826504', jobId: 'job-wo-bg-1005-1', resourceId: 'mech-greg-jackson', start: '09:00', end: '15:30', title: 'Diagnostics backlog' },
  { day: 19, reference: '014826504', jobId: 'job-wo-bg-1005-2', resourceId: 'mech-jeff-goldberg', start: '12:30', end: '17:30', title: 'Workshop overflow' },
  { day: 20, reference: '014826505', jobId: 'job-wo-bg-1006-1', resourceId: 'advisor-scenario-lead', start: '09:00', end: '18:00', title: 'Service advisor desk', category: 'activity' },
  { day: 20, reference: '014826505', jobId: 'job-wo-bg-1006-2', resourceId: 'car-audi-a3-kl643ju', start: '09:00', end: '17:00', title: 'Courtesy car booking', category: 'activity' },
  { day: 21, reference: '014826506', jobId: 'job-wo-bg-1007-1', resourceId: 'mech-scenario-flex', start: '09:00', end: '12:00', title: 'Express jobs support' },
  { day: 21, reference: '014826506', jobId: 'job-wo-bg-1007-2', resourceId: 'mech-kelly-hanson', start: '13:00', end: '18:00', title: 'Electrical diagnosis' },
  { day: 22, reference: '014826507', jobId: 'job-wo-bg-1008-1', resourceId: 'car-bmw-320-mw112ab', start: '09:00', end: '21:00', title: 'Courtesy car all day', category: 'activity' },
  { day: 22, reference: '014826507', jobId: 'job-wo-bg-1008-2', resourceId: 'mech-phil-parker', start: '10:00', end: '14:00', title: 'Brake repair follow-up' },
  { day: 23, reference: '014826508', jobId: 'job-wo-bg-1009-1', resourceId: 'mech-mark-owen', start: '09:30', end: '12:00', title: 'Quick service package' },
  { day: 23, reference: '014826508', jobId: 'job-wo-bg-1009-2', resourceId: 'advisor-ted-phillips', start: '10:00', end: '15:00', title: 'Advisor bookings', category: 'activity' },
  { day: 26, reference: '014826509', jobId: 'job-wo-bg-1010-1', resourceId: 'mech-jeff-goldberg', start: '09:00', end: '18:00', title: 'Workshop campaign' },
  { day: 26, reference: '014826509', jobId: 'job-wo-bg-1010-2', resourceId: 'car-scenario-courtesy', start: '12:00', end: '18:00', title: 'Afternoon courtesy car', category: 'activity' },
  { day: 27, reference: '014826501', jobId: 'job-wo-bg-1002-1', resourceId: 'mech-kelly-hanson', start: '10:00', end: '12:30', title: 'Battery replacement' },
  { day: 27, reference: '014826501', jobId: 'job-wo-bg-1002-2', resourceId: 'advisor-frank-miller', start: '09:00', end: '14:00', title: 'Advisor customer calls', category: 'activity' },
  { day: 28, reference: '014826502', jobId: 'job-wo-bg-1003-1', resourceId: 'mech-greg-jackson', start: '09:00', end: '11:30', title: 'A/C service' },
  { day: 28, reference: '014826502', jobId: 'job-wo-bg-1003-2', resourceId: 'car-audi-a4-kl657og', start: '09:00', end: '18:00', title: 'Courtesy car booking', category: 'activity' },
  { day: 29, reference: '014826503', jobId: 'job-wo-bg-1004-1', resourceId: 'mech-scenario-flex', start: '09:00', end: '15:00', title: 'Workshop recovery block' },
  { day: 29, reference: '014826503', jobId: 'job-wo-bg-1004-2', resourceId: 'advisor-scenario-lead', start: '13:00', end: '17:30', title: 'Late handovers', category: 'activity' },
  { day: 30, reference: '014826504', jobId: 'job-wo-bg-1005-1', resourceId: 'mech-mark-owen', start: '09:00', end: '10:30', title: 'Pre-weekend check' },
  { day: 30, reference: '014826504', jobId: 'job-wo-bg-1005-2', resourceId: 'car-audi-a3-kl643ju', start: '09:00', end: '13:00', title: 'Morning courtesy car', category: 'activity' },
];

const mayPlannerDayCapacity: Array<{
  day: number;
  reference: string;
  jobId: string;
  resourceId: string;
  hours: number;
  title: string;
}> = [
  { day: 2, reference: '014826502', jobId: 'job-wo-bg-1003-1', resourceId: 'mech-jeff-goldberg', hours: 2, title: 'Prepare parts and road test' },
  { day: 6, reference: '014826504', jobId: 'job-wo-bg-1005-2', resourceId: 'mech-greg-jackson', hours: 3, title: 'Capacity hold: diagnostics' },
  { day: 8, reference: '014826506', jobId: 'job-wo-bg-1007-1', resourceId: 'advisor-frank-miller', hours: 2, title: 'Callback capacity' },
  { day: 12, reference: '014826508', jobId: 'job-wo-bg-1009-2', resourceId: 'mech-phil-parker', hours: 4, title: 'Capacity hold: brake repair' },
  { day: 15, reference: '014826502', jobId: 'job-wo-bg-1003-2', resourceId: 'advisor-ted-phillips', hours: 3, title: 'Capacity hold: handovers' },
  { day: 19, reference: '014826504', jobId: 'job-wo-bg-1005-1', resourceId: 'car-scenario-courtesy', hours: 6, title: 'Courtesy car day hold' },
  { day: 22, reference: '014826507', jobId: 'job-wo-bg-1008-2', resourceId: 'mech-mark-owen', hours: 2, title: 'Capacity hold: quality check' },
  { day: 28, reference: '014826502', jobId: 'job-wo-bg-1003-1', resourceId: 'mech-kelly-hanson', hours: 3, title: 'Capacity hold: A/C follow-up' },
];

const MOCK_MAY_PLANNER_SCHEDULE_ENTRIES: ScheduleEntry[] = [
  ...mayPlannerDemoBookings.map((booking, index) => ({
    id: `sch-may-demo-${index + 1}`,
    jobId: booking.jobId,
    resourceId: booking.resourceId,
    start: new Date(`2024-05-${String(booking.day).padStart(2, '0')}T${booking.start}:00`),
    end: new Date(`2024-05-${String(booking.day).padStart(2, '0')}T${booking.end}:00`),
    title: booking.title,
    color: '#A6C8FF',
    kind: 'scheduled' as const,
    workOrderReference: booking.reference,
    workorderItemStatus: 'scheduled' as const,
    workorderItemCategory: booking.category ?? 'job',
  })),
  ...mayPlannerDayCapacity.map((block, index) => ({
    id: `sch-may-capacity-${index + 1}`,
    jobId: block.jobId,
    resourceId: block.resourceId,
    start: new Date(`2024-05-${String(block.day).padStart(2, '0')}T09:00:00`),
    end: new Date(new Date(`2024-05-${String(block.day).padStart(2, '0')}T09:00:00`).getTime() + block.hours * 60 * 60000),
    title: block.title,
    color: '#4C68B1',
    kind: 'day-capacity' as const,
    workOrderReference: block.reference,
    workorderItemStatus: 'scheduled' as const,
    workorderItemCategory: 'job' as const,
  })),
];

const MOCK_MAY_CAPACITY_DEMO_UNAVAILABILITY: UnavailabilityBlock[] = [
  ...['mech-mark-owen', 'mech-phil-parker', 'mech-greg-jackson'].map(resourceId => ({
    resourceId,
    start: new Date('2024-05-16T09:00:00'),
    end: new Date('2024-05-16T21:00:00'),
    reason: 'May demo mechanic demand',
    title: 'May demo mechanic demand',
    color: '#E0E0E0',
  })),
  ...['advisor-scenario-lead', 'advisor-ted-phillips'].map(resourceId => ({
    resourceId,
    start: new Date('2024-05-20T09:00:00'),
    end: new Date('2024-05-20T21:00:00'),
    reason: 'May demo advisor shortage',
    title: 'May demo advisor shortage',
    color: '#E0E0E0',
  })),
  ...['car-scenario-courtesy', 'car-audi-a4-kl657og', 'car-audi-a3-kl643ju', 'car-bmw-320-mw112ab'].map(resourceId => ({
    resourceId,
    start: new Date('2024-05-22T09:00:00'),
    end: new Date('2024-05-22T21:00:00'),
    reason: 'May demo courtesy car shortage',
    title: 'May demo courtesy car shortage',
    color: '#E0E0E0',
  })),
];

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
  '014826610': { status: 'edit', workflowState: 'offer' },
  '014826611': { status: 'edit', workflowState: 'offer' },
  '014826612': { status: 'edit', workflowState: 'offer' },
  '014826615': { status: 'edit', workflowState: 'offer' },
  '014826616': { status: 'edit', workflowState: 'offer' },
  '014826617': { status: 'edit', workflowState: 'offer' },
  '014826613': { status: 'preparation', workflowState: 'preparation' },
  '014826614': { status: 'preparation', workflowState: 'preparation' },
  '014826706': { status: 'edit', workflowState: 'offer' },
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
      address: 'St. Martin Strasse 56',
      city: 'Munich',
      country: 'Germany',
      phone: '+49 89 123456',
      email: 'fleet@alpha.example',
    },
    billingParty: {
      id: 'customer-alpha-gmbh',
      name: 'Alpha GMBH',
      address: 'St. Martin Strasse 56',
      city: 'Munich',
      country: 'Germany',
    },
    jobs: [
      {
        id: 'job-014826312-tire-change',
        workOrderId: 'wo-014826312',
        title: 'Tire Change',
        description: 'Remove wheels, replace tires, balance assemblies, set pressures, and torque wheel bolts to specification.',
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
        description: 'Test battery and charging system, replace battery if failed, register battery change, and verify start/stop operation.',
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
        description: 'Perform yearly/25,000km service checklist: replace oil and filters, inspect brakes, fluids, lights, tires, and reset service indicator.',
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
        description: 'Connect BEA 950 emission tester, run prescribed emissions cycle, record measured values, and attach result to MOT check.',
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
        description: 'Inspect brake pads, discs, lines, and fluid; run brake force test and document any MOT safety defects.',
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
  {
    id: 'wo-014826610',
    referenceNumber: '014826610',
    status: 'edit',
    workflowState: 'offer',
    demoLocationId: 'klagenfurt',
    vehicle: {
      id: 'vehicle-014826610',
      licensePlate: 'K 610 FK',
      make: 'Audi',
      model: 'A4 Avant',
      vin: 'WAUZZZ8K0KA826610',
      mileage: 82000,
      location: 'Klagenfurt',
    },
    customer: {
      id: 'customer-klagenfurt-retail-610',
      name: 'Klagenfurt Retail GmbH',
      city: 'Klagenfurt',
      country: 'Austria',
      phone: '+43 463 826610',
      email: 'service@klagenfurt-retail.example',
    },
    jobs: [
      {
        id: 'job-014826610-service-inspection',
        workOrderId: 'wo-014826610',
        title: 'Annual Service Inspection',
        description: 'Perform annual service checklist, replace oil and filter, inspect brakes, fluids, lights and tyres, and reset service indicator.',
        fru: 1.5,
        estimatedDurationMinutes: 90,
        requiredResourceType: 'mechanic',
        requiredQualifications: [QUALIFICATIONS.generalService],
        resourceRequirements: [
          { resourceType: 'mechanic', requiredQualifications: [QUALIFICATIONS.generalService], label: 'Mechanic' },
        ],
        status: 'unscheduled',
      },
      {
        id: 'job-014826610-brake-check',
        workOrderId: 'wo-014826610',
        title: 'Brake Check',
        description: 'Inspect brake pads, discs, lines and fluid; document remaining wear and required follow-up.',
        fru: 0.5,
        estimatedDurationMinutes: 30,
        requiredResourceType: 'mechanic',
        requiredQualifications: [QUALIFICATIONS.brakes],
        resourceRequirements: [
          { resourceType: 'mechanic', requiredQualifications: [QUALIFICATIONS.brakes], label: 'Mechanic' },
        ],
        status: 'unscheduled',
      },
    ],
    createdAt: baseDate,
    updatedAt: baseDate,
    notes: 'Klagenfurt demo order with Klagenfurt workshop requirements.',
  },
  {
    id: 'wo-014826611',
    referenceNumber: '014826611',
    status: 'edit',
    workflowState: 'offer',
    demoLocationId: 'klagenfurt',
    vehicle: {
      id: 'vehicle-014826611',
      licensePlate: 'K 611 UH',
      make: 'Audi',
      model: 'A3 Sportback',
      vin: 'WAUZZZ8V0KA826611',
      mileage: 54000,
      location: 'Klagenfurt',
    },
    customer: {
      id: 'customer-woerthersee-fleet',
      name: 'Woerthersee Fleet Services',
      city: 'Klagenfurt',
      country: 'Austria',
      phone: '+43 463 826611',
      email: 'fleet@woerthersee.example',
    },
    jobs: [
      {
        id: 'job-014826611-diagnostics',
        workOrderId: 'wo-014826611',
        title: 'Warning Light Diagnosis',
        description: 'Run diagnostic scan, identify warning light root cause, inspect related wiring and components, and document next repair step.',
        fru: 1,
        estimatedDurationMinutes: 60,
        requiredResourceType: 'mechanic',
        requiredQualifications: [QUALIFICATIONS.diagnostics],
        resourceRequirements: [
          { resourceType: 'mechanic', requiredQualifications: [QUALIFICATIONS.diagnostics], label: 'Mechanic' },
        ],
        status: 'unscheduled',
      },
      {
        id: 'job-014826611-battery-test',
        workOrderId: 'wo-014826611',
        title: 'Battery Test',
        description: 'Test battery condition, charging output and start/stop readiness; recommend replacement if needed.',
        fru: 0.5,
        estimatedDurationMinutes: 30,
        requiredResourceType: 'mechanic',
        requiredQualifications: [QUALIFICATIONS.battery],
        resourceRequirements: [
          { resourceType: 'mechanic', requiredQualifications: [QUALIFICATIONS.battery], label: 'Mechanic' },
        ],
        status: 'unscheduled',
      },
    ],
    createdAt: baseDate,
    updatedAt: baseDate,
    notes: 'Klagenfurt demo order for diagnostics and battery workflow.',
  },
  {
    id: 'wo-014826612',
    referenceNumber: '014826612',
    status: 'edit',
    workflowState: 'offer',
    demoLocationId: 'klagenfurt',
    vehicle: {
      id: 'vehicle-014826612',
      licensePlate: 'K 612 PJ',
      make: 'Volkswagen',
      model: 'Passat Variant',
      vin: 'WVWZZZ3CZKA826612',
      mileage: 103000,
      location: 'Klagenfurt',
    },
    customer: {
      id: 'customer-alpine-delivery',
      name: 'Alpine Delivery KG',
      city: 'Klagenfurt',
      country: 'Austria',
      phone: '+43 463 826612',
      email: 'dispatch@alpine-delivery.example',
    },
    jobs: [
      {
        id: 'job-014826612-mot-emissions',
        workOrderId: 'wo-014826612',
        title: 'MOT and Emissions Preparation',
        description: 'Prepare vehicle for inspection, run emissions-related checks, verify readiness monitors and document any failed items.',
        fru: 1,
        estimatedDurationMinutes: 60,
        requiredResourceType: 'mechanic',
        requiredQualifications: [QUALIFICATIONS.emissions],
        resourceRequirements: [
          { resourceType: 'mechanic', requiredQualifications: [QUALIFICATIONS.emissions], label: 'Mechanic' },
        ],
        status: 'unscheduled',
      },
      {
        id: 'job-014826612-tyre-inspection',
        workOrderId: 'wo-014826612',
        title: 'Tyre Inspection',
        description: 'Inspect tyres for tread depth, sidewall damage and pressure; rotate or replace as required.',
        fru: 0.5,
        estimatedDurationMinutes: 30,
        requiredResourceType: 'mechanic',
        requiredQualifications: [QUALIFICATIONS.tyres],
        resourceRequirements: [
          { resourceType: 'mechanic', requiredQualifications: [QUALIFICATIONS.tyres], label: 'Mechanic' },
        ],
        status: 'unscheduled',
      },
    ],
    createdAt: baseDate,
    updatedAt: baseDate,
    notes: 'Klagenfurt demo order requiring emissions-qualified workshop capacity.',
  },
  {
    id: 'wo-014826615',
    referenceNumber: '014826615',
    status: 'edit',
    workflowState: 'offer',
    demoLocationId: 'klagenfurt',
    vehicle: {
      id: 'vehicle-014826615',
      licensePlate: 'K 615 HM',
      make: 'Volkswagen',
      model: 'Tiguan',
      vin: 'WVGZZZ5NZKA826615',
      mileage: 73000,
      location: 'Klagenfurt',
    },
    customer: {
      id: 'customer-harbor-market-klagenfurt',
      name: 'Harbor Market Klagenfurt',
      city: 'Klagenfurt',
      country: 'Austria',
      phone: '+43 463 826615',
      email: 'fleet@harbor-market-klagenfurt.example',
    },
    jobs: [
      {
        id: 'job-014826615-oil-service',
        workOrderId: 'wo-014826615',
        title: 'Oil Service',
        description: 'Complete oil and filter service, inspect fluid levels and reset service interval indicator.',
        fru: 1,
        estimatedDurationMinutes: 60,
        requiredResourceType: 'mechanic',
        requiredQualifications: [QUALIFICATIONS.generalService],
        resourceRequirements: [
          { resourceType: 'mechanic', requiredQualifications: [QUALIFICATIONS.generalService], label: 'Mechanic' },
        ],
        status: 'unscheduled',
      },
      {
        id: 'job-014826615-tyre-pressure',
        workOrderId: 'wo-014826615',
        title: 'Tyre Pressure Warning',
        description: 'Inspect tyres, correct pressures, check TPMS warning and record follow-up recommendation.',
        fru: 0.5,
        estimatedDurationMinutes: 30,
        requiredResourceType: 'mechanic',
        requiredQualifications: [QUALIFICATIONS.tyres],
        resourceRequirements: [
          { resourceType: 'mechanic', requiredQualifications: [QUALIFICATIONS.tyres], label: 'Mechanic' },
        ],
        status: 'unscheduled',
      },
    ],
    createdAt: baseDate,
    updatedAt: baseDate,
    notes: 'Klagenfurt pending demo order with no pre-planned bookings.',
  },
  {
    id: 'wo-014826616',
    referenceNumber: '014826616',
    status: 'edit',
    workflowState: 'offer',
    demoLocationId: 'klagenfurt',
    vehicle: {
      id: 'vehicle-014826616',
      licensePlate: 'K 616 GD',
      make: 'Audi',
      model: 'A6 Avant',
      vin: 'WAUZZZF20KA826616',
      mileage: 98000,
      location: 'Klagenfurt',
    },
    customer: {
      id: 'customer-green-delivery-klagenfurt',
      name: 'Green Delivery Klagenfurt',
      city: 'Klagenfurt',
      country: 'Austria',
      phone: '+43 463 826616',
      email: 'operations@green-delivery-klagenfurt.example',
    },
    jobs: [
      {
        id: 'job-014826616-diagnostics',
        workOrderId: 'wo-014826616',
        title: 'Diagnostic Scan',
        description: 'Run diagnostic scan for intermittent warning, save fault report and identify next repair step.',
        fru: 1,
        estimatedDurationMinutes: 60,
        requiredResourceType: 'mechanic',
        requiredQualifications: [QUALIFICATIONS.diagnostics],
        resourceRequirements: [
          { resourceType: 'mechanic', requiredQualifications: [QUALIFICATIONS.diagnostics], label: 'Mechanic' },
        ],
        status: 'unscheduled',
      },
      {
        id: 'job-014826616-brake-inspection',
        workOrderId: 'wo-014826616',
        title: 'Brake Inspection',
        description: 'Inspect brake pads, discs and fluid condition; document safety recommendation before offer approval.',
        fru: 0.5,
        estimatedDurationMinutes: 30,
        requiredResourceType: 'mechanic',
        requiredQualifications: [QUALIFICATIONS.brakes],
        resourceRequirements: [
          { resourceType: 'mechanic', requiredQualifications: [QUALIFICATIONS.brakes], label: 'Mechanic' },
        ],
        status: 'unscheduled',
      },
    ],
    createdAt: baseDate,
    updatedAt: baseDate,
    notes: 'Klagenfurt pending demo order for diagnostics and brake inspection.',
  },
  {
    id: 'wo-014826617',
    referenceNumber: '014826617',
    status: 'edit',
    workflowState: 'offer',
    demoLocationId: 'klagenfurt',
    vehicle: {
      id: 'vehicle-014826617',
      licensePlate: 'K 617 OF',
      make: 'Audi',
      model: 'Q5',
      vin: 'WAUZZZFY0KA826617',
      mileage: 87000,
      location: 'Klagenfurt',
    },
    customer: {
      id: 'customer-klagenfurt-offer-demo',
      name: 'Klagenfurt Offer Demo',
      city: 'Klagenfurt',
      country: 'Austria',
      phone: '+43 463 826617',
      email: 'offer@klagenfurt-demo.example',
    },
    jobs: [
      {
        id: 'job-014826617-service-check',
        workOrderId: 'wo-014826617',
        title: 'Service Check',
        description: 'Perform service check, inspect fluids and tyres, and document offer-stage recommendations.',
        fru: 1,
        estimatedDurationMinutes: 60,
        requiredResourceType: 'mechanic',
        requiredQualifications: [QUALIFICATIONS.generalService],
        resourceRequirements: [
          { resourceType: 'mechanic', requiredQualifications: [QUALIFICATIONS.generalService], label: 'Mechanic' },
        ],
        status: 'unscheduled',
      },
      {
        id: 'job-014826617-brake-check',
        workOrderId: 'wo-014826617',
        title: 'Brake Check',
        description: 'Inspect brake pads, discs and fluid before confirming the customer offer.',
        fru: 0.5,
        estimatedDurationMinutes: 30,
        requiredResourceType: 'mechanic',
        requiredQualifications: [QUALIFICATIONS.brakes],
        resourceRequirements: [
          { resourceType: 'mechanic', requiredQualifications: [QUALIFICATIONS.brakes], label: 'Mechanic' },
        ],
        status: 'unscheduled',
      },
    ],
    createdAt: baseDate,
    updatedAt: baseDate,
    notes: 'Klagenfurt offer-stage location demo order. Opens with the Klagenfurt resource view.',
  },
  {
    id: 'wo-014826613',
    referenceNumber: '014826613',
    status: 'preparation',
    workflowState: 'preparation',
    demoLocationId: 'klagenfurt',
    vehicle: {
      id: 'vehicle-014826613',
      licensePlate: 'K 613 JJ',
      make: 'Audi',
      model: 'Q3',
      vin: 'WAUZZZF30KA826613',
      mileage: 68000,
      location: 'Klagenfurt',
    },
    customer: {
      id: 'customer-city-hotel-klagenfurt',
      name: 'City Hotel Klagenfurt',
      city: 'Klagenfurt',
      country: 'Austria',
      phone: '+43 463 826613',
      email: 'fleet@city-hotel-klagenfurt.example',
    },
    jobs: [
      {
        id: 'job-014826613-tyre-change',
        workOrderId: 'wo-014826613',
        title: 'Tyre Change',
        description: 'Replace tyres, balance wheels, set pressures and perform final road-safety check.',
        fru: 1,
        estimatedDurationMinutes: 60,
        requiredResourceType: 'mechanic',
        requiredQualifications: [QUALIFICATIONS.tyres],
        resourceRequirements: [
          { resourceType: 'mechanic', requiredQualifications: [QUALIFICATIONS.tyres], label: 'Mechanic' },
        ],
        status: 'unscheduled',
      },
      {
        id: 'job-014826613-diagnostics',
        workOrderId: 'wo-014826613',
        title: 'Diagnostic Scan',
        description: 'Run full vehicle diagnostic scan, document faults and clear resolved fault memory.',
        fru: 0.5,
        estimatedDurationMinutes: 30,
        requiredResourceType: 'mechanic',
        requiredQualifications: [QUALIFICATIONS.diagnostics],
        resourceRequirements: [
          { resourceType: 'mechanic', requiredQualifications: [QUALIFICATIONS.diagnostics], label: 'Mechanic' },
        ],
        status: 'unscheduled',
      },
    ],
    createdAt: baseDate,
    updatedAt: baseDate,
    notes: 'Klagenfurt scheduled demo order on 15 April.',
  },
  {
    id: 'wo-014826614',
    referenceNumber: '014826614',
    status: 'preparation',
    workflowState: 'preparation',
    demoLocationId: 'klagenfurt',
    vehicle: {
      id: 'vehicle-014826614',
      licensePlate: 'K 614 FT',
      make: 'Volkswagen',
      model: 'Golf Variant',
      vin: 'WVWZZZAUZKA826614',
      mileage: 91000,
      location: 'Klagenfurt',
    },
    customer: {
      id: 'customer-karnten-delivery',
      name: 'Kaernten Delivery Services',
      city: 'Klagenfurt',
      country: 'Austria',
      phone: '+43 463 826614',
      email: 'service@kaernten-delivery.example',
    },
    jobs: [
      {
        id: 'job-014826614-battery-replacement',
        workOrderId: 'wo-014826614',
        title: 'Battery Replacement',
        description: 'Replace battery, register battery change and verify charging/start-stop operation.',
        fru: 0.5,
        estimatedDurationMinutes: 30,
        requiredResourceType: 'mechanic',
        requiredQualifications: [QUALIFICATIONS.battery],
        resourceRequirements: [
          { resourceType: 'mechanic', requiredQualifications: [QUALIFICATIONS.battery], label: 'Mechanic' },
        ],
        status: 'unscheduled',
      },
      {
        id: 'job-014826614-brake-service',
        workOrderId: 'wo-014826614',
        title: 'Brake Service',
        description: 'Inspect brake components, replace worn parts as required and complete brake safety check.',
        fru: 1,
        estimatedDurationMinutes: 60,
        requiredResourceType: 'mechanic',
        requiredQualifications: [QUALIFICATIONS.brakes],
        resourceRequirements: [
          { resourceType: 'mechanic', requiredQualifications: [QUALIFICATIONS.brakes], label: 'Mechanic' },
        ],
        status: 'unscheduled',
      },
    ],
    createdAt: baseDate,
    updatedAt: baseDate,
    notes: 'Klagenfurt scheduled demo order on 16 April.',
  },
  {
    id: 'wo-vie-2006',
    referenceNumber: '014826706',
    status: 'edit',
    workflowState: 'offer',
    demoLocationId: 'vienna',
    vehicle: {
      id: 'vehicle-014826706',
      licensePlate: 'W 706 OF',
      make: 'Audi',
      model: 'Q4 e-tron',
      vin: 'WAUVIE00000026706',
      mileage: 41000,
      location: 'Vienna',
    },
    customer: {
      id: 'customer-vienna-offer-demo',
      name: 'Vienna Offer Demo',
      city: 'Vienna',
      country: 'Austria',
      phone: '+43 1 826706',
      email: 'offer@vienna-demo.example',
    },
    jobs: [
      {
        id: 'job-vie-2006-electric-check',
        workOrderId: 'wo-vie-2006',
        title: 'Electrical Diagnosis',
        description: 'Diagnose charging warning and confirm electrical system condition before offer approval.',
        fru: 1,
        estimatedDurationMinutes: 60,
        requiredResourceType: 'mechanic',
        requiredQualifications: [QUALIFICATIONS.electrician],
        resourceRequirements: [
          { resourceType: 'mechanic', requiredQualifications: [QUALIFICATIONS.electrician], label: 'Electrician' },
          { resourceType: 'bay', requiredQualifications: [QUALIFICATIONS.pcBay], label: 'PC Bay' },
        ],
        status: 'unscheduled',
      },
      {
        id: 'job-vie-2006-final-scan',
        workOrderId: 'wo-vie-2006',
        title: 'Final Diagnostic Scan',
        description: 'Run final diagnostic scan and attach report for the customer offer.',
        fru: 0.5,
        estimatedDurationMinutes: 30,
        requiredResourceType: 'mechanic',
        requiredQualifications: [QUALIFICATIONS.diagnostics],
        resourceRequirements: [
          { resourceType: 'mechanic', requiredQualifications: [QUALIFICATIONS.diagnostics], label: 'Mechanic' },
          { resourceType: 'device', requiredQualifications: [QUALIFICATIONS.dieselTester], label: 'Diesel tester' },
        ],
        status: 'unscheduled',
      },
    ],
    createdAt: baseDate,
    updatedAt: baseDate,
    notes: 'Vienna offer-stage location demo order. Opens with the Vienna resource view.',
  },
  {
    id: 'wo-vie-2001',
    referenceNumber: '014826701',
    status: 'preparation',
    workflowState: 'preparation',
    demoLocationId: 'vienna',
    vehicle: {
      id: 'vehicle-014826701',
      licensePlate: 'W 701 EV',
      make: 'Audi',
      model: 'e-tron GT',
      vin: 'WAUVIE00000026701',
      mileage: 42000,
      location: 'Vienna',
    },
    customer: {
      id: 'customer-vienna-electric-fleet',
      name: 'Vienna Electric Fleet',
      city: 'Vienna',
      country: 'Austria',
      phone: '+43 1 826701',
      email: 'service@vienna-electric-fleet.example',
    },
    jobs: [
      {
        id: 'job-vie-2001-high-voltage-diagnosis',
        workOrderId: 'wo-vie-2001',
        title: 'High Voltage Diagnosis',
        description: 'Run guided high-voltage diagnosis and document electrical fault findings.',
        fru: 1,
        estimatedDurationMinutes: 60,
        requiredResourceType: 'mechanic',
        requiredQualifications: [QUALIFICATIONS.electrician],
        resourceRequirements: [
          { resourceType: 'mechanic', requiredQualifications: [QUALIFICATIONS.electrician], label: 'Electrician' },
          { resourceType: 'bay', requiredQualifications: [QUALIFICATIONS.pcBay], label: 'PC Bay' },
        ],
        status: 'unscheduled',
      },
      {
        id: 'job-vie-2001-software-update',
        workOrderId: 'wo-vie-2001',
        title: 'Control Unit Software Update',
        description: 'Apply pending control-unit software update and verify vehicle handover readiness.',
        fru: 0.5,
        estimatedDurationMinutes: 30,
        requiredResourceType: 'mechanic',
        requiredQualifications: [QUALIFICATIONS.diagnostics],
        resourceRequirements: [
          { resourceType: 'mechanic', requiredQualifications: [QUALIFICATIONS.diagnostics], label: 'Mechanic' },
          { resourceType: 'device', requiredQualifications: [QUALIFICATIONS.dieselTester], label: 'Diesel tester' },
        ],
        status: 'unscheduled',
      },
    ],
    createdAt: baseDate,
    updatedAt: baseDate,
    notes: 'Vienna demo order showing qualification-based technician and device matching.',
  },
  {
    id: 'wo-vie-2002',
    referenceNumber: '014826702',
    status: 'edit',
    workflowState: 'offer',
    demoLocationId: 'vienna',
    vehicle: {
      id: 'vehicle-014826702',
      licensePlate: 'W 702 PA',
      make: 'BMW',
      model: 'X3',
      vin: 'WBAVIE00000026702',
      mileage: 61000,
      location: 'Vienna',
    },
    customer: {
      id: 'customer-vienna-hotel-group',
      name: 'Vienna Hotel Group',
      city: 'Vienna',
      country: 'Austria',
      phone: '+43 1 826702',
      email: 'fleet@vienna-hotel-group.example',
    },
    jobs: [
      {
        id: 'job-vie-2002-paint-repair',
        workOrderId: 'wo-vie-2002',
        title: 'Paint Repair Preparation',
        description: 'Prepare bumper area for paint repair and confirm finish requirements.',
        fru: 1,
        estimatedDurationMinutes: 60,
        requiredResourceType: 'mechanic',
        requiredQualifications: [QUALIFICATIONS.painter],
        resourceRequirements: [
          { resourceType: 'mechanic', requiredQualifications: [QUALIFICATIONS.painter], label: 'Painter' },
          { resourceType: 'bay', requiredQualifications: [QUALIFICATIONS.ltBay], label: 'LT Bay' },
        ],
        status: 'unscheduled',
      },
      {
        id: 'job-vie-2002-emissions-check',
        workOrderId: 'wo-vie-2002',
        title: 'Emission System Check',
        description: 'Run emissions check and document inspection result.',
        fru: 0.5,
        estimatedDurationMinutes: 30,
        requiredResourceType: 'mechanic',
        requiredQualifications: [QUALIFICATIONS.mechanic],
        resourceRequirements: [
          { resourceType: 'mechanic', requiredQualifications: [QUALIFICATIONS.mechanic], label: 'Mechanic' },
          { resourceType: 'device', requiredQualifications: [QUALIFICATIONS.emissionTester], label: 'Emission Tester' },
        ],
        status: 'unscheduled',
      },
    ],
    createdAt: baseDate,
    updatedAt: baseDate,
    notes: 'Vienna unscheduled demo order for painter, bay and device matching.',
  },
  {
    id: 'wo-vie-2003',
    referenceNumber: '014826703',
    status: 'preparation',
    workflowState: 'execution',
    demoLocationId: 'vienna',
    vehicle: {
      id: 'vehicle-014826703',
      licensePlate: 'W 703 EL',
      make: 'Volkswagen',
      model: 'ID.4',
      vin: 'WVWVIE00000026703',
      mileage: 38000,
      location: 'Vienna',
    },
    customer: {
      id: 'customer-danube-energy',
      name: 'Danube Energy Services',
      city: 'Vienna',
      country: 'Austria',
      phone: '+43 1 826703',
      email: 'fleet@danube-energy.example',
    },
    jobs: [
      {
        id: 'job-vie-2003-electric-diagnostics',
        workOrderId: 'wo-vie-2003',
        title: 'Electrical Diagnostics',
        description: 'Diagnose intermittent charging warning and verify control-unit fault memory.',
        fru: 1,
        estimatedDurationMinutes: 60,
        requiredResourceType: 'mechanic',
        requiredQualifications: [QUALIFICATIONS.electrician],
        resourceRequirements: [
          { resourceType: 'mechanic', requiredQualifications: [QUALIFICATIONS.electrician], label: 'Electrician' },
          { resourceType: 'bay', requiredQualifications: [QUALIFICATIONS.pcBay], label: 'PC Bay' },
        ],
        status: 'unscheduled',
      },
      {
        id: 'job-vie-2003-final-scan',
        workOrderId: 'wo-vie-2003',
        title: 'Final Diagnostic Scan',
        description: 'Run final scan after electrical diagnosis and confirm no active warning remains.',
        fru: 0.5,
        estimatedDurationMinutes: 30,
        requiredResourceType: 'mechanic',
        requiredQualifications: [QUALIFICATIONS.diagnostics],
        resourceRequirements: [
          { resourceType: 'mechanic', requiredQualifications: [QUALIFICATIONS.diagnostics], label: 'Mechanic' },
          { resourceType: 'device', requiredQualifications: [QUALIFICATIONS.dieselTester], label: 'Diesel tester' },
        ],
        status: 'unscheduled',
      },
    ],
    createdAt: baseDate,
    updatedAt: baseDate,
    notes: 'Vienna in-progress demo order with an electrician requirement currently being worked.',
  },
  {
    id: 'wo-vie-2004',
    referenceNumber: '014826704',
    status: 'complete',
    workflowState: 'followup',
    demoLocationId: 'vienna',
    vehicle: {
      id: 'vehicle-014826704',
      licensePlate: 'W 704 PT',
      make: 'Audi',
      model: 'A6 Avant',
      vin: 'WAUVIE00000026704',
      mileage: 82000,
      location: 'Vienna',
    },
    customer: {
      id: 'customer-ringstrasse-hotel',
      name: 'Ringstrasse Hotel Fleet',
      city: 'Vienna',
      country: 'Austria',
      phone: '+43 1 826704',
      email: 'fleet@ringstrasse-hotel.example',
    },
    jobs: [
      {
        id: 'job-vie-2004-paint-touchup',
        workOrderId: 'wo-vie-2004',
        title: 'Paint Touch-Up',
        description: 'Complete small paint touch-up and quality inspection before handover.',
        fru: 1,
        estimatedDurationMinutes: 60,
        requiredResourceType: 'mechanic',
        requiredQualifications: [QUALIFICATIONS.painter],
        resourceRequirements: [
          { resourceType: 'mechanic', requiredQualifications: [QUALIFICATIONS.painter], label: 'Painter' },
          { resourceType: 'bay', requiredQualifications: [QUALIFICATIONS.ltBay], label: 'LT Bay' },
        ],
        status: 'unscheduled',
      },
      {
        id: 'job-vie-2004-emissions',
        workOrderId: 'wo-vie-2004',
        title: 'Emission Tester Validation',
        description: 'Validate emission tester result after repair and attach report.',
        fru: 0.5,
        estimatedDurationMinutes: 30,
        requiredResourceType: 'mechanic',
        requiredQualifications: [QUALIFICATIONS.mechanic],
        resourceRequirements: [
          { resourceType: 'mechanic', requiredQualifications: [QUALIFICATIONS.mechanic], label: 'Mechanic' },
          { resourceType: 'device', requiredQualifications: [QUALIFICATIONS.emissionTester], label: 'Emission Tester' },
        ],
        status: 'unscheduled',
      },
    ],
    createdAt: baseDate,
    updatedAt: baseDate,
    notes: 'Vienna completed demo order for the Completed section.',
  },
  {
    id: 'wo-vie-2005',
    referenceNumber: '014826705',
    status: 'edit',
    workflowState: 'offer',
    demoLocationId: 'vienna',
    vehicle: {
      id: 'vehicle-014826705',
      licensePlate: 'W 705 PC',
      make: 'BMW',
      model: '5 Series Touring',
      vin: 'WBAVIE00000026705',
      mileage: 54000,
      location: 'Vienna',
    },
    customer: {
      id: 'customer-prater-courier',
      name: 'Prater Courier GmbH',
      city: 'Vienna',
      country: 'Austria',
      phone: '+43 1 826705',
      email: 'dispatch@prater-courier.example',
    },
    jobs: [
      {
        id: 'job-vie-2005-pc-service',
        workOrderId: 'wo-vie-2005',
        title: 'PC Bay Service',
        description: 'Complete regular PC bay service inspection and document findings.',
        fru: 1,
        estimatedDurationMinutes: 60,
        requiredResourceType: 'mechanic',
        requiredQualifications: [QUALIFICATIONS.mechanic],
        resourceRequirements: [
          { resourceType: 'mechanic', requiredQualifications: [QUALIFICATIONS.mechanic], label: 'Mechanic' },
          { resourceType: 'bay', requiredQualifications: [QUALIFICATIONS.pcBay], label: 'PC Bay' },
        ],
        status: 'unscheduled',
      },
      {
        id: 'job-vie-2005-alignment-check',
        workOrderId: 'wo-vie-2005',
        title: 'Alignment Check',
        description: 'Inspect wheel alignment and record adjustment recommendation.',
        fru: 0.5,
        estimatedDurationMinutes: 30,
        requiredResourceType: 'mechanic',
        requiredQualifications: [QUALIFICATIONS.mechanic],
        resourceRequirements: [
          { resourceType: 'mechanic', requiredQualifications: [QUALIFICATIONS.mechanic], label: 'Mechanic' },
          { resourceType: 'bay', requiredQualifications: [QUALIFICATIONS.pcAlignmentBay], label: 'PC Alignm. Bay' },
        ],
        status: 'unscheduled',
      },
    ],
    createdAt: baseDate,
    updatedAt: baseDate,
    notes: 'Vienna unscheduled demo order for pending planning and alignment bay matching.',
  },  ...[
  ['wo-bg-1001', '014826500', 'Mueller GmbH', 'M-BG 500', 'Oil Leak Diagnosis', 'Engine Bay Inspection', 'mech-mark-owen'],
    ['wo-bg-1002', '014826501', 'Schneider AG', 'M-BG 501', 'Windshield Washer Repair', 'Wiper Blade Replacement', 'mech-phil-parker'],
    ['wo-bg-1003', '014826502', 'Weber Logistics', 'M-BG 502', 'Air Conditioning Diagnosis', 'Cabin Filter Replacement', 'mech-greg-jackson'],
    ['wo-bg-1004', '014826503', 'Klein Fleet', 'M-BG 503', 'Suspension Noise Investigation', 'Shock Absorber Inspection', 'mech-jeff-goldberg'],
    ['wo-bg-1005', '014826504', 'Bauer GmbH', 'M-BG 504', 'Control Unit Scan', 'Software Update', 'mech-kelly-hanson'],
    ['wo-bg-1006', '014826505', 'Neumann Auto', 'M-BG 505', 'Door Lock Repair', 'Key Fob Programming', 'mech-mark-owen'],
    ['wo-bg-1007', '014826506', 'Hofmann Services', 'M-BG 506', 'Coolant Leak Check', 'Pressure Test', 'mech-phil-parker'],
    ['wo-bg-1008', '014826507', 'Adler Transport', 'M-BG 507', 'Noise From Rear Axle', 'Road Test', 'mech-greg-jackson'],
    ['wo-bg-1009', '014826508', 'Stein & Partner', 'M-BG 508', 'Navigation System Update', 'Connectivity Check', 'mech-jeff-goldberg'],
    ['wo-bg-1010', '014826509', 'Wolf Leasing', 'M-BG 509', 'Seat Heating Diagnosis', 'Interior Trim Repair', 'mech-kelly-hanson'],
  ].map(([id, referenceNumber, customerName, licensePlate, firstJob, secondJob]) => ({
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
      phone: `+49 89 ${referenceNumber.slice(-6)}`,
      email: `${customerName.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '')}@example.com`,
    },
    jobs: [
      {
        id: `job-${id}-1`,
        workOrderId: id,
        title: firstJob,
        description: getMechanicJobDescription(firstJob),
        fru: 0.75,
        estimatedDurationMinutes: 45,
        requiredResourceType: 'mechanic' as const,
        requiredQualifications: [QUALIFICATIONS.generalService],
        resourceRequirements: backgroundJobRequirementsByOrder[referenceNumber][0],
        status: 'unscheduled' as const,
      },
      {
        id: `job-${id}-2`,
        workOrderId: id,
        title: secondJob,
        description: getMechanicJobDescription(secondJob),
        fru: 0.5,
        estimatedDurationMinutes: 30,
        requiredResourceType: 'mechanic' as const,
        requiredQualifications: [QUALIFICATIONS.generalService],
        resourceRequirements: backgroundJobRequirementsByOrder[referenceNumber][1],
        status: 'unscheduled' as const,
      },
    ],
    createdAt: baseDate,
    updatedAt: baseDate,
  })),
];

export const MOCK_SCHEDULE_ENTRIES: ScheduleEntry[] = [
  ...MOCK_MAY_PLANNER_SCHEDULE_ENTRIES,
  { id: 'sch-vie-701-frank-checkin', jobId: 'wo-vie-2001:act-checkin', resourceId: 'vie-advisor-frank-reynold', start: new Date('2024-04-15T09:00:00'), end: new Date('2024-04-15T09:30:00'), title: 'Check-In 014826701', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826701' },
  { id: 'sch-vie-701-kelly-hv', jobId: 'job-vie-2001-high-voltage-diagnosis', resourceId: 'vie-tech-kelly-hanson', start: new Date('2024-04-15T09:30:00'), end: new Date('2024-04-15T10:30:00'), title: 'High Voltage Diagnosis', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826701' },
  { id: 'sch-vie-701-bay-hv', jobId: 'job-vie-2001-high-voltage-diagnosis', resourceId: 'vie-bay-pc-1', start: new Date('2024-04-15T09:30:00'), end: new Date('2024-04-15T10:30:00'), title: 'High Voltage Diagnosis', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826701' },
  { id: 'sch-vie-701-lisa-software', jobId: 'job-vie-2001-software-update', resourceId: 'vie-tech-lisa-smith', start: new Date('2024-04-15T10:30:00'), end: new Date('2024-04-15T11:00:00'), title: 'Control Unit Software Update', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826701' },
  { id: 'sch-vie-701-eps-software', jobId: 'job-vie-2001-software-update', resourceId: 'vie-device-eps-708', start: new Date('2024-04-15T10:30:00'), end: new Date('2024-04-15T11:00:00'), title: 'Control Unit Software Update', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826701' },
  { id: 'sch-vie-701-tom-handover', jobId: 'wo-vie-2001:act-handover', resourceId: 'vie-advisor-tom-hunter', start: new Date('2024-04-15T14:00:00'), end: new Date('2024-04-15T14:30:00'), title: 'Handover 014826701', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826701' },
  { id: 'sch-vie-703-phil-checkin', jobId: 'wo-vie-2003:act-checkin', resourceId: 'vie-advisor-phil-wilson', start: new Date('2024-04-15T09:00:00'), end: new Date('2024-04-15T09:30:00'), title: 'Check-In 014826703', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826703' },
  { id: 'sch-vie-703-lisa-electric', jobId: 'job-vie-2003-electric-diagnostics', resourceId: 'vie-tech-lisa-smith', start: new Date('2024-04-15T09:30:00'), end: new Date('2024-04-15T10:30:00'), title: 'Electrical Diagnostics', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826703' },
  { id: 'sch-vie-703-bay-electric', jobId: 'job-vie-2003-electric-diagnostics', resourceId: 'vie-bay-pc-2', start: new Date('2024-04-15T09:30:00'), end: new Date('2024-04-15T10:30:00'), title: 'Electrical Diagnostics', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826703' },
  { id: 'sch-vie-703-kelly-scan', jobId: 'job-vie-2003-final-scan', resourceId: 'vie-tech-kelly-hanson', start: new Date('2024-04-15T11:00:00'), end: new Date('2024-04-15T11:30:00'), title: 'Final Diagnostic Scan', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826703' },
  { id: 'sch-vie-703-eps-scan', jobId: 'job-vie-2003-final-scan', resourceId: 'vie-device-eps-708', start: new Date('2024-04-15T11:00:00'), end: new Date('2024-04-15T11:30:00'), title: 'Final Diagnostic Scan', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826703' },
  { id: 'sch-vie-703-brandon-handover', jobId: 'wo-vie-2003:act-handover', resourceId: 'vie-advisor-brandon-richards', start: new Date('2024-04-15T11:30:00'), end: new Date('2024-04-15T12:00:00'), title: 'Handover 014826703', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826703' },
  { id: 'sch-vie-704-tom-checkin', jobId: 'wo-vie-2004:act-checkin', resourceId: 'vie-advisor-tom-hunter', start: new Date('2024-04-12T09:00:00'), end: new Date('2024-04-12T09:30:00'), title: 'Check-In 014826704', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826704' },
  { id: 'sch-vie-704-jeff-paint', jobId: 'job-vie-2004-paint-touchup', resourceId: 'vie-painter-jeff-meyer', start: new Date('2024-04-12T09:30:00'), end: new Date('2024-04-12T10:30:00'), title: 'Paint Touch-Up', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826704' },
  { id: 'sch-vie-704-lt-paint', jobId: 'job-vie-2004-paint-touchup', resourceId: 'vie-bay-lt-1', start: new Date('2024-04-12T09:30:00'), end: new Date('2024-04-12T10:30:00'), title: 'Paint Touch-Up', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826704' },
  { id: 'sch-vie-704-samuel-emissions', jobId: 'job-vie-2004-emissions', resourceId: 'vie-tech-samuel-frazor', start: new Date('2024-04-12T10:30:00'), end: new Date('2024-04-12T11:00:00'), title: 'Emission Tester Validation', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826704' },
  { id: 'sch-vie-704-bea-emissions', jobId: 'job-vie-2004-emissions', resourceId: 'vie-device-bea-950-1', start: new Date('2024-04-12T10:30:00'), end: new Date('2024-04-12T11:00:00'), title: 'Emission Tester Validation', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826704' },
  { id: 'sch-vie-704-frank-handover', jobId: 'wo-vie-2004:act-handover', resourceId: 'vie-advisor-frank-reynold', start: new Date('2024-04-12T11:00:00'), end: new Date('2024-04-12T11:30:00'), title: 'Handover 014826704', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826704' },
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
  { id: 'sch-bg-1006-mark-2', jobId: 'job-wo-bg-1006-2', resourceId: 'mech-mark-owen', start: new Date('2024-04-16T10:00:00'), end: new Date('2024-04-12T10:30:00'), title: 'Key Fob Programming', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826505' },
  { id: 'sch-bg-1006-eps-1', jobId: 'job-wo-bg-1006-2', resourceId: 'device-eps-708', start: new Date('2024-04-16T10:00:00'), end: new Date('2024-04-12T10:30:00'), title: 'Key Fob Programming', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826505' },
  { id: 'sch-bg-1007-phil-1', jobId: 'job-wo-bg-1007-1', resourceId: 'mech-phil-parker', start: new Date('2024-04-16T10:15:00'), end: new Date('2024-04-12T11:00:00'), title: 'Coolant Leak Check', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826506' },
  { id: 'sch-bg-1007-bay-1', jobId: 'job-wo-bg-1007-1', resourceId: 'bay-pc-3', start: new Date('2024-04-16T10:15:00'), end: new Date('2024-04-12T11:00:00'), title: 'Coolant Leak Check', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826506' },
  { id: 'sch-bg-1007-phil-2', jobId: 'job-wo-bg-1007-2', resourceId: 'mech-phil-parker', start: new Date('2024-04-12T11:00:00'), end: new Date('2024-04-12T11:30:00'), title: 'Pressure Test', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826506' },
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
  { id: 'sch-bg-1002-frank-handover', jobId: 'wo-bg-1002:act-handover', resourceId: 'advisor-frank-miller', start: new Date('2024-04-15T13:00:00'), end: new Date('2024-04-15T13:30:00'), title: 'Handover 014826501', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826501' },
  { id: 'sch-bg-1002-courtesy', jobId: 'wo-bg-1002:act-mobility', resourceId: 'car-audi-a3-kl643ju', start: new Date('2024-04-15T11:15:00'), end: new Date('2024-04-15T13:30:00'), title: 'Courtesy Car 014826501', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826501' },
  { id: 'sch-bg-1003-ted-checkin', jobId: 'wo-bg-1003:act-checkin', resourceId: 'advisor-ted-phillips', start: new Date('2024-04-15T13:00:00'), end: new Date('2024-04-15T13:30:00'), title: 'Check-In 014826502', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826502' },
  { id: 'sch-bg-1003-ted-handover', jobId: 'wo-bg-1003:act-handover', resourceId: 'advisor-ted-phillips', start: new Date('2024-04-15T14:30:00'), end: new Date('2024-04-15T15:00:00'), title: 'Handover 014826502', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826502' },
  { id: 'sch-bg-1003-courtesy', jobId: 'wo-bg-1003:act-mobility', resourceId: 'car-audi-a4-kl657og', start: new Date('2024-04-15T13:30:00'), end: new Date('2024-04-15T15:00:00'), title: 'Courtesy Car 014826502', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826502' },
  { id: 'sch-bg-1004-frank-checkin', jobId: 'wo-bg-1004:act-checkin', resourceId: 'advisor-frank-miller', start: new Date('2024-04-15T13:00:00'), end: new Date('2024-04-15T13:30:00'), title: 'Check-In 014826503', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826503' },
  { id: 'sch-bg-1004-frank-handover', jobId: 'wo-bg-1004:act-handover', resourceId: 'advisor-frank-miller', start: new Date('2024-04-15T15:00:00'), end: new Date('2024-04-15T15:30:00'), title: 'Handover 014826503', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826503' },
  { id: 'sch-bg-1004-courtesy', jobId: 'wo-bg-1004:act-mobility', resourceId: 'car-audi-a3-kl643ju', start: new Date('2024-04-15T13:30:00'), end: new Date('2024-04-15T15:30:00'), title: 'Courtesy Car 014826503', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826503' },
  { id: 'sch-bg-1005-ted-checkin', jobId: 'wo-bg-1005:act-checkin', resourceId: 'advisor-ted-phillips', start: new Date('2024-04-15T15:30:00'), end: new Date('2024-04-15T16:00:00'), title: 'Check-In 014826504', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826504' },
  { id: 'sch-bg-1005-ted-handover', jobId: 'wo-bg-1005:act-handover', resourceId: 'advisor-ted-phillips', start: new Date('2024-04-15T17:15:00'), end: new Date('2024-04-15T17:45:00'), title: 'Handover 014826504', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826504' },
  { id: 'sch-bg-1006-frank-handover', jobId: 'wo-bg-1006:act-handover', resourceId: 'advisor-frank-miller', start: new Date('2024-04-12T10:30:00'), end: new Date('2024-04-12T11:00:00'), title: 'Handover 014826505', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826505' },
  { id: 'sch-bg-1005-courtesy', jobId: 'wo-bg-1005:act-mobility', resourceId: 'car-audi-a4-kl657og', start: new Date('2024-04-15T16:00:00'), end: new Date('2024-04-15T17:45:00'), title: 'Courtesy Car 014826504', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826504' },
  { id: 'sch-bg-1006-frank-checkin', jobId: 'wo-bg-1006:act-checkin', resourceId: 'advisor-frank-miller', start: new Date('2024-04-16T08:45:00'), end: new Date('2024-04-16T09:15:00'), title: 'Check-In 014826505', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826505' },
  { id: 'sch-bg-1006-courtesy', jobId: 'wo-bg-1006:act-mobility', resourceId: 'car-bmw-320-mw112ab', start: new Date('2024-04-16T09:15:00'), end: new Date('2024-04-12T11:00:00'), title: 'Courtesy Car 014826505', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826505' },
  { id: 'sch-bg-1007-ted-checkin', jobId: 'wo-bg-1007:act-checkin', resourceId: 'advisor-ted-phillips', start: new Date('2024-04-16T09:45:00'), end: new Date('2024-04-16T10:15:00'), title: 'Check-In 014826506', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826506' },
  { id: 'sch-bg-1007-ted-handover', jobId: 'wo-bg-1007:act-handover', resourceId: 'advisor-ted-phillips', start: new Date('2024-04-12T11:30:00'), end: new Date('2024-04-16T12:00:00'), title: 'Handover 014826506', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826506' },
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
  { id: 'sch-klg-613-jeff-checkin', jobId: 'wo-014826613:act-checkin', resourceId: 'klg-advisor-jeff', start: new Date('2024-04-15T09:00:00'), end: new Date('2024-04-15T09:30:00'), title: 'Check-In 014826613', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826613' },
  { id: 'sch-klg-613-peter-tyre', jobId: 'job-014826613-tyre-change', resourceId: 'klg-mech-peter', start: new Date('2024-04-15T09:30:00'), end: new Date('2024-04-15T10:30:00'), title: 'Tyre Change', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826613' },
  { id: 'sch-klg-613-frank-diagnostics', jobId: 'job-014826613-diagnostics', resourceId: 'klg-mech-frank', start: new Date('2024-04-15T10:30:00'), end: new Date('2024-04-15T11:00:00'), title: 'Diagnostic Scan', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826613' },
  { id: 'sch-klg-613-tom-handover', jobId: 'wo-014826613:act-handover', resourceId: 'klg-advisor-tom', start: new Date('2024-04-15T12:00:00'), end: new Date('2024-04-15T12:30:00'), title: 'Handover 014826613', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826613' },
  { id: 'sch-klg-614-tom-checkin', jobId: 'wo-014826614:act-checkin', resourceId: 'klg-advisor-tom', start: new Date('2024-04-16T13:00:00'), end: new Date('2024-04-16T13:30:00'), title: 'Check-In 014826614', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826614' },
  { id: 'sch-klg-614-courtesy', jobId: 'wo-014826614:act-mobility', resourceId: 'klg-car-audi-a4-k657pj', start: new Date('2024-04-16T13:30:00'), end: new Date('2024-04-16T16:00:00'), title: 'Courtesy Car 014826614', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826614' },
  { id: 'sch-klg-614-mike-battery', jobId: 'job-014826614-battery-replacement', resourceId: 'klg-mech-mike', start: new Date('2024-04-16T13:30:00'), end: new Date('2024-04-16T14:00:00'), title: 'Battery Replacement', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826614' },
  { id: 'sch-klg-614-peter-brake', jobId: 'job-014826614-brake-service', resourceId: 'klg-mech-peter', start: new Date('2024-04-16T14:00:00'), end: new Date('2024-04-16T15:00:00'), title: 'Brake Service', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826614' },
  { id: 'sch-klg-614-jeff-handover', jobId: 'wo-014826614:act-handover', resourceId: 'klg-advisor-jeff', start: new Date('2024-04-16T16:00:00'), end: new Date('2024-04-16T16:30:00'), title: 'Handover 014826614', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826614' },
  { id: 'sch-klg-610-jeff-checkin', jobId: 'wo-014826610:act-checkin', resourceId: 'klg-advisor-jeff', start: new Date('2024-04-17T09:00:00'), end: new Date('2024-04-17T09:30:00'), title: 'Check-In 014826610', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826610' },
  { id: 'sch-klg-610-frank-service', jobId: 'job-014826610-service-inspection', resourceId: 'klg-mech-frank', start: new Date('2024-04-17T09:30:00'), end: new Date('2024-04-17T11:00:00'), title: 'Annual Service Inspection', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826610' },
  { id: 'sch-klg-610-peter-brake', jobId: 'job-014826610-brake-check', resourceId: 'klg-mech-peter', start: new Date('2024-04-17T11:00:00'), end: new Date('2024-04-17T11:30:00'), title: 'Brake Check', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826610' },
  { id: 'sch-klg-610-tom-handover', jobId: 'wo-014826610:act-handover', resourceId: 'klg-advisor-tom', start: new Date('2024-04-17T15:00:00'), end: new Date('2024-04-17T15:30:00'), title: 'Handover 014826610', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826610' },
  { id: 'sch-klg-611-tom-checkin', jobId: 'wo-014826611:act-checkin', resourceId: 'klg-advisor-tom', start: new Date('2024-04-17T10:00:00'), end: new Date('2024-04-17T10:30:00'), title: 'Check-In 014826611', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826611' },
  { id: 'sch-klg-611-courtesy', jobId: 'wo-014826611:act-mobility', resourceId: 'klg-car-audi-a3-k336uh', start: new Date('2024-04-17T10:30:00'), end: new Date('2024-04-17T13:00:00'), title: 'Courtesy Car 014826611', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826611' },
  { id: 'sch-klg-611-mike-diagnostics', jobId: 'job-014826611-diagnostics', resourceId: 'klg-mech-mike', start: new Date('2024-04-17T10:30:00'), end: new Date('2024-04-17T11:30:00'), title: 'Warning Light Diagnosis', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826611' },
  { id: 'sch-klg-611-mike-battery', jobId: 'job-014826611-battery-test', resourceId: 'klg-mech-mike', start: new Date('2024-04-17T11:30:00'), end: new Date('2024-04-17T12:00:00'), title: 'Battery Test', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826611' },
  { id: 'sch-klg-611-jeff-handover', jobId: 'wo-014826611:act-handover', resourceId: 'klg-advisor-jeff', start: new Date('2024-04-17T13:00:00'), end: new Date('2024-04-17T13:30:00'), title: 'Handover 014826611', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826611' },
  { id: 'sch-klg-612-jeff-checkin', jobId: 'wo-014826612:act-checkin', resourceId: 'klg-advisor-jeff', start: new Date('2024-04-17T13:00:00'), end: new Date('2024-04-17T13:30:00'), title: 'Check-In 014826612', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826612' },
  { id: 'sch-klg-612-john-mot', jobId: 'job-014826612-mot-emissions', resourceId: 'klg-mech-john', start: new Date('2024-04-17T13:30:00'), end: new Date('2024-04-17T14:30:00'), title: 'MOT and Emissions Preparation', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826612' },
  { id: 'sch-klg-612-frank-tyre', jobId: 'job-014826612-tyre-inspection', resourceId: 'klg-mech-frank', start: new Date('2024-04-17T14:30:00'), end: new Date('2024-04-17T15:00:00'), title: 'Tyre Inspection', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826612' },
  { id: 'sch-klg-612-tom-handover', jobId: 'wo-014826612:act-handover', resourceId: 'klg-advisor-tom', start: new Date('2024-04-17T16:00:00'), end: new Date('2024-04-17T16:30:00'), title: 'Handover 014826612', color: '#A6C8FF', kind: 'blocked-order', workOrderReference: '014826612' },
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
const jobResourceById = new Map<string, string>();
const resourceById = new Map(MOCK_RESOURCES.map(resource => [resource.id, resource]));

MOCK_SCHEDULE_ENTRIES
  .filter(entry => !entry.jobId.includes(':act-'))
  .forEach(entry => {
    const order = workOrderByJobId.get(entry.jobId);
    const job = order?.jobs.find(candidate => candidate.id === entry.jobId);
    const resource = resourceById.get(entry.resourceId);
    if (job && resource?.type === job.requiredResourceType) {
      jobResourceById.set(entry.jobId, entry.resourceId);
    }
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
    job.assignedResourceId = jobResourceById.get(job.id) ?? job.assignedResourceId;
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
  ...MOCK_MAY_CAPACITY_DEMO_UNAVAILABILITY,
  ...['2024-04-22', '2024-04-23', '2024-04-24', '2024-04-25', '2024-04-26', '2024-04-27', '2024-04-28'].flatMap(date =>
    MOCK_RESOURCES.map(resource => ({
      resourceId: resource.id,
      start: new Date(`${date}T09:00:00`),
      end: new Date(`${date}T21:00:00`),
      reason: 'Demo capacity block',
      title: 'Demo capacity block',
      color: '#E0E0E0',
    }))
  ),
  ...MOCK_RESOURCES
    .filter(resource => resource.type === 'mechanic' || resource.type === 'bay' || resource.type === 'device')
    .map(resource => ({
      resourceId: resource.id,
      start: new Date('2024-04-30T10:00:00'),
      end: new Date('2024-04-30T21:00:00'),
      reason: 'Demo partial capacity block',
      title: 'Demo partial capacity block',
      color: '#E0E0E0',
    })),
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
