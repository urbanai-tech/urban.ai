'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const ignoredDirectories = new Set([
  '.git', '.next', '.venv', '_browser_profile', 'build', 'coverage', 'dist',
  'node_modules', 'out', 'playwright-report', 'test-results', 'venv',
]);

function walk(directory, output = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolutePath, output);
    else if (entry.isFile() && /\.(?:md|markdown)$/i.test(entry.name)) output.push(absolutePath);
  }
  return output;
}

function stripCode(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/~~~[\s\S]*?~~~/g, '')
    .replace(/`[^`\r\n]*`/g, '');
}

function localTarget(rawTarget) {
  let target = rawTarget.trim();
  if (target.startsWith('<') && target.endsWith('>')) target = target.slice(1, -1);
  target = target.replace(/\s+["'][^"']*["']\s*$/, '').trim();
  if (!target || target.startsWith('#')) return null;
  if (/[{}]/.test(target)) return null;
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|\$\{|<)/i.test(target)) return null;

  target = target.split('#', 1)[0].split('?', 1)[0];
  try {
    target = decodeURIComponent(target);
  } catch {
    // Keep malformed URLs visible as broken paths instead of hiding them.
  }
  return target.replace(/\\/g, '/');
}

function lineNumberAt(content, index) {
  return content.slice(0, index).split('\n').length;
}

function audit() {
  const files = walk(root);
  const findings = [];
  let links = 0;
  const expression = /!?\[[^\]]*\]\(([^)]+)\)/g;

  for (const absolutePath of files) {
    const markdown = stripCode(fs.readFileSync(absolutePath, 'utf8'));
    expression.lastIndex = 0;
    let match;
    while ((match = expression.exec(markdown)) !== null) {
      const target = localTarget(match[1]);
      if (!target) continue;
      links += 1;
      const targetWithoutLine = target.replace(/(:\d+)(?::\d+)?$/, '');
      let destination = targetWithoutLine.startsWith('/')
        ? path.resolve(root, `.${targetWithoutLine}`)
        : path.resolve(path.dirname(absolutePath), targetWithoutLine);
      const relativeSource = path.relative(root, absolutePath).replace(/\\/g, '/');
      if (!fs.existsSync(destination) && relativeSource.startsWith('docs/archive/')) {
        const canonicalDocsCandidate = path.resolve(root, 'docs', targetWithoutLine);
        if (fs.existsSync(canonicalDocsCandidate)) destination = canonicalDocsCandidate;
      }
      const insideRoot = destination === root || destination.startsWith(`${root}${path.sep}`);
      if (!insideRoot || !fs.existsSync(destination)) {
        findings.push({
          file: relativeSource,
          line: lineNumberAt(markdown, match.index),
          target,
          reason: insideRoot ? 'missing' : 'outside-repository',
        });
      }
    }
  }
  return { files: files.length, links, findings };
}

const reportOnly = process.argv.includes('--report-only');
const result = audit();
if (result.findings.length > 0) {
  const stream = reportOnly ? process.stdout : process.stderr;
  stream.write(`Documentation link audit found ${result.findings.length} broken local link(s).\n`);
  for (const finding of result.findings) {
    stream.write(`- ${finding.file}:${finding.line} -> ${finding.target} [${finding.reason}]\n`);
  }
  if (!reportOnly) process.exitCode = 1;
} else {
  process.stdout.write(`Documentation link audit passed: ${result.files} files and ${result.links} local links checked.\n`);
}
