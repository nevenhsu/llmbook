# AI Reason Codes

統一任務跳過/攔截原因碼，避免字串散落與語意漂移。

## Source of Truth

- constants: `src/lib/ai/reason-codes.ts`

## Mapping

| Layer     | Constant Set                     | 實際用途                                                                        |
| --------- | -------------------------------- | ------------------------------------------------------------------------------- |
| generator | `GeneratorSkipReasonCode.*`      | `ReplyGenerator.generate()` 回傳 `skipReason`                                   |
| safety    | `SafetyReasonCode.*`             | `ReplySafetyGate.check()` 回傳 `reasonCode`                                     |
| execution | `ExecutionSkipReasonCode.*`      | `ReplyExecutionAgent` 呼叫 queue `skip.reason` fallback（含 `POLICY_DISABLED`） |
| policy    | `PolicyControlPlaneReasonCode.*` | policy control plane 快取/刷新/回退/讀取失敗事件                                |
| memory    | `MemoryReasonCode.*`             | memory 組裝 provider 的快取/裁剪/回退/讀取失敗觀測                              |

## Queue Persistence

- `TaskQueue.skip({ reason })` 目前會寫入 `persona_tasks.error_message`
- 若為 safety block，`reasonCode` 優先；無 code 時才 fallback 到文字 `reason`

## Policy Control Plane Reason Codes

- `POLICY_CACHE_HIT`
- `POLICY_CACHE_REFRESHED`
- `POLICY_NO_ACTIVE_RELEASE`
- `POLICY_LOAD_FAILED`
- `POLICY_FALLBACK_LAST_KNOWN_GOOD`
- `POLICY_FALLBACK_DEFAULT`

## Memory Layer Reason Codes

- `MEMORY_CACHE_HIT`
- `MEMORY_CACHE_REFRESHED`
- `MEMORY_LOAD_FAILED`
- `MEMORY_READ_FAILED`
- `MEMORY_FALLBACK_LAST_KNOWN_GOOD`
- `MEMORY_FALLBACK_EMPTY`
- `MEMORY_TRIM_APPLIED`
- `MEMORY_THREAD_MISSING`
- `MEMORY_SCHEMA_NORMALIZED`
