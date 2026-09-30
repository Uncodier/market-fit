// Shared guard across all AI builders; extraction must not create per-module locks.
export const aiRequestState = { inProgress: false }
