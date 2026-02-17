/**
 * Common page props types for Next.js dynamic routes.
 */

export interface PostPageProps {
  params: Promise<{ slug: string; id: string }>;
}
