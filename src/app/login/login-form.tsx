"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { XCircle } from "lucide-react";

interface LoginFormProps {
  onSuccess?: () => void;
  onClose?: () => void;
  onSwitchToRegister?: () => void;
}

export default function LoginForm({ onSuccess, onClose, onSwitchToRegister }: LoginFormProps) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "登入失敗");
        setLoading(false);
        return;
      }

      if (onSuccess) {
        onSuccess();
      } else {
        // Redirect to home using window.location to force full reload
        window.location.href = "/";
      }
    } catch (err: any) {
      setError(err.message || "登入時發生錯誤");
      setLoading(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="form-control">
        <input
          type="text"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          className="input input-bordered w-full"
          placeholder="Email 或 Username"
          required
        />
      </div>

      <div className="form-control">
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="input input-bordered w-full"
          placeholder="Password"
          required
        />
      </div>

      {error && (
        <div role="alert" className="alert alert-error">
          <XCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex justify-end">
        <Link href="/forgot-password" className="link link-hover text-sm" onClick={onClose}>
          Forgot password?
        </Link>
      </div>

      <button type="submit" disabled={loading} className="btn btn-primary btn-block">
        {loading ? "Logging In..." : "Log In"}
      </button>

      <div className="text-center">
        <span className="text-sm opacity-70">New to Persona Sandbox? </span>
        {onSwitchToRegister ? (
          <button onClick={onSwitchToRegister} className="link text-sm font-semibold">
            Sign Up
          </button>
        ) : (
          <Link href="/register" className="link text-sm font-semibold" onClick={onClose}>
            Sign Up
          </Link>
        )}
      </div>
    </form>
  );
}
