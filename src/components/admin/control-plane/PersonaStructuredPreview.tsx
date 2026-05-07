"use client";

import toast from "react-hot-toast";
import { Copy } from "lucide-react";
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

function renderTextBlock(title: string, value: unknown) {
  const text = asText(value);
  if (!text) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold tracking-wide uppercase opacity-55">{title}</div>
      <p className="text-sm leading-6">{text}</p>
    </div>
  );
}

function splitCommaSeparatedItems(values: string[]): string[] {
  return values.flatMap((value) =>
    value
      .split(",")
      .map((item, index) => {
        const trimmed = item.trim();
        if (index === 0) {
          return trimmed;
        }
        return trimmed.replace(/^(and|or)\s+/i, "");
      })
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
  const isV2 = personaCore.schema_version === "v2";
  const rawJson = JSON.stringify(structured, null, 2);

  const copyRawJson = async () => {
    try {
      await navigator.clipboard.writeText(rawJson);
      toast.success("Raw JSON copied");
    } catch {
      toast.error("Failed to copy raw JSON");
    }
  };

  return (
    <div className="space-y-4">
      <section className="from-base-200 via-base-100 to-base-200 border-base-300/70 rounded-2xl border bg-gradient-to-br p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="text-xl font-semibold">{structured.persona.display_name}</div>
            <p className="max-w-3xl text-sm leading-6 opacity-80">{structured.persona.bio}</p>
          </div>
          <span
            className={`badge px-3 py-3 text-xs font-semibold ${
              structured.persona.status === "active" ? "badge-success" : "badge-ghost"
            }`}
          >
            {structured.persona.status}
          </span>
        </div>

        {isV2 ? (
          <V2IdentitySection personaCore={personaCore} />
        ) : (
          <V1IdentitySection personaCore={personaCore} />
        )}
      </section>

      <div className="space-y-4">
        {isV2 ? (
          <V2CoreSections personaCore={personaCore} />
        ) : (
          <V1CoreSections personaCore={personaCore} />
        )}
      </div>

      <RefSourcesSection structured={structured} />

      <div className="collapse-arrow bg-base-100 border-base-300/70 collapse relative rounded-xl border">
        <input type="checkbox" />
        <div className="collapse-title pr-14 text-sm font-semibold">View Raw JSON</div>
        <div className="absolute top-3 right-9 z-10">
          <button
            type="button"
            className="btn btn-ghost btn-xs btn-square"
            aria-label="Copy raw JSON"
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void copyRawJson();
            }}
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="collapse-content">
          <pre className="bg-base-200 max-h-[32rem] overflow-auto rounded-lg p-3 text-xs whitespace-pre-wrap">
            {rawJson}
          </pre>
        </div>
      </div>
    </div>
  );
}

function V2IdentitySection({ personaCore }: { personaCore: Record<string, unknown> }) {
  const identity = asRecord(personaCore.identity);

  return (
    <div className="mt-5 space-y-3">
      <div className="bg-base-100/70 rounded-xl p-4">
        <div className="text-xs font-semibold tracking-wide uppercase opacity-55">Archetype</div>
        <div className="mt-2 text-sm font-medium">{asText(identity.archetype) ?? "—"}</div>
      </div>
      <div className="bg-base-100/70 rounded-xl p-4">
        <div className="text-xs font-semibold tracking-wide uppercase opacity-55">Core Drive</div>
        <div className="mt-2 text-sm">{asText(identity.core_drive) ?? "—"}</div>
      </div>
      <div className="bg-base-100/70 rounded-xl p-4">
        <div className="text-xs font-semibold tracking-wide uppercase opacity-55">
          Central Tension
        </div>
        <div className="mt-2 text-sm">{asText(identity.central_tension) ?? "—"}</div>
      </div>
      <div className="bg-base-100/70 rounded-xl p-4">
        <div className="text-xs font-semibold tracking-wide uppercase opacity-55">Self Image</div>
        <div className="mt-2 text-sm">{asText(identity.self_image) ?? "—"}</div>
      </div>
    </div>
  );
}

function V1IdentitySection({ personaCore }: { personaCore: Record<string, unknown> }) {
  const identitySummary = asRecord(personaCore.identity_summary);

  return (
    <div className="mt-5 space-y-3">
      <div className="bg-base-100/70 rounded-xl p-4">
        <div className="text-xs font-semibold tracking-wide uppercase opacity-55">Archetype</div>
        <div className="mt-2 text-sm font-medium">{asText(identitySummary.archetype) ?? "—"}</div>
      </div>
      <div className="bg-base-100/70 rounded-xl p-4">
        <div className="text-xs font-semibold tracking-wide uppercase opacity-55">
          Core Motivation
        </div>
        <div className="mt-2 text-sm">{asText(identitySummary.core_motivation) ?? "—"}</div>
      </div>
      <div className="bg-base-100/70 rounded-xl p-4">
        <div className="text-xs font-semibold tracking-wide uppercase opacity-55">
          One-Sentence Identity
        </div>
        <div className="mt-2 text-sm leading-6">
          {asText(identitySummary.one_sentence_identity) ?? "—"}
        </div>
      </div>
    </div>
  );
}

function V2CoreSections({ personaCore }: { personaCore: Record<string, unknown> }) {
  const mind = asRecord(personaCore.mind);
  const tp = asRecord(mind.thinking_procedure);
  const taste = asRecord(personaCore.taste);
  const voice = asRecord(personaCore.voice);
  const forum = asRecord(personaCore.forum);
  const narrative = asRecord(personaCore.narrative);
  const refStyle = asRecord(personaCore.reference_style);
  const antiGeneric = asRecord(personaCore.anti_generic);
  const forumLengths = asRecord(forum.typical_lengths);

  return (
    <>
      <SectionCard
        title="Mind"
        description="Reasoning style, attention biases, and thinking procedure."
      >
        {renderTextBlock("Reasoning Style", mind.reasoning_style)}
        {renderTagList("Attention Biases", asStringArray(mind.attention_biases))}
        {renderTagList("Default Assumptions", asStringArray(mind.default_assumptions))}
        {renderTagList("Blind Spots", asStringArray(mind.blind_spots))}
        {renderTextBlock("Disagreement Style", mind.disagreement_style)}
        {tp ? (
          <div className="space-y-3">
            <div className="text-xs font-semibold tracking-wide uppercase opacity-55">
              Thinking Procedure
            </div>
            {renderTextList("Context Reading", asStringArray(tp.context_reading))}
            {renderTextList("Salience Rules", asStringArray(tp.salience_rules))}
            {renderTextList("Interpretation Moves", asStringArray(tp.interpretation_moves))}
            {renderTextList("Response Moves", asStringArray(tp.response_moves))}
            {renderTextList("Omission Rules", asStringArray(tp.omission_rules))}
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Taste"
        description="Values, respects, dismissals, and recurring obsessions."
      >
        {renderTagList("Values", asStringArray(taste.values))}
        {renderTagList("Respects", asStringArray(taste.respects))}
        {renderTagList("Dismisses", asStringArray(taste.dismisses))}
        {renderTagList("Recurring Obsessions", asStringArray(taste.recurring_obsessions))}
      </SectionCard>

      <SectionCard
        title="Voice"
        description="Register, rhythm, habits, humor, and forbidden phrases."
      >
        {renderTextBlock("Register", voice.register)}
        <div className="space-y-2">
          <div className="text-xs font-semibold tracking-wide uppercase opacity-55">Rhythm</div>
          <p className="text-sm">{asText(voice.rhythm) ?? "—"}</p>
        </div>
        {renderTagList("Opening Habits", asStringArray(voice.opening_habits))}
        {renderTagList("Closing Habits", asStringArray(voice.closing_habits))}
        {renderTextBlock("Humor Style", voice.humor_style)}
        {renderTagList("Metaphor Domains", asStringArray(voice.metaphor_domains))}
        {renderTagList("Forbidden Phrases", asStringArray(voice.forbidden_phrases))}
      </SectionCard>

      <SectionCard
        title="Forum"
        description="Participation mode, preferred intents, and typical lengths."
      >
        {renderTextBlock("Participation Mode", forum.participation_mode)}
        {renderTagList("Post Intents", asStringArray(forum.preferred_post_intents))}
        {renderTagList("Comment Intents", asStringArray(forum.preferred_comment_intents))}
        {renderTagList("Reply Intents", asStringArray(forum.preferred_reply_intents))}
        <div className="flex gap-4">
          <span className="text-xs">
            Post: <strong>{asText(forumLengths.post) ?? "—"}</strong>
          </span>
          <span className="text-xs">
            Comment: <strong>{asText(forumLengths.comment) ?? "—"}</strong>
          </span>
          <span className="text-xs">
            Reply: <strong>{asText(forumLengths.reply) ?? "—"}</strong>
          </span>
        </div>
      </SectionCard>

      <SectionCard
        title="Narrative"
        description="Story engine, conflicts, characters, scene details, and endings."
      >
        {renderTextBlock("Story Engine", narrative.story_engine)}
        {renderTagList("Favored Conflicts", asStringArray(narrative.favored_conflicts))}
        {renderTagList("Character Focus", asStringArray(narrative.character_focus))}
        {renderTagList("Emotional Palette", asStringArray(narrative.emotional_palette))}
        {renderTagList("Plot Instincts", asStringArray(narrative.plot_instincts))}
        {renderTagList("Scene Detail Biases", asStringArray(narrative.scene_detail_biases))}
        {renderTagList("Ending Preferences", asStringArray(narrative.ending_preferences))}
        {renderTagList("Avoid Story Shapes", asStringArray(narrative.avoid_story_shapes))}
      </SectionCard>

      <SectionCard
        title="Reference Style"
        description="Reference names and abstract traits (non-imitation)."
      >
        {renderTagList("Reference Names", asStringArray(refStyle.reference_names))}
        {renderTagList("Abstract Traits", asStringArray(refStyle.abstract_traits))}
        <div className="text-xs opacity-60">
          do_not_imitate: <strong>{String(refStyle.do_not_imitate)}</strong>
        </div>
      </SectionCard>

      <SectionCard title="Anti-Generic" description="Patterns to avoid and failure mode.">
        {renderTagList("Avoid Patterns", asStringArray(antiGeneric.avoid_patterns))}
        {renderTextBlock("Failure Mode", antiGeneric.failure_mode)}
      </SectionCard>
    </>
  );
}

function V1CoreSections({ personaCore }: { personaCore: Record<string, unknown> }) {
  const identitySummary = asRecord(personaCore.identity_summary);
  const values = asRecord(personaCore.values);
  const aestheticProfile = asRecord(personaCore.aesthetic_profile);
  const livedContext = asRecord(personaCore.lived_context);
  const creatorAffinity = asRecord(personaCore.creator_affinity);
  const interactionDefaults = asRecord(personaCore.interaction_defaults);
  const guardrails = asRecord(personaCore.guardrails);
  const voiceFingerprint = asRecord(personaCore.voice_fingerprint);
  const taskStyleMatrix = asRecord(personaCore.task_style_matrix);
  const postStyle = asRecord(taskStyleMatrix.post);
  const commentStyle = asRecord(taskStyleMatrix.comment);
  const valueHierarchy = asValueHierarchy(values.value_hierarchy);

  return (
    <>
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
        {renderTextList("Friction Triggers", asStringArray(interactionDefaults.friction_triggers))}
        {renderTextList(
          "Non-Generic Traits",
          asStringArray(interactionDefaults.non_generic_traits),
        )}
      </SectionCard>

      <SectionCard title="Guardrails" description="Hard limits and how this persona de-escalates.">
        {renderTextList("Hard No", asStringArray(guardrails.hard_no))}
        {renderTextList(
          "De-escalation Style",
          splitCommaSeparatedItems(asStringArray(guardrails.deescalation_style)),
        )}
      </SectionCard>

      <SectionCard
        title="Voice Fingerprint"
        description="How this persona tends to open, attack, praise, and close."
      >
        {renderTextBlock("Opening Move", voiceFingerprint.opening_move)}
        {renderTagList("Metaphor Domains", asStringArray(voiceFingerprint.metaphor_domains))}
        {renderTextBlock("Attack Style", voiceFingerprint.attack_style)}
        {renderTextBlock("Praise Style", voiceFingerprint.praise_style)}
        {renderTextBlock("Closing Move", voiceFingerprint.closing_move)}
        {renderTextList("Forbidden Shapes", asStringArray(voiceFingerprint.forbidden_shapes))}
      </SectionCard>

      <SectionCard
        title="Task Style Matrix"
        description="How this persona should shape posts versus comments."
      >
        <div className="space-y-4">
          <div className="bg-base-200/40 space-y-4 rounded-xl p-4">
            <div className="text-sm font-semibold">Post</div>
            {renderTextBlock("Entry Shape", postStyle.entry_shape)}
            {renderTextBlock("Body Shape", postStyle.body_shape)}
            {renderTextBlock("Close Shape", postStyle.close_shape)}
            {renderTextList("Forbidden Shapes", asStringArray(postStyle.forbidden_shapes))}
          </div>
          <div className="bg-base-200/40 space-y-4 rounded-xl p-4">
            <div className="text-sm font-semibold">Comment</div>
            {renderTextBlock("Entry Shape", commentStyle.entry_shape)}
            {renderTextBlock("Feedback Shape", commentStyle.feedback_shape)}
            {renderTextBlock("Close Shape", commentStyle.close_shape)}
            {renderTextList("Forbidden Shapes", asStringArray(commentStyle.forbidden_shapes))}
          </div>
        </div>
      </SectionCard>
    </>
  );
}

function RefSourcesSection({ structured }: { structured: PersonaGenerationStructured }) {
  return (
    <>
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
        title={`Other Reference Sources (${structured.other_reference_sources.length})`}
        description="Non-personality references such as works, concepts, methods, or principles."
      >
        {structured.other_reference_sources.length > 0 ? (
          <div className="space-y-3">
            {structured.other_reference_sources.map((source) => (
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
        ) : (
          <div className="text-sm opacity-60">No additional non-personality references.</div>
        )}
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
    </>
  );
}
