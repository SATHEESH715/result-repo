// Reads the latest TestRun event of every stripe from Application Insights and writes each one as
// <dir>/<folder>/summary.json, the same shape the report script already reads.
// Usage: node scripts/fetch-app-insights.mjs <dir>
// Needs APPINSIGHTS_APP_ID and APPINSIGHTS_TOKEN (a Microsoft Entra token for https://api.applicationinsights.io).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = process.argv[2] ?? 'ai-results';
const appId = process.env.APPINSIGHTS_APP_ID;
const token = process.env.APPINSIGHTS_TOKEN;
const api = (process.env.APPINSIGHTS_API ?? 'https://api.applicationinsights.io').replace(/\/+$/, '');
if (!appId || !token) throw new Error('APPINSIGHTS_APP_ID and APPINSIGHTS_TOKEN must be set');

const query = `customEvents
| where name == "TestRun" and timestamp > ago(30d)
| extend folder = tostring(customDimensions.folder)
| summarize arg_max(timestamp, customDimensions, customMeasurements) by folder
| project folder, timestamp,
    project = tostring(customDimensions.project),
    runUrl = tostring(customDimensions.runUrl),
    jobStatus = tostring(customDimensions.jobStatus),
    dotnetTotal = toint(customMeasurements.dotnetTotal), dotnetFailed = toint(customMeasurements.dotnetFailed),
    angularTotal = toint(customMeasurements.angularTotal), angularFailed = toint(customMeasurements.angularFailed),
    brunoTotal = toint(customMeasurements.brunoTotal), brunoFailed = toint(customMeasurements.brunoFailed),
    playwrightTotal = toint(customMeasurements.playwrightTotal), playwrightFailed = toint(customMeasurements.playwrightFailed)
| sort by folder asc`;

const response = await fetch(`${api}/v1/apps/${appId}/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
});
if (!response.ok) throw new Error(`Application Insights returned ${response.status}: ${await response.text()}`);

const table = (await response.json()).tables?.[0];
if (!table) throw new Error('Application Insights returned no table');
const columns = table.columns.map((c) => c.name);
const level = (row, name) => ({ total: row[`${name}Total`] ?? 0, failed: row[`${name}Failed`] ?? 0 });

for (const values of table.rows) {
  const row = Object.fromEntries(values.map((v, i) => [columns[i], v]));
  const summary = {
    project: row.project,
    folder: row.folder,
    runUrl: row.runUrl,
    runDate: row.timestamp,
    jobStatus: row.jobStatus,
    levels: { dotnet: level(row, 'dotnet'), angular: level(row, 'angular'), bruno: level(row, 'bruno'), playwright: level(row, 'playwright') },
  };
  mkdirSync(join(outDir, row.folder), { recursive: true });
  writeFileSync(join(outDir, row.folder, 'summary.json'), JSON.stringify(summary, null, 2));
}
console.log(`Wrote ${table.rows.length} stripe result(s) from Application Insights`);
