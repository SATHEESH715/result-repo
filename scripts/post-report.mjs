// Reads <dir>/<folder>/summary.json for every project in projects.json and posts ONE results table to Teams.
// Usage: node scripts/post-report.mjs <dir>        (set DRY_RUN=1 to print the card instead of posting it)
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] ?? '.';
const projects = JSON.parse(readFileSync(new URL('../projects.json', import.meta.url), 'utf8'));
const sourceLabel = process.env.SOURCE_LABEL ?? 'result files';
const staleHours = Number(process.env.STALE_HOURS ?? 72);
const levels = ['dotnet', 'angular', 'bruno', 'playwright'];

const column = (width, text, color = 'Default', weight = 'Default') => ({
  type: 'Column',
  width,
  verticalContentAlignment: 'Center',
  items: [{
    type: 'TextBlock',
    text: String(text),
    wrap: true,
    color,
    weight,
    horizontalAlignment: width === 2 ? 'Center' : 'Left', // number and status columns are centred
  }],
});

const row = (columns) => ({ type: 'ColumnSet', separator: true, columns });

function levelColumn(level) {
  if (!level || level.total === 0) return column(2, 'none', 'Attention');
  if (level.failed > 0) return column(2, `${level.total - level.failed}/${level.total}`, 'Attention');
  return column(2, `${level.total}/${level.total}`, 'Good');
}

function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unknown';
  const month = d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
  const time = d.toISOString().slice(11, 16);
  return `${d.getUTCDate()} ${month} ${d.getUTCFullYear()} ${time} GMT`;
}

function readSummary(folder) {
  const file = join(dir, folder, 'summary.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}

function projectStatus(summary) {
  if (!summary) return 'no results';
  const failed = levels.reduce((n, l) => n + (summary.levels?.[l]?.failed ?? 0), 0);
  if (failed > 0) return 'error';
  if (levels.some((l) => (summary.levels?.[l]?.total ?? 0) === 0)) return 'no results';
  if (summary.jobStatus !== 'success') return 'error';
  const ageHours = (Date.now() - new Date(summary.runDate).getTime()) / 3600000;
  return ageHours > staleHours ? 'stale' : 'success';
}

const header = row([
  column(3, 'Name', 'Default', 'Bolder'),
  column(2, 'API (.NET)', 'Default', 'Bolder'),
  column(2, 'Angular', 'Default', 'Bolder'),
  column(2, 'Bruno', 'Default', 'Bolder'),
  column(2, 'Playwright', 'Default', 'Bolder'),
  column(3, 'Last run', 'Default', 'Bolder'),
  column(2, 'Status', 'Default', 'Bolder'),
  column(2, 'Total Tests', 'Default', 'Bolder'),
  column(2, 'Failed Tests', 'Default', 'Bolder'),
]);

let anyBad = false;
const rows = projects.map(({ folder, name }) => {
  const summary = readSummary(folder);
  const status = projectStatus(summary);
  if (status !== 'success') anyBad = true;
  const total = levels.reduce((n, l) => n + (summary?.levels?.[l]?.total ?? 0), 0);
  const failed = levels.reduce((n, l) => n + (summary?.levels?.[l]?.failed ?? 0), 0);
  const label = summary?.runUrl ? `[${name}](${summary.runUrl})` : name; // the name links to the run
  return row([
    column(3, label),
    ...levels.map((l) => levelColumn(summary?.levels?.[l])),
    column(3, summary ? formatDate(summary.runDate) : 'never'),
    column(2, status, status === 'success' ? 'Good' : 'Attention'),
    column(2, total),
    column(2, failed),
  ]);
});

const card = {
  type: 'message',
  attachments: [{
    contentType: 'application/vnd.microsoft.card.adaptive',
    content: {
      type: 'AdaptiveCard',
      version: '1.4',
      msteams: { width: 'Full' },
      body: [
        { type: 'TextBlock', size: 'Large', weight: 'Bolder', wrap: true, text: `Test Results ${new Date().toDateString()}` },
        { type: 'TextBlock', wrap: true, text: `Source: ${sourceLabel}. Test columns show passed/total. Click a name for its run.` },
        header,
        ...rows,
        {
          type: 'TextBlock', wrap: true, separator: true, weight: 'Bolder',
          color: anyBad ? 'Attention' : 'Good',
          text: anyBad
            ? 'Some tests failed or did not run! If this is a project you work on, please investigate and correct the failing tests.'
            : 'All tests passed.',
        },
      ],
    },
  }],
};

if (process.env.DRY_RUN === '1') {
  console.log(JSON.stringify(card, null, 2));
} else {
  const url = process.env.TEAMS_WORKFLOW_URL;
  if (!url) throw new Error('TEAMS_WORKFLOW_URL is not set');
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(card) });
  if (!response.ok) throw new Error(`Teams returned ${response.status}`);
  console.log('Report posted to Teams');
}
