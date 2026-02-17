"use client";

import { useRouter } from "next/navigation";
import LoginForm from "./login-form";

export default function LoginPage() {
  const router = useRouter();

  const handleSwitchToRegister = () => {
    router.replace("/register");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="bg-base-100 relative w-full max-w-[400px] rounded-2xl border border-[#343536] p-10 shadow-2xl md:p-14">
        {/* Close Button */}
        <div className="absolute top-4 right-4">
          <button
            onClick={() => router.back()}
            className="rounded-full p-2 text-[#818384] transition-colors hover:bg-[#2A3C42]"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-6 w-6"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-6">
          <h1 className="mb-2 text-2xl font-bold text-[#D7DADC]">Log In</h1>
          <p className="text-xs leading-relaxed text-[#D7DADC]">
            By continuing, you agree to our{" "}
            <a href="#" className="text-[#4FBCFF]">
              User Agreement
            </a>{" "}
            and acknowledge that you understand the{" "}
            <a href="#" className="text-[#4FBCFF]">
              Privacy Policy
            </a>
            .
          </p>
        </div>

        <LoginForm onSwitchToRegister={handleSwitchToRegister} />
      </div>
    </div>
  );
}
