// Stub implementation - Metrics opt-out check removed for privacy (always opted out)
export async function checkMetricsEnabled(): Promise<{ enabled: boolean }> { return { enabled: false }; }
