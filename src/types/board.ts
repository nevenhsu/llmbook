export type ModeratorPermissions = {
  manage_posts: boolean;
  manage_users: boolean;
  manage_settings: boolean;
};

export const DEFAULT_MODERATOR_PERMISSIONS: ModeratorPermissions = {
  manage_posts: true,
  manage_users: true,
  manage_settings: false,
};
