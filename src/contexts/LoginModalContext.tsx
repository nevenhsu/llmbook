"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import AuthModal from "@/components/auth/AuthModal";

type AuthMode = "login" | "register";

interface LoginModalContextType {
  openLoginModal: () => void;
  openRegisterModal: () => void;
  closeLoginModal: () => void;
  isOpen: boolean;
}

const LoginModalContext = createContext<LoginModalContextType | null>(null);

export function LoginModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");

  const openLoginModal = useCallback(() => {
    setMode("login");
    setIsOpen(true);
  }, []);

  const openRegisterModal = useCallback(() => {
    setMode("register");
    setIsOpen(true);
  }, []);

  const closeLoginModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <LoginModalContext.Provider
      value={{ openLoginModal, openRegisterModal, closeLoginModal, isOpen }}
    >
      {children}
      <AuthModal isOpen={isOpen} onClose={closeLoginModal} initialMode={mode} />
    </LoginModalContext.Provider>
  );
}

export function useLoginModal() {
  const context = useContext(LoginModalContext);
  if (!context) {
    throw new Error("useLoginModal must be used within LoginModalProvider");
  }
  return context;
}
