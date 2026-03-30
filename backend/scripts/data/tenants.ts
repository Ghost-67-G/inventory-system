export type SeedUserDefinition = {
  name: string;
  email: string;
  password: string;
  role: 'owner' | 'manager' | 'staff' | 'viewer';
};

export type SeedTenantCustomField = {
  name: string;
  type: 'text' | 'number' | 'boolean' | 'date';
  required: boolean;
};

export type SeedTenantDefinition = {
  tenant: {
    name: string;
    slug: string;
    settings: {
      currency: string;
      timezone: string;
      lowStockThreshold: number;
    };
    customFields: SeedTenantCustomField[];
    onboardingComplete: boolean;
  };
  users: SeedUserDefinition[];
};

export const TENANT_DEFINITIONS: SeedTenantDefinition[] = [
  {
    tenant: {
      name: 'Apex Electronics',
      slug: 'apex-electronics',
      settings: {
        currency: 'USD',
        timezone: 'America/New_York',
        lowStockThreshold: 10,
      },
      customFields: [
        { name: 'Supplier', type: 'text', required: false },
        { name: 'Warranty (months)', type: 'number', required: false },
        { name: 'Refurbished', type: 'boolean', required: false },
      ],
      onboardingComplete: true,
    },
    users: [
      {
        name: 'James Carter',
        email: 'owner@apex.dev',
        password: 'Password123',
        role: 'owner',
      },
      {
        name: 'Priya Sharma',
        email: 'manager@apex.dev',
        password: 'Password123',
        role: 'manager',
      },
      {
        name: 'Marcus Webb',
        email: 'staff@apex.dev',
        password: 'Password123',
        role: 'staff',
      },
      {
        name: 'Linda Osei',
        email: 'viewer@apex.dev',
        password: 'Password123',
        role: 'viewer',
      },
    ],
  },
  {
    tenant: {
      name: 'Crescent Wholesale',
      slug: 'crescent-wholesale',
      settings: {
        currency: 'GBP',
        timezone: 'Europe/London',
        lowStockThreshold: 5,
      },
      customFields: [
        { name: 'Batch number', type: 'text', required: false },
        { name: 'Expiry date', type: 'date', required: false },
      ],
      onboardingComplete: true,
    },
    users: [
      {
        name: 'Sophie Whitfield',
        email: 'owner@crescent.dev',
        password: 'Password123',
        role: 'owner',
      },
      {
        name: 'Daniel Nwosu',
        email: 'staff@crescent.dev',
        password: 'Password123',
        role: 'staff',
      },
    ],
  },
];
