import React from "react";
import ReactDOM from "react-dom";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";


type TreeNode = {
  name: string;
  children?: TreeNode[];
  event_id?: string;
};

type ControlProps = {
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
  treeData: TreeNode | null;
  onPathSearch: (entity: string, action: string, status: string) => void;
};

// Helper to flatten all status nodes (log keys) with their templates
function getAllLogKeys(tree: TreeNode | null): { event_id: string; log_template: string; status: string }[] {
  const result: { event_id: string; log_template: string; status: string }[] = [];
  function traverse(node: any) {
    if (!node) return;
    if (node.event_id && node.log_template) {
      result.push({ event_id: node.event_id, log_template: node.log_template, status: node.name });
    }
    if (node.children) node.children.forEach(traverse);
  }
  traverse(tree);
  return result;
}

export const TreeControls: React.FC<ControlProps> = ({
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
  treeData,
  onPathSearch,
}) => {
  const [selectedEntity, setSelectedEntity] = React.useState<string | null>(null);
  const [selectedAction, setSelectedAction] = React.useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = React.useState<string | null>(null);

  // Gather all log keys for dropdown
  const logKeyOptions = React.useMemo(() => getAllLogKeys(treeData), [treeData]);
  const [logKeyDropdownOpen, setLogKeyDropdownOpen] = React.useState(false);

  const entities = React.useMemo(() => {
    if (!treeData) return [];
    return treeData.children?.map(e => e.name) ?? [];
  }, [treeData]);

  const actions = React.useMemo(() => {
    if (!treeData || !selectedEntity) return [];
    const entityNode = treeData.children?.find(e => e.name === selectedEntity);
    return entityNode?.children?.map(a => a.name) ?? [];
  }, [treeData, selectedEntity]);

  const statuses = React.useMemo(() => {
    if (!treeData || !selectedEntity || !selectedAction) return [];
    const entityNode = treeData.children?.find(e => e.name === selectedEntity);
    const actionNode = entityNode?.children?.find(a => a.name === selectedAction);
    return actionNode?.children?.map(s => s.name) ?? [];
  }, [treeData, selectedEntity, selectedAction]);

  function handlePathSearch() {
    if (selectedEntity && selectedAction && selectedStatus) {
      onPathSearch(selectedEntity, selectedAction, selectedStatus);
    }
  }

  function handleUnifiedClear() {
    handleClearSearch();
    setSelectedEntity(null);
    setSelectedAction(null);
    setSelectedStatus(null);
  }

  // Refs and positions for dropdowns
  const entityInputRef = React.useRef<HTMLDivElement>(null);
  const actionInputRef = React.useRef<HTMLDivElement>(null);
  const statusInputRef = React.useRef<HTMLDivElement>(null);

  const [entityDropdownPos, setEntityDropdownPos] = React.useState({left: 0, top: 0, width: 0});
  const [actionDropdownPos, setActionDropdownPos] = React.useState({left: 0, top: 0, width: 0});
  const [statusDropdownPos, setStatusDropdownPos] = React.useState({left: 0, top: 0, width: 0});

  React.useLayoutEffect(() => {
    if (entityInputRef.current) {
      const rect = entityInputRef.current.getBoundingClientRect();
      setEntityDropdownPos({ left: rect.left, top: rect.bottom, width: rect.width });
    }
    if (actionInputRef.current) {
      const rect = actionInputRef.current.getBoundingClientRect();
      setActionDropdownPos({ left: rect.left, top: rect.bottom, width: rect.width });
    }
    if (statusInputRef.current) {
      const rect = statusInputRef.current.getBoundingClientRect();
      setStatusDropdownPos({ left: rect.left, top: rect.bottom, width: rect.width });
    }
  }, [
    selectedEntity, selectedAction, selectedStatus,
    entities, actions, statuses,
    window.innerWidth, window.innerHeight
  ]);

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
      {/* Tree Controls Toggle Section */}
      <div style={{ fontWeight: 600, fontSize: "1.1rem", marginBottom: 10, letterSpacing: 0.2 }}>
        Tree Controls
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", alignItems: "center" }}>
        <div style={{ alignItems: "flex-start", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
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
      </div>
      {/* Log Key Search Section */}
      <div style={{ marginTop: "2rem", padding: "1rem", borderTop: "1px solid #eee", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Log Key Search</div>
        <form
          onSubmit={handleSearchSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "center" }}
          autoComplete="off"
        >
          <div style={{ position: "relative", width: "fit-content" }}>
            <Command>
              <CommandInput
                placeholder="Search Log Key..."
                value={searchInput}
                onValueChange={v => {
                  setSearchInput(v);
                  setLogKeyDropdownOpen(true);
                }}
                onFocus={() => setLogKeyDropdownOpen(true)}
                onBlur={() => setTimeout(() => setLogKeyDropdownOpen(false), 150)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.currentTarget.form?.requestSubmit?.();
                    setLogKeyDropdownOpen(false);
                  }
                }}
              />
              {logKeyDropdownOpen && (
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
                  <CommandList
                    style={{
                      maxHeight: 240,
                      overflowY: "auto",
                    }}
                  >
                    {logKeyOptions
                      .filter(opt =>
                        (opt.event_id + " " + opt.log_template + " " + opt.status)
                          .toLowerCase()
                          .includes(searchInput.toLowerCase())
                      )
                      .sort((a, b) => a.event_id.localeCompare(b.event_id, undefined, { numeric: true }))
                      .map(opt => (
                        <CommandItem
                          key={opt.event_id}
                          value={opt.event_id}
                          onSelect={() => {
                            setSearchInput(opt.event_id);
                            setLogKeyDropdownOpen(false);
                            setTimeout(() => {
                              document.activeElement && (document.activeElement as HTMLElement).blur();
                            }, 0);
                          }}
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
          {searchValue && !matchedNodeId && (
            <div style={{ color: "#b00", fontSize: "0.95rem" }}>No status node found.</div>
          )}
          <Button type="submit" style={{ marginTop: 8 }}>Search Log Key</Button>
        </form>
      </div>
      {/* Path Search Section */}
      <div style={{ marginTop: "2rem", padding: "1rem", borderTop: "1px solid #eee", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Sequence Search</div>
        {/* Entity Command */}
        <div ref={entityInputRef} style={{ position: "relative", width: "fit-content" }}>
          <Command>
            <CommandInput
              placeholder="Search Entity..."
              value={selectedEntity ?? ""}
              onValueChange={v => {
                setSelectedEntity(v);
                setSelectedAction(null);
                setSelectedStatus(null);
              }}
            />
            {selectedEntity && (
              <button
                type="button"
                aria-label="Clear entity"
                onClick={() => {
                  setSelectedEntity(null);
                  setSelectedAction(null);
                  setSelectedStatus(null);
                }}
                style={{
                  position: "absolute",
                  right: 10,
                  top: 8,
                  background: "none",
                  border: "none",
                  fontSize: "1.1rem",
                  cursor: "pointer",
                  color: "#888",
                  zIndex: 2,
                }}
              >
                ×
              </button>
            )}
            {selectedEntity !== null && selectedEntity.length > 0 && !entities.includes(selectedEntity) && ReactDOM.createPortal(
              <div
                style={{
                  position: "absolute",
                  left: entityDropdownPos.left,
                  top: entityDropdownPos.top,
                  width: entityDropdownPos.width,
                  zIndex: 9999,
                  background: "#fff", // solid background
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                  borderRadius: 6,
                  border: "1px solid #e0e0e0",
                }}
              >
                <CommandList>
                  {entities
                    .filter(entity => entity.toLowerCase().includes(selectedEntity.toLowerCase()))
                    .map(entity => (
                      <CommandItem
                        key={entity}
                        value={entity}
                        onSelect={() => {
                          setSelectedEntity(entity);
                          setSelectedAction(null);
                          setSelectedStatus(null);
                        }}
                      >
                        {entity}
                      </CommandItem>
                    ))}
                </CommandList>
              </div>,
              document.body
            )}
          </Command>
        </div>
        {/* Action Command */}
        <div ref={actionInputRef} style={{ position: "relative", width: "fit-content" }}>
          <Command>
            <CommandInput
              placeholder="Search Action..."
              value={selectedAction ?? ""}
              onValueChange={v => {
                setSelectedAction(v);
                setSelectedStatus(null);
              }}
              disabled={!selectedEntity}
            />
            {selectedAction && (
              <button
                type="button"
                aria-label="Clear action"
                onClick={() => {
                  setSelectedAction(null);
                  setSelectedStatus(null);
                }}
                style={{
                  position: "absolute",
                  right: 10,
                  top: 8,
                  background: "none",
                  border: "none",
                  fontSize: "1.1rem",
                  cursor: "pointer",
                  color: "#888",
                  zIndex: 2,
                }}
              >
                ×
              </button>
            )}
            {selectedAction !== null && selectedAction.length > 0 && !actions.includes(selectedAction) && ReactDOM.createPortal(
              <div
                style={{
                  position: "absolute",
                  left: actionDropdownPos.left,
                  top: actionDropdownPos.top,
                  width: actionDropdownPos.width,
                  zIndex: 9999,
                  background: "#fff", // solid background
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                  borderRadius: 6,
                  border: "1px solid #e0e0e0",
                }}
              >
                <CommandList>
                  {actions
                    .filter(action => action.toLowerCase().includes(selectedAction.toLowerCase()))
                    .map(action => (
                      <CommandItem
                        key={action}
                        value={action}
                        onSelect={() => {
                          setSelectedAction(action);
                          setSelectedStatus(null);
                        }}
                      >
                        {action}
                      </CommandItem>
                    ))}
                </CommandList>
              </div>,
              document.body
            )}
          </Command>
        </div>
        {/* Status Command */}
        <div ref={statusInputRef} style={{ position: "relative", width: "fit-content" }}>
          <Command>
            <CommandInput
              placeholder="Search Status..."
              value={selectedStatus ?? ""}
              onValueChange={v => setSelectedStatus(v)}
              disabled={!selectedAction}
            />
            {selectedStatus && (
              <button
                type="button"
                aria-label="Clear status"
                onClick={() => setSelectedStatus(null)}
                style={{
                  position: "absolute",
                  right: 10,
                  top: 8,
                  background: "none",
                  border: "none",
                  fontSize: "1.1rem",
                  cursor: "pointer",
                  color: "#888",
                  zIndex: 2,
                }}
              >
                ×
              </button>
            )}
            {selectedStatus !== null && selectedStatus.length > 0 && !statuses.includes(selectedStatus) && ReactDOM.createPortal(
              <div
                style={{
                  position: "absolute",
                  left: statusDropdownPos.left,
                  top: statusDropdownPos.top,
                  width: statusDropdownPos.width,
                  zIndex: 9999,
                  background: "#fff", // solid background
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                  borderRadius: 6,
                  border: "1px solid #e0e0e0",
                }}
              >
                <CommandList>
                  {statuses
                    .filter(status => status.toLowerCase().includes(selectedStatus.toLowerCase()))
                    .map(status => (
                      <CommandItem
                        key={status}
                        value={status}
                        onSelect={() => setSelectedStatus(status)}
                      >
                        {status}
                      </CommandItem>
                    ))}
                </CommandList>
              </div>,
              document.body
            )}
          </Command>
        </div>
        <Button
          style={{ marginTop: 12 }}
          disabled={!selectedEntity || !selectedAction || !selectedStatus}
          onClick={handlePathSearch}
        >
          Search Sequence
        </Button>
      </div>
      {/* Unified Clear Button */}
      {(searchValue || selectedEntity || selectedAction || selectedStatus) && (
        <Button
          type="button"
          onClick={handleUnifiedClear}
          style={{ marginTop: 16, alignSelf: "flex-end" }}
          variant="secondary"
        >
          Clear All
        </Button>
      )}
    </div>
  );
};
