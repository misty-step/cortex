import { useState, useCallback } from "react";

interface SearchBarProps {
  onSearch?: (query: string) => void;
  placeholder?: string;
}

export function SearchBar({ onSearch, placeholder = "Search..." }: SearchBarProps) {
  const [query, setQuery] = useState("");

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(query);
  }, [query, onSearch]);

  return (
    <form onSubmit={handleSubmit} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-64 px-3 py-1.5 bg-[var(--bg)] border border-[var(--border)] rounded text-sm text-[var(--fg)] placeholder:text-[var(--fg3)] focus:outline-none focus:border-[var(--blue)]"
      />
      {query && (
        <button
          type="button"
          onClick={() => { setQuery(""); onSearch?.(""); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--fg3)] hover:text-[var(--fg)]"
        >
          ×
        </button>
      )}
    </form>
  );
}
