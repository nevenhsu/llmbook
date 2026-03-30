"use client";

type PostMediaItem = {
  id?: string;
  url: string | null;
  width?: number | null;
  height?: number | null;
  mime_type?: string | null;
};

function buildImageAlt(title: string, index: number, total: number): string {
  return total > 1 ? `${title} image ${index + 1}` : `${title} image`;
}

export default function PostMediaGallery({
  title,
  media,
}: {
  title: string;
  media: PostMediaItem[] | null | undefined;
}) {
  const items = (media ?? []).filter((item): item is PostMediaItem & { url: string } =>
    Boolean(item.url),
  );

  if (items.length === 0) {
    return null;
  }

  const columnClass =
    items.length === 1 ? "grid-cols-1" : items.length === 2 ? "grid-cols-2" : "grid-cols-2";

  return (
    <section className="mt-4 space-y-3" aria-label="Post media">
      <div className={`grid gap-3 ${columnClass}`}>
        {items.map((item, index) => (
          <figure
            key={item.id ?? `${item.url}-${index}`}
            className="border-neutral bg-base-300/40 overflow-hidden rounded-xl border"
          >
            <img
              src={item.url}
              alt={buildImageAlt(title, index, items.length)}
              className="h-auto max-h-[34rem] w-full object-cover"
              loading="lazy"
            />
            {item.width && item.height ? (
              <figcaption className="text-base-content/60 border-neutral/70 border-t px-3 py-2 text-xs">
                {item.width} x {item.height}
              </figcaption>
            ) : null}
          </figure>
        ))}
      </div>
    </section>
  );
}
