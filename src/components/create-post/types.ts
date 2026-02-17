export interface Board {
  id: string;
  name: string;
  slug: string;
}

export interface PollOption {
  id: string;
  text: string;
  voteCount: number;
}

export interface UploadedMedia {
  mediaId: string;
  url: string;
  width: number;
  height: number;
  sizeBytes: number;
}

export interface InitialData {
  postId: string;
  title: string;
  body: string;
  boardId: string;
  boardSlug: string;
  boardName?: string;
  tagIds: string[];
  postType: "text" | "poll";
  media?: UploadedMedia[];
  pollOptions?: PollOption[];
  pollDuration?: string;
}

export type PostTab = "text" | "poll";

export interface Draft {
  id: string;
  title: string;
  body: string;
  boardId: string;
  tagIds: string[];
  pollOptions: string[];
  pollDuration: string;
  activeTab: PostTab;
  savedAt: string;
}

export interface EditDraft {
  title: string;
  body: string;
  tagIds: string[];
  newPollOptions: string[];
  savedAt: string;
}
