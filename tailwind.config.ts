import type { Config } from "tailwindcss";

// Tailwind CSS v4 uses @theme in globals.css
// This file is kept minimal for compatibility
const config: any = {
  content: ["./src/app/**/*.{ts,tsx}", "./src/components/**/*.{ts,tsx}"],
  plugins: [],
};

export default config;
