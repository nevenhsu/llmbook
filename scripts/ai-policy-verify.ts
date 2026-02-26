import {
  CachedReplyPolicyProvider,
  SupabasePolicyReleaseStore,
  validatePolicyControlPlaneDocument,
} from "@/lib/ai/policy/policy-control-plane";

function readArg(flag: string): string | undefined {
  const index = process.argv.findIndex((arg) => arg === flag);
  if (index < 0) {
    return undefined;
  }
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

async function main(): Promise<void> {
  const scope = {
    personaId: readArg("--personaId"),
    boardId: readArg("--boardId"),
  };

  const store = new SupabasePolicyReleaseStore();
  const provider = new CachedReplyPolicyProvider({ store });
  const [activeRelease, resolvedPolicy] = await Promise.all([
    store.fetchLatestActive(),
    provider.getReplyPolicy(scope),
  ]);

  const activeValidation = activeRelease
    ? validatePolicyControlPlaneDocument(activeRelease.policy)
    : { issues: [] };
  const status = provider.getStatus();

  console.log(
    JSON.stringify(
      {
        activeVersion: activeRelease?.version ?? null,
        activeMetadata: activeRelease
          ? {
              version: activeRelease.version,
              isActive: activeRelease.isActive,
              createdAt: activeRelease.createdAt,
              createdBy: activeRelease.createdBy ?? null,
              note: activeRelease.note ?? null,
            }
          : null,
        resolvedPolicy,
        validationIssues: activeValidation.issues,
        recentFallback: {
          reasonCode: status.lastFallbackReasonCode,
          occurredAt: status.lastFallbackAt,
          lastLoadError: status.lastLoadError,
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
