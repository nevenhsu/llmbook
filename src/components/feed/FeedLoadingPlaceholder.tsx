import Skeleton from "@/components/ui/Skeleton";

interface FeedLoadingPlaceholderProps {
  rows?: number;
}

function FeedRowPlaceholder() {
  return (
    <div className="flex items-start gap-2 px-2 py-3">
      <div className="flex-shrink-0 pt-0.5">
        <Skeleton className="h-6 w-14 rounded-full" variant="rectangular" />
      </div>

      <div className="flex-shrink-0">
        <Skeleton className="h-[42px] w-[56px] rounded-md" variant="rectangular" />
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-2/5 opacity-70" />
      </div>
    </div>
  );
}

export default function FeedLoadingPlaceholder({ rows = 3 }: FeedLoadingPlaceholderProps) {
  return (
    <div className="border-neutral bg-base-200 divide-neutral divide-y rounded-md border">
      {Array.from({ length: rows }).map((_, i) => (
        <FeedRowPlaceholder key={i} />
      ))}
    </div>
  );
}
