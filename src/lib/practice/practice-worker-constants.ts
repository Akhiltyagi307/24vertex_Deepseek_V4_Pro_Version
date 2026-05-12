/** Default jobs claimed per `/api/internal/practice/run-jobs` invocation (URL param or fallback). */
export const PRACTICE_JOB_WORKER_DEFAULT_BATCH_LIMIT = 10;

/** Upper bound per invocation to protect serverless wall-clock budgets. */
export const PRACTICE_JOB_WORKER_MAX_BATCH_LIMIT = 20;
