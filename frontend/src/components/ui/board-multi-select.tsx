"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Star, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type BoardOption = {
  value: string;
  label: string;
};

type BoardMultiSelectProps = {
  options: BoardOption[];
  selected: string[];
  primaryId: string | null;
  onSelectedChange: (selected: string[]) => void;
  onPrimaryChange: (primaryId: string | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
};

export function BoardMultiSelect({
  options,
  selected,
  primaryId,
  onSelectedChange,
  onPrimaryChange,
  placeholder = "Select boards…",
  searchPlaceholder = "Search boards…",
  emptyMessage = "No boards found.",
  disabled = false,
}: BoardMultiSelectProps) {
  const [open, setOpen] = useState(false);

  const toggleBoard = (boardId: string) => {
    if (selected.includes(boardId)) {
      const next = selected.filter((id) => id !== boardId);
      onSelectedChange(next);
      // If we removed the primary, pick next one or null
      if (primaryId === boardId) {
        onPrimaryChange(next.length > 0 ? next[0] : null);
      }
    } else {
      const next = [...selected, boardId];
      onSelectedChange(next);
      // Auto-set primary if first board
      if (!primaryId) {
        onPrimaryChange(boardId);
      }
    }
  };

  const removeBoard = (boardId: string) => {
    const next = selected.filter((id) => id !== boardId);
    onSelectedChange(next);
    if (primaryId === boardId) {
      onPrimaryChange(next.length > 0 ? next[0] : null);
    }
  };

  const setPrimary = (boardId: string) => {
    onPrimaryChange(boardId);
  };

  const selectedLabels = options.filter((o) => selected.includes(o.value));

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full justify-between h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200",
              selected.length === 0 && "text-slate-500",
            )}
          >
            {selected.length === 0
              ? placeholder
              : `${selected.length} board${selected.length > 1 ? "s" : ""} selected`}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => {
                  const isSelected = selected.includes(option.value);
                  return (
                    <CommandItem
                      key={option.value}
                      value={option.label}
                      onSelect={() => toggleBoard(option.value)}
                    >
                      <div
                        className={cn(
                          "mr-2 flex h-4 w-4 items-center justify-center rounded border border-slate-300",
                          isSelected
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "opacity-50",
                        )}
                      >
                        {isSelected ? (
                          <Check className="h-3 w-3" />
                        ) : null}
                      </div>
                      <span className="flex-1">{option.label}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected board chips */}
      {selectedLabels.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selectedLabels.map((board) => {
            const isPrimary = primaryId === board.value;
            return (
              <Badge
                key={board.value}
                variant={isPrimary ? "accent" : "default"}
                className="flex items-center gap-1 pr-1 cursor-default"
              >
                {isPrimary ? (
                  <Star className="h-3 w-3 fill-current" />
                ) : null}
                <span className="max-w-[120px] truncate">{board.label}</span>
                {!isPrimary && selected.length > 1 ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPrimary(board.value);
                    }}
                    className="ml-0.5 rounded p-0.5 hover:bg-slate-200 transition-colors"
                    title="Set as primary board"
                  >
                    <Star className="h-2.5 w-2.5 text-slate-400" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeBoard(board.value);
                  }}
                  className="ml-0.5 rounded p-0.5 hover:bg-slate-200 transition-colors"
                  title="Remove board"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      ) : null}

      {selected.length > 1 ? (
        <p className="text-xs text-slate-500">
          <Star className="inline h-3 w-3 fill-current text-slate-400" /> = primary board. Click the star on a chip to change.
        </p>
      ) : null}
    </div>
  );
}
