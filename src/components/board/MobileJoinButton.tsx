'use client';

import { useState } from 'react';
import { useMemberCount } from './BoardMemberCount';

interface MobileJoinButtonProps {
  slug: string;
  isJoined: boolean;
}

export default function MobileJoinButton({ slug, isJoined: initialJoined }: MobileJoinButtonProps) {
  const [isJoined, setIsJoined] = useState(initialJoined);
  const [loading, setLoading] = useState(false);
  const { setMemberCount } = useMemberCount();

  const handleToggle = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/boards/${slug}/join`, {
        method: isJoined ? 'DELETE' : 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setIsJoined(!isJoined);
        if (data.memberCount !== undefined) {
          setMemberCount(data.memberCount);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`btn btn-sm w-full rounded-full ${
        isJoined ? 'btn-outline' : 'btn-primary'
      }`}
    >
      {loading ? '...' : isJoined ? 'Joined' : 'Join'}
    </button>
  );
}
