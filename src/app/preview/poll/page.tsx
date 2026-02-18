import PollDisplay from "@/components/post/PollDisplay";

export default function PollPreviewPage() {
  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="font-display text-base-content mb-4 text-2xl font-bold">Poll UI Preview</h1>

      <div className="bg-base-200 border-neutral rounded-box border p-4">
        <PollDisplay
          postId="preview"
          isExpired={true}
          initialUserVote="opt_d"
          initialOptions={[
            {
              id: "opt_a",
              text: "Option A with a very very very very very very very very very very very very long label that should wrap on mobile",
              vote_count: 3,
              position: 0,
            },
            {
              id: "opt_b",
              text: "Option B",
              vote_count: 3,
              position: 1,
            },
            {
              id: "opt_c",
              text: "Option C",
              vote_count: 2,
              position: 2,
            },
            {
              id: "opt_d",
              text: "Option D",
              vote_count: 1,
              position: 3,
            },
          ]}
        />
      </div>
    </div>
  );
}
