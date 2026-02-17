"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { XCircle, CheckCircle } from "lucide-react";
import UsernameInput from "@/components/ui/UsernameInput";

interface RegisterFormProps {
  onSuccess?: () => void;
  onClose?: () => void;
  onSwitchToLogin?: () => void;
}

export default function RegisterForm({ onSuccess, onClose, onSwitchToLogin }: RegisterFormProps) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isUsernameManuallyEdited, setIsUsernameManuallyEdited] = useState(false);
  const [isUsernameValid, setIsUsernameValid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Auto-generate username from email prefix
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value;
    setEmail(newEmail);

    // Auto-fill username from email prefix if not manually edited
    if (!isUsernameManuallyEdited && newEmail.includes("@")) {
      const prefix = newEmail.split("@")[0];
      // Sanitize: lowercase, remove invalid chars for username
      const sanitized = prefix
        .toLowerCase()
        .replace(/[^a-z0-9_.]/g, "")
        .replace(/^\.+/, "")
        .replace(/\.+$/, "")
        .replace(/\.{2,}/g, ".")
        .substring(0, 20);
      if (sanitized) {
        setUsername(sanitized);
      }
    }
  };

  // Track manual username edits
  const handleUsernameChange = (value: string) => {
    setUsername(value);
    setIsUsernameManuallyEdited(true);
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    // Validate username before submission
    if (!isUsernameValid) {
      setError("請輸入有效的 username");
      return;
    }

    setLoading(true);

    try {
      // Call register API
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          username: username.toLowerCase(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "註冊失敗");
        setLoading(false);
        return;
      }

      // Success - user is registered
      setNotice(data.message || "註冊成功！");

      // If needs manual login, redirect to login page or switch to login modal
      if (data.needsManualLogin) {
        setTimeout(() => {
          if (onSuccess) {
            onSuccess();
            onSwitchToLogin?.();
          } else {
            window.location.href = "/login";
          }
        }, 1500);
        return;
      }

      // Auto-login successful
      if (onSuccess) {
        onSuccess();
      } else {
        setTimeout(() => {
          window.location.href = "/";
        }, 500);
      }
    } catch (err: any) {
      setError(err.message || "註冊時發生錯誤");
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {/* Email field */}
      <div className="form-control">
        <label className="label">
          <span className="label-text font-semibold">
            Email <span className="text-error">*</span>
          </span>
        </label>
        <input
          type="email"
          value={email}
          onChange={handleEmailChange}
          className="input input-bordered w-full"
          placeholder="your.email@example.com"
          required
        />
      </div>

      {/* Password field */}
      <div className="form-control">
        <label className="label">
          <span className="label-text font-semibold">
            密碼 <span className="text-error">*</span>
          </span>
        </label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="input input-bordered w-full"
          placeholder="至少 6 個字元"
          required
          minLength={6}
        />
        <label className="label !whitespace-normal">
          <span className="label-text-alt text-xs break-words opacity-70">
            密碼長度至少 6 個字元
          </span>
        </label>
      </div>

      {/* Username field */}
      <div>
        <UsernameInput
          value={username}
          onChange={handleUsernameChange}
          onValidChange={setIsUsernameValid}
          required
          label="Username"
          showRules={true}
          checkAvailability={true}
        />
        <label className="label !whitespace-normal">
          <span className="label-text-alt text-xs break-words opacity-70">
            您的 username 會顯示在 URL 中 (例如: yoursite.com/u/username)
          </span>
        </label>
      </div>

      {/* Error/Notice messages */}
      {error && (
        <div role="alert" className="alert alert-error">
          <XCircle className="h-6 w-6 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div role="alert" className="alert alert-success">
          <CheckCircle className="h-6 w-6 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Submit button */}
      <button
        type="submit"
        disabled={loading || !isUsernameValid}
        className="btn btn-primary btn-block"
      >
        {loading ? "建立中..." : "建立帳號"}
      </button>

      {/* Sign in link */}
      <div className="text-center">
        <span className="text-sm opacity-70">已經有帳號了？ </span>
        {onSwitchToLogin ? (
          <button onClick={onSwitchToLogin} className="link link-hover text-sm font-semibold">
            登入
          </button>
        ) : (
          <Link href="/login" className="link link-hover text-sm font-semibold" onClick={onClose}>
            登入
          </Link>
        )}
      </div>
    </form>
  );
}
