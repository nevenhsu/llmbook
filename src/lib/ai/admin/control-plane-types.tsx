import type { ReactNode } from "react";
import { Server, FileText, UserPlus, MessageSquare } from "lucide-react";

export type PersonaItem = {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  bio: string;
  status: string;
};

export type DraftState = {
  selectedVersion: number;
  systemBaseline: string;
  globalPolicy: string;
  styleGuide: string;
  forbiddenRules: string;
  note: string;
};

export type ControlPlaneSection = "providers" | "policy" | "persona" | "preview";

export const SECTION_ICONS: Record<ControlPlaneSection, ReactNode> = {
  providers: <Server className="h-4 w-4" />,
  policy: <FileText className="h-4 w-4" />,
  persona: <UserPlus className="h-4 w-4" />,
  preview: <MessageSquare className="h-4 w-4" />,
};

export const SECTION_ITEMS: Array<{ id: ControlPlaneSection; label: string; helper: string }> = [
  {
    id: "providers",
    label: "Providers",
    helper: "Manage provider keys and model inventory",
  },
  {
    id: "policy",
    label: "Policy",
    helper: "Draft, preview, publish, rollback",
  },
  {
    id: "persona",
    label: "Persona",
    helper: "Generate, regenerate, save to DB",
  },
  {
    id: "preview",
    label: "Preview",
    helper: "Preview post/comment with persona",
  },
];

export const SUPPORTED_PROVIDERS = [
  { id: "xai", displayName: "xAI", sdkPackage: "@ai-sdk/xai" },
  { id: "minimax", displayName: "Minimax", sdkPackage: "vercel-minimax-ai-provider" },
  { id: "deepseek", displayName: "DeepSeek", sdkPackage: "@ai-sdk/deepseek" },
] as const;

export const SUPPORTED_MODELS = [
  {
    providerId: "xai",
    modelKey: "grok-4-1-fast-reasoning",
    displayName: "Grok 4.1 Fast Reasoning",
    capability: "text_generation",
    metadata: { input: ["text", "image"], output: ["text"] },
  },
  {
    providerId: "xai",
    modelKey: "grok-imagine-image",
    displayName: "Grok Imagine Image",
    capability: "image_generation",
    metadata: { input: ["text", "image"], output: ["image"] },
  },
  {
    providerId: "minimax",
    modelKey: "MiniMax-M2.5",
    displayName: "MiniMax M2.5",
    capability: "text_generation",
    metadata: { input: ["text"], output: ["text"] },
  },
  {
    providerId: "deepseek",
    modelKey: "deepseek-v4-flash",
    displayName: "DeepSeek-V4-Flash",
    capability: "text_generation",
    metadata: { input: ["text"], output: ["text"] },
  },
] as const;
