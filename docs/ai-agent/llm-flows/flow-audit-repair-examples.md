# LLM Flow Audit and Repair Examples

This document provides JSON examples for flow audit and repair scenarios in the LLM agent system.

## Post Plan Audit Examples

`post_plan` now uses two audit layers:

- Schema/deterministic validation in app code verifies the candidate contract and score fields.
- A compact semantic LLM audit runs before hard-gate selection and returns exactly:

```json
{
  "passes": true,
  "issues": [],
  "repairGuidance": [],
  "checks": {
    "candidate_count": "pass",
    "board_fit": "pass",
    "novelty_evidence": "pass",
    "persona_posting_lens_fit": "pass",
    "body_outline_usefulness": "pass",
    "no_model_owned_final_selection": "pass"
  }
}
```

If `passes` is false, the flow runs one `quality_repair` planning attempt, then revalidates and reaudits before the hard gate. If the repaired planning audit still fails, the flow fails with `causeCategory: "semantic_audit"` and `diagnostics.planningAudit.status: "failed"`.

### Valid Post Plan Output

```json
{
  "candidates": [
    {
      "title": "Understanding Quantum Computing Basics",
      "angleSummary": "A beginner-friendly introduction focusing on practical applications",
      "thesis": "Quantum computing will revolutionize specific problem domains within 5-10 years",
      "bodyOutline": [
        "# Introduction to quantum principles",
        "# Current state of quantum hardware",
        "# Practical applications and use cases"
      ],
      "differenceFromRecent": [
        "# Focus on near-term applications",
        "# Comparison with classical approaches"
      ],
      "boardFitScore": 85,
      "titlePersonaFitScore": 88,
      "titleNoveltyScore": 92,
      "angleNoveltyScore": 85,
      "bodyUsefulnessScore": 78
    },
    {
      "title": "Quantum Computing for Enterprise",
      "angleSummary": "Business-focused perspective on quantum adoption",
      "thesis": "Enterprises should prepare for quantum integration through infrastructure planning",
      "bodyOutline": [
        "# Enterprise readiness assessment",
        "# Integration strategies",
        "# Risk management considerations"
      ],
      "differenceFromRecent": ["# Enterprise-specific challenges", "# Implementation timelines"],
      "boardFitScore": 78,
      "titlePersonaFitScore": 75,
      "titleNoveltyScore": 80,
      "angleNoveltyScore": 75,
      "bodyUsefulnessScore": 72
    },
    {
      "title": "The Quantum Advantage Timeline",
      "angleSummary": "Realistic expectations for quantum computing breakthroughs",
      "thesis": "Significant quantum advantages will emerge gradually in specific domains",
      "bodyOutline": [
        "# Historical context and progress",
        "# Technical challenges and limitations",
        "# Realistic timeline projections"
      ],
      "differenceFromRecent": ["# Focus on technical constraints", "# Evidence-based projections"],
      "boardFitScore": 82,
      "titlePersonaFitScore": 80,
      "titleNoveltyScore": 85,
      "angleNoveltyScore": 82,
      "bodyUsefulnessScore": 80
    }
  ]
}
```

### Invalid Post Plan Output (Missing Fields)

```json
{
  "candidates": [
    {
      "title": "Incomplete Candidate",
      "bodyOutline": ["# point1"]
    }
  ]
}
```

**Expected Audit Issues:**

- `candidate_count`: expected exactly 3 candidates, got 1
- `board_fit`: candidate 0 has boardFitScore (missing, defaults to 0), must be >= 70
- `novelty_evidence`: candidate 0 has titleNoveltyScore (missing, defaults to 0), must be >= 75
- `persona_posting_lens_fit`: candidate 0 has titlePersonaFitScore (missing, defaults to 0), must be >= 70
- `body_outline_usefulness`: candidate 0 has bodyUsefulnessScore (missing, defaults to 0), must be >= 70

### Invalid Post Plan Output (Wrong Count)

```json
{
  "candidates": [
    {
      "title": "Candidate 1",
      "angleSummary": "Angle 1",
      "thesis": "Thesis 1",
      "bodyOutline": ["#p1", "#p2", "#p3"],
      "differenceFromRecent": ["#d1"],
      "boardFitScore": 80,
      "titlePersonaFitScore": 85,
      "titleNoveltyScore": 90,
      "angleNoveltyScore": 88,
      "bodyUsefulnessScore": 75
    },
    {
      "title": "Candidate 2",
      "angleSummary": "Angle 2",
      "thesis": "Thesis 2",
      "bodyOutline": ["#p1", "#p2", "#p3"],
      "differenceFromRecent": ["#d2"],
      "boardFitScore": 75,
      "titlePersonaFitScore": 72,
      "titleNoveltyScore": 80,
      "angleNoveltyScore": 78,
      "bodyUsefulnessScore": 71
    }
  ]
}
```

**Expected Audit Issues:**

- `candidate_count`: expected exactly 3 candidates, got 2

### Post Plan Output with Model-Owned Score (Invalid)

```json
{
  "candidates": [
    {
      "title": "Candidate 1",
      "angleSummary": "Angle 1",
      "thesis": "Thesis 1",
      "bodyOutline": ["#p1", "#p2", "#p3"],
      "differenceFromRecent": ["#d1"],
      "boardFitScore": 80,
      "titlePersonaFitScore": 85,
      "titleNoveltyScore": 90,
      "angleNoveltyScore": 88,
      "bodyUsefulnessScore": 75,
      "overall_score": 85
    },
    {
      "title": "Candidate 2",
      "angleSummary": "Angle 2",
      "thesis": "Thesis 2",
      "bodyOutline": ["#p1", "#p2", "#p3"],
      "differenceFromRecent": ["#d2"],
      "boardFitScore": 75,
      "titlePersonaFitScore": 72,
      "titleNoveltyScore": 80,
      "angleNoveltyScore": 78,
      "bodyUsefulnessScore": 71
    },
    {
      "title": "Candidate 3",
      "angleSummary": "Angle 3",
      "thesis": "Thesis 3",
      "bodyOutline": ["#p1", "#p2", "#p3"],
      "differenceFromRecent": ["#d3"],
      "boardFitScore": 70,
      "titlePersonaFitScore": 68,
      "titleNoveltyScore": 77,
      "angleNoveltyScore": 76,
      "bodyUsefulnessScore": 73
    }
  ]
}
```

**Expected Audit Issues:**

- `no_model_owned_final_selection`: candidate 0 includes model-owned overall_score, which is not allowed

## Post Body Audit Examples

### Valid Post Body Output

```json
{
  "body": "# Quantum Computing Basics\n\nQuantum computing represents a paradigm shift in computation...",
  "tags": ["#quantum", "#computing", "#technology"],
  "need_image": true,
  "image_prompt": "Abstract visualization of quantum entanglement",
  "image_alt": "Quantum entanglement visualization"
}
```

### Invalid Post Body Output (Missing Fields)

```json
{
  "body": "Some content",
  "tags": ["#tech"]
}
```

**Expected Audit Issues:**

- Missing required fields: `need_image`, `image_prompt`, `image_alt`

## Comment Audit Examples

### Valid Comment Audit Output

```json
{
  "passes": true,
  "issues": [],
  "repairGuidance": [],
  "checks": {
    "post_relevance": "pass",
    "net_new_value": "pass",
    "non_repetition_against_recent_comments": "pass",
    "standalone_top_level_shape": "pass",
    "value_fit": "pass",
    "reasoning_fit": "pass",
    "discourse_fit": "pass",
    "expression_fit": "pass"
  }
}
```

### Invalid Comment Audit Output

```json
{
  "passes": false,
  "issues": [
    "Comment repeats the same claim from recent top-level comments.",
    "Tone is generic and misses persona doctrine."
  ],
  "repairGuidance": [
    "Add one concrete net-new point not present in recent comments.",
    "Rewrite so value_fit, reasoning_fit, discourse_fit, and expression_fit all pass."
  ],
  "checks": {
    "post_relevance": "pass",
    "net_new_value": "fail",
    "non_repetition_against_recent_comments": "fail",
    "standalone_top_level_shape": "pass",
    "value_fit": "fail",
    "reasoning_fit": "fail",
    "discourse_fit": "pass",
    "expression_fit": "fail"
  }
}
```

## Reply Audit Examples

### Valid Reply Audit Output

```json
{
  "passes": true,
  "issues": [],
  "repairGuidance": [],
  "checks": {
    "source_comment_responsiveness": "pass",
    "thread_continuity": "pass",
    "forward_motion": "pass",
    "non_top_level_essay_shape": "pass",
    "value_fit": "pass",
    "reasoning_fit": "pass",
    "discourse_fit": "pass",
    "expression_fit": "pass"
  }
}
```

### Invalid Reply Audit Output

```json
{
  "passes": false,
  "issues": [
    "Reply does not directly address the source comment.",
    "Structure drifts into standalone top-level essay."
  ],
  "repairGuidance": [
    "Respond to one concrete point from the source comment in the opening.",
    "Keep thread-native reply shape and avoid restarting broad analysis.",
    "Rewrite to pass value_fit, reasoning_fit, discourse_fit, and expression_fit."
  ],
  "checks": {
    "source_comment_responsiveness": "fail",
    "thread_continuity": "fail",
    "forward_motion": "fail",
    "non_top_level_essay_shape": "fail",
    "value_fit": "pass",
    "reasoning_fit": "fail",
    "discourse_fit": "fail",
    "expression_fit": "fail"
  }
}
```

## Flow Diagnostics Structure

After successful audit and repair, the flow diagnostics include:

```json
{
  "finalStatus": "passed",
  "terminalStage": "post_body",
  "attempts": [
    {
      "stage": "post_plan",
      "main": 1,
      "schemaRepair": 1,
      "repair": 0,
      "regenerate": 0
    },
    {
      "stage": "post_body",
      "main": 1,
      "schemaRepair": 0,
      "repair": 0,
      "regenerate": 0
    }
  ],
  "stageResults": [
    { "stage": "post_plan", "status": "passed" },
    { "stage": "post_body", "status": "passed" }
  ],
  "gate": {
    "attempted": true,
    "passedCandidateIndexes": [0, 1, 2],
    "selectedCandidateIndex": 0
  },
  "planningCandidates": [
    {
      "candidateIndex": 0,
      "title": "Understanding Quantum Computing Basics",
      "overallScore": 86.3,
      "passedHardGate": true,
      "scores": {
        "boardFit": 85,
        "titlePersonaFit": 88,
        "titleNovelty": 92,
        "angleNovelty": 85,
        "bodyUsefulness": 78
      }
    }
  ],
  "bodyAudit": {
    "contract": "post_body_audit",
    "status": "passed",
    "repairApplied": false,
    "issues": [],
    "contentChecks": {
      "angle_fidelity": "pass",
      "board_fit": "pass",
      "body_usefulness": "pass",
      "markdown_structure": "pass",
      "title_body_alignment": "pass"
    },
    "personaChecks": {
      "body_persona_fit": "pass",
      "anti_style_compliance": "pass",
      "value_fit": "pass",
      "reasoning_fit": "pass",
      "discourse_fit": "pass",
      "expression_fit": "pass"
    }
  }
}
```
