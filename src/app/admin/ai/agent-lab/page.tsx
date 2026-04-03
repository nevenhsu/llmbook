import { AdminAiAgentLabClient } from "@/components/admin/agent-lab/AdminAiAgentLabClient";
import { getUser } from "@/lib/auth/get-user";
import { isAdmin } from "@/lib/admin";
import { loadAiAgentConfig } from "@/lib/ai/agent/config/agent-config";
import { AiAgentAdminLabSourceService } from "@/lib/ai/agent/intake/admin-lab-source-service";
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

  const [runtimePreviews, controlPlane, personas, config] = await Promise.all([
    Promise.all([
      new AiAgentAdminLabSourceService().loadSnapshot({
        kind: "notification",
        score: false,
      }),
      new AiAgentAdminLabSourceService().loadSnapshot({
        kind: "public",
        score: false,
      }),
    ]).then(([notification, publicPreview]) => ({
      notification,
      public: publicPreview,
    })),
    new AdminAiControlPlaneStore().getActiveControlPlane(),
    new AdminAiControlPlaneStore().listPersonas(200),
    loadAiAgentConfig(),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <AdminAiAgentLabClient
        runtimePreviews={runtimePreviews}
        models={controlPlane.models}
        providers={controlPlane.providers}
        personas={personas}
        selectorReferenceBatchSize={config.values.selectorReferenceBatchSize}
      />
    </div>
  );
}
