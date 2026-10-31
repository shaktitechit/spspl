"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { Check, ChevronDown, Plus, Search, X } from "lucide-react";

export type SearchableSelectOption = {
  id: string;
  name: string;
  sublabel?: string;
};

export type SearchableSelectProps = {
  label: string;
  required?: boolean;
  options: SearchableSelectOption[];
  valueId: string;
  valueName?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  loadingText?: string;
  error?: string;
  onSelect: (option: SearchableSelectOption | null) => void;
  onQuickAdd?: (initialQuery?: string) => void;
  quickAddLabel?: string;
  allowClear?: boolean;
  className?: string;
};

export function SearchableSelect({
  label,
  required = false,
  options,
  valueId,
  valueName,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  disabled = false,
  isLoading = false,
  loadingText = "Loading...",
  error,
  onSelect,
  onQuickAdd,
  quickAddLabel,
  allowClear = true,
  className = "",
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close when clicked outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset search when opening
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.name.toLowerCase().includes(q) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(q))
    );
  }, [options, searchQuery]);

  const selectedOption = useMemo(() => {
    if (!valueId) return null;
    return options.find((opt) => opt.id === valueId) || null;
  }, [options, valueId]);

  const displayLabel = valueName || selectedOption?.name || "";

  return (
    <div className={`relative space-y-1 ${className}`} ref={containerRef}>
      {/* Label & Quick Add CTA Bar */}
      <div className="flex items-center justify-between">
        <label className="block text-[11px] font-medium text-muted">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
        {!disabled && onQuickAdd && (
          <button
            type="button"
            onClick={() => onQuickAdd("")}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary-hover transition cursor-pointer"
            title={quickAddLabel || `Quick Add ${label}`}
          >
            <Plus className="h-3 w-3" />
            <span>{quickAddLabel || `+ Add ${label}`}</span>
          </button>
        )}
      </div>

      {/* Trigger Button */}
      <div className="relative">
        <button
          type="button"
          disabled={disabled || isLoading}
          onClick={() => setIsOpen((prev) => !prev)}
          className={`flex min-h-[38px] w-full items-center justify-between rounded-lg border bg-surface-muted px-3 py-1.5 text-xs text-foreground outline-none transition text-left cursor-pointer ${
            error
              ? "border-rose-500 ring-1 ring-rose-500/20"
              : isOpen
              ? "border-primary ring-2 ring-primary/20"
              : "border-border hover:border-border/80"
          } disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          <div className="flex-1 truncate pr-2">
            {isLoading ? (
              <span className="text-muted">{loadingText}</span>
            ) : displayLabel ? (
              <span className="font-semibold text-foreground">{displayLabel}</span>
            ) : (
              <span className="text-muted">{placeholder}</span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {allowClear && !disabled && !isLoading && valueId && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(null);
                }}
                className="rounded p-0.5 text-muted hover:text-foreground cursor-pointer transition"
                title="Clear selection"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronDown
              className={`h-4 w-4 text-muted transition-transform duration-200 ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </div>
        </button>
      </div>

      {error && <p className="text-[11px] text-rose-500">{error}</p>}

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-[120] mt-1 max-h-64 w-full rounded-xl border border-border bg-card shadow-xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
          {/* Search Header */}
          <div className="p-2 border-b border-border bg-surface-muted/50">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-border bg-card pl-8 pr-7 py-1 text-xs text-foreground outline-none focus:border-primary"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1.5 text-muted hover:text-foreground cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center justify-between mt-1 px-0.5 text-[10px] text-muted">
              <span>{filteredOptions.length} available</span>
              {onQuickAdd && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onQuickAdd(searchQuery);
                  }}
                  className="text-primary hover:underline font-semibold cursor-pointer"
                >
                  {quickAddLabel || `+ Add ${label}`}
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="overflow-y-auto max-h-48 p-1">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-xs text-muted space-y-2">
                <p>
                  No {label.toLowerCase()} found matching &quot;{searchQuery}&quot;
                </p>
                {onQuickAdd && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onQuickAdd(searchQuery);
                    }}
                    className="inline-flex items-center gap-1 rounded-md bg-primary/10 border border-primary/20 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Quick Add &quot;{searchQuery}&quot;</span>
                  </button>
                )}
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.id === valueId;
                return (
                  <div
                    key={opt.id}
                    onClick={() => {
                      onSelect(opt);
                      setIsOpen(false);
                    }}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer hover:bg-surface-muted transition ${
                      isSelected ? "bg-primary/10 text-primary font-semibold" : "text-foreground"
                    }`}
                  >
                    <div className="truncate flex-1 pr-2 flex items-center gap-1.5">
                      <span className="truncate">{opt.name}</span>
                      {opt.sublabel && (
                        <span className="text-[10px] font-normal text-muted truncate">
                          {opt.sublabel}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default SearchableSelect;

