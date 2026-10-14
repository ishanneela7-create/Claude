import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import type { AddressInfo } from 'node:net';
import { createApp } from '../server/app';
import { createContext, refreshStatistics } from '../server/db';
import { insertSyntheticParts } from '../server/syntheticParts';
import { STARTER_COLORS, seedColors } from '../server/services/colorSeed';

const count = Number(process.argv.find((arg) => /^\d+$/.test(arg)) ?? 50000);
const runs = 30;

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lego-perf-'));
const context = createContext(dataDir);
seedColors(context.db, STARTER_COLORS);

let started = performance.now();
insertSyntheticParts(context.db, count);
refreshStatistics(context.db);
console.log(
  `Inserted ${count.toLocaleString()} parts + search index in ${((performance.now() - started) / 1000).toFixed(1)}s`,
);
console.log(
  `Database size: ${(fs.statSync(path.join(dataDir, 'library.db')).size / 1e6).toFixed(1)} MB\n`,
);

const server = createApp(context).listen(0);
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;

interface Case {
  label: string;
  path: string;
}
const cases: Case[] = [
  { label: 'Search: brick (many matches)', path: '/parts?q=brick&limit=100' },
  { label: 'Search: brick 2 x 4', path: '/parts?q=brick%202%20x%204&limit=100' },
  { label: 'Search: design id 10050', path: '/parts?q=10050&limit=100' },
  { label: 'Search: word in notes (smooth note)', path: '/parts?q=smooth%20note&limit=100' },
  { label: 'Search: location (Drawer 3)', path: '/parts?q=Drawer%203&limit=100' },
  { label: 'Search: color:red cat:plates', path: '/parts?q=color:red%20cat:plates&limit=100' },
  { label: 'Search: qty:>150 custom:true', path: '/parts?q=qty:%3E150%20custom:true&limit=100' },
  {
    label: 'Search: loc:"Room 2 > Cabinet 3"',
    path: '/parts?q=loc:%22Room%202%20%3E%20Cabinet%203%22&limit=100',
  },
  { label: 'Search: typo "brik" (fuzzy fallback)', path: '/parts?q=brik&limit=100' },
  { label: 'List: first page, sort name', path: '/parts?limit=100' },
  { label: 'List: sort by color', path: '/parts?sort=color&limit=100' },
  { label: 'List: sort by location', path: '/parts?sort=location&limit=100' },
  { label: 'List: deep page (offset 40000)', path: '/parts?offset=40000&limit=100' },
  { label: 'List: grouped by category', path: '/parts?group=category&limit=100' },
  { label: 'Group counts by color', path: '/parts/groups?group=color' },
  { label: 'Smart view: low stock', path: '/parts?low_stock=true&limit=100' },
  { label: 'Filter by location subtree', path: '/parts?location_id=LOC&limit=100' },
  { label: 'Duplicate scan', path: '/parts/duplicates' },
];

const locationRow = context.db
  .prepare("SELECT id FROM locations WHERE path = 'Room 2 > Cabinet 3'")
  .get() as { id: string };

function percentile(sorted: number[], fraction: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0;
}

async function measure(url: string): Promise<number[]> {
  const times: number[] = [];
  for (let run = 0; run < runs; run++) {
    started = performance.now();
    const response = await fetch(url);
    await response.arrayBuffer();
    if (!response.ok) throw new Error(`${url} -> ${response.status}`);
    times.push(performance.now() - started);
  }
  return times.sort((a, b) => a - b);
}

console.log('| Test | median ms | p95 ms | worst ms | results |');
console.log('|---|---:|---:|---:|---:|');
let slowest = 0;
for (const item of cases) {
  const url = base + item.path.replace('LOC', locationRow.id);
  await fetch(url).then((r) => r.arrayBuffer());
  const times = await measure(url);
  const body = (await (await fetch(url)).json()) as { total?: number } | unknown[];
  const results = Array.isArray(body) ? body.length : (body.total ?? 0);
  const p95 = percentile(times, 0.95);
  if (item.label.startsWith('Search')) slowest = Math.max(slowest, p95);
  console.log(
    `| ${item.label} | ${percentile(times, 0.5).toFixed(1)} | ${p95.toFixed(1)} | ${(times.at(-1) ?? 0).toFixed(1)} | ${results.toLocaleString()} |`,
  );
}
console.log(
  `\nSlowest search p95: ${slowest.toFixed(1)} ms (target: under 100 ms). ${slowest < 100 ? 'PASS' : 'FAIL'}`,
);
server.close();
context.db.close();
fs.rmSync(dataDir, { recursive: true, force: true });
process.exitCode = slowest < 100 ? 0 : 1;
