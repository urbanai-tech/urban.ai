'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const hooksDirectory = path.join(root, '.githooks');
const preCommitHook = path.join(hooksDirectory, 'pre-commit');

if (!fs.existsSync(preCommitHook)) {
  process.stderr.write('Cannot install Git hooks: .githooks/pre-commit is missing.\n');
  process.exit(1);
}

execFileSync('git', ['config', '--local', 'core.hooksPath', '.githooks'], {
  cwd: root,
  stdio: 'inherit',
});

if (process.platform !== 'win32') {
  fs.chmodSync(preCommitHook, 0o755);
}

const configuredPath = execFileSync('git', ['config', '--local', '--get', 'core.hooksPath'], {
  cwd: root,
  encoding: 'utf8',
}).trim();

if (configuredPath !== '.githooks') {
  process.stderr.write(`Git hook installation failed: unexpected hooks path ${configuredPath}.\n`);
  process.exit(1);
}

process.stdout.write('Git hooks installed: core.hooksPath=.githooks.\n');

