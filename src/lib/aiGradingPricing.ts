// Verified against OpenAI's model page on 2026-09-08. Recheck before relying on displayed estimates.
export const AI_GRADING_ESTIMATE={model:'gpt-5-mini',inputTokens:5000,outputTokens:1200,inputPerMillionUsd:.25,outputPerMillionUsd:2}
export const estimatedGradeCostUsd=AI_GRADING_ESTIMATE.inputTokens*AI_GRADING_ESTIMATE.inputPerMillionUsd/1_000_000+AI_GRADING_ESTIMATE.outputTokens*AI_GRADING_ESTIMATE.outputPerMillionUsd/1_000_000
