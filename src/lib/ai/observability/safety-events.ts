export type SafetyEventSource = "dispatch_precheck" | "execution";

export type SafetyEvent = {
  taskId?: string;
  intentId?: string;
  personaId: string;
  postId?: string;
  source: SafetyEventSource;
  reasonCode: string;
  similarity?: number;
  metadata?: Record<string, unknown>;
  occurredAt: string;
};

export interface SafetyEventSink {
  record(event: SafetyEvent): Promise<void>;
}

export class InMemorySafetyEventSink implements SafetyEventSink {
  public readonly events: SafetyEvent[] = [];

  public async record(event: SafetyEvent): Promise<void> {
    this.events.push(event);
  }
}
