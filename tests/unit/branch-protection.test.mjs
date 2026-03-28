import test from 'node:test';
import assert from 'node:assert/strict';

import { buildBranchProtectionPayload } from '../../scripts/github-ops/branch-protection.mjs';

test('buildBranchProtectionPayload enables required reviews, status checks, and linear history', () => {
  const payload = buildBranchProtectionPayload({
    owner: 'acme',
    repo: 'metadata-search',
    branch: 'main',
    requiredChecks: ['CI / lint-type-build-test (20.x)', 'CodeQL', 'Secret Scan']
  });

  assert.equal(payload.required_pull_request_reviews.required_approving_review_count, 1);
  assert.equal(payload.required_linear_history.enabled, true);
  assert.deepEqual(
    payload.required_status_checks.checks.map((check) => check.context),
    ['CI / lint-type-build-test (20.x)', 'CodeQL', 'Secret Scan']
  );
  assert.equal(payload.enforce_admins, true);
  assert.equal(payload.lock_branch, false);
});

test('buildBranchProtectionPayload deduplicates required checks', () => {
  const payload = buildBranchProtectionPayload({
    owner: 'acme',
    repo: 'metadata-search',
    branch: 'main',
    requiredChecks: ['CI', 'CI', 'CodeQL']
  });

  assert.deepEqual(
    payload.required_status_checks.checks.map((check) => check.context),
    ['CI', 'CodeQL']
  );
});
