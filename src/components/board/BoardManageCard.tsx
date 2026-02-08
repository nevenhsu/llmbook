import Link from 'next/link';

interface BoardManageCardProps {
  slug: string;
}

export default function BoardManageCard({ slug }: BoardManageCardProps) {
  return (
    <div className="card bg-surface rounded-box p-4 mt-4 space-y-3">
      <h3 className="font-bold mb-3">Board Management</h3>
      <div className="flex flex-col gap-2">
        <Link
          href={`/r/${slug}/settings`}
          className="rounded-box bg-base-200 px-3 py-2 text-sm font-medium hover:bg-base-100 transition-colors"
        >
          Board Settings
        </Link>
      </div>
    </div>
  );
}
