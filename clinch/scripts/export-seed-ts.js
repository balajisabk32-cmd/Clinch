const rs = require('../src/services/reportingService');
const fs = require('fs');
const path = require('path');

const dash = rs.getDashboard();
const deals = rs.enrichedDeals();

const outPath = path.resolve(__dirname, '../../frontend/src/lib/dealHealthSeed.ts');

const content = `// Pre-seeded Deal Health & Portfolio Dataset from Clinch
import type { DealHealthDashboardData, EnrichedDeal } from './api'

export const SEED_DASHBOARD_DATA: DealHealthDashboardData = ${JSON.stringify(dash, null, 2)}

export const SEED_ENRICHED_DEALS: EnrichedDeal[] = ${JSON.stringify(deals, null, 2)}
`

fs.writeFileSync(outPath, content, 'utf8');
console.log('Successfully generated dealHealthSeed.ts with', deals.length, 'enriched deals.');
