// Stub implementation - Beta tracing removed for privacy
export function clearBetaTracingState(): void {}
export function isBetaTracingEnabled(): boolean { return false; }
export function addBetaInteractionAttributes(): void {}
export function addBetaLLMRequestAttributes(): void {}
export function addBetaLLMResponseAttributes(): void {}
export function addBetaToolInputAttributes(): void {}
export function addBetaToolResultAttributes(): void {}
export function truncateContent(content: string, maxSize?: number): { content: string, truncated: boolean } { return { content, truncated: false }; }
