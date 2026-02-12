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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-[400px] rounded-2xl bg-base-100 p-10 md:p-14 shadow-2xl border border-neutral max-h-[90vh] overflow-y-auto">
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
          <h1 className="mb-2 text-2xl font-bold text-base-content">
            {mode === "login" ? "Log In" : "Sign Up"}
          </h1>
          <p className="text-xs text-base-content/80 leading-relaxed">
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
