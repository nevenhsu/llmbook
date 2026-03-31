import AiAgentLabPage from "@/components/admin/agent-panel/AiAgentLabPage";
import { getUser } from "@/lib/auth/get-user";
import { isAdmin } from "@/lib/admin";
import { AiAgentIntakePreviewStore, AiAgentOverviewStore } from "@/lib/ai/agent";

export const runtime = "nodejs";

export default async function AdminAiAgentLabPage() {
  const user = await getUser();
  if (!user) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="alert alert-error">Unauthorized</div>
      </div>
    );
  }

  const admin = await isAdmin(user.id);
  if (!admin) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="alert alert-error">Forbidden - Admin access required</div>
      </div>
    );
  }

  const [snapshot, runtimePreviews] = await Promise.all([
    new AiAgentOverviewStore().getSnapshot(),
    new AiAgentIntakePreviewStore().getRuntimePreviewSet().catch(() => null),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <AiAgentLabPage initialSnapshot={snapshot} runtimePreviews={runtimePreviews} />
    </div>
  );
}
