import { isAdmin } from "@/lib/admin";
import { AiAgentTaskInjectionService } from "@/lib/ai/agent/intake/task-injection-service";
import type { TaskCandidatePreview } from "@/lib/ai/agent/intake/intake-preview";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, http, parseJsonBody } from "@/lib/server/route-helpers";

type SaveTaskBody = {
  candidates?: TaskCandidatePreview[];
};

async function incrementMatchedPersonaCounts(input: {
  candidates: TaskCandidatePreview[];
  insertedCandidateIndexes: number[];
}) {
  const increments = new Map<
    string,
    { sourceTable: string; sourceId: string; personaIds: Set<string> }
  >();

  for (const candidate of input.candidates) {
    if (
      !input.insertedCandidateIndexes.includes(candidate.candidateIndex) ||
      candidate.dispatchKind !== "public"
    ) {
      continue;
    }

    const key = `${candidate.sourceTable}:${candidate.sourceId}`;
    const current = increments.get(key);
    if (current) {
      current.personaIds.add(candidate.personaId);
      continue;
    }

    increments.set(key, {
      sourceTable: candidate.sourceTable,
      sourceId: candidate.sourceId,
      personaIds: new Set([candidate.personaId]),
    });
  }

  if (increments.size === 0) {
    return;
  }

  const supabase = createAdminClient();
  for (const increment of increments.values()) {
    const { data, error } = await supabase
      .from("ai_opps")
      .select("id, matched_persona_count")
      .eq("kind", "public")
      .eq("source_table", increment.sourceTable)
      .eq("source_id", increment.sourceId)
      .maybeSingle<{ id: string; matched_persona_count: number }>();

    if (error) {
      throw new Error(`load ai_opps matched_persona_count failed: ${error.message}`);
    }
    if (!data) {
      continue;
    }

    const { error: updateError } = await supabase
      .from("ai_opps")
      .update({
        matched_persona_count: data.matched_persona_count + increment.personaIds.size,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);

    if (updateError) {
      throw new Error(`update ai_opps matched_persona_count failed: ${updateError.message}`);
    }
  }
}

export const POST = withAuth(async (req, { user }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const body = await parseJsonBody<SaveTaskBody>(req);
  if ("status" in body) {
    return body;
  }

  const candidates = Array.isArray(body.candidates) ? body.candidates : [];

  if (candidates.length === 0) {
    return http.badRequest("candidates is required");
  }

  const result = await new AiAgentTaskInjectionService().executeCandidates({
    candidates,
  });
  await incrementMatchedPersonaCounts({
    candidates,
    insertedCandidateIndexes: result.injectionPreview.results
      .filter((row) => row.inserted)
      .map((row) => row.candidateIndex),
  });

  return http.ok(result);
});
