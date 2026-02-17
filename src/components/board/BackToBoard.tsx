import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface BackToBoardProps {
  slug: string;
  className?: string;
}

export default function BackToBoard({ slug, className = "" }: BackToBoardProps) {
  return (
    <Link
      href={`/r/${slug}`}
      className={`text-base-content/70 hover:text-base-content inline-flex items-center gap-2 text-sm transition-colors ${className}`}
    >
      <ArrowLeft size={16} />
      Back to r/{slug}
    </Link>
  );
}
