import type { ReactNode } from "react";
import { Server, FileText, Route, UserPlus, MessageSquare } from "lucide-react";
import type {
  AiModelConfig,
  AiModelRoute,
  AiProviderConfig,
  PolicyReleaseListItem,
  PreviewResult,
  PersonaGenerationStructured,
} from "@/lib/ai/admin/control-plane-store";

export type PersonaItem = {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  bio: string;
  status: string;
};

export type DraftState = {
  policyVersion: number;
  coreGoal: string;
  globalPolicy: string;
  styleGuide: string;
  forbiddenRules: string;
  note: string;
};

export type ControlPlaneSection = "providers" | "policy" | "routes" | "persona" | "preview";

export type RouteDraftState = Record<AiModelRoute["scope"], { orderedModelIds: string[] }>;

export const SECTION_ICONS: Record<ControlPlaneSection, ReactNode> = {
  providers: <Server className="h-4 w-4" />,
  policy: <FileText className="h-4 w-4" />,
  routes: <Route className="h-4 w-4" />,
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
    id: "routes",
    label: "Routes",
    helper: "Capability routes (text/image)",
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

export const ROUTE_SCOPE_ORDER: Array<AiModelRoute["scope"]> = ["global_default", "image"];

export const SUPPORTED_PROVIDERS = [
  { id: "xai", displayName: "xAI", sdkPackage: "@ai-sdk/xai" },
  { id: "minimax", displayName: "Minimax", sdkPackage: "vercel-minimax-ai-provider" },
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
    modelKey: "MiniMax-M2.1",
    displayName: "MiniMax M2.1",
    capability: "text_generation",
    metadata: { input: ["text"], output: ["text"] },
  },
] as const;
