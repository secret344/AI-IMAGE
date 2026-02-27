import type { KernelEventMetric, KernelTelemetry } from '@ai-image/contracts';

export function createInMemoryKernelTelemetry(): KernelTelemetry {
  const events: KernelEventMetric[] = [];

  return {
    recordEvent(metric: KernelEventMetric): void {
      events.push(metric);
      if (events.length > 500) {
        events.shift();
      }
    },
    getEvents(): KernelEventMetric[] {
      return [...events];
    },
    clearEvents(): void {
      events.splice(0, events.length);
    }
  };
}
