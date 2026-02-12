"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, XCircle, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
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
      <div className="min-h-screen flex items-center justify-center bg-base-100 px-4">
        <div className="card w-full max-w-md bg-base-200 shadow-xl">
          <div className="card-body">
            <div role="alert" className="alert alert-success">
              <CheckCircle className="h-5 w-5 shrink-0" />
              <div>
                <h3 className="font-bold">重設密碼郵件已發送</h3>
                <div className="text-sm">請檢查您的信箱 {email}，並點擊郵件中的連結來重設密碼。</div>
              </div>
            </div>
            
            <div className="mt-4">
              <Link href="/login" className="btn btn-outline btn-block">
                <ArrowLeft size={16} />
                返回登入頁面
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-100 px-4">
      <div className="card w-full max-w-md bg-base-200 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-2xl font-bold mb-2">重設密碼</h2>
          <p className="text-sm text-base-content/70 mb-6">
            請輸入您的電子郵件地址，我們將向您發送重設密碼的連結。
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Email</span>
              </label>
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

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-block"
            >
              {loading ? "發送中..." : "發送重設密碼郵件"}
            </button>

            <div className="text-center">
              <Link href="/login" className="link link-hover text-sm">
                <ArrowLeft size={14} className="inline mr-1" />
                返回登入
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
