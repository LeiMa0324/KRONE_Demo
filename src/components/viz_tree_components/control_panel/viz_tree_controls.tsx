import React from "react";
import { CollapseControls } from "./control_panel_parts/collapse_controls";
import { LogKeySearch } from "./control_panel_parts/log_key_search";
import { SequenceSearch } from "./control_panel_parts/sequence_search";
import { UnifiedClearButton } from "./control_panel_parts/unified_clear_button";
import type { TreeControlsProps } from "../types";
import { getAllLogKeys } from "@/components/viz_tree_components/viz_tree_utils";
import { getEntities, getActions, getStatuses } from "./control_selectors";

export const TreeControls: React.FC<TreeControlsProps> = ({
  collapse,
  search,
  selection,
  treeData,
}) => {
  const logKeyOptions = React.useMemo(() => getAllLogKeys(treeData), [treeData]);
  const [logKeyDropdownOpen, setLogKeyDropdownOpen] = React.useState(false);

  const [entityDropdownOpen, setEntityDropdownOpen] = React.useState(false);
  const [actionDropdownOpen, setActionDropdownOpen] = React.useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = React.useState(false);

  const entityInputRef = React.useRef<HTMLDivElement>(null);
  const actionInputRef = React.useRef<HTMLDivElement>(null);
  const statusInputRef = React.useRef<HTMLDivElement>(null);

  const [entityDropdownPos, setEntityDropdownPos] = React.useState({ left: 0, top: 0, width: 0 });
  const [actionDropdownPos, setActionDropdownPos] = React.useState({ left: 0, top: 0, width: 0 });
  const [statusDropdownPos, setStatusDropdownPos] = React.useState({ left: 0, top: 0, width: 0 });

  React.useLayoutEffect(() => {
    function updatePositions() {
      if (entityInputRef.current) {
        const rect = entityInputRef.current.getBoundingClientRect();
        setEntityDropdownPos({ left: rect.left + window.scrollX, top: rect.bottom + window.scrollY, width: rect.width });
      }
      if (actionInputRef.current) {
        const rect = actionInputRef.current.getBoundingClientRect();
        setActionDropdownPos({ left: rect.left + window.scrollX, top: rect.bottom + window.scrollY, width: rect.width });
      }
      if (statusInputRef.current) {
        const rect = statusInputRef.current.getBoundingClientRect();
        setStatusDropdownPos({ left: rect.left + window.scrollX, top: rect.bottom + window.scrollY, width: rect.width });
      }
    }
    updatePositions();
    window.addEventListener("scroll", updatePositions, true);
    window.addEventListener("resize", updatePositions);
    return () => {
      window.removeEventListener("scroll", updatePositions, true);
      window.removeEventListener("resize", updatePositions);
    };
  }, [
    selection.entity, selection.action, selection.status,
  ]);

  const entities = React.useMemo(() => getEntities(treeData ?? {}), [treeData]);
  const actions = React.useMemo(() => getActions(treeData ?? {}, selection.entity), [treeData, selection.entity]);
  const statuses = React.useMemo(() => getStatuses(treeData ?? {}, selection.entity, selection.action), [treeData, selection.entity, selection.action]);

  function handleUnifiedClear() {
    search.handleClear();
    selection.setEntity(null);
    selection.setAction(null);
    selection.setStatus(null);
  }

  return (
    <div
      style={{
        padding: "1rem",
        background: "#fff",
        borderRadius: 8,
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        minWidth: 0,
        border: "1.5px solid #e0e0e0",
      }}
    >
      <div style={{ fontWeight: 600, fontSize: "1.1rem", marginBottom: 10, letterSpacing: 0.2 }}>
        Tree Controls
      </div>
      <CollapseControls collapse={collapse} />
      <div style={{ marginTop: "2rem", padding: "1rem", borderTop: "1px solid #eee", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Log Key Search</div>
        <LogKeySearch
          search={search}
          logKeyOptions={logKeyOptions}
          dropdownOpen={logKeyDropdownOpen}
          setDropdownOpen={setLogKeyDropdownOpen}
        />
      </div>
      <div style={{ marginTop: "2rem", padding: "1rem", borderTop: "1px solid #eee", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Sub-Tree Search</div>
        <SequenceSearch
          selection={selection}
          entities={entities}
          actions={actions}
          statuses={statuses}
          entityDropdownOpen={entityDropdownOpen}
          setEntityDropdownOpen={setEntityDropdownOpen}
          actionDropdownOpen={actionDropdownOpen}
          setActionDropdownOpen={setActionDropdownOpen}
          statusDropdownOpen={statusDropdownOpen}
          setStatusDropdownOpen={setStatusDropdownOpen}
          entityInputRef={entityInputRef}
          actionInputRef={actionInputRef}
          statusInputRef={statusInputRef}
          entityDropdownPos={entityDropdownPos}
          actionDropdownPos={actionDropdownPos}
          statusDropdownPos={statusDropdownPos}
          handlePathSearch={() => {
            search.setInput("");
            selection.onPathSearch(
              selection.entity ?? "",
              selection.action ?? "",
              selection.status ?? ""
            );
          }}
        />
      </div>
      <UnifiedClearButton
        show={!!(search.value || selection.entity || selection.action || selection.status)}
        handleClear={handleUnifiedClear}
      />
    </div>
  );
};
