#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const DEFAULT_TIMEOUT_MS = 8_000;

function parseArgs(argv) {
  const options = {
    dryRun: false,
    output: null,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--output' || arg === '-o') {
      const value = argv[index + 1];
      if (!value || value.startsWith('-')) {
        throw new Error(`${arg} requires a file path.`);
      }
      options.output = value;
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function usage() {
  return [
    'Usage:',
    '  node scripts/release-evidence.js --dry-run',
    '  node scripts/release-evidence.js --output docs/evidence/release-evidence.md',
    '',
    'Options:',
    '  --dry-run          Print the Markdown evidence to stdout without writing a file.',
    '  --output, -o FILE  Write the Markdown evidence to FILE.',
    '  --help, -h         Show this help.',
  ].join('\n');
}

function run(command, args, cwd, timeout = DEFAULT_TIMEOUT_MS) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    timeout,
    windowsHide: true,
  });

  return {
    command: [command, ...args].join(' '),
    ok: result.status === 0,
    status: result.status,
    signal: result.signal,
    stdout: sanitizeText(result.stdout || ''),
    stderr: sanitizeText(result.stderr || ''),
    error: result.error ? sanitizeText(result.error.message) : '',
  };
}

function sanitizeText(value) {
  return String(value)
    .replace(/(https?:\/\/)([^/\s:@]+):([^@\s/]+)@/gi, '$1[redacted]@')
    .replace(/\b(gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, '[redacted-token]')
    .replace(/\b(glpat-[A-Za-z0-9_-]{20,})\b/g, '[redacted-token]')
    .replace(/\b(xox[baprs]-[A-Za-z0-9-]{20,})\b/g, '[redacted-token]')
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/-]+=*/gi, '$1 [redacted-token]')
    .replace(/\b((?:api[_-]?key|access[_-]?token|auth[_-]?token|password|secret)=)[^\s&]+/gi, '$1[redacted]');
}

function sanitizeRemoteUrl(value) {
  const raw = sanitizeText(value.trim());

  try {
    const parsed = new URL(raw);
    parsed.username = '';
    parsed.password = '';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch (_) {
    return raw.replace(/([^@\s]+)@([^:\s]+):/, '[redacted-user]@$2:');
  }
}

function singleLine(value, fallback = 'Unavailable') {
  const clean = sanitizeText(value || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return clean[0] || fallback;
}

function parseRemotes(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/);
      if (!match) {
        return null;
      }
      return {
        name: match[1],
        url: sanitizeRemoteUrl(match[2]),
        type: match[3],
      };
    })
    .filter(Boolean);
}

function gitValue(args, cwd, fallback = 'Unavailable') {
  const result = run('git', args, cwd);
  return result.ok ? singleLine(result.stdout, fallback) : fallback;
}

function parseJsonResult(result) {
  if (!result.ok || !result.stdout.trim()) {
    return null;
  }

  try {
    return JSON.parse(result.stdout);
  } catch (_) {
    return null;
  }
}

function collectGit(cwd) {
  const rootResult = run('git', ['rev-parse', '--show-toplevel'], cwd);
  const repoRoot = rootResult.ok ? singleLine(rootResult.stdout, cwd) : cwd;

  const branch = gitValue(['branch', '--show-current'], repoRoot, '');
  const sha = gitValue(['rev-parse', 'HEAD'], repoRoot);
  const shortSha = gitValue(['rev-parse', '--short=12', 'HEAD'], repoRoot);
  const commitDate = gitValue(['show', '-s', '--format=%cI', 'HEAD'], repoRoot);
  const commitSubject = gitValue(['show', '-s', '--format=%s', 'HEAD'], repoRoot);
  const remotesResult = run('git', ['remote', '-v'], repoRoot);
  const statusResult = run('git', ['status', '--short', '--branch'], repoRoot);

  return {
    repoRoot,
    branch: branch || '(detached HEAD)',
    sha,
    shortSha,
    commitDate,
    commitSubject,
    remotes: remotesResult.ok ? parseRemotes(remotesResult.stdout) : [],
    status: statusResult.ok ? statusResult.stdout.trim() : `Unavailable: ${statusResult.stderr || statusResult.error}`,
  };
}

function collectGitHub(cwd) {
  const version = run('gh', ['--version'], cwd);
  if (!version.ok) {
    return {
      available: false,
      summary: 'GitHub CLI is not available on PATH.',
      version: null,
      auth: null,
      repo: null,
      pr: null,
      runs: null,
    };
  }

  const auth = run('gh', ['auth', 'status', '--hostname', 'github.com'], cwd);
  const repo = parseJsonResult(run('gh', ['repo', 'view', '--json', 'nameWithOwner,url,defaultBranchRef,isPrivate'], cwd));
  const pr = parseJsonResult(run('gh', ['pr', 'view', '--json', 'number,state,isDraft,baseRefName,headRefName,url'], cwd));
  const runs = parseJsonResult(run('gh', ['run', 'list', '--limit', '5', '--json', 'databaseId,status,conclusion,workflowName,headBranch,event,url,updatedAt'], cwd));

  return {
    available: true,
    summary: auth.ok ? 'GitHub CLI is available and authenticated.' : 'GitHub CLI is available, but authentication/status check did not succeed.',
    version: singleLine(version.stdout),
    auth: auth.ok ? 'Authenticated for github.com.' : singleLine(auth.stderr || auth.stdout || auth.error),
    repo,
    pr,
    runs: Array.isArray(runs) ? runs : null,
  };
}

function markdownTable(headers, rows) {
  const safeHeaders = headers.map((header) => markdownCell(header));
  const safeRows = rows.map((row) => row.map((cell) => markdownCell(cell == null ? '' : String(cell))));
  return [
    `| ${safeHeaders.join(' | ')} |`,
    `| ${safeHeaders.map(() => '---').join(' | ')} |`,
    ...safeRows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}

function markdownCell(value) {
  return sanitizeText(value).replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');
}

function renderMarkdown(evidence) {
  const lines = [];

  lines.push('# Release Evidence');
  lines.push('');
  lines.push(`Generated at: ${evidence.generatedAt}`);
  lines.push('');
  lines.push('## Repository');
  lines.push('');
  lines.push(`- Path: \`${sanitizeText(evidence.git.repoRoot)}\``);
  lines.push(`- Branch: \`${sanitizeText(evidence.git.branch)}\``);
  lines.push(`- SHA: \`${sanitizeText(evidence.git.sha)}\``);
  lines.push(`- Short SHA: \`${sanitizeText(evidence.git.shortSha)}\``);
  lines.push(`- Commit date: ${sanitizeText(evidence.git.commitDate)}`);
  lines.push(`- Commit subject: ${sanitizeText(evidence.git.commitSubject)}`);
  lines.push('');
  lines.push('## Remotes');
  lines.push('');

  if (evidence.git.remotes.length > 0) {
    lines.push(markdownTable(['Name', 'Type', 'URL'], evidence.git.remotes.map((remote) => [remote.name, remote.type, remote.url])));
  } else {
    lines.push('No git remotes were found.');
  }

  lines.push('');
  lines.push('## Working Tree');
  lines.push('');
  lines.push('Only git status codes and file paths are collected; file contents and environment variables are not read.');
  lines.push('');
  lines.push('```text');
  lines.push(evidence.git.status || 'Clean working tree.');
  lines.push('```');
  lines.push('');
  lines.push('## GitHub CLI');
  lines.push('');
  lines.push(`- Status: ${sanitizeText(evidence.github.summary)}`);

  if (evidence.github.version) {
    lines.push(`- Version: ${sanitizeText(evidence.github.version)}`);
  }

  if (evidence.github.auth) {
    lines.push(`- Auth: ${sanitizeText(evidence.github.auth)}`);
  }

  if (evidence.github.repo) {
    const defaultBranch = evidence.github.repo.defaultBranchRef && evidence.github.repo.defaultBranchRef.name
      ? evidence.github.repo.defaultBranchRef.name
      : 'Unavailable';
    lines.push(`- Repository: ${sanitizeText(evidence.github.repo.nameWithOwner || 'Unavailable')}`);
    lines.push(`- Repository URL: ${sanitizeRemoteUrl(evidence.github.repo.url || 'Unavailable')}`);
    lines.push(`- Default branch: ${sanitizeText(defaultBranch)}`);
    lines.push(`- Private: ${evidence.github.repo.isPrivate ? 'yes' : 'no'}`);
  }

  if (evidence.github.pr) {
    lines.push('');
    lines.push('### Current Branch Pull Request');
    lines.push('');
    lines.push(markdownTable(
      ['Number', 'State', 'Draft', 'Head', 'Base', 'URL'],
      [[
        evidence.github.pr.number,
        evidence.github.pr.state,
        evidence.github.pr.isDraft ? 'yes' : 'no',
        evidence.github.pr.headRefName,
        evidence.github.pr.baseRefName,
        sanitizeRemoteUrl(evidence.github.pr.url || ''),
      ]],
    ));
  }

  if (evidence.github.runs && evidence.github.runs.length > 0) {
    lines.push('');
    lines.push('### Recent Workflow Runs');
    lines.push('');
    lines.push(markdownTable(
      ['Run', 'Workflow', 'Branch', 'Event', 'Status', 'Conclusion', 'Updated', 'URL'],
      evidence.github.runs.map((item) => [
        item.databaseId,
        item.workflowName,
        item.headBranch,
        item.event,
        item.status,
        item.conclusion || '',
        item.updatedAt,
        sanitizeRemoteUrl(item.url || ''),
      ]),
    ));
  }

  lines.push('');
  lines.push('## Secret Hygiene');
  lines.push('');
  lines.push('- Environment variables are not collected.');
  lines.push('- File contents are not collected.');
  lines.push('- Remote credentials and common token formats are redacted before output.');
  lines.push('- GitHub CLI data is limited to repository, pull request, and workflow status metadata.');
  lines.push('');

  return `${sanitizeText(lines.join('\n'))}\n`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  if (!options.dryRun && !options.output) {
    options.dryRun = true;
  }

  const git = collectGit(process.cwd());
  const github = collectGitHub(git.repoRoot);
  const markdown = renderMarkdown({
    generatedAt: new Date().toISOString(),
    git,
    github,
  });

  if (options.dryRun || !options.output) {
    process.stdout.write(markdown);
    return;
  }

  const outputPath = path.resolve(process.cwd(), options.output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, markdown, 'utf8');
  process.stdout.write(`Release evidence written to ${outputPath}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${sanitizeText(error.message)}\n`);
  process.stderr.write(`${usage()}\n`);
  process.exitCode = 1;
}
