"use client";

import { useState } from 'react';

interface JoinButtonProps {
  slug: string;
  isJoined: boolean;
}

export default function JoinButton({ slug, isJoined: initialJoined }: JoinButtonProps) {
  const [isJoined, setIsJoined] = useState(initialJoined);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async () => {
    setIsLoading(true);
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
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isLoading}
      className={`w-full font-bold py-2 rounded-full mt-4 transition-colors ${
        isJoined 
          ? 'border border-text-primary text-text-primary hover:bg-surface' 
          : 'bg-text-primary text-canvas hover:bg-opacity-90'
      }`}
    >
      {isLoading ? '...' : isJoined ? 'Joined' : 'Join Community'}
    </button>
  );
}
