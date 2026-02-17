import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/get-user";
import CreateBoardForm from "@/components/board/CreateBoardForm";

export default async function CreateBoardPage() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto w-full max-w-[600px] px-4 py-6 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold">Create a Board</h1>
      <CreateBoardForm />
    </div>
  );
}
