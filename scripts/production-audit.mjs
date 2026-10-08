#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const workspaces = process.argv.slice(2).filter(Boolean);
if (workspaces.length === 0) {
  console.error('Usage: node scripts/production-audit.mjs <workspace> [workspace...]');
  process.exit(2);
}

let failed = false;

for (const workspace of workspaces) {
  const result = spawnSync(
    'npm',
    ['audit', '--workspace', workspace, '--omit=dev', '--audit-level=moderate', '--json'],
    { encoding: 'utf8' },
  );

  let report;
  try {
    report = JSON.parse(result.stdout || '{}');
  } catch {
    console.error(`[audit] npm audit returned invalid JSON for ${workspace}.`);
    if (result.stderr) console.error(result.stderr);
    failed = true;
    continue;
  }

  const vulnerabilities = report.vulnerabilities || {};
  const relevant = Object.entries(vulnerabilities).filter(([, vulnerability]) =>
    ['moderate', 'high', 'critical'].includes(String(vulnerability?.severity || '').toLowerCase()),
  );

  if (relevant.length > 0) {
    failed = true;
    console.error(`Production dependency vulnerabilities found in ${workspace}:`);
    for (const [name, vulnerability] of relevant) {
      console.error(`- ${name}: ${vulnerability.severity || 'unknown'} severity`);
      const via = Array.isArray(vulnerability.via)
        ? vulnerability.via
            .filter((item) => typeof item === 'object')
            .map((item) => item.url || item.title || item.source)
            .filter(Boolean)
        : [];
      if (via.length) console.error(`  ${via.join(', ')}`);
    }
  } else {
    console.log(`[audit] ${workspace}: no moderate-or-higher production vulnerabilities reported.`);
  }
}

if (failed) process.exit(1);
console.log('Production dependency audit passed.');
