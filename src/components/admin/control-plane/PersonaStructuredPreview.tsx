"use client";

import type { ReactNode } from "react";
import type { PersonaGenerationStructured } from "@/lib/ai/admin/control-plane-store";

type Props = {
  structured: PersonaGenerationStructured;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is string => typeof item === "string" && item.trim().length > 0,
    );
  }
  return typeof value === "string" && value.trim().length > 0 ? [value] : [];
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asValueHierarchy(value: unknown): Array<{
  value: string;
  priority: number | null;
}> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const row = asRecord(item);
      const text = asText(row.value);
      if (!text) {
        return null;
      }
      return {
        value: text,
        priority: typeof row.priority === "number" ? row.priority : null,
      };
    })
    .filter((item): item is { value: string; priority: number | null } => item !== null);
}

function renderTagList(title: string, values: string[]) {
  if (values.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold tracking-wide uppercase opacity-55">{title}</div>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => (
          <span
            key={`${title}-${value}`}
            className="badge badge-outline border-base-300/70 px-3 py-3 text-xs"
          >
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}

function renderTextList(title: string, values: string[]) {
  if (values.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold tracking-wide uppercase opacity-55">{title}</div>
      <ul className="marker:text-base-content/45 list-disc space-y-2 pl-5">
        {values.map((value) => (
          <li key={`${title}-${value}`} className="text-sm leading-6 opacity-85">
            {value}
          </li>
        ))}
      </ul>
    </div>
  );
}

function splitCommaSeparatedItems(values: string[]): string[] {
  return values.flatMap((value) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="bg-base-100 border-base-300/70 rounded-xl border p-4">
      <div className="mb-4">
        <h4 className="text-sm font-semibold">{title}</h4>
        {description ? <p className="mt-1 text-xs opacity-60">{description}</p> : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function PersonaStructuredPreview({ structured }: Props) {
  const personaCore = asRecord(structured.persona_core);
  const identitySummary = asRecord(personaCore.identity_summary);
  const values = asRecord(personaCore.values);
  const aestheticProfile = asRecord(personaCore.aesthetic_profile);
  const livedContext = asRecord(personaCore.lived_context);
  const creatorAffinity = asRecord(personaCore.creator_affinity);
  const interactionDefaults = asRecord(personaCore.interaction_defaults);
  const guardrails = asRecord(personaCore.guardrails);
  const valueHierarchy = asValueHierarchy(values.value_hierarchy);

  return (
    <div className="space-y-4">
      <section className="from-base-200 via-base-100 to-base-200 border-base-300/70 rounded-2xl border bg-gradient-to-br p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="text-xl font-semibold">{structured.personas.display_name}</div>
            <p className="max-w-3xl text-sm leading-6 opacity-80">{structured.personas.bio}</p>
          </div>
          <span
            className={`badge px-3 py-3 text-xs font-semibold ${
              structured.personas.status === "active" ? "badge-success" : "badge-ghost"
            }`}
          >
            {structured.personas.status}
          </span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="bg-base-100/70 rounded-xl p-4">
            <div className="text-xs font-semibold tracking-wide uppercase opacity-55">
              Archetype
            </div>
            <div className="mt-2 text-sm font-medium">
              {asText(identitySummary.archetype) ?? "—"}
            </div>
          </div>
          <div className="bg-base-100/70 rounded-xl p-4 md:col-span-2">
            <div className="text-xs font-semibold tracking-wide uppercase opacity-55">
              Core Motivation
            </div>
            <div className="mt-2 text-sm">{asText(identitySummary.core_motivation) ?? "—"}</div>
          </div>
          <div className="bg-base-100/70 rounded-xl p-4 md:col-span-3">
            <div className="text-xs font-semibold tracking-wide uppercase opacity-55">
              One-Sentence Identity
            </div>
            <div className="mt-2 text-sm leading-6">
              {asText(identitySummary.one_sentence_identity) ?? "—"}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Values" description="Priority order, worldview, and judgment style.">
          {valueHierarchy.length > 0 ? (
            <ol className="space-y-2">
              {valueHierarchy.map((item) => (
                <li
                  key={`${item.priority ?? "na"}-${item.value}`}
                  className="bg-base-200/50 flex items-center gap-3 rounded-lg px-3 py-2"
                >
                  <span className="bg-base-100 border-base-300/70 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold">
                    {item.priority ?? "?"}
                  </span>
                  <span className="text-sm">{item.value}</span>
                </li>
              ))}
            </ol>
          ) : null}
          {renderTextList("Worldview", asStringArray(values.worldview))}
          <div className="space-y-2">
            <div className="text-xs font-semibold tracking-wide uppercase opacity-55">
              Judgment Style
            </div>
            <p className="text-sm leading-6">{asText(values.judgment_style) ?? "—"}</p>
          </div>
        </SectionCard>

        <SectionCard
          title="Aesthetic Profile"
          description="Humor, narrative taste, preferred creative patterns, and dislikes."
        >
          {renderTextList("Humor Preferences", asStringArray(aestheticProfile.humor_preferences))}
          {renderTextList(
            "Narrative Preferences",
            asStringArray(aestheticProfile.narrative_preferences),
          )}
          {renderTextList(
            "Creative Preferences",
            asStringArray(aestheticProfile.creative_preferences),
          )}
          {renderTextList("Disliked Patterns", asStringArray(aestheticProfile.disliked_patterns))}
          {renderTextList("Taste Boundaries", asStringArray(aestheticProfile.taste_boundaries))}
        </SectionCard>

        <SectionCard
          title="Lived Context"
          description="What this persona knows from experience versus what still needs retrieval."
        >
          {renderTagList("Familiar Scenes", asStringArray(livedContext.familiar_scenes_of_life))}
          {renderTagList(
            "Experience Flavors",
            asStringArray(livedContext.personal_experience_flavors),
          )}
          {renderTagList("Cultural Contexts", asStringArray(livedContext.cultural_contexts))}
          {renderTagList(
            "Confident Grounding",
            asStringArray(livedContext.topics_with_confident_grounding),
          )}
          {renderTagList(
            "Needs Runtime Retrieval",
            asStringArray(livedContext.topics_requiring_runtime_retrieval),
          )}
        </SectionCard>

        <SectionCard
          title="Creator Affinity"
          description="What kinds of creators, structures, and details this persona leans toward."
        >
          {renderTagList(
            "Admired Creator Types",
            asStringArray(creatorAffinity.admired_creator_types),
          )}
          {renderTagList(
            "Structural Preferences",
            asStringArray(creatorAffinity.structural_preferences),
          )}
          {renderTagList(
            "Detail Selection Habits",
            asStringArray(creatorAffinity.detail_selection_habits),
          )}
          {renderTagList("Creative Biases", asStringArray(creatorAffinity.creative_biases))}
        </SectionCard>

        <SectionCard
          title="Interaction Defaults"
          description="How this persona tends to behave inside a discussion."
        >
          <div className="space-y-2">
            <div className="text-xs font-semibold tracking-wide uppercase opacity-55">
              Default Stance
            </div>
            <p className="text-sm leading-6">{asText(interactionDefaults.default_stance) ?? "—"}</p>
          </div>
          {renderTextList(
            "Discussion Strengths",
            asStringArray(interactionDefaults.discussion_strengths),
          )}
          {renderTextList(
            "Friction Triggers",
            asStringArray(interactionDefaults.friction_triggers),
          )}
          {renderTextList(
            "Non-Generic Traits",
            asStringArray(interactionDefaults.non_generic_traits),
          )}
        </SectionCard>

        <SectionCard
          title="Guardrails"
          description="Hard limits and how this persona de-escalates."
        >
          {renderTextList("Hard No", asStringArray(guardrails.hard_no))}
          {renderTextList(
            "De-escalation Style",
            splitCommaSeparatedItems(asStringArray(guardrails.deescalation_style)),
          )}
        </SectionCard>
      </div>

      <SectionCard
        title={`Reference Sources (${structured.reference_sources.length})`}
        description="Named influences with the specific contribution each one adds."
      >
        <div className="space-y-3">
          {structured.reference_sources.map((source) => (
            <div key={`${source.type}-${source.name}`} className="bg-base-200/50 rounded-xl p-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-medium">{source.name}</div>
                <span className="badge badge-outline border-base-300/70 text-[11px]">
                  {source.type}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <ul className="w-full space-y-2">
                  {source.contribution.map((item) => (
                    <li key={`${source.name}-${item}`} className="text-sm leading-6 opacity-85">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Reference Derivation"
        description="How the named references were transformed into this persona."
      >
        <div className="space-y-2">
          {structured.reference_derivation.map((item, index) => (
            <div key={`${index}-${item}`} className="bg-base-200/50 rounded-lg px-3 py-2 text-sm">
              {item}
            </div>
          ))}
        </div>
        <div className="space-y-2 pt-2">
          <div className="text-xs font-semibold tracking-wide uppercase opacity-55">
            Originalization Note
          </div>
          <p className="text-sm leading-6">{structured.originalization_note}</p>
        </div>
      </SectionCard>

      <SectionCard
        title={`Persona Memories (${structured.persona_memories.length})`}
        description="Canonical and recent memories that can influence later generation."
      >
        <div className="space-y-3">
          {structured.persona_memories.map((memory, index) => (
            <div
              key={`${memory.memory_key ?? "memory"}-${index}`}
              className="bg-base-200/50 rounded-xl p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-mono text-xs opacity-70">
                  {memory.memory_key ?? `memory_${index + 1}`}
                </div>
                <span className="badge badge-outline border-base-300/70 text-[11px]">
                  {memory.memory_type}
                </span>
                <span className="badge badge-outline border-base-300/70 text-[11px]">
                  scope: {memory.scope}
                </span>
                {memory.is_canonical ? (
                  <span className="badge badge-outline border-base-300/70 text-[11px]">
                    canonical
                  </span>
                ) : null}
                {typeof memory.importance === "number" ? (
                  <span className="badge badge-outline border-base-300/70 text-[11px]">
                    importance: {memory.importance}
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-sm leading-6">{memory.content}</p>
              {Object.keys(memory.metadata).length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(memory.metadata).map(([key, value]) => (
                    <span
                      key={`${memory.memory_key ?? index}-${key}`}
                      className="badge badge-outline px-3 py-3 text-xs"
                    >
                      {key}: {String(value)}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="collapse-arrow bg-base-100 border-base-300/70 collapse rounded-xl border">
        <input type="checkbox" />
        <div className="collapse-title text-sm font-semibold">View Raw JSON</div>
        <div className="collapse-content">
          <pre className="bg-base-200 max-h-[32rem] overflow-auto rounded-lg p-3 text-xs whitespace-pre-wrap">
            {JSON.stringify(structured, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
