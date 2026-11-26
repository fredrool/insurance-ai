/**
 * Submit five sample claims to POST /monitoring/claims (Nest must be running).
 *
 *   node --env-file=.env scripts/run-monitoring-examples.mjs
 *
 * Optional: MONITORING_BASE_URL=http://localhost:3000
 */
const baseUrl = process.env.MONITORING_BASE_URL ?? 'http://localhost:3000';

const examples = [
  {
    label: '1 — Normal claim',
    body: {
      claimId: 'CLM-NORMAL',
      policyId: 'POL-001',
      amount: 25_000,
      currency: 'CAD',
      incidentDate: '2026-11-01',
      submittedAt: '2026-11-10',
      description: 'Minor water damage from a burst pipe',
    },
  },
  {
    label: '2 — High amount',
    body: {
      claimId: 'CLM-HIGH',
      policyId: 'POL-001',
      amount: 150_000,
      currency: 'CAD',
      incidentDate: '2026-11-01',
      submittedAt: '2026-11-15',
      description: 'Major water damage caused by a burst pipe',
    },
  },
  {
    label: '3 — Late submission',
    body: {
      claimId: 'CLM-LATE',
      policyId: 'POL-001',
      amount: 12_000,
      currency: 'CAD',
      incidentDate: '2026-09-01',
      submittedAt: '2026-11-15',
      description: 'Theft of bicycles from garage',
    },
  },
  {
    label: '4 — Missing policyId',
    body: {
      claimId: 'CLM-NOPOL',
      amount: 8_000,
      currency: 'CAD',
      incidentDate: '2026-10-20',
      submittedAt: '2026-11-01',
      description: 'Storm damage to roof shingles',
    },
  },
  {
    label: '5 — Contradictory information',
    body: {
      claimId: 'CLM-CONTRA',
      policyId: 'POL-002',
      amount: 5_000,
      currency: 'CAD',
      incidentDate: '2026-11-10',
      submittedAt: '2026-11-12',
      description:
        'Auto collision on 2026-08-01 (stated in narrative) but incidentDate is 2026-11-10; also claims amount is 5000 CAD while text says total repair estimate is 25000 CAD.',
    },
  },
];

for (const example of examples) {
  console.log(`\n=== ${example.label} ===\n`);
  const response = await fetch(`${baseUrl}/monitoring/claims`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(example.body),
  });

  const text = await response.text();
  if (!response.ok) {
    console.error(`HTTP ${response.status}: ${text}`);
    continue;
  }
  console.log(JSON.stringify(JSON.parse(text), null, 2));
}