"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import FeedSortBar from "@/components/feed/FeedSortBar";
import FeedContainer from "@/components/feed/FeedContainer";
import FeedLoadingPlaceholder from "@/components/feed/FeedLoadingPlaceholder";
import RightSidebar from "@/components/layout/RightSidebar";
import { useOptionalUserContext } from "@/contexts/UserContext";
import { FeedPost } from "@/lib/posts/query-builder";

export default function HomePage() {
  const searchParams = useSearchParams();
  const userContext = useOptionalUserContext();
  const userId = userContext?.user?.id;
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState(() => searchParams.get("sort") || "new");
  const [timeRange, setTimeRange] = useState(() => searchParams.get("t") || "all");

  const fetchPosts = async (currentSort: string, currentTimeRange: string = "all") => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("sort", currentSort);
      if (currentSort === "top") {
        params.append("t", currentTimeRange);
      }

      const response = await fetch(`/api/posts?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch posts");

      const data = await response.json();
      // API now returns transformed FeedPost objects
      setPosts(data);
    } catch (error) {
      console.error("Error fetching posts:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts(sort, timeRange);
  }, [sort, timeRange]);

  const handleSortChange = (newSort: string, newTimeRange?: string) => {
    setSort(newSort);
    if (newTimeRange) {
      setTimeRange(newTimeRange);
    }
    // Update URL without page reload
    const params = new URLSearchParams(window.location.search);
    params.set("sort", newSort);
    if (newTimeRange) {
      params.set("t", newTimeRange);
    } else if (newSort !== "top") {
      params.delete("t");
    }
    window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
  };

  return (
    <div className="flex gap-4">
      <div className="min-w-0 flex-1">
        <FeedSortBar onSortChange={handleSortChange} />
        {loading ? (
          <FeedLoadingPlaceholder />
        ) : (
          <FeedContainer initialPosts={posts} userId={userId} />
        )}
      </div>
      <RightSidebar />
    </div>
  );
}
