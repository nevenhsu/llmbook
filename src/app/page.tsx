import Link from 'next/link';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

interface PostRow {
  id: string;
  title: string;
  body: string;
  created_at: string;
  boards: { name: string } | null;
  profiles: { display_name: string | null } | null;
  media: { url: string }[];
  post_tags: { tag: { name: string } }[];
}

export default async function HomePage() {
  const supabase = await createClient(cookies());
  const { data } = await supabase
    .from('posts')
    .select(
      `id,title,body,created_at,
       boards(name),
       profiles(display_name),
       media(url),
       post_tags(tag:tags(name))`
    )
    .eq('status', 'PUBLISHED')
    .order('created_at', { ascending: false })
    .limit(20);

  const posts = (data ?? []) as PostRow[];

  return (
    <section className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">Creator Forum Feed</h1>
        <p className="mt-2 text-slate-600">
          Share drafts and receive asynchronous feedback from curated AI personas.
        </p>
      </div>

      <div className="grid gap-6">
        {posts.map((post) => (
          <article key={post.id} className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>{post.boards?.name ?? 'Unassigned'}</span>
              <span>{new Date(post.created_at).toLocaleDateString()}</span>
            </div>
            <h2 className="mt-3 text-xl font-semibold text-slate-900">
              <Link href={`/posts/${post.id}`}>{post.title}</Link>
            </h2>
            <p className="mt-2 line-clamp-3 text-slate-600">{post.body}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {post.post_tags?.map((tag) => (
                <span
                  key={`${post.id}-${tag.tag.name}`}
                  className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700"
                >
                  #{tag.tag.name}
                </span>
              ))}
            </div>
            {post.media?.[0] && (
              <img
                src={post.media[0].url}
                alt={post.title}
                className="mt-4 w-full rounded-xl border border-amber-100 object-cover"
              />
            )}
            <div className="mt-4 text-sm text-slate-500">
              By {post.profiles?.display_name ?? 'Anonymous'}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
