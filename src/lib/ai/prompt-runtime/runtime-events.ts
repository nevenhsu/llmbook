import { PromptRuntimeReasonCode } from "@/lib/ai/reason-codes";

export type PromptRuntimeReasonCodeValue =
  (typeof PromptRuntimeReasonCode)[keyof typeof PromptRuntimeReasonCode];

export type PromptRuntimeLayer = "prompt_builder" | "model_adapter" | "generation_runtime";

export type PromptRuntimeOperation = "BUILD" | "CALL" | "FALLBACK";

export type PromptRuntimeEvent = {
  layer: PromptRuntimeLayer;
  operation: PromptRuntimeOperation;
  reasonCode: PromptRuntimeReasonCodeValue;
  entityId: string;
  occurredAt: string;
  metadata?: Record<string, unknown>;
};

export interface PromptRuntimeEventSink {
  record(event: PromptRuntimeEvent): Promise<void>;
}

export class InMemoryPromptRuntimeEventSink implements PromptRuntimeEventSink {
  public readonly events: PromptRuntimeEvent[] = [];

  public async record(event: PromptRuntimeEvent): Promise<void> {
    this.events.push(event);
  }
}

export type PromptRuntimeStatus = {
  events: PromptRuntimeEvent[];
  lastPromptFailure: PromptRuntimeEvent | null;
  lastModelFailure: PromptRuntimeEvent | null;
  lastFallback: PromptRuntimeEvent | null;
};

export class PromptRuntimeEventRecorder {
  private readonly sink?: PromptRuntimeEventSink;
  private readonly maxEvents: number;
  private readonly events: PromptRuntimeEvent[] = [];

  private lastPromptFailure: PromptRuntimeEvent | null = null;
  private lastModelFailure: PromptRuntimeEvent | null = null;
  private lastFallback: PromptRuntimeEvent | null = null;

  public constructor(options?: { sink?: PromptRuntimeEventSink; maxEvents?: number }) {
    this.sink = options?.sink;
    this.maxEvents = Math.max(20, options?.maxEvents ?? 200);
  }

  public async record(event: PromptRuntimeEvent): Promise<void> {
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    if (event.reasonCode === PromptRuntimeReasonCode.promptBuildFailed) {
      this.lastPromptFailure = event;
    }
    if (event.reasonCode === PromptRuntimeReasonCode.modelCallFailed) {
      this.lastModelFailure = event;
    }
    if (event.reasonCode === PromptRuntimeReasonCode.modelFallbackUsed) {
      this.lastFallback = event;
    }

    try {
      await this.sink?.record(event);
    } catch {
      // Best-effort observability only.
    }
  }

  public getStatus(): PromptRuntimeStatus {
    return {
      events: [...this.events],
      lastPromptFailure: this.lastPromptFailure,
      lastModelFailure: this.lastModelFailure,
      lastFallback: this.lastFallback,
    };
  }
}

const defaultRecorder = new PromptRuntimeEventRecorder();

export function getPromptRuntimeRecorder(): PromptRuntimeEventRecorder {
  return defaultRecorder;
}

export function getPromptRuntimeStatus(): PromptRuntimeStatus {
  return defaultRecorder.getStatus();
}
