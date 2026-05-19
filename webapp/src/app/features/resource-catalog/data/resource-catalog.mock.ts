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
];

export function getResourceCatalogGroup(groupId: string | null | undefined): ResourceCatalogGroup | undefined {
  return RESOURCE_CATALOG_GROUPS.find(group => group.id === groupId);
}
