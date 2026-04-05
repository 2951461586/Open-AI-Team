import { randomUUID } from 'node:crypto';

export function buildCanonicalCriticReview({
  taskId,
  targetId,
  reviewerMemberId = 'critic',
  score = 0.95,
  verdict = 'approve',
  issues = [],
  checklist,
  evidenceRequirements,
} = {}) {
  return {
    reviewId: `review:${randomUUID()}`,
    contractVersion: 'critic.review.v2',
    outputType: 'team.review.v2',
    taskId,
    targetType: 'plan',
    targetId,
    reviewerMemberId,
    score,
    verdict,
    checklist: checklist || [
      'Steps are concrete, actionable, and ordered',
      'Each step has explicit success criteria and verification method',
      'Risks are concrete with mitigations and fallback/rollback',
      'Callback procedure is fully specified with headers and payload shape',
      'Final output is consistent with posted payloads and recorded evidence',
    ],
    evidenceRequirements: evidenceRequirements || [
      'HTTP callback returns 2xx (or explicit ok=true) and response body is recorded',
      'Review JSON contains taskId/targetType/targetId/contractVersion/outputType correctly',
      'Failure path defines one retry and captures final error evidence',
    ],
    issues,
  };
}

export function buildCriticReviewPayload(args = {}) {
  return buildCanonicalCriticReview(args);
}
