import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const USERNAME = process.env.GITHUB_USERNAME || 'techcodeco';
const TOKEN = process.env.GITHUB_TOKEN;
const OUTPUT = resolve(process.cwd(), 'assets/language-stats.svg');
const API = 'https://api.github.com';
const MAX_RETRIES = 4;
const CONCURRENCY = 6;

const LANGUAGE_COLORS = {
  TypeScript: '#3178C6',
  JavaScript: '#F1E05A',
  HTML: '#E34C26',
  CSS: '#563D7C',
  Shell: '#89E051',
  Python: '#3572A5',
  Java: '#B07219',
  Go: '#00ADD8',
  Rust: '#DEA584',
  PHP: '#4F5D95',
  Ruby: '#701516',
  C: '#555555',
  'C++': '#F34B7D',
  'C#': '#178600',
  Vue: '#41B883',
  Svelte: '#FF3E00',
  Kotlin: '#A97BFF',
  Dart: '#00B4AB',
  Swift: '#F05138',
  Lua: '#000080',
  Dockerfile: '#384D54',
  Makefile: '#427819',
  HCL: '#844FBA',
  Nix: '#7E7EFF',
};

const FALLBACK_COLORS = [
  '#8B5CF6', '#60A5FA', '#22D3EE', '#A78BFA', '#F472B6',
  '#34D399', '#FBBF24', '#FB7185', '#818CF8', '#2DD4BF',
];

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function fetchJson(url) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'techcodeco-profile-language-stats',
  };

  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    let response;
    try {
      response = await fetch(url, { headers });
    } catch (error) {
      if (attempt === MAX_RETRIES - 1) {
        throw new Error(`Network request failed for ${url}: ${error.message}`);
      }
      await sleep(500 * (2 ** attempt));
      continue;
    }

    if (response.ok) return response.json();

    const body = await response.text();
    const retryable = response.status === 429
      || response.status >= 500
      || (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0');

    if (!retryable || attempt === MAX_RETRIES - 1) {
      throw new Error(`GitHub API returned ${response.status} for ${url}: ${body.slice(0, 500)}`);
    }

    const retryAfter = Number(response.headers.get('retry-after'));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : 1000 * (2 ** attempt);
    await sleep(waitMs);
  }

  throw new Error(`Request failed after ${MAX_RETRIES} attempts: ${url}`);
}

async function getOwnedPublicRepositories() {
  const repositories = [];

  for (let page = 1; ; page += 1) {
    const url = new URL(`${API}/users/${encodeURIComponent(USERNAME)}/repos`);
    url.searchParams.set('type', 'owner');
    url.searchParams.set('per_page', '100');
    url.searchParams.set('page', String(page));
    url.searchParams.set('sort', 'updated');

    const batch = await fetchJson(url);
    if (!Array.isArray(batch)) {
      throw new TypeError('Unexpected GitHub API response while listing repositories.');
    }

    repositories.push(...batch);
    if (batch.length < 100) break;
  }

  // Forks are excluded so the chart reflects repositories owned and developed by this account.
  return repositories.filter((repo) => !repo.fork && !repo.disabled);
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (true) {
        const index = nextIndex;
        nextIndex += 1;
        if (index >= items.length) return;
        results[index] = await mapper(items[index]);
      }
    },
  );

  await Promise.all(workers);
  return results;
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function colorForLanguage(name, index) {
  if (LANGUAGE_COLORS[name]) return LANGUAGE_COLORS[name];
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return FALLBACK_COLORS[(hash + index) % FALLBACK_COLORS.length];
}

function buildSvg(entries, repositoryCount, generatedAt) {
  const width = 1000;
  const top = 184;
  const rowHeight = 39;
  const visibleEntries = entries.slice(0, 10);
  const height = Math.max(315, top + visibleEntries.length * rowHeight + 46);
  const totalBytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);
  const barX = 42;
  const barY = 132;
  const barWidth = 916;
  const barHeight = 14;

  let stackedBar = '';
  let offset = 0;
  entries.forEach((entry, index) => {
    const segmentWidth = totalBytes > 0 ? (entry.bytes / totalBytes) * barWidth : 0;
    if (segmentWidth > 0.4) {
      stackedBar += `<rect x="${(barX + offset).toFixed(2)}" y="${barY}" width="${segmentWidth.toFixed(2)}" height="${barHeight}" fill="${colorForLanguage(entry.name, index)}" />`;
    }
    offset += segmentWidth;
  });

  const rows = visibleEntries.map((entry, index) => {
    const y = top + index * rowHeight;
    const percent = totalBytes > 0 ? (entry.bytes / totalBytes) * 100 : 0;
    const barMaxWidth = 420;
    const progressWidth = Math.max(2, (percent / 100) * barMaxWidth);
    const color = colorForLanguage(entry.name, index);

    return `
      <g>
        <circle cx="52" cy="${y + 9}" r="5.5" fill="${color}" />
        <text x="70" y="${y + 14}" class="language">${escapeXml(entry.name)}</text>
        <rect x="270" y="${y + 3}" width="${barMaxWidth}" height="10" rx="5" fill="#202A42" />
        <rect x="270" y="${y + 3}" width="${progressWidth.toFixed(2)}" height="10" rx="5" fill="${color}" />
        <text x="720" y="${y + 14}" class="percent">${percent.toFixed(1)}%</text>
        <text x="950" y="${y + 14}" text-anchor="end" class="bytes">${formatBytes(entry.bytes)}</text>
      </g>`;
  }).join('\n');

  const emptyState = `
    <text x="500" y="220" text-anchor="middle" class="empty">No language data was found in the public repositories yet.</text>
    <text x="500" y="248" text-anchor="middle" class="muted">The chart will populate automatically when repository code is available.</text>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">GitHub language statistics for ${escapeXml(USERNAME)}</title>
  <desc id="desc">Programming language distribution across ${repositoryCount} public non-fork repositories.</desc>
  <defs>
    <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0B1020" />
      <stop offset="55%" stop-color="#111A32" />
      <stop offset="100%" stop-color="#21153F" />
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#7C3AED" />
      <stop offset="100%" stop-color="#38BDF8" />
    </linearGradient>
    <style>
      text { font-family: Inter, Segoe UI, Arial, sans-serif; }
      .eyebrow { fill: #A78BFA; font-size: 12px; font-weight: 700; letter-spacing: 2px; }
      .heading { fill: #F8FAFC; font-size: 25px; font-weight: 700; }
      .muted { fill: #94A3B8; font-size: 12px; }
      .metric { fill: #E2E8F0; font-size: 13px; font-weight: 600; }
      .language { fill: #E2E8F0; font-size: 14px; font-weight: 600; }
      .percent { fill: #C4B5FD; font-size: 13px; font-weight: 700; }
      .bytes { fill: #94A3B8; font-size: 12px; }
      .empty { fill: #E2E8F0; font-size: 15px; font-weight: 600; }
    </style>
  </defs>
  <rect x="1" y="1" width="998" height="${height - 2}" rx="18" fill="url(#background)" stroke="#34305B" stroke-width="1.5" />
  <rect x="28" y="27" width="4" height="58" rx="2" fill="url(#accent)" />
  <text x="48" y="39" class="eyebrow">TECHCODE  /  GITHUB INSIGHTS</text>
  <text x="48" y="73" class="heading">Language Distribution</text>
  <text x="955" y="43" text-anchor="end" class="metric">${repositoryCount} PUBLIC REPOSITORIES</text>
  <text x="955" y="66" text-anchor="end" class="muted">${entries.length} languages detected</text>
  <rect x="${barX}" y="${barY}" width="${barWidth}" height="${barHeight}" rx="7" fill="#202A42" />
  <clipPath id="barClip"><rect x="${barX}" y="${barY}" width="${barWidth}" height="${barHeight}" rx="7" /></clipPath>
  <g clip-path="url(#barClip)">${stackedBar}</g>
  ${visibleEntries.length ? rows : emptyState}
  <line x1="42" y1="${height - 34}" x2="958" y2="${height - 34}" stroke="#343D59" />
  <text x="42" y="${height - 15}" class="muted">Updated ${escapeXml(generatedAt)} · Generated automatically with GitHub Actions</text>
  <text x="958" y="${height - 15}" text-anchor="end" class="muted">CODE • BUILD • LEVEL UP</text>
</svg>
`;
}

async function main() {
  if (!/^[a-zA-Z0-9-]{1,39}$/.test(USERNAME)) {
    throw new Error(`Invalid GitHub username: ${USERNAME}`);
  }

  console.log(`Collecting public repositories for @${USERNAME}...`);
  const repositories = await getOwnedPublicRepositories();
  console.log(`Found ${repositories.length} public, non-fork repositories.`);

  const languageMaps = await mapWithConcurrency(repositories, CONCURRENCY, async (repo) => {
    const url = `${API}/repos/${encodeURIComponent(USERNAME)}/${encodeURIComponent(repo.name)}/languages`;
    return fetchJson(url);
  });

  const totals = new Map();
  for (const languageMap of languageMaps) {
    for (const [language, bytes] of Object.entries(languageMap ?? {})) {
      totals.set(language, (totals.get(language) ?? 0) + Number(bytes));
    }
  }

  const entries = [...totals.entries()]
    .map(([name, bytes]) => ({ name, bytes }))
    .filter((entry) => Number.isFinite(entry.bytes) && entry.bytes > 0)
    .sort((a, b) => b.bytes - a.bytes);

  const generatedAt = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date());

  const svg = buildSvg(entries, repositories.length, generatedAt);
  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, svg, 'utf8');

  console.log(`Wrote ${OUTPUT}`);
  console.log('Language totals:', Object.fromEntries(entries));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
