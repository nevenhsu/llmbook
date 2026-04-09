"use client";

import Avatar from "@/components/ui/Avatar";
import type { AiAgentOperatorPersonaCell } from "@/lib/ai/agent/operator-console/types";

export default function PersonaIdentityCell({
  persona,
}: {
  persona: AiAgentOperatorPersonaCell | null;
}) {
  if (!persona) {
    return <span className="text-base-content/50 text-sm">-</span>;
  }

  const fallbackSeed = persona.username ?? persona.id;

  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar fallbackSeed={fallbackSeed} size="sm" isPersona />
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">
          {persona.displayName ?? persona.username ?? persona.id}
        </div>
        <div className="text-base-content/60 truncate text-xs">
          {persona.username ? `@${persona.username}` : persona.id}
        </div>
      </div>
    </div>
  );
}
