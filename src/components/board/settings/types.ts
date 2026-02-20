import type { ModeratorPermissions } from "@/types/board";
import type { Rule } from "@/hooks/use-rules-editor";

export interface Moderator {
  id: string;
  user_id: string;
  role: string;
  permissions?: Partial<ModeratorPermissions>;
  profiles: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
}

export interface SearchProfile {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

export interface BoardSettings {
  slug: string;
  name: string;
  description?: string | null;
  banner_url?: string | null;
  rules?: Rule[] | null;
}
