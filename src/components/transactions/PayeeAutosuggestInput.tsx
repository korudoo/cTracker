import { useEffect, useMemo, useRef, useState } from 'react';
import { normalizePayee, sanitizePayeeName } from '@/utils/payee';

interface PayeeAutosuggestInputProps {
  id: string;
  value: string;
  suggestions: string[];
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
}

const MAX_VISIBLE_SUGGESTIONS = 20;

function dedupeSuggestions(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  values.forEach((value) => {
    const cleanValue = sanitizePayeeName(value);
    const normalized = normalizePayee(cleanValue);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    unique.push(cleanValue);
  });

  return unique;
}

export function PayeeAutosuggestInput({
  id,
  value,
  suggestions,
  placeholder,
  disabled,
  onChange,
  onBlur,
}: PayeeAutosuggestInputProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const uniqueSuggestions = useMemo(() => dedupeSuggestions(suggestions), [suggestions]);
  const query = sanitizePayeeName(value);
  const normalizedQuery = normalizePayee(query);

  const filteredSuggestions = useMemo(() => {
    if (!normalizedQuery) {
      return uniqueSuggestions.slice(0, MAX_VISIBLE_SUGGESTIONS);
    }

    const matches = uniqueSuggestions.filter((suggestion) =>
      normalizePayee(suggestion).includes(normalizedQuery),
    );
    const prefixMatches = matches.filter((suggestion) =>
      normalizePayee(suggestion).startsWith(normalizedQuery),
    );
    const containsMatches = matches.filter(
      (suggestion) => !normalizePayee(suggestion).startsWith(normalizedQuery),
    );

    return [...prefixMatches, ...containsMatches].slice(0, MAX_VISIBLE_SUGGESTIONS);
  }, [normalizedQuery, uniqueSuggestions]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setHighlightedIndex(-1);
      return;
    }

    if (!filteredSuggestions.length) {
      setHighlightedIndex(-1);
      return;
    }

    setHighlightedIndex((previous) => {
      if (previous < 0) {
        return 0;
      }
      return Math.min(previous, filteredSuggestions.length - 1);
    });
  }, [filteredSuggestions, isOpen]);

  const showNoMatches = isOpen && normalizedQuery.length >= 2 && filteredSuggestions.length === 0;

  const selectSuggestion = (suggestion: string) => {
    onChange(suggestion);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  return (
    <div ref={rootRef} className="relative">
      <input
        id={id}
        type="text"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          if (!disabled) {
            setIsOpen(true);
          }
        }}
        onBlur={onBlur}
        onKeyDown={(event) => {
          if (!isOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault();
            setIsOpen(true);
            return;
          }

          if (!isOpen || !filteredSuggestions.length) {
            if (event.key === 'Escape') {
              setIsOpen(false);
              setHighlightedIndex(-1);
            }
            return;
          }

          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setHighlightedIndex((previous) => (previous + 1) % filteredSuggestions.length);
            return;
          }

          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlightedIndex((previous) =>
              previous <= 0 ? filteredSuggestions.length - 1 : previous - 1,
            );
            return;
          }

          if (event.key === 'Enter' && highlightedIndex >= 0) {
            event.preventDefault();
            selectSuggestion(filteredSuggestions[highlightedIndex]);
            return;
          }

          if (event.key === 'Escape') {
            event.preventDefault();
            setIsOpen(false);
            setHighlightedIndex(-1);
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={`${id}-suggestions`}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
      />

      {isOpen && filteredSuggestions.length ? (
        <ul
          id={`${id}-suggestions`}
          role="listbox"
          className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {filteredSuggestions.map((suggestion, index) => (
            <li
              key={`${suggestion}-${index}`}
              role="option"
              aria-selected={highlightedIndex === index}
              className={`cursor-pointer px-3 py-2 text-sm ${
                highlightedIndex === index ? 'bg-brand-50 text-brand-800' : 'text-slate-700 hover:bg-slate-50'
              }`}
              onMouseDown={(event) => {
                event.preventDefault();
                selectSuggestion(suggestion);
              }}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      ) : null}

      {showNoMatches ? (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 shadow-lg">
          No matches
        </div>
      ) : null}
    </div>
  );
}
