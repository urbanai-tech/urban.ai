# Release Evidence

This directory can store generated Markdown evidence for release handoffs.

Generate a preview without writing a file:

```sh
node scripts/release-evidence.js --dry-run
```

Write a release evidence file:

```sh
node scripts/release-evidence.js --output docs/evidence/release-evidence.md
```

The generator collects local git SHA, branch, remotes, working tree status, and optional GitHub CLI metadata when `gh` is available. It does not read environment variables or file contents, and it redacts remote credentials plus common token formats before writing output.
