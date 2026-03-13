#!/usr/bin/env node
/**
 * PreToolUse Hook: Format staged Go and Proto files before commit
 *
 * Triggers on: git commit, gt create, gt modify, gt amend
 *
 * For staged .go files: runs goimports → gci → golines/gofumpt
 * For staged .proto files: runs clang-format -style=Google
 * Skips generated files. Re-stages formatted files.
 *
 * Fails silently if tools are missing.
 */

'use strict';

const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const MAX_STDIN = 1024 * 1024;
const TOOL_TIMEOUT = 15000;

// Commands that trigger formatting
const COMMIT_PATTERNS = [
  /\bgit\s+commit\b/,
  /\bgt\s+create\b/,
  /\bgt\s+modify\b/,
  /\bgt\s+amend\b/,
];

function isCommitCommand(cmd) {
  return COMMIT_PATTERNS.some(p => p.test(cmd));
}

function isGeneratedFile(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.endsWith('.pb.go')) return true;
  if (normalized.endsWith('_grpc.pb.go')) return true;
  if (normalized.endsWith('.pb.gw.go')) return true;
  if (normalized.endsWith('/generated.go')) return true;
  if (normalized.endsWith('/models_gen.go')) return true;
  if (/\/ent\//.test(normalized) && !/(\/ent\/schema\/|\/db\/schema\/)/.test(normalized)) return true;
  return false;
}

function commandExists(cmd) {
  const result = spawnSync('which', [cmd], { stdio: 'pipe', timeout: 3000 });
  return result.status === 0;
}

function findGoRoot(dir) {
  let current = dir;
  while (true) {
    if (fs.existsSync(path.join(current, 'go.mod'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function getGciSections(projectRoot) {
  const defaults = ['--section', 'standard', '--section', 'default', '--section', 'localmodule'];
  if (!projectRoot) return defaults;

  const candidates = ['.golangci.yml', '.golangci.yaml'];
  for (const name of candidates) {
    const configPath = path.join(projectRoot, name);
    try {
      const content = fs.readFileSync(configPath, 'utf8');
      const sections = [];
      let inGci = false;
      let inSections = false;
      for (const line of content.split('\n')) {
        const trimmed = line.trimStart();
        if (/^gci:/.test(trimmed)) { inGci = true; inSections = false; continue; }
        if (inGci && /^sections:/.test(trimmed)) { inSections = true; continue; }
        if (inSections) {
          const match = trimmed.match(/^-\s*(.+)/);
          if (match) {
            sections.push('--section', match[1].trim());
          } else if (!trimmed.startsWith('#') && trimmed.length > 0 && !trimmed.startsWith('-')) {
            break;
          }
        }
        if (inGci && !inSections && trimmed.length > 0 && !trimmed.startsWith(' ') && !trimmed.startsWith('#') && !trimmed.startsWith('-') && !/^gci:/.test(trimmed)) {
          inGci = false;
        }
      }
      if (sections.length > 0) return sections;
    } catch { /* */ }
  }
  return defaults;
}

function getStagedFiles() {
  try {
    const result = spawnSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACM'], {
      stdio: 'pipe',
      encoding: 'utf8',
      timeout: 5000,
    });
    if (result.status !== 0) return [];
    return result.stdout.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function formatGoFile(filePath) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) return;

  const projectRoot = findGoRoot(path.dirname(resolved));
  const execOpts = {
    cwd: projectRoot || path.dirname(resolved),
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: TOOL_TIMEOUT,
  };

  if (commandExists('goimports')) {
    try { execFileSync('goimports', ['-w', resolved], execOpts); } catch (e) { console.error(`[Hook] Format failed for ${resolved}: ${e.message}`); }
  }
  if (commandExists('gci')) {
    try {
      const sections = getGciSections(projectRoot);
      execFileSync('gci', ['write', ...sections, resolved], execOpts);
    } catch (e) { console.error(`[Hook] Format failed for ${resolved}: ${e.message}`); }
  }
  if (commandExists('golines')) {
    try {
      execFileSync('golines', ['-m', '120', '--base-formatter', 'gofumpt', '-w', resolved], execOpts);
    } catch (e) { console.error(`[Hook] Format failed for ${resolved}: ${e.message}`); }
  }
}

function formatProtoFile(filePath) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) return;
  if (!commandExists('clang-format')) return;

  try {
    execFileSync('clang-format', ['-i', '-style=Google', resolved], {
      stdio: 'pipe',
      timeout: 10000,
    });
  } catch (e) { console.error(`[Hook] Format failed for ${resolved}: ${e.message}`); }
}

function restageFiles(files) {
  if (files.length === 0) return;
  try {
    spawnSync('git', ['add', ...files], { stdio: 'pipe', timeout: 5000 });
  } catch { /* */ }
}

function run(rawInput) {
  try {
    const input = JSON.parse(rawInput);
    const cmd = String(input.tool_input?.command || '');

    if (!isCommitCommand(cmd)) return rawInput;

    const staged = getStagedFiles();
    if (staged.length === 0) return rawInput;

    const goFiles = staged.filter(f => f.endsWith('.go') && !isGeneratedFile(f));
    const protoFiles = staged.filter(f => f.endsWith('.proto'));

    if (goFiles.length === 0 && protoFiles.length === 0) return rawInput;

    // Format
    for (const f of goFiles) formatGoFile(f);
    for (const f of protoFiles) formatProtoFile(f);

    // Re-stage formatted files
    restageFiles([...goFiles, ...protoFiles]);

    const total = goFiles.length + protoFiles.length;
    if (total > 0) {
      console.error(`[Hook] Formatted ${goFiles.length} .go + ${protoFiles.length} .proto file(s) before commit`);
    }
  } catch { /* */ }

  return rawInput;
}

// ── stdin entry point ────────────────────────────────────────────
if (require.main === module) {
  let data = '';
  process.stdin.setEncoding('utf8');

  process.stdin.on('data', chunk => {
    if (data.length < MAX_STDIN) {
      data += chunk.substring(0, MAX_STDIN - data.length);
    }
  });

  process.stdin.on('end', () => {
    data = run(data);
    process.stdout.write(data);
    process.exit(0);
  });
}

module.exports = { run };
