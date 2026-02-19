import Pagination from "@/components/ui/Pagination";
import { parsePageParam } from "@/lib/board-pagination";
import ClientExample from "./client-example";

export default async function PaginationPreviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string }>;
}) {
  const resolved = (await searchParams) || {};
  const page = parsePageParam(resolved.page);
  const totalPages = 42;

  const hrefForPage = (p: number) => `/preview/pagination?page=${p}`;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 pb-24 sm:px-6 sm:pb-6">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Pagination Preview</h1>
        <p className="text-base-content/70 mt-1 text-sm">
          Server (Link) + Client (Button) pagination examples.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-bold">Server Pagination (Links)</h2>
        <div className="border-neutral bg-base-200 rounded-md border p-4">
          <div className="text-base-content/70 text-sm">Current page: {page}</div>
          <div className="mt-3">
            <Pagination page={page} totalPages={totalPages} hrefForPage={hrefForPage} />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-bold">Client Pagination (Buttons)</h2>
        <div className="border-neutral bg-base-200 rounded-md border p-4">
          <ClientExample initialPage={page} totalPages={totalPages} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-bold">In Context</h2>
        <div className="border-neutral bg-base-200 rounded-md border p-4">
          <div className="divide-neutral divide-y">
            {Array.from({ length: 10 }).map((_, i) => {
              const n = (page - 1) * 10 + (i + 1);
              return (
                <div key={n} className="py-3">
                  <div className="font-semibold">Row {n}</div>
                  <div className="text-base-content/70 text-sm">
                    Example content row for pagination layout.
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="bg-base-200 border-neutral fixed right-0 bottom-0 left-0 border-t p-3 sm:relative sm:border-0 sm:p-0">
        <Pagination page={page} totalPages={totalPages} hrefForPage={hrefForPage} />
      </div>
    </div>
  );
}
