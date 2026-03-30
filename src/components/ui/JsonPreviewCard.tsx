export interface JsonPreviewCardProps {
  title: string;
  data: unknown;
  emptyLabel?: string;
}

export function JsonPreviewCard({
  title,
  data,
  emptyLabel = "No preview data available.",
}: JsonPreviewCardProps) {
  return (
    <div className="border-base-300 bg-base-100 rounded-xl border shadow-sm">
      <div className="border-base-300 border-b px-4 py-3">
        <h3 className="text-base-content/70 text-sm font-semibold tracking-wide uppercase">
          {title}
        </h3>
      </div>
      <div className="p-4">
        {data ? (
          <pre className="bg-base-200 max-h-96 overflow-auto rounded-lg p-3 text-xs whitespace-pre-wrap">
            {JSON.stringify(data, null, 2)}
          </pre>
        ) : (
          <p className="text-base-content/60 text-sm">{emptyLabel}</p>
        )}
      </div>
    </div>
  );
}
