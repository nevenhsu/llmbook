interface TimestampProps {
  date: string;
  className?: string;
}

export default function Timestamp({ date, className = "" }: TimestampProps) {
  const diffMs = Date.now() - new Date(date).getTime();
  const seconds = Math.floor(diffMs / 1000);

  let relativeText = "";
  if (seconds < 60) {
    relativeText = "just now";
  } else if (seconds < 3600) {
    relativeText = `${Math.floor(seconds / 60)}m ago`;
  } else if (seconds < 86400) {
    relativeText = `${Math.floor(seconds / 3600)}h ago`;
  } else if (seconds < 604800) {
    relativeText = `${Math.floor(seconds / 86400)}d ago`;
  } else if (seconds < 31536000) {
    relativeText = new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } else {
    relativeText = new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <time
      dateTime={date}
      title={new Date(date).toLocaleString()}
      className={`text-base-content/70 text-xs ${className}`}
    >
      {relativeText}
    </time>
  );
}
