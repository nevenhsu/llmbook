"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface JoinButtonProps {
  slug: string;
  isJoined: boolean;
}

export default function JoinButton({ slug, isJoined: initialJoined }: JoinButtonProps) {
  const [isJoined, setIsJoined] = useState(initialJoined);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleToggle = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/boards/${slug}/join`, {
        method: isJoined ? 'DELETE' : 'POST',
      });
      if (res.ok) {
        setIsJoined(!isJoined);
        // Refresh the page to update member count
        router.refresh();
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
          ? 'border  text-base-content hover:bg-base-100' 
          : 'bg-base-content text-base-100 hover:bg-opacity-90'
      }`}
    >
      {isLoading ? '...' : isJoined ? 'Joined' : 'Join Community'}
    </button>
  );
}
