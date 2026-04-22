// Stub implementation - Growthbook remote config removed for privacy and local control
export function checkStatsigFeatureGate_CACHED_MAY_BE_STALE(): boolean { return false; }
export function getDynamicConfig_CACHED_MAY_BE_STALE(): any { return null; }
export function getFeatureValue_CACHED_MAY_BE_STALE(key?: string, defaultValue?: any): any { return defaultValue !== undefined ? defaultValue : undefined; }
export function getFeatureValue_CACHED_WITH_REFRESH(key?: string, defaultValue?: any): any { return defaultValue !== undefined ? defaultValue : undefined; }
export function checkGate_CACHED_OR_BLOCKING(): boolean { return false; }
export function refreshGrowthBookAfterAuthChange(): void {}
export function checkSecurityRestrictionGate(): boolean { return false; }
export function getDynamicConfig_BLOCKS_ON_INIT(): any { return null; }
export async function waitForRemoteConfigInitialization(): Promise<void> {}
