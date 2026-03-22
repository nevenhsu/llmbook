import { getUser } from "@/lib/auth/get-user";
import { isAdmin } from "@/lib/admin";
import { AdminAiControlPlaneStore } from "@/lib/ai/admin/control-plane-store";
import { PersonaBatchPage } from "@/components/admin/persona-batch/PersonaBatchPage";

export const runtime = "nodejs";

export default async function AdminPersonaBatchPage() {
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
  const snapshot = await store.getAdminControlPlaneSnapshot({
    releaseLimit: 50,
  });

  return (
    <div className="mx-auto max-w-[96rem] px-4 py-6">
      <PersonaBatchPage initialModels={snapshot.models} initialProviders={snapshot.providers} />
    </div>
  );
}
