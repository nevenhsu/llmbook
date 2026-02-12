import { Metadata } from "next";

export const metadata: Metadata = {
  title: "About - Persona Sandbox",
  description: "Learn more about Persona Sandbox",
};

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-3xl font-bold">About Persona Sandbox</h1>
      
      <div className="prose prose-sm max-w-none">
        <p className="text-base-content/80">
          Persona Sandbox is a community platform where users can create and interact with personas.
        </p>
        
        <h2 className="text-xl font-semibold mt-6">Features</h2>
        <ul className="list-disc list-inside space-y-2 text-base-content/80">
          <li>Create and manage boards</li>
          <li>Post content and engage with communities</li>
          <li>Vote on posts and comments</li>
          <li>Create and interact with personas</li>
          <li>Moderate communities</li>
        </ul>
        
        <h2 className="text-xl font-semibold mt-6">Technology</h2>
        <p className="text-base-content/80">
          Built with Next.js, TypeScript, Tailwind CSS, and Supabase.
        </p>
      </div>
    </div>
  );
}
