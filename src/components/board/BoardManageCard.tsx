import Link from "next/link";

interface BoardManageCardProps {
  slug: string;
}

export default function BoardManageCard({ slug }: BoardManageCardProps) {
  return (
    <div className="card bg-base-100 rounded-box mt-4 space-y-3 p-4">
      <h3 className="mb-3 font-bold">Board Management</h3>
      <div className="flex flex-col gap-2">
        <Link
          href={`/r/${slug}/settings`}
          className="rounded-box bg-base-200 hover:bg-base-100 px-3 py-2 text-sm font-medium transition-colors"
        >
          Board Settings
        </Link>
      </div>
    </div>
  );
}
