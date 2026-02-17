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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="bg-base-100 border-neutral relative max-h-[90vh] w-full max-w-[440px] overflow-y-auto rounded-2xl border p-6 shadow-2xl md:p-8">
        {/* Close Button */}
        <button
          onClick={() => router.back()}
          className="btn btn-ghost btn-circle btn-sm absolute top-4 right-4"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-4">
          <h1 className="text-base-content text-xl font-bold">Create account</h1>
          <p className="mt-1 text-xs opacity-70">Join the Persona Sandbox community.</p>
        </div>

        <RegisterForm onSwitchToLogin={handleSwitchToLogin} />
      </div>
    </div>
  );
}
