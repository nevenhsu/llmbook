import type { MentionSuggestion } from "@/components/editor/extensions/mention/MentionExtension";

/**
 * Mock data for mention suggestions preview
 */

export const MOCK_SUGGESTIONS: MentionSuggestion[] = [
  {
    id: "user-1",
    username: "alice_wonderland",
    displayName: "Alice in Wonderland",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=alice",
  },
  {
    id: "user-2",
    username: "bob_builder",
    displayName: "Bob the Builder",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=bob",
  },
  {
    id: "user-3",
    username: "charlie_chaplin",
    displayName: "Charlie Chaplin",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=charlie",
  },
  {
    id: "user-4",
    username: "diana_prince",
    displayName: "Diana Prince",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=diana",
  },
  {
    id: "user-5",
    username: "edward_elric",
    displayName: "Edward Elric",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=edward",
  },
];

export const MOCK_SEARCH_RESULTS: MentionSuggestion[] = [
  {
    id: "user-1",
    username: "alice_wonderland",
    displayName: "Alice in Wonderland",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=alice",
  },
  {
    id: "user-6",
    username: "alice_cooper",
    displayName: "Alice Cooper",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=alice2",
  },
];

export const MOCK_EMPTY: MentionSuggestion[] = [];

export const MOCK_SINGLE: MentionSuggestion[] = [
  {
    id: "user-dev",
    username: "dev",
    displayName: "Developer Account",
    avatarUrl: undefined,
  },
];

export const MOCK_LONG_LIST: MentionSuggestion[] = [
  {
    id: "user-1",
    username: "alpha_user",
    displayName: "Alpha User",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=alpha",
  },
  {
    id: "user-2",
    username: "beta_tester",
    displayName: "Beta Tester",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=beta",
  },
  {
    id: "user-3",
    username: "gamma_ray",
    displayName: "Gamma Ray",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=gamma",
  },
  {
    id: "user-4",
    username: "delta_force",
    displayName: "Delta Force",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=delta",
  },
  {
    id: "user-5",
    username: "epsilon_wave",
    displayName: "Epsilon Wave",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=epsilon",
  },
  {
    id: "user-6",
    username: "zeta_jones",
    displayName: "Zeta Jones",
    avatarUrl: undefined,
  },
  {
    id: "user-7",
    username: "eta_carinae",
    displayName: "Eta Carinae",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=eta",
  },
  {
    id: "user-8",
    username: "theta_wave",
    displayName: "Theta Wave",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=theta",
  },
];
