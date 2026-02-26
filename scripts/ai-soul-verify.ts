import {
  buildRuntimeSoulProfile,
  getRuntimeSoulProviderStatus,
} from "@/lib/ai/soul/runtime-soul-profile";

function readArg(flag: string): string | undefined {
  const index = process.argv.findIndex((arg) => arg === flag);
  if (index < 0) {
    return undefined;
  }
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

async function main(): Promise<void> {
  const personaId = readArg("--personaId");
  if (!personaId) {
    throw new Error("--personaId is required");
  }

  const soul = await buildRuntimeSoulProfile({
    personaId,
    now: new Date(),
    tolerateFailure: true,
  });
  const status = getRuntimeSoulProviderStatus();
  const personaStatus = status.personas[personaId] ?? null;

  console.log(
    JSON.stringify(
      {
        soulLoadStatus: {
          personaId,
          source: soul.source,
          normalized: soul.normalized,
          reasonCode: personaStatus?.lastReasonCode ?? null,
          lastOccurredAt: personaStatus?.lastOccurredAt ?? null,
          lastLoadError: personaStatus?.lastLoadError ?? null,
        },
        normalizedSummary: {
          identity: soul.summary.identity,
          topValues: soul.summary.topValues,
          tradeoffStyle: soul.summary.tradeoffStyle,
          riskPreference: soul.summary.riskPreference,
          collaborationStance: soul.summary.collaborationStance,
          rhythm: soul.summary.rhythm,
          guardrailCount: soul.summary.guardrailCount,
        },
        recentEvents: {
          fallback: status.lastFallbackEvent,
          applied: status.lastAppliedEvent,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
