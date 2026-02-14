import { useState, useCallback, useEffect } from "react";
import { useDebounce } from "../hooks/useDebounce";

interface SearchBarProps {
  onSearch?: (query: string) => void;
  onDebouncedSearch?: (query: string) => void;
  placeholder?: string;
  debounceMs?: number;
  value?: string;
  className?: string;
}

export function SearchBar({
  onSearch,
  onDebouncedSearch,
  placeholder = "Search...",
  debounceMs = 300,
  value: controlledValue,
  className = "",
}: SearchBarProps) {
  const [query, setQuery] = useState(controlledValue ?? "");
  const debouncedQuery = useDebounce(query, debounceMs);

  // Sync with controlled value
  useEffect(() => {
    if (controlledValue !== undefined) {
      setQuery(controlledValue);
    }
  }, [controlledValue]);

  // Trigger debounced search
  useEffect(() => {
    onDebouncedSearch?.(debouncedQuery);
  }, [debouncedQuery, onDebouncedSearch]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onSearch?.(query);
    },
    [query, onSearch]
  );

  const handleClear = useCallback(() => {
    setQuery("");
    onSearch?.("");
    onDebouncedSearch?.("");
  }, [onSearch, onDebouncedSearch]);

  return (
    <form onSubmit={handleSubmit} className={`relative ${className}`}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-64 px-3 py-1.5 bg-[var(--bg)] border border-[var(--border)] rounded text-sm text-[var(--fg)] placeholder:text-[var(--fg3)] focus:outline-none focus:border-[var(--blue)]"
        aria-label="Search"
      />
      {query && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--fg3)] hover:text-[var(--fg)]"
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </form>
  );
}
