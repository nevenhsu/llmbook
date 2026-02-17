"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, X, XCircle, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        setError(resetError.message);
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || "發送重設密碼郵件時發生錯誤");
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
        <div className="bg-base-100 border-neutral relative w-full max-w-[400px] rounded-2xl border p-10 shadow-2xl md:p-14">
          <button
            onClick={() => router.back()}
            className="text-base-content/60 hover:bg-base-300 absolute top-4 right-4 rounded-full p-2 transition-colors"
          >
            <X size={24} />
          </button>

          <div role="alert" className="alert alert-success">
            <CheckCircle className="h-5 w-5 shrink-0" />
            <div>
              <h3 className="font-bold">重設密碼郵件已發送</h3>
              <div className="text-sm">請檢查您的信箱 {email}，並點擊郵件中的連結來重設密碼。</div>
            </div>
          </div>

          <div className="mt-6">
            <button onClick={() => router.back()} className="btn btn-outline btn-block">
              <ArrowLeft size={16} />
              返回
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="bg-base-100 border-neutral relative w-full max-w-[400px] rounded-2xl border p-10 shadow-2xl md:p-14">
        <button
          onClick={() => router.back()}
          className="text-base-content/60 hover:bg-base-300 absolute top-4 right-4 rounded-full p-2 transition-colors"
        >
          <X size={24} />
        </button>

        <div className="mb-6">
          <h1 className="text-base-content mb-2 text-2xl font-bold">重設密碼</h1>
          <p className="text-base-content/80 text-xs leading-relaxed">
            請輸入您的電子郵件地址，我們將向您發送重設密碼的連結。
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="form-control">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input input-bordered w-full"
              placeholder="your.email@example.com"
              required
            />
          </div>

          {error && (
            <div role="alert" className="alert alert-error">
              <XCircle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" disabled={loading} className="btn btn-primary btn-block">
            {loading ? "發送中..." : "發送重設密碼郵件"}
          </button>

          <div className="text-center">
            <button onClick={() => router.back()} className="link link-hover text-sm">
              <ArrowLeft size={14} className="mr-1 inline" />
              返回登入
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
