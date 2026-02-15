interface PaginationProps {
  page: number;
  total: number;
  limit: number;
  hasMore: boolean;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, total, limit, hasMore, onPageChange }: PaginationProps) {
  if (total <= limit && page === 1) return null;

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="flex items-center justify-between pt-3 text-sm text-[var(--fg3)]">
      <span>
        {total} total &middot; page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="px-3 py-1 rounded bg-[var(--bg2)] disabled:opacity-30 hover:bg-[var(--bg3)] disabled:cursor-default"
        >
          Prev
        </button>
        <button
          disabled={!hasMore}
          onClick={() => onPageChange(page + 1)}
          className="px-3 py-1 rounded bg-[var(--bg2)] disabled:opacity-30 hover:bg-[var(--bg3)] disabled:cursor-default"
        >
          Next
        </button>
      </div>
    </div>
  );
}
