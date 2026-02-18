"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X, XCircle, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [validSession, setValidSession] = useState(false);

  useEffect(() => {
    // Check if user has a valid session (came from reset password email)
    const checkSession = async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setValidSession(!!session);
    };

    checkSession();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("密碼不一致");
      return;
    }

    // Validate password length
    if (password.length < 6) {
      setError("密碼長度至少需要 6 個字元");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);

      // Redirect to home after 2 seconds
      setTimeout(() => {
        router.push("/");
      }, 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "更新密碼時發生錯誤";
      setError(message);
      setLoading(false);
    }
  }

  if (!validSession) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
        <div className="bg-base-100 border-neutral relative w-full max-w-[400px] rounded-2xl border p-10 shadow-2xl md:p-14">
          <button
            onClick={() => router.push("/login")}
            className="text-base-content/60 hover:bg-base-300 absolute top-4 right-4 rounded-full p-2 transition-colors"
          >
            <X size={24} />
          </button>

          <div role="alert" className="alert alert-warning">
            <XCircle className="h-5 w-5 shrink-0" />
            <div>
              <h3 className="font-bold">無效的重設密碼連結</h3>
              <div className="text-sm">請重新申請重設密碼，或檢查您的郵件連結是否已過期。</div>
            </div>
          </div>

          <div className="mt-6 space-y-2">
            <Link href="/forgot-password" className="btn btn-primary btn-block">
              重新申請重設密碼
            </Link>
            <Link href="/login" className="btn btn-outline btn-block">
              返回登入頁面
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
        <div className="bg-base-100 border-neutral relative w-full max-w-[400px] rounded-2xl border p-10 shadow-2xl md:p-14">
          <div role="alert" className="alert alert-success">
            <CheckCircle className="h-5 w-5 shrink-0" />
            <div>
              <h3 className="font-bold">密碼已成功更新</h3>
              <div className="text-sm">正在跳轉到首頁...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="bg-base-100 border-neutral relative w-full max-w-[400px] rounded-2xl border p-10 shadow-2xl md:p-14">
        <button
          onClick={() => router.push("/login")}
          className="text-base-content/60 hover:bg-base-300 absolute top-4 right-4 rounded-full p-2 transition-colors"
        >
          <X size={24} />
        </button>

        <div className="mb-6">
          <h1 className="text-base-content mb-2 text-2xl font-bold">設定新密碼</h1>
          <p className="text-base-content/80 text-xs leading-relaxed">請輸入您的新密碼。</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="form-control">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input input-bordered w-full"
              placeholder="至少 6 個字元"
              required
              minLength={6}
            />
          </div>

          <div className="form-control">
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input input-bordered w-full"
              placeholder="再次輸入新密碼"
              required
              minLength={6}
            />
          </div>

          {error && (
            <div role="alert" className="alert alert-error">
              <XCircle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" disabled={loading} className="btn btn-primary btn-block">
            {loading ? "更新中..." : "更新密碼"}
          </button>
        </form>
      </div>
    </div>
  );
}
