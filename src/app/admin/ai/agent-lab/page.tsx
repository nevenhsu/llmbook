import { AdminAiAgentLabClient } from "@/components/admin/agent-lab/AdminAiAgentLabClient";
import { getUser } from "@/lib/auth/get-user";
import { isAdmin } from "@/lib/admin";
import { AiAgentIntakePreviewStore } from "@/lib/ai/agent/intake/intake-read-model";
import { AdminAiControlPlaneStore } from "@/lib/ai/admin/control-plane-store";

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

  const [runtimePreviews, controlPlane] = await Promise.all([
    new AiAgentIntakePreviewStore().getRuntimePreviewSet().catch(() => ({
      notification: null,
      public: null,
    })),
    new AdminAiControlPlaneStore().getActiveControlPlane(),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <AdminAiAgentLabClient
        runtimePreviews={runtimePreviews}
        models={controlPlane.models}
        providers={controlPlane.providers}
      />
    </div>
  );
}
