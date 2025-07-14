import React from "react";
import { Button } from "@/components/ui/button";
import type { SelectionState } from "../../types";
import { DropdownSearchBar } from "./dropdown_search";

export const SequenceSearch: React.FC<{
  selection: SelectionState;
  entities: string[];
  actions: string[];
  statuses: string[];
  entityDropdownOpen: boolean;
  setEntityDropdownOpen: (v: boolean) => void;
  actionDropdownOpen: boolean;
  setActionDropdownOpen: (v: boolean) => void;
  statusDropdownOpen: boolean;
  setStatusDropdownOpen: (v: boolean) => void;
  entityInputRef: React.RefObject<HTMLDivElement | null>;
  actionInputRef: React.RefObject<HTMLDivElement | null>;
  statusInputRef: React.RefObject<HTMLDivElement | null>;
  entityDropdownPos: { left: number; top: number; width: number };
  actionDropdownPos: { left: number; top: number; width: number };
  statusDropdownPos: { left: number; top: number; width: number };
  handlePathSearch: () => void;
}> = ({
  selection,
  entities,
  actions,
  statuses,
  entityDropdownOpen,
  setEntityDropdownOpen,
  actionDropdownOpen,
  setActionDropdownOpen,
  statusDropdownOpen,
  setStatusDropdownOpen,
  entityInputRef,
  actionInputRef,
  statusInputRef,
  entityDropdownPos,
  actionDropdownPos,
  statusDropdownPos,
  handlePathSearch,
}) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
    {/* Entity Command */}
    <div ref={entityInputRef} style={{ position: "relative", width: "fit-content" }}>
      <DropdownSearchBar
        placeholder="Search Entity..."
        value={selection.entity}
        setValue={selection.setEntity}
        clearOthers={() => {
          selection.setAction(null);
          selection.setStatus(null);
        }}
        dropdownOpen={entityDropdownOpen}
        setDropdownOpen={setEntityDropdownOpen}
        inputRef={entityInputRef}
        dropdownPos={entityDropdownPos}
        options={entities}
      />
    </div>
    {/* Action Command */}
    <div ref={actionInputRef} style={{ position: "relative", width: "fit-content" }}>
      <DropdownSearchBar
        placeholder="Search Action..."
        value={selection.action}
        setValue={selection.setAction}
        clearOthers={() => selection.setStatus(null)}
        dropdownOpen={actionDropdownOpen}
        setDropdownOpen={setActionDropdownOpen}
        inputRef={actionInputRef}
        dropdownPos={actionDropdownPos}
        options={actions}
      />
    </div>
    {/* Status Command */}
    <div ref={statusInputRef} style={{ position: "relative", width: "fit-content" }}>
      <DropdownSearchBar
        placeholder="Search Status..."
        value={selection.status}
        setValue={selection.setStatus}
        dropdownOpen={statusDropdownOpen}
        setDropdownOpen={setStatusDropdownOpen}
        inputRef={statusInputRef}
        dropdownPos={statusDropdownPos}
        options={statuses}
      />
    </div>
    <Button
      style={{ marginTop: 12 }}
      disabled={!selection.entity && !selection.action && !selection.status}
      type="button"
      onClick={handlePathSearch}
    >
      Search Path
    </Button>
  </div>
);