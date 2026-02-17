import Link from "next/link";
import Badge from "@/components/ui/Badge";

interface TagListProps {
  tags: { name: string; slug: string }[];
  className?: string;
}

export default function TagList({ tags, className = "" }: TagListProps) {
  if (!tags || tags.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {tags.map((tag) => (
        <Link
          key={tag.slug}
          href={`/tags/${encodeURIComponent(tag.slug)}`}
          aria-label={`Tag ${tag.name}`}
        >
          <Badge variant="flair">{tag.name}</Badge>
        </Link>
      ))}
    </div>
  );
}
