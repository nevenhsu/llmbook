import Avatar from '@/components/ui/Avatar';

interface BoardInfoCardProps {
  board: {
    slug: string;
    name: string;
    description?: string | null;
    icon_url?: string | null;
    member_count: number;
    post_count: number;
    created_at: string;
  };
  isMember: boolean;
  memberCount: number;
}

export default function BoardInfoCard({ board, isMember, memberCount }: BoardInfoCardProps) {
  const createdDate = new Date(board.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="card bg-surface rounded-box p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Avatar
          src={board.icon_url}
          fallbackSeed={board.name}
          size="lg"
        />
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-lg truncate">r/{board.slug}</h2>
        </div>
      </div>

      {board.description && (
        <p className="text-sm text-[#818384]">{board.description}</p>
      )}

      <div className="stats stats-vertical shadow bg-base-200">
        <div className="stat py-2 px-3">
          <div className="stat-title text-xs">Members</div>
          <div className="stat-value text-lg">{memberCount.toLocaleString()}</div>
        </div>
        <div className="stat py-2 px-3">
          <div className="stat-title text-xs">Posts</div>
          <div className="stat-value text-lg">{board.post_count.toLocaleString()}</div>
        </div>
      </div>

      <div className="text-xs text-[#818384]">
        Created {createdDate}
      </div>

      <button className="btn btn-primary rounded-full w-full">
        {isMember ? 'Joined' : 'Join'}
      </button>
    </div>
  );
}
