export interface ResourceCatalogResource {
  id: string;
  name: string;
  code: string;
  description: string;
  status: 'Available' | 'Assigned' | 'Inactive';
}

export interface ResourceCatalogGroup {
  id: string;
  label: string;
  subtitle: string;
  description: string;
  resources: ResourceCatalogResource[];
}

export const RESOURCE_CATALOG_GROUPS: ResourceCatalogGroup[] = [
  {
    id: 'mechanics',
    label: 'Mechanics',
    subtitle: 'Technician Catalog',
    description: 'Workshop technicians and specialist mechanics',
    resources: [
      { id: 'mech-mark-owen', name: 'Mark Owen', code: 'MEC-001', description: 'General service, tyre, battery and diagnostics technician', status: 'Assigned' },
      { id: 'mech-phil-parker', name: 'Phil Parker', code: 'MEC-002', description: 'General service, brake and diagnostics technician', status: 'Assigned' },
      { id: 'mech-greg-jackson', name: 'Greg Jackson', code: 'MEC-003', description: 'MOT and emissions technician', status: 'Assigned' },
      { id: 'mech-jeff-goldberg', name: 'Jeff Goldberg', code: 'MEC-004', description: 'Brake, suspension and diagnostics technician', status: 'Assigned' },
      { id: 'mech-kelly-hanson', name: 'Kelly Hanson', code: 'MEC-005', description: 'General service, battery and diagnostics technician', status: 'Assigned' },
    ],
  },
  {
    id: 'service-advisors',
    label: 'Service Advisors',
    subtitle: 'Advisor Catalog',
    description: 'Customer-facing service advisors',
    resources: [
      { id: 'advisor-ted-phillips', name: 'Ted Phillips', code: 'ADV-001', description: 'Service advisor for wait-in-dealership appointments', status: 'Assigned' },
      { id: 'advisor-frank-miller', name: 'Frank Miller', code: 'ADV-002', description: 'Service advisor for drop-off and mobility appointments', status: 'Assigned' },
    ],
  },
  {
    id: 'bays',
    label: 'Bays',
    subtitle: 'Workshop Bay Catalog',
    description: 'Physical workshop bays and ramps',
    resources: [
      { id: 'bay-pc-1', name: 'PC Bay 1', code: 'BAY-PC-001', description: 'Personal car bay', status: 'Assigned' },
      { id: 'bay-pc-2', name: 'PC Bay 2', code: 'BAY-PC-002', description: 'Personal car bay', status: 'Assigned' },
      { id: 'bay-pc-3', name: 'PC Bay 3', code: 'BAY-PC-003', description: 'Personal car bay', status: 'Assigned' },
      { id: 'bay-lt-1', name: 'LT Bay 1', code: 'BAY-LT-001', description: 'Light truck bay', status: 'Available' },
      { id: 'bay-pc-alignment', name: 'PC Alignment', code: 'BAY-ALIGN', description: 'Personal car alignment bay', status: 'Available' },
    ],
  },
  {
    id: 'devices',
    label: 'Devices',
    subtitle: 'Equipment Catalog',
    description: 'Workshop tools and diagnostic equipment',
    resources: [
      { id: 'device-bea-950', name: 'BEA 950 Emission Tester', code: 'DEV-BEA-950', description: 'Emission tester required for emission test workflows', status: 'Assigned' },
      { id: 'device-eps-708', name: 'EPS 708 Diesel Tester', code: 'DEV-EPS-708', description: 'Diesel diagnostics and control unit tester', status: 'Assigned' },
    ],
  },
  {
    id: 'courtesy-cars',
    label: 'Courtesy Cars',
    subtitle: 'Mobility Catalog',
    description: 'Replacement and courtesy vehicles',
    resources: [
      { id: 'car-audi-a4-kl657og', name: 'Audi A4 KL 657 OG', code: 'CAR-A4-657', description: 'Courtesy car', status: 'Assigned' },
      { id: 'car-audi-a3-kl643ju', name: 'Audi A3 KL 643 JU', code: 'CAR-A3-643', description: 'Courtesy car', status: 'Available' },
    ],
  },
  {
    id: 'service-centre-klagenfurt-mechanics',
    label: 'Mechanics',
    subtitle: 'Klagenfurt Technician Catalog',
    description: 'Technicians assigned to Service Centre Klagenfurt',
    resources: [
      { id: 'klg-mech-frank', name: 'Frank', code: 'KLG-MEC-001', description: 'General service, diagnostics, tyre and brake technician', status: 'Assigned' },
      { id: 'klg-mech-mike', name: 'Mike', code: 'KLG-MEC-002', description: 'General service, battery and diagnostics technician', status: 'Assigned' },
      { id: 'klg-mech-john', name: 'John', code: 'KLG-MEC-003', description: 'MOT and emissions technician', status: 'Assigned' },
      { id: 'klg-mech-peter', name: 'Peter', code: 'KLG-MEC-004', description: 'General service, brake and tyre technician', status: 'Assigned' },
    ],
  },
  {
    id: 'service-centre-klagenfurt-service-advisors',
    label: 'Service Advisors',
    subtitle: 'Klagenfurt Advisor Catalog',
    description: 'Customer-facing advisors assigned to Service Centre Klagenfurt',
    resources: [
      { id: 'klg-advisor-jeff', name: 'Jeff', code: 'KLG-ADV-001', description: 'Service advisor for Klagenfurt appointments', status: 'Assigned' },
      { id: 'klg-advisor-tom', name: 'Tom', code: 'KLG-ADV-002', description: 'Service advisor for Klagenfurt handovers', status: 'Assigned' },
    ],
  },
  {
    id: 'service-centre-klagenfurt-courtesy-cars',
    label: 'Courtesy Cars',
    subtitle: 'Klagenfurt Mobility Catalog',
    description: 'Courtesy vehicles assigned to Service Centre Klagenfurt',
    resources: [
      { id: 'klg-car-audi-a4-k657pj', name: 'Audi A4 - K 657 PJ', code: 'KLG-CAR-A4-657', description: 'Courtesy car', status: 'Assigned' },
      { id: 'klg-car-audi-a3-k336uh', name: 'Audi A3 - K 336 UH', code: 'KLG-CAR-A3-336', description: 'Courtesy car', status: 'Available' },
    ],
  },
  {
    id: 'service-center-vienna-technicians',
    label: 'Technicians',
    subtitle: 'Vienna Technician Catalog',
    description: 'Technicians assigned to Service Center Vienna with qualification tags',
    resources: [
      { id: 'vie-tech-mark-owen', name: 'Mark Owen', code: 'VIE-TEC-001', description: 'Mechanic', status: 'Assigned' },
      { id: 'vie-tech-phil-parker', name: 'Phil Parker', code: 'VIE-TEC-002', description: 'Mechanic', status: 'Assigned' },
      { id: 'vie-tech-greg-jackson', name: 'Greg Jackson', code: 'VIE-TEC-003', description: 'Mechanic', status: 'Assigned' },
      { id: 'vie-tech-jeff-goldberg', name: 'Jeff Goldberg', code: 'VIE-TEC-004', description: 'Mechanic', status: 'Assigned' },
      { id: 'vie-tech-kelly-hanson', name: 'Kelly Hanson', code: 'VIE-TEC-005', description: 'Mechanic, Electrician', status: 'Assigned' },
      { id: 'vie-tech-brenda-miller', name: 'Brenda Miller', code: 'VIE-TEC-006', description: 'Mechanic', status: 'Assigned' },
      { id: 'vie-tech-mark-peterson', name: 'Mark Peterson', code: 'VIE-TEC-007', description: 'Mechanic', status: 'Assigned' },
      { id: 'vie-tech-lisa-smith', name: 'Lisa Smith', code: 'VIE-TEC-008', description: 'Mechanic, Electrician', status: 'Assigned' },
      { id: 'vie-tech-samuel-frazor', name: 'Samuel Frazor', code: 'VIE-TEC-009', description: 'Mechanic', status: 'Assigned' },
    ],
  },
  {
    id: 'service-center-vienna-painter',
    label: 'Painter',
    subtitle: 'Vienna Paint Catalog',
    description: 'Paint specialists assigned to Service Center Vienna',
    resources: [
      { id: 'vie-painter-jeff-meyer', name: 'Jeff Meyer', code: 'VIE-PNT-001', description: 'Painter', status: 'Assigned' },
      { id: 'vie-painter-claus-ford', name: 'Claus Ford', code: 'VIE-PNT-002', description: 'Painter', status: 'Assigned' },
    ],
  },
  {
    id: 'service-center-vienna-service-advisors',
    label: 'Service Advisors',
    subtitle: 'Vienna Advisor Catalog',
    description: 'Customer-facing advisors assigned to Service Center Vienna',
    resources: [
      { id: 'vie-advisor-frank-reynold', name: 'Frank Reynold', code: 'VIE-ADV-001', description: 'Service advisor', status: 'Assigned' },
      { id: 'vie-advisor-tom-hunter', name: 'Tom Hunter', code: 'VIE-ADV-002', description: 'Service advisor', status: 'Assigned' },
      { id: 'vie-advisor-phil-wilson', name: 'Phil Wilson', code: 'VIE-ADV-003', description: 'Service advisor', status: 'Assigned' },
      { id: 'vie-advisor-brandon-richards', name: 'Brandon Richards', code: 'VIE-ADV-004', description: 'Service advisor', status: 'Assigned' },
    ],
  },
  {
    id: 'service-center-vienna-bays',
    label: 'Bays',
    subtitle: 'Vienna Bay Catalog',
    description: 'Workshop bays assigned to Service Center Vienna',
    resources: [
      { id: 'vie-bay-pc-1', name: 'PC Bay 1', code: 'VIE-BAY-PC-001', description: 'PC Bay', status: 'Assigned' },
      { id: 'vie-bay-pc-2', name: 'PC Bay 2', code: 'VIE-BAY-PC-002', description: 'PC Bay', status: 'Assigned' },
      { id: 'vie-bay-pc-3', name: 'PC Bay 3', code: 'VIE-BAY-PC-003', description: 'PC Bay', status: 'Assigned' },
      { id: 'vie-bay-pc-4', name: 'PC Bay 4', code: 'VIE-BAY-PC-004', description: 'PC Bay', status: 'Assigned' },
      { id: 'vie-bay-pc-5', name: 'PC Bay 5', code: 'VIE-BAY-PC-005', description: 'PC Bay', status: 'Assigned' },
      { id: 'vie-bay-pc-6', name: 'PC Bay 6', code: 'VIE-BAY-PC-006', description: 'PC Bay', status: 'Assigned' },
      { id: 'vie-bay-pc-alignment-1', name: 'PC Alignment Bay 1', code: 'VIE-BAY-ALIGN-001', description: 'PC Alignm. Bay', status: 'Assigned' },
      { id: 'vie-bay-lt-1', name: 'LT Bay 1', code: 'VIE-BAY-LT-001', description: 'LT Bay', status: 'Assigned' },
    ],
  },
  {
    id: 'service-center-vienna-devices',
    label: 'Devices',
    subtitle: 'Vienna Equipment Catalog',
    description: 'Workshop devices assigned to Service Center Vienna',
    resources: [
      { id: 'vie-device-bea-950-1', name: 'BEA 950 Emission Tester 1', code: 'VIE-DEV-BEA-001', description: 'Emission Tester', status: 'Assigned' },
      { id: 'vie-device-eps-708', name: 'EPS 708 Diesel Tester', code: 'VIE-DEV-EPS-001', description: 'Diesel tester', status: 'Assigned' },
    ],
  },
  {
    id: 'service-center-vienna-courtesy-cars',
    label: 'Courtesy Cars',
    subtitle: 'Vienna Mobility Catalog',
    description: 'Courtesy vehicles assigned to Service Center Vienna',
    resources: [
      { id: 'vie-car-audi-a4-w54223x', name: 'Audi A4 - W 54223 X', code: 'VIE-CAR-001', description: 'Courtesy Car', status: 'Assigned' },
      { id: 'vie-car-audi-a4-w54224r', name: 'Audi A4 - W 54224 R', code: 'VIE-CAR-002', description: 'Courtesy Car', status: 'Assigned' },
      { id: 'vie-car-audi-a4-w12781a', name: 'Audi A4 - W 12781 A', code: 'VIE-CAR-003', description: 'Courtesy Car', status: 'Assigned' },
      { id: 'vie-car-audi-a4-w85322x', name: 'Audi A4 - W 85322 X', code: 'VIE-CAR-004', description: 'Courtesy Car', status: 'Assigned' },
      { id: 'vie-car-audi-a5-w11092r', name: 'Audi A5 - W 11092 R', code: 'VIE-CAR-005', description: 'Courtesy Car', status: 'Assigned' },
      { id: 'vie-car-bmw-x3-w32464u', name: 'BMW X3 - W 32464 U', code: 'VIE-CAR-006', description: 'Courtesy Car', status: 'Assigned' },
      { id: 'vie-car-bmw-x3-w32422t', name: 'BMW X3 - W 32422 T', code: 'VIE-CAR-007', description: 'Courtesy Car', status: 'Assigned' },
    ],
  },];

export function getResourceCatalogGroup(groupId: string | null | undefined): ResourceCatalogGroup | undefined {
  return RESOURCE_CATALOG_GROUPS.find(group => group.id === groupId);
}
