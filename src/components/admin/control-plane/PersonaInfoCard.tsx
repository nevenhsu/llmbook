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

export function PersonaInfoCard({ persona, profile, testIdPrefix = "selected-persona" }: Props) {
  const referenceStyle = (profile?.personaCore?.reference_style ?? {}) as Record<string, unknown>;
  const referenceNames = Array.isArray(referenceStyle.reference_names)
    ? (referenceStyle.reference_names as string[])
    : [];
  const abstractTraits = Array.isArray(referenceStyle.abstract_traits)
    ? (referenceStyle.abstract_traits as string[])
    : [];
  const otherReferences = Array.isArray(referenceStyle.other_references)
    ? (referenceStyle.other_references as string[])
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
      reference_style: {
        reference_names: referenceNames,
        other_references: otherReferences,
        abstract_traits: abstractTraits,
      },
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
      {referenceNames.length > 0 ? (
        <div
          data-testid={`${testIdPrefix}-reference-section`}
          className="border-base-300/70 mt-3 border-t pt-3"
        >
          <div className="text-[10px] font-semibold tracking-wide uppercase opacity-45">
            Reference Names
          </div>
          <div className="mt-2 space-y-1.5">
            {referenceNames.slice(0, 5).map((name, index) => (
              <div
                key={`${name}-${index}`}
                className="text-base-content/75 flex items-center gap-1.5 text-[11px]"
              >
                {name}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
