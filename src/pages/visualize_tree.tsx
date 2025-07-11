import React, { useEffect, useState, useMemo } from "react";
import { csv } from "d3-fetch";
import { hierarchy } from "d3-hierarchy";
import type { HierarchyNode } from "d3-hierarchy";
import { buildTree } from "../tree_utils";
import { 
  findStatusNode,
  findNodeId, 
} from "../viz_tree_utils";
import type { TreeNode } from "../tree_utils";
import { TreeControls } from "../components/viz_tree/control_panel/viz_tree_controls";
import { VizTree } from "../components/viz_tree/viz_tree";
import { TreeInfoPanel } from "../components/viz_tree/tree_info_panel";
import { Footer } from "@/components/footer";

export const VisualizeTree: React.FC = () => {
  const [treeData, setTreeData] = useState<TreeNode | null>(null);
  const [collapseEntities, setCollapseEntities] = useState(false);
  const [collapseActions, setCollapseActions] = useState(false);
  const [collapseStatuses, setCollapseStatuses] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [matchedNodeId, setMatchedNodeId] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<HierarchyNode<TreeNode> | null>(null);
  const [matchedNodeObj, setMatchedNodeObj] = useState<HierarchyNode<TreeNode> | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [searchMode, setSearchMode] = useState<"logKey" | "sequence" | null>(null);

  useEffect(() => {
    csv("/Krone_Tree.csv").then(rows => setTreeData(buildTree(rows)));
  }, []);

  useEffect(() => {
    if (searchMode !== "logKey") return;
    if (!treeData || !searchValue) {
      setMatchedNodeId(null);
      return;
    }
    setMatchedNodeId(findStatusNode(treeData, searchValue));
  }, [searchValue, treeData, searchMode]);

  useEffect(() => {
    if (!treeData || !matchedNodeId) {
      setMatchedNodeObj(null);
      return;
    }
    const root = hierarchy(treeData, d => d.children || d._children);
    let found: HierarchyNode<TreeNode> | null = null;
    root.each(node => {
      if (
        (node.depth === 3 && node.data.event_id === matchedNodeId) ||
        ((node.depth === 1 || node.depth === 2) && node.data.name === matchedNodeId)
      ) {
        found = node;
      }
    });
    setMatchedNodeObj(found);
  }, [treeData, matchedNodeId]);

  function handleSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSelectedEntity(null);
    setSelectedAction(null);
    setSelectedStatus(null);
    setSearchValue(searchInput.trim());
    setSearchMode("logKey");
    if (!searchInput.trim()) setHoveredNode(null);
  }

  function handleClearSearch() {
    setSearchInput("");
    setSearchValue("");
    setMatchedNodeId(null);
    setMatchedNodeObj(null);
    setSelectedEntity(null);
    setSelectedAction(null);
    setSelectedStatus(null);
    setSearchMode(null);
  }

  function handlePathSearch(entity: string, action: string, status: string) {
    setSearchMode("sequence");
    setSearchInput("");
    setSearchValue("");
    if (!treeData) return;

    let foundId: string | null = null;
    if (entity && !action && !status) foundId = entity;
    else if (entity && action && !status) foundId = action;
    else if (entity && !action && status) foundId = findNodeId(treeData, entity, undefined, status);
    else if (entity && action && status) foundId = findNodeId(treeData, entity, action, status);
    else if (!entity && action && !status) foundId = action;
    else if (!entity && !action && status) foundId = findNodeId(treeData, undefined, undefined, status);
    else if (!entity && action && status) foundId = findNodeId(treeData, undefined, action, status);

    setSearchValue(foundId ?? "");
    setMatchedNodeId(foundId);
    if (!foundId) setMatchedNodeObj(null);
  }

  const staticRootNode = useMemo(() => {
    if (!treeData) return null;
    return {
      data: treeData,
      depth: 0,
      parent: null,
      children: (treeData.children || []).map(child => ({ data: child })),
    } as unknown as HierarchyNode<TreeNode>;
  }, [treeData]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div style={{ minHeight: "100vh", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ flex: "1 1 auto", display: "flex", alignItems: "flex-start", paddingTop: "80px", paddingLeft: "20px", paddingRight: "20px", boxSizing: "border-box", overflow: "hidden" }}>
        <div style={{ flex: "0 0 25%", width: "25%", minWidth: 180, maxWidth: "30%", height: "100%", overflowY: "auto", paddingBottom: 200 }}>
          <div style={{ marginBottom: 16 }}>
            <TreeInfoPanel node={staticRootNode} title="Tree statistics" hideNodeName={true} sortLogKeys={true} />
          </div>
          <TreeControls
            collapse={{
              entities: collapseEntities,
              actions: collapseActions,
              statuses: collapseStatuses,
              setEntities: setCollapseEntities,
              setActions: setCollapseActions,
              setStatuses: setCollapseStatuses,
            }}
            search={{
              input: searchInput,
              setInput: setSearchInput,
              value: searchValue,
              matchedNodeId,
              handleSubmit: handleSearchSubmit,
              handleClear: handleClearSearch,
            }}
            selection={{
              entity: selectedEntity,
              setEntity: setSelectedEntity,
              action: selectedAction,
              setAction: setSelectedAction,
              status: selectedStatus,
              setStatus: setSelectedStatus,
              onPathSearch: handlePathSearch,
            }}
            treeData={treeData}
          />
        </div>
        <div style={{ flex: "0 0 50%", width: "50%", minWidth: 0, height: "100%", overflow: "auto", display: "flex", flexDirection: "column" }}>
          {treeData && (
            <VizTree
              treeData={treeData}
              collapseEntities={collapseEntities}
              collapseActions={collapseActions}
              collapseStatuses={collapseStatuses}
              matchedNodeId={matchedNodeId}
              setHoveredNode={setHoveredNode}
              showAnomalySymbols={true}
              disableHoverHighlight={!!matchedNodeId}
            />
          )}
        </div>
        <div style={{ flex: "0 0 25%", width: "25%", minWidth: 180, maxWidth: "30%", height: "100%", overflowY: "auto" }}>
          <TreeInfoPanel node={searchValue && matchedNodeObj ? matchedNodeObj : hoveredNode} />
        </div>
      </div>
      <div style={{ flex: "0 0 auto" }}>
        <Footer />
      </div>
    </div>
  );
};
