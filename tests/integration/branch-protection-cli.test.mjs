import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

test('CLI prints dry-run payload for GitHub API', async () => {
  const { stdout } = await execFileAsync('node', [
    'scripts/github-ops/branch-protection.mjs',
    '--owner', 'acme',
    '--repo', 'metadata-search',
    '--branch', 'main',
    '--required-check', 'CI / lint-type-build-test (20.x)',
    '--required-check', 'CodeQL',
    '--dry-run'
  ]);

  const output = JSON.parse(stdout);
  assert.equal(output.branch, 'main');
  assert.equal(output.payload.required_linear_history.enabled, true);
  assert.equal(output.payload.required_pull_request_reviews.required_approving_review_count, 1);
  assert.deepEqual(
    output.payload.required_status_checks.checks.map((check) => check.context),
    ['CI / lint-type-build-test (20.x)', 'CodeQL']
  );
});
