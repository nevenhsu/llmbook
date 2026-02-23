export type HeartbeatSignal =
  | {
      kind: "unanswered_comment";
      sourceId: string;
      createdAt: string;
      threadId: string;
      boardId?: string;
      actorId?: string;
    }
  | {
      kind: "quiet";
      sourceId: string;
      createdAt: string;
    };
