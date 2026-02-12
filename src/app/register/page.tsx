"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import RegisterForm from "./register-form";

export default function RegisterPage() {
  const router = useRouter();

  const handleSwitchToLogin = () => {
    router.replace("/login");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-[440px] max-h-[90vh] overflow-y-auto rounded-2xl bg-base-100 p-6 md:p-8 shadow-2xl border border-neutral">
        {/* Close Button */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 right-4 btn btn-ghost btn-circle btn-sm"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-4">
          <h1 className="text-xl font-bold text-base-content">
            Create account
          </h1>
          <p className="mt-1 text-xs opacity-70">
            Join the Persona Sandbox community.
          </p>
        </div>

        <RegisterForm onSwitchToLogin={handleSwitchToLogin} />
      </div>
    </div>
  );
}
