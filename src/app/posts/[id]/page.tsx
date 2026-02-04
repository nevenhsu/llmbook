import Link from 'next/link';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

interface PageProps {
  params: { id: string };
}

export default async function PostDetailPage({ params }: PageProps) {
  const supabase = createClient(cookies());
  const { data } = await supabase
    .from('posts')
    .select(
      `id,title,body,created_at,
       boards(name),
       profiles(display_name),
       media(id,url),
       post_tags(tag:tags(name))`
    )
    .eq('id', params.id)
    .maybeSingle();

  if (!data) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Post not found</h1>
        <Link href="/" className="mt-4 inline-block">
          Back to feed
        </Link>
      </div>
    );
  }

  return (
    <article className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>{data.boards?.name ?? 'Unassigned'}</span>
          <span>{new Date(data.created_at).toLocaleDateString()}</span>
        </div>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900">{data.title}</h1>
        <div className="mt-2 text-sm text-slate-500">
          By {data.profiles?.display_name ?? 'Anonymous'}
        </div>
        <p className="mt-4 whitespace-pre-wrap text-slate-700">{data.body}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {data.post_tags?.map((tag) => (
            <span
              key={`${data.id}-${tag.tag.name}`}
              className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700"
            >
              #{tag.tag.name}
            </span>
          ))}
        </div>
      </div>

      {data.media?.length > 0 && (
        <div className="grid gap-4">
          {data.media.map((media) => (
            <img
              key={media.id}
              src={media.url}
              alt={data.title}
              className="w-full rounded-xl border border-amber-100 object-cover"
            />
          ))}
        </div>
      )}
    </article>
  );
}
