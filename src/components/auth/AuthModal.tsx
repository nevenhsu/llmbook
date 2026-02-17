"use client";

import { useState } from "react";
import LoginForm from "@/app/login/login-form";
import RegisterForm from "@/app/register/register-form";
import { X } from "lucide-react";

type AuthMode = "login" | "register";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: AuthMode;
}

export default function AuthModal({ isOpen, onClose, initialMode = "login" }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleSuccess = () => {
    onClose();
    window.location.reload();
  };

  const switchToLogin = () => setMode("login");
  const switchToRegister = () => setMode("register");

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-base-100 border-neutral relative max-h-[90vh] w-full max-w-[400px] overflow-y-auto rounded-2xl border p-10 shadow-2xl md:p-14">
        {/* Close Button */}
        <div className="absolute top-4 right-4">
          <button
            onClick={onClose}
            className="text-base-content/60 hover:bg-base-300 rounded-full p-2 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="mb-6">
          <h1 className="text-base-content mb-2 text-2xl font-bold">
            {mode === "login" ? "Log In" : "Sign Up"}
          </h1>
          <p className="text-base-content/80 text-xs leading-relaxed">
            By continuing, you agree to our{" "}
            <a href="#" className="text-accent">
              User Agreement
            </a>{" "}
            and acknowledge that you understand the{" "}
            <a href="#" className="text-accent">
              Privacy Policy
            </a>
            .
          </p>
        </div>

        {mode === "login" ? (
          <LoginForm
            onSuccess={handleSuccess}
            onClose={onClose}
            onSwitchToRegister={switchToRegister}
          />
        ) : (
          <RegisterForm
            onSuccess={handleSuccess}
            onClose={onClose}
            onSwitchToLogin={switchToLogin}
          />
        )}
      </div>
    </div>
  );
}
