import React from "react";
import { Command, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import type { SearchState } from "../../types";

type LogKeyOption = {
  event_id: string;
  log_template: string;
  status: string;
};

export const LogKeySearch: React.FC<{
  search: SearchState;
  logKeyOptions: LogKeyOption[];
  dropdownOpen: boolean;
  setDropdownOpen: (v: boolean) => void;
}> = ({ search, logKeyOptions, dropdownOpen, setDropdownOpen }) => (
  <form
    onSubmit={e => {
      e.preventDefault();
      search.handleSubmit(e);
    }}
    style={{ display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "center" }}
    autoComplete="off"
  >
    <div style={{ position: "relative", width: "fit-content" }}>
      <Command>
        <CommandInput
          placeholder="Search Log Key..."
          value={search.input}
          onValueChange={v => {
            search.setInput(v);
            setDropdownOpen(true);
          }}
          onFocus={() => setDropdownOpen(true)}
          onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
          onKeyDown={e => {
            if (e.key === "Enter") {
              e.currentTarget.form?.requestSubmit?.();
              setDropdownOpen(false);
            }
          }}
        />
        {dropdownOpen && (
          <div
            style={{
              position: "absolute",
              left: 0,
              top: "100%",
              width: "100%",
              zIndex: 9999,
              background: "#fff",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              borderRadius: 6,
              border: "1px solid #e0e0e0",
            }}
          >
            <CommandList style={{ maxHeight: 240, overflowY: "auto" }}>
              {logKeyOptions
                .filter(opt =>
                  opt.event_id.toLowerCase().includes(search.input.toLowerCase()) ||
                  opt.log_template.toLowerCase().includes(search.input.toLowerCase())
                )
                .sort((a, b) => a.event_id.localeCompare(b.event_id, undefined, { numeric: true }))
                .map(opt => (
                  <CommandItem
                    key={opt.event_id}
                    value={opt.event_id}
                    onSelect={() => search.setInput(opt.event_id)}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      paddingTop: 6,
                      paddingBottom: 6,
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        fontFamily: "monospace",
                        minWidth: "56px",
                        marginRight: 8,
                      }}
                    >
                      {opt.event_id}
                    </span>
                    <span
                      style={{
                        color: "#888",
                        fontSize: "0.95em",
                        whiteSpace: "normal",
                        wordBreak: "break-word",
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      {opt.log_template}
                    </span>
                  </CommandItem>
                ))}
            </CommandList>
          </div>
        )}
      </Command>
    </div>
    {search.value && !search.matchedNodeId && (
      <div style={{ color: "#b00", fontSize: "0.95rem" }}>No status node found.</div>
    )}
    <Button type="submit" style={{ marginTop: 8 }} disabled={!search.input.trim()}>Search Log Key</Button>
  </form>
);