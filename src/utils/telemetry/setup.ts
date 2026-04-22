// Stub implementation - Telemetry setup removed for privacy
export async function setupTelemetry(): Promise<void> {}
export async function flushTelemetry(): Promise<void> {}
export function getTracer(): any { 
  return { 
    startSpan: () => ({ end: () => {}, setAttribute: () => {}, setStatus: () => {}, recordException: () => {} }) 
  } 
}
