"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SearchForm({
  defaultValue,
  action = "/app/search",
}: {
  defaultValue: string;
  action?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  return (
    <form
      className="max-w-xl"
      onSubmit={(event) => {
        event.preventDefault();
        const next = value.trim();
        router.push(next ? `${action}?q=${encodeURIComponent(next)}` : action);
      }}
    >
      <label className="flex flex-col gap-2 text-sm text-ink-soft">
        Look through your threads
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="min-h-12 rounded-md border border-line bg-paper px-3 text-ink"
          name="q"
          type="search"
          autoComplete="off"
        />
      </label>
      <button type="submit" className="mt-4 min-h-11 rounded-md bg-ink px-4 text-sm text-paper">
        Search
      </button>
    </form>
  );
}
