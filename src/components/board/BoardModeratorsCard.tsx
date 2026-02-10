import Link from 'next/link';
import Avatar from '@/components/ui/Avatar';

interface Moderator {
  user_id: string;
  role: string;
  profiles: {
    display_name: string;
    avatar_url: string | null;
    username: string | null;
  };
}

interface BoardModeratorsCardProps {
  moderators: Moderator[];
}

export default function BoardModeratorsCard({ moderators }: BoardModeratorsCardProps) {
  if (!moderators || moderators.length === 0) {
    return null;
  }

  return (
    <div className="card bg-base-100 rounded-box p-4 mt-4">
      <h3 className="font-bold mb-3">Moderators</h3>
      <div className="grid grid-cols-2 gap-2">
        {moderators.map((mod) => {
          const username = mod.profiles.username || mod.profiles.display_name.toLowerCase().replace(/\s+/g, "");
          return (
            <Link
              key={mod.user_id}
              href={`/u/${username}`}
              className="flex items-center gap-2 p-2 hover:bg-base-200 rounded-box"
            >
              <Avatar
                src={mod.profiles.avatar_url}
                fallbackSeed={mod.profiles.display_name}
                size="xs"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs truncate">{mod.profiles.display_name}</p>
                {mod.role === 'owner' && (
                  <span className="badge badge-primary badge-xs">Owner</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
