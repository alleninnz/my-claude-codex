#!/usr/bin/env node
/**
 * PreToolUse Hook: Warn when editing generated files
 *
 * Runs before Edit tool use. If the target file matches a known
 * generated file pattern, writes a warning to stderr.
 *
 * Does NOT block the edit — just warns.
 */

'use strict';

const MAX_STDIN = 1024 * 1024; // 1MB limit

const GENERATED_PATTERNS = [
  { test: f => f.endsWith('.pb.go'), source: '.proto files and run protoc' },
  { test: f => f.endsWith('_grpc.pb.go'), source: '.proto files and run protoc' },
  { test: f => f.endsWith('.pb.gw.go'), source: '.proto files and run protoc' },
  { test: f => f.endsWith('/generated.go'), source: 'the GraphQL schema and run codegen' },
  { test: f => f.endsWith('/models_gen.go'), source: 'the GraphQL schema and run codegen' },
  {
    test: f => {
      const normalized = f.replace(/\\/g, '/');
      return /\/ent\/[^/]+\.go$/.test(normalized)
        && !/(\/ent\/schema\/|\/db\/schema\/)/.test(normalized);
    },
    source: 'ent schema files in ent/schema/ and run go generate'
  },
];

/**
 * Core logic.
 */
function run(rawInput) {
  try {
    const input = JSON.parse(rawInput);
    const filePath = input.tool_input?.file_path;

    if (filePath) {
      const normalized = filePath.replace(/\\/g, '/');
      for (const pattern of GENERATED_PATTERNS) {
        if (pattern.test(normalized)) {
          process.stderr.write(
            `Warning: "${filePath}" is a generated file. Edit the source (${pattern.source}) and regenerate instead.\n`
          );
          break;
        }
      }
    }
  } catch {
    // Invalid input — pass through
  }

  return rawInput;
}

// ── stdin entry point ────────────────────────────────────────────
if (require.main === module) {
  let data = '';
  process.stdin.setEncoding('utf8');

  process.stdin.on('data', chunk => {
    if (data.length < MAX_STDIN) {
      const remaining = MAX_STDIN - data.length;
      data += chunk.substring(0, remaining);
    }
  });

  process.stdin.on('end', () => {
    data = run(data);
    process.stdout.write(data);
    process.exit(0);
  });
}

module.exports = { run };
