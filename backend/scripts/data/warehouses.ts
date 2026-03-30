export const WAREHOUSE_DEFINITIONS = [
  {
    name: 'Main Warehouse',
    code: 'WH-001',
    description: 'Primary storage and dispatch hub',
    isDefault: true,
    address: {
      street: '14 Industrial Park Road',
      city: 'Newark',
      state: 'NJ',
      country: 'US',
      postalCode: '07101',
    },
  },
  {
    name: 'East Storage',
    code: 'WH-002',
    description: 'Secondary overflow storage',
    isDefault: false,
    address: {
      street: '8 Commerce Drive',
      city: 'Brooklyn',
      state: 'NY',
      country: 'US',
      postalCode: '11201',
    },
  },
  {
    name: 'Returns & Repairs',
    code: 'WH-003',
    description: 'Holds returned and refurbished stock',
    isDefault: false,
    address: {
      street: '22 Logistics Way',
      city: 'Elizabeth',
      state: 'NJ',
      country: 'US',
      postalCode: '07206',
    },
  },
] as const;
