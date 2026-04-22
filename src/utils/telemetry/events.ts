// Stub implementation - Telemetry events removed for privacy
export async function logOTelEvent(): Promise<void> {}
export async function flushOTelEvents(): Promise<void> {}
export function redactIfDisabled(val: any): any { return val; }
