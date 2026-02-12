"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { XCircle, CheckCircle } from "lucide-react";
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
      const { data: { session } } = await supabase.auth.getSession();
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
    } catch (err: any) {
      setError(err.message || "更新密碼時發生錯誤");
      setLoading(false);
    }
  }

  if (!validSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-100 px-4">
        <div className="card w-full max-w-md bg-base-200 shadow-xl">
          <div className="card-body">
            <div role="alert" className="alert alert-warning">
              <XCircle className="h-5 w-5 shrink-0" />
              <div>
                <h3 className="font-bold">無效的重設密碼連結</h3>
                <div className="text-sm">請重新申請重設密碼，或檢查您的郵件連結是否已過期。</div>
              </div>
            </div>
            
            <div className="mt-4 space-y-2">
              <Link href="/forgot-password" className="btn btn-primary btn-block">
                重新申請重設密碼
              </Link>
              <Link href="/login" className="btn btn-outline btn-block">
                返回登入頁面
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-100 px-4">
        <div className="card w-full max-w-md bg-base-200 shadow-xl">
          <div className="card-body">
            <div role="alert" className="alert alert-success">
              <CheckCircle className="h-5 w-5 shrink-0" />
              <div>
                <h3 className="font-bold">密碼已成功更新</h3>
                <div className="text-sm">正在跳轉到首頁...</div>
              </div>
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
          <h2 className="card-title text-2xl font-bold mb-2">設定新密碼</h2>
          <p className="text-sm text-base-content/70 mb-6">
            請輸入您的新密碼。
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="form-control">
              <label className="label">
                <span className="label-text">新密碼</span>
              </label>
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
              <label className="label">
                <span className="label-text">確認新密碼</span>
              </label>
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

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-block"
            >
              {loading ? "更新中..." : "更新密碼"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
