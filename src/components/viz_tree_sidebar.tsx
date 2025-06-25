import React from "react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

type SidebarProps = {
  collapseEntities: boolean;
  setCollapseEntities: (v: boolean) => void;
  collapseActions: boolean;
  setCollapseActions: (v: boolean) => void;
  collapseStatuses: boolean;
  setCollapseStatuses: (v: boolean) => void;
  searchInput: string;
  setSearchInput: (v: string) => void;
  handleSearchSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  handleClearSearch: () => void;
  searchValue: string;
  matchedNodeId: string | null;
};

export const TreeSidebar: React.FC<SidebarProps> = ({
  collapseEntities,
  setCollapseEntities,
  collapseActions,
  setCollapseActions,
  collapseStatuses,
  setCollapseStatuses,
  searchInput,
  setSearchInput,
  handleSearchSubmit,
  handleClearSearch,
  searchValue,
  matchedNodeId,
}) => {
  return (
    <div
      style={{
        padding: "1rem",
        background: "#fff",
        borderRadius: 8,
        // width: 280,
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Switch checked={collapseEntities} onCheckedChange={setCollapseEntities} />
          Collapse Entities
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Switch checked={collapseActions} onCheckedChange={setCollapseActions} />
          Collapse Actions
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Switch checked={collapseStatuses} onCheckedChange={setCollapseStatuses} />
          Collapse Statuses
        </label>
      </div>
      <form onSubmit={handleSearchSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <input
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Search Log Key"
          style={{
            padding: "0.5rem",
            border: "1.5px solid #ccc",
            borderRadius: 6,
            outline: "none",
            fontSize: "1rem",
          }}
        />
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Button type="submit">Enter</Button>
          {searchValue && <Button type="button" onClick={handleClearSearch}>Clear</Button>}
        </div>
      </form>
      {searchValue && !matchedNodeId && (
        <div style={{ color: "#b00", fontSize: "0.95rem" }}>No status node found.</div>
      )}
    </div>
  );
};
