import toast from "react-hot-toast";
import { Copy } from "lucide-react";
import type { PersonaProfile } from "@/lib/ai/admin/control-plane-store";
import type { PersonaItem } from "@/lib/ai/admin/control-plane-types";
import Avatar from "@/components/ui/Avatar";

type Props = {
  persona: PersonaItem;
  profile: PersonaProfile | null;
  testIdPrefix?: string;
};

export function InteractionPreviewPersonaCard({
  persona,
  profile,
  testIdPrefix = "selected-persona",
}: Props) {
  const referenceSources = Array.isArray(profile?.personaCore?.reference_sources)
    ? (profile?.personaCore.reference_sources as Array<Record<string, unknown>>)
    : [];
  const referenceDerivation = Array.isArray(profile?.personaCore?.reference_derivation)
    ? (profile?.personaCore.reference_derivation as string[])
    : [];
  const copyPayload = JSON.stringify(
    {
      persona: {
        id: profile?.persona.id ?? persona.id,
        username: profile?.persona.username ?? persona.username,
        display_name: profile?.persona.display_name ?? persona.display_name,
        bio: profile?.persona.bio ?? null,
        status: profile?.persona.status ?? null,
      },
      reference_sources: referenceSources,
      reference_derivation: referenceDerivation,
    },
    null,
    2,
  );

  const copyPersonaData = async () => {
    try {
      await navigator.clipboard.writeText(copyPayload);
      toast.success("Persona data copied");
    } catch {
      toast.error("Failed to copy persona data");
    }
  };

  return (
    <div
      data-testid={`${testIdPrefix}-card`}
      className="bg-primary/5 border-primary/10 relative rounded-lg border p-3 text-xs"
    >
      <div className="absolute top-3 right-3">
        <button
          type="button"
          className="btn btn-ghost btn-xs btn-square"
          aria-label="Copy persona data JSON"
          onClick={() => void copyPersonaData()}
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
      <div data-testid={`${testIdPrefix}-identity`} className="flex items-center gap-3">
        <Avatar
          src={persona.avatar_url || undefined}
          fallbackSeed={persona.username}
          size="sm"
          isPersona
        />
        <div className="min-w-0 flex-1">
          <span className="text-base-content block truncate text-sm font-bold">
            {persona.display_name}
          </span>
          <span className="font-mono text-[11px] opacity-50">@{persona.username}</span>
        </div>
      </div>
      {referenceSources.length > 0 ? (
        <div
          data-testid={`${testIdPrefix}-reference-section`}
          className="border-base-300/70 mt-3 border-t pt-3"
        >
          <div className="text-[10px] font-semibold tracking-wide uppercase opacity-45">
            Reference Sources
          </div>
          <div className="mt-2 space-y-1.5">
            {referenceSources.slice(0, 3).map((source, index) => (
              <div
                key={`${String(source.name ?? "reference")}-${index}`}
                className="text-base-content/75 flex items-center gap-1.5 text-[11px]"
              >
                {String(source.name ?? "Unknown")}
                {typeof source.type === "string" && source.type.trim().length > 0 ? (
                  <span className="text-base-content/40">· {source.type}</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
