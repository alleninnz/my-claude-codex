/**
 * Package manager detection for Claude Code hook scripts.
 * Only getPackageManager() is used by this plugin (via resolve-formatter.js).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { getClaudeDir, readFile } = require('./utils');

const PACKAGE_MANAGERS = {
  npm:  { lockFile: 'package-lock.json', execCmd: 'npx' },
  pnpm: { lockFile: 'pnpm-lock.yaml',   execCmd: 'pnpm exec' },
  yarn: { lockFile: 'yarn.lock',         execCmd: 'yarn exec' },
  bun:  { lockFile: 'bun.lockb',         execCmd: 'bunx' },
};

const DETECTION_PRIORITY = ['pnpm', 'bun', 'yarn', 'npm'];

function detectFromLockFile(projectDir) {
  for (const name of DETECTION_PRIORITY) {
    if (fs.existsSync(path.join(projectDir, PACKAGE_MANAGERS[name].lockFile))) {
      return name;
    }
  }
  return null;
}

function detectFromPackageJson(projectDir) {
  const content = readFile(path.join(projectDir, 'package.json'));
  if (!content) return null;
  try {
    const pkg = JSON.parse(content);
    if (pkg.packageManager) {
      const name = pkg.packageManager.split('@')[0];
      if (PACKAGE_MANAGERS[name]) return name;
    }
  } catch { /* */ }
  return null;
}

/**
 * Detect the package manager for a project directory.
 *
 * Priority: env var → project config → package.json field → lock file → global config → npm
 */
function getPackageManager(options = {}) {
  const { projectDir = process.cwd() } = options;

  // 1. Environment variable
  const envPm = process.env.CLAUDE_PACKAGE_MANAGER;
  if (envPm && PACKAGE_MANAGERS[envPm]) {
    return { name: envPm, config: PACKAGE_MANAGERS[envPm], source: 'environment' };
  }

  // 2. Project config
  const projectConfig = readFile(path.join(projectDir, '.claude', 'package-manager.json'));
  if (projectConfig) {
    try {
      const cfg = JSON.parse(projectConfig);
      if (cfg.packageManager && PACKAGE_MANAGERS[cfg.packageManager]) {
        return { name: cfg.packageManager, config: PACKAGE_MANAGERS[cfg.packageManager], source: 'project-config' };
      }
    } catch { /* */ }
  }

  // 3. package.json packageManager field
  const fromPkg = detectFromPackageJson(projectDir);
  if (fromPkg) return { name: fromPkg, config: PACKAGE_MANAGERS[fromPkg], source: 'package.json' };

  // 4. Lock file
  const fromLock = detectFromLockFile(projectDir);
  if (fromLock) return { name: fromLock, config: PACKAGE_MANAGERS[fromLock], source: 'lock-file' };

  // 5. Global config
  const globalContent = readFile(path.join(getClaudeDir(), 'package-manager.json'));
  if (globalContent) {
    try {
      const cfg = JSON.parse(globalContent);
      if (cfg.packageManager && PACKAGE_MANAGERS[cfg.packageManager]) {
        return { name: cfg.packageManager, config: PACKAGE_MANAGERS[cfg.packageManager], source: 'global-config' };
      }
    } catch { /* */ }
  }

  // 6. Default to npm
  return { name: 'npm', config: PACKAGE_MANAGERS.npm, source: 'default' };
}

module.exports = { getPackageManager };
