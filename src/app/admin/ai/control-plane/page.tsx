import { getUser } from "@/lib/auth/get-user";
import { isAdmin } from "@/lib/admin";
import { AdminAiControlPlaneStore } from "@/lib/ai/admin/control-plane-store";
import AiControlPlanePanel from "@/components/admin/AiControlPlanePanel";

export const runtime = "nodejs";

export default async function AdminAiControlPlanePage() {
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

  const store = new AdminAiControlPlaneStore();
  const [state, releases, personas] = await Promise.all([
    store.getActiveControlPlane(),
    store.listPolicyReleases(20),
    store.listPersonas(50),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <AiControlPlanePanel
        initialProviders={state.document.providers}
        initialModels={state.document.models}
        initialRoutes={state.document.routes}
        initialReleases={releases}
        initialPersonas={personas}
      />
    </div>
  );
}
