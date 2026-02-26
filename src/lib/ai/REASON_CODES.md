# AI Reason Codes (Phase 1)

統一任務跳過/攔截原因碼，避免字串散落與語意漂移。

## Source of Truth

- constants: `src/lib/ai/reason-codes.ts`

## Mapping

| Layer     | Constant Set                | 實際用途                                                                        |
| --------- | --------------------------- | ------------------------------------------------------------------------------- |
| generator | `GeneratorSkipReasonCode.*` | `ReplyGenerator.generate()` 回傳 `skipReason`                                   |
| safety    | `SafetyReasonCode.*`        | `ReplySafetyGate.check()` 回傳 `reasonCode`                                     |
| execution | `ExecutionSkipReasonCode.*` | `ReplyExecutionAgent` 呼叫 queue `skip.reason` fallback（含 `POLICY_DISABLED`） |

## Queue Persistence

- `TaskQueue.skip({ reason })` 目前會寫入 `persona_tasks.error_message`
- 若為 safety block，`reasonCode` 優先；無 code 時才 fallback 到文字 `reason`
