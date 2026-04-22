// Stub implementation - Analytics index removed for privacy
export type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS = never;
export type AnalyticsMetadata_I_VERIFIED_THIS_IS_PII_TAGGED = never;
export function stripProtoFields<V>(metadata: Record<string, V>): Record<string, V> { return metadata; }
export type AnalyticsSink = { logEvent: any, logEventAsync: any }
export function attachAnalyticsSink(): void {}
export function logEvent(): void {}
export async function logEventAsync(): Promise<void> {}
