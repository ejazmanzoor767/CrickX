#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const workspaces = process.argv.slice(2).filter(Boolean);
if (workspaces.length === 0) {
  console.error('Usage: node scripts/production-audit.mjs <workspace> [workspace...]');
  process.exit(2);
}

const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const workspacePackages = lock.packages || {};

function resolveDependency(dep, parentKey) {
  let parent = parentKey;
  while (true) {
    const candidate = parent === ''
      ? `node_modules/${dep}`
      : `${parent}/node_modules/${dep}`;
    if (workspacePackages[candidate]) return candidate;

    const marker = parent.lastIndexOf('/node_modules/');
    if (marker < 0) break;
    parent = parent.slice(0, marker);
  }

  const rootCandidate = `node_modules/${dep}`;
  return workspacePackages[rootCandidate] ? rootCandidate : null;
}

function packageName(packageKey) {
  const pkg = workspacePackages[packageKey];
  if (pkg?.name) return pkg.name;
  return packageKey.split('/node_modules/').at(-1);
}

const productionPackages = new Set();
const visited = new Set();

function walk(packageKey) {
  if (!packageKey || visited.has(packageKey)) return;
  visited.add(packageKey);

  const pkg = workspacePackages[packageKey];
  if (!pkg) return;
  productionPackages.add(packageName(packageKey));

  for (const dep of Object.keys(pkg.dependencies || {})) {
    walk(resolveDependency(dep, packageKey));
  }
}

for (const workspace of workspaces) {
  if (!workspacePackages[workspace]) {
    console.error(`Workspace not found in package-lock.json: ${workspace}`);
    process.exit(2);
  }

  const pkg = workspacePackages[workspace];
  for (const dep of Object.keys(pkg.dependencies || {})) {
    walk(resolveDependency(dep, workspace));
  }
}

const audit = spawnSync(
  'npm',
  ['audit', '--omit=dev', '--json', '--audit-level=moderate'],
  { encoding: 'utf8' }
);

let report;
try {
  report = JSON.parse(audit.stdout || '{}');
} catch {
  console.error('npm audit did not return valid JSON.');
  if (audit.stdout) console.error(audit.stdout);
  if (audit.stderr) console.error(audit.stderr);
  process.exit(audit.status || 1);
}

const vulnerabilities = report.vulnerabilities || {};
const relevant = Object.entries(vulnerabilities).filter(([name]) =>
  productionPackages.has(name)
);

for (const [name, vulnerability] of Object.entries(vulnerabilities)) {
  const severity = vulnerability.severity || 'unknown';
  const via = Array.isArray(vulnerability.via)
    ? vulnerability.via
        .filter((item) => typeof item === 'object')
        .map((item) => item.url || item.title || item.source)
        .filter(Boolean)
    : [];

  if (!productionPackages.has(name)) {
    console.warn(
      `[audit] Ignored vulnerability outside API/web production closure: ${name} (${severity})${via.length ? ` - ${via.join(', ')}` : ''}`
    );
  }
}

if (relevant.length > 0) {
  console.error('');
  console.error('Production dependency vulnerabilities found in the audited workspace closure:');
  for (const [name, vulnerability] of relevant) {
    console.error(`- ${name}: ${vulnerability.severity || 'unknown'} severity`);
  }
  console.error('');
  process.exit(1);
}

console.log(
  `Production dependency audit passed for: ${workspaces.join(', ')}. Audited production packages: ${productionPackages.size}.`
);
