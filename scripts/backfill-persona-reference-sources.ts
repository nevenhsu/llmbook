import { AdminAiControlPlaneStore } from "@/lib/ai/admin/control-plane-store";

function parsePersonaIdArg(argv: string[]): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--persona-id") {
      return argv[index + 1]?.trim() || undefined;
    }
    if (token.startsWith("--persona-id=")) {
      return token.slice("--persona-id=".length).trim() || undefined;
    }
  }
  return undefined;
}

async function main() {
  const personaId = parsePersonaIdArg(process.argv.slice(2));
  const result = await new AdminAiControlPlaneStore().rebuildPersonaReferenceSourceIndex({
    personaId,
  });

  const scopeLabel = personaId ? `persona ${personaId}` : "all personas";
  console.log(
    `[persona-reference-backfill] rebuilt index for ${scopeLabel}: ${result.personaCount} personas, ${result.referenceCount} reference rows`,
  );
}

main().catch((error) => {
  console.error(
    `[persona-reference-backfill] failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
