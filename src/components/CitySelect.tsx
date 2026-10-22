"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { filterColombiaCities, type ColombiaCityOption } from "@/lib/colombia-cities";

const VISIBLE_LIMIT = 8;

export function CitySelect({
  id,
  name,
  defaultValue = "",
  required = false,
}: {
  id: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(defaultValue);
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const matches = useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return [];
    return filterColombiaCities(q).slice(0, VISIBLE_LIMIT);
  }, [query]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.setCustomValidity(required && !value ? "Escribe y elige una ciudad de la lista." : "");
  }, [required, value]);

  function choose(row: ColombiaCityOption) {
    setValue(row.value);
    setQuery(row.value);
    setOpen(false);
  }

  function onChange(next: string) {
    setQuery(next);
    setValue("");
    setActive(0);
    setOpen(next.trim().length >= 2);
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={query}
        required={required}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder="Escribe tu ciudad"
        className="w-full"
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => {
          if (query.trim().length >= 2 && !value) setOpen(true);
        }}
        onKeyDown={(event) => {
          if (!open || matches.length === 0) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((index) => (index + 1) % matches.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((index) => (index - 1 + matches.length) % matches.length);
          } else if (event.key === "Enter" && matches[active]) {
            event.preventDefault();
            choose(matches[active]);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      <input type="hidden" name={name} value={value} />
      {open && query.trim().length >= 2 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-line bg-surface py-1 text-sm shadow-lg"
        >
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-muted">Sin coincidencias</li>
          ) : (
            matches.map((row, index) => (
              <li key={row.value} role="option" aria-selected={index === active}>
                <button
                  type="button"
                  className={`flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left ${
                    index === active ? "bg-felt/20" : ""
                  }`}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(row)}
                >
                  <span>{row.city}</span>
                  <span className="shrink-0 text-xs text-muted">{row.department}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
