export type SafetyGateResult = {
  allowed: boolean;
  reason?: string;
};

export interface ReplySafetyGate {
  check(input: { text: string }): Promise<SafetyGateResult>;
}

export class AllowAllReplySafetyGate implements ReplySafetyGate {
  public async check(): Promise<SafetyGateResult> {
    return { allowed: true };
  }
}
