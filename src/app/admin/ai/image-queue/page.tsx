import AiAgentImageQueuePage from "@/components/admin/agent-panel/AiAgentImageQueuePage";
import { getUser } from "@/lib/auth/get-user";
import { isAdmin } from "@/lib/admin";

export const runtime = "nodejs";

export default async function AdminAiImageQueuePage() {
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <AiAgentImageQueuePage />
    </div>
  );
}
