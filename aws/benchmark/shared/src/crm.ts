/** Fictional CRM data — kept in sync with `mcp/crm/crm.data.ts`. */

export interface CrmCustomer {
  id: string;
  displayName: string;
  email: string;
  policyIds: string[];
}

const CRM_CUSTOMERS: CrmCustomer[] = [
  {
    id: 'CUS-1001',
    displayName: 'Alex Martin',
    email: 'alex.martin@example.abc-assurances.ca',
    policyIds: ['POL-001'],
  },
  {
    id: 'CUS-1002',
    displayName: 'Jordan Lee',
    email: 'jordan.lee@example.abc-assurances.ca',
    policyIds: ['POL-002'],
  },
];

export function getCustomerDetails(customerId: string): CrmCustomer | null {
  return CRM_CUSTOMERS.find((customer) => customer.id === customerId) ?? null;
}

export function getCustomerByPolicy(policyId: string): CrmCustomer | null {
  return (
    CRM_CUSTOMERS.find((customer) => customer.policyIds.includes(policyId)) ??
    null
  );
}