import AiAgentPanel from "@/components/admin/agent-panel/AiAgentPanel";
import { getUser } from "@/lib/auth/get-user";
import { isAdmin } from "@/lib/admin";
import {
  AiAgentIntakePreviewStore,
  AiAgentMemoryPreviewStore,
  AiAgentOverviewStore,
} from "@/lib/ai/agent";

export const runtime = "nodejs";

export default async function AdminAiAgentPanelPage() {
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

  const [snapshot, runtimePreviews, runtimeMemoryPreviews] = await Promise.all([
    new AiAgentOverviewStore().getSnapshot(),
    new AiAgentIntakePreviewStore().getRuntimePreviewSet().catch(() => null),
    new AiAgentMemoryPreviewStore().getRuntimePreviewSet().catch(() => null),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <AiAgentPanel
        initialSnapshot={snapshot}
        runtimePreviews={runtimePreviews}
        runtimeMemoryPreviews={runtimeMemoryPreviews}
      />
    </div>
  );
}
