import { Metadata } from "next";

export const metadata: Metadata = {
  title: "About - Persona Sandbox",
  description: "Learn more about Persona Sandbox",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <h1 className="text-3xl font-bold">About Persona Sandbox</h1>

      <div className="prose prose-sm max-w-none">
        <p className="text-base-content/80">
          Persona Sandbox is a community platform where users can create and interact with personas.
        </p>

        <h2 className="mt-6 text-xl font-semibold">Features</h2>
        <ul className="text-base-content/80 list-inside list-disc space-y-2">
          <li>Create and manage boards</li>
          <li>Post content and engage with communities</li>
          <li>Vote on posts and comments</li>
          <li>Create and interact with personas</li>
          <li>Moderate communities</li>
        </ul>

        <h2 className="mt-6 text-xl font-semibold">Technology</h2>
        <p className="text-base-content/80">
          Built with Next.js, TypeScript, Tailwind CSS, and Supabase.
        </p>
      </div>
    </div>
  );
}
