"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
    <div className="space-y-4">
      {/* Social Buttons Stack */}
      <div className="space-y-3">
        <button
          type="button"
          className="flex w-full items-center justify-center gap-3 rounded-full border border-[#D7DADC] bg-white px-4 py-2.5 text-sm font-bold text-[#1A1A1B] hover:bg-gray-100 transition-colors"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c5.52 0 10-4.48 10-10S17.52 2 12 2zm4.56 16.59c-.21.21-.49.32-.78.32-.42 0-.81-.22-1.03-.59-.83-1.42-2.34-2.32-3.99-2.32s-3.16.89-3.99 2.32c-.22.37-.61.59-1.03.59-.29 0-.57-.11-.78-.32-.42-.42-.42-1.11.01-1.52 1.25-2.14 3.52-3.48 6.04-3.48s4.79 1.34 6.04 3.48c.42.42.42 1.11-.01 1.52zM12 14c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z" />
          </svg>
          Continue with Phone Number
        </button>
        <button
          type="button"
          className="flex w-full items-center justify-center gap-3 rounded-full border border-[#D7DADC] bg-white px-4 py-2.5 text-sm font-bold text-[#1A1A1B] hover:bg-gray-100 transition-colors"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </button>
        <button
          type="button"
          className="flex w-full items-center justify-center gap-3 rounded-full border border-[#D7DADC] bg-white px-4 py-2.5 text-sm font-bold text-[#1A1A1B] hover:bg-gray-100 transition-colors"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.74 1.18 0 2.21-1.23 3.79-1.18 1.34.05 2.56.77 3.3 1.83-3.1 1.66-2.43 5.37.56 6.63-.44 1.34-.98 2.66-2.73 4.95zM12.03 5.4c-.16-2.58 2.15-4.4 4.35-4.4.29 2.76-2.45 4.67-4.35 4.4z" />
          </svg>
          Continue with Apple
        </button>
      </div>

      {/* OR Divider */}
      <div className="flex items-center gap-4 py-2">
        <div className="h-[1px] flex-1 bg-[#343536]"></div>
        <span className="text-xs font-bold text-[#818384] uppercase">OR</span>
        <div className="h-[1px] flex-1 bg-[#343536]"></div>
      </div>

      <form className="space-y-3" onSubmit={handleSubmit}>
        <div>
          {/* Floating label style simulation with simple placeholder for now or standard input */}
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-full border border-[#343536] bg-[#2A3C42] px-4 py-3 text-sm text-[#D7DADC] placeholder-[#818384] outline-none focus:border-[#D7DADC] transition-colors"
            placeholder="Email or username"
            required
          />
        </div>
        <div>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-full border border-[#343536] bg-[#2A3C42] px-4 py-3 text-sm text-[#D7DADC] placeholder-[#818384] outline-none focus:border-[#D7DADC] transition-colors"
            placeholder="Password"
            required
          />
        </div>

        {error && (
          <div className="rounded-md bg-red-900/30 p-3 text-sm text-red-400 border border-red-900/50">
            {error}
          </div>
        )}

        <div className="py-2">
          <a
            href="#"
            className="text-xs font-bold text-[#4FBCFF] hover:underline"
          >
            Forgot password?
          </a>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-[#D93A00] px-5 py-3 text-sm font-bold text-white hover:bg-[#C93600] disabled:opacity-60 transition-colors"
          >
            {loading ? "Logging In..." : "Log In"}
          </button>
        </div>

        <p className="text-center text-xs text-[#818384] mt-4">
          New to Persona Sandbox?{" "}
          <a
            href="/register"
            className="font-bold text-[#D7DADC] hover:underline"
          >
            Sign Up
          </a>
        </p>
      </form>
    </div>
  );
}
