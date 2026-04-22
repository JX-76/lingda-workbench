// Stub implementation - auto updater removed for privacy/control
export async function checkForUpdates(): Promise<void> {}
export function getMaxVersion(): string { return '2.1.88' }
export function shouldSkipVersion(): boolean { return true }
export async function checkGlobalInstallPermissions(): Promise<boolean> { return true }
export function isUpdateAvailable(): boolean { return false }
