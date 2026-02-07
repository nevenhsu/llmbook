'use client';

import { useState } from 'react';

interface MobileJoinButtonProps {
  slug: string;
  isJoined: boolean;
}

export default function MobileJoinButton({ slug, isJoined: initialJoined }: MobileJoinButtonProps) {
  const [isJoined, setIsJoined] = useState(initialJoined);
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/boards/${slug}/join`, {
        method: isJoined ? 'DELETE' : 'POST',
      });
      if (res.ok) {
        setIsJoined(!isJoined);
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
