/**
 * Minimal utility functions for Claude Code hook scripts.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

function getClaudeDir() {
  return path.join(os.homedir(), '.claude');
}

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function writeFile(filePath, content) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  } catch {
    return false;
  }
}

function commandExists(cmd) {
  if (!cmd || typeof cmd !== 'string') return false;
  const result = spawnSync('which', [cmd], { stdio: 'pipe', timeout: 3000 });
  return result.status === 0;
}

module.exports = { getClaudeDir, readFile, writeFile, commandExists };
