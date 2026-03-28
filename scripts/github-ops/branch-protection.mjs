#!/usr/bin/env node
import process from 'node:process';

const DEFAULT_REQUIRED_CHECKS = [
  'CI / lint-type-build-test (20.x)',
  'CodeQL',
  'Dependency Review',
  'Secret Scan'
];

export function buildBranchProtectionPayload({ owner, repo, branch, requiredChecks }) {
  const checks = [...new Set((requiredChecks ?? []).filter(Boolean))].map((context) => ({ context }));

  return {
    owner,
    repo,
    branch,
    enforce_admins: true,
    required_linear_history: {
      enabled: true
    },
    required_status_checks: {
      strict: true,
      checks
    },
    required_pull_request_reviews: {
      dismiss_stale_reviews: true,
      require_code_owner_reviews: false,
      required_approving_review_count: 1,
      require_last_push_approval: true
    },
    required_conversation_resolution: true,
    block_creations: false,
    allow_force_pushes: false,
    allow_deletions: false,
    lock_branch: false
  };
}

function parseArgs(argv) {
  const args = {
    requiredChecks: []
  };

  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];

    if (value === '--owner') args.owner = argv[++i];
    else if (value === '--repo') args.repo = argv[++i];
    else if (value === '--branch') args.branch = argv[++i];
    else if (value === '--required-check') args.requiredChecks.push(argv[++i]);
    else if (value === '--dry-run') args.dryRun = true;
  }

  return args;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const owner = args.owner ?? process.env.GITHUB_OWNER;
  const repo = args.repo ?? process.env.GITHUB_REPO;
  const branch = args.branch ?? 'main';
  const token = process.env.GITHUB_TOKEN;
  const requiredChecks = args.requiredChecks.length > 0 ? args.requiredChecks : DEFAULT_REQUIRED_CHECKS;

  if (!owner) fail('Missing owner. Provide --owner or GITHUB_OWNER.');
  if (!repo) fail('Missing repo. Provide --repo or GITHUB_REPO.');

  const payload = buildBranchProtectionPayload({ owner, repo, branch, requiredChecks });

  if (args.dryRun) {
    process.stdout.write(`${JSON.stringify({ owner, repo, branch, payload }, null, 2)}\n`);
    return;
  }

  if (!token) {
    fail('Missing GITHUB_TOKEN for live API request. Use --dry-run to preview payload.');
  }

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches/${branch}/protection`, {
    method: 'PUT',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      required_status_checks: payload.required_status_checks,
      enforce_admins: payload.enforce_admins,
      required_pull_request_reviews: payload.required_pull_request_reviews,
      restrictions: null,
      required_linear_history: payload.required_linear_history,
      allow_force_pushes: payload.allow_force_pushes,
      allow_deletions: payload.allow_deletions,
      block_creations: payload.block_creations,
      required_conversation_resolution: payload.required_conversation_resolution,
      lock_branch: payload.lock_branch
    })
  });

  if (!response.ok) {
    const body = await response.text();
    fail(`GitHub API request failed (${response.status}): ${body}`);
  }

  process.stdout.write(`Branch protection updated for ${owner}/${repo} (${branch}).\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
