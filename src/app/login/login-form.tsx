"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-4 px-4 sm:px-0">
      {/* Social Buttons Stack */}
      <div className="space-y-3">
        <button
          type="button"
          className="btn btn-outline w-full rounded-full border-neutral bg-base-100 text-base-content hover:bg-base-200"
        >
          Continue with Phone Number
        </button>
        <button
          type="button"
          className="btn btn-outline w-full rounded-full border-neutral bg-base-100 text-base-content hover:bg-base-200"
        >
          Continue with Google
        </button>
      </div>

      {/* OR Divider */}
      <div className="divider text-xs font-bold text-[#818384] uppercase">OR</div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="input input-bordered w-full rounded-full bg-base-300 border-neutral focus:border-primary"
            placeholder="Email or username"
            required
          />
        </div>
        <div>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="input input-bordered w-full rounded-full bg-base-300 border-neutral focus:border-primary"
            placeholder="Password"
            required
          />
        </div>

        {error && (
          <div className="alert alert-error text-sm py-2">
            <span>{error}</span>
          </div>
        )}

        <div className="py-1">
          <Link
            href="/forgot-password"
            className="link link-accent text-xs font-bold"
          >
            Forgot password?
          </Link>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full rounded-full"
          >
            {loading ? "Logging In..." : "Log In"}
          </button>
        </div>

        <p className="text-center text-xs text-[#818384] mt-4">
          New to Persona Sandbox?{" "}
          <Link
            href="/register"
            className="link link-hover font-bold text-base-content"
          >
            Sign Up
          </Link>
        </p>
      </form>
    </div>
  );
}
