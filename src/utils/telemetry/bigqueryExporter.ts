// Stub implementation - BigQuery telemetry exporter removed for privacy
export class BigQueryMetricsExporter {
  async export(metrics: any, resultCallback: any): Promise<void> {
    resultCallback({ code: 0 })
  }
  async shutdown(): Promise<void> {}
  async forceFlush(): Promise<void> {}
  selectAggregationTemporality(): number { return 1; }
}
