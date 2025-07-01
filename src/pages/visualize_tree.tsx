import React, { useEffect, useState } from "react";
import { csv } from "d3-fetch";
import { hierarchy } from "d3-hierarchy";
import type { HierarchyNode } from "d3-hierarchy";
import { buildTree } from "../tree_utils";
import type { TreeNode } from "../tree_utils";
import { TreeControls } from "../components/viz_tree_controls";
import { VizTree } from "../components/viz_tree";
import { TreeInfoPanel } from "../components/tree_info_panel";
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
    csv("/Krone_Tree.csv").then(rows => {
      setTreeData(buildTree(rows));
    });
  }, []);

  useEffect(() => {
    if (searchMode !== "logKey") return;
    if (!treeData || !searchValue) { setMatchedNodeId(null); return; }
    function findStatusNode(node: TreeNode): string | null {
      if (node.event_id === searchValue) return node.event_id;
      for (const child of node.children || node._children || []) {
        const found = findStatusNode(child);
        if (found) return found;
      }
      return null;
    }
    setMatchedNodeId(findStatusNode(treeData));
  }, [searchValue, treeData, searchMode]);

  useEffect(() => {
    if (!treeData || !matchedNodeId) { setMatchedNodeObj(null); return; }
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
    // Clear sequence search state
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
    if (!treeData) return;

    // If only entity is selected
    if (entity && !action && !status) {
      setSearchValue(entity);
      setMatchedNodeId(entity);
      setMatchedNodeObj(null);
      return;
    }

    // If entity and action are selected
    if (entity && action && !status) {
      setSearchValue(action);
      setMatchedNodeId(action);
      setMatchedNodeObj(null);
      return;
    }

    // If entity and status are selected (but no action)
    if (entity && !action && status) {
      let foundId: string | null = null;
      for (const entityNode of treeData.children || []) {
        if (entityNode.name !== entity) continue;
        for (const actionNode of entityNode.children || []) {
          for (const statusNode of actionNode.children || []) {
            if (statusNode.name === status && statusNode.event_id) {
              foundId = statusNode.event_id;
              break;
            }
          }
          if (foundId) break;
        }
        if (foundId) break;
      }
      setSearchValue(foundId ?? "");
      setMatchedNodeId(foundId);
      if (!foundId) setMatchedNodeObj(null);
      return;
    }

    // If entity, action, and status are selected
    if (entity && action && status) {
      let foundId: string | null = null;
      for (const entityNode of treeData.children || []) {
        if (entityNode.name !== entity) continue;
        for (const actionNode of entityNode.children || []) {
          if (actionNode.name !== action) continue;
          for (const statusNode of actionNode.children || []) {
            if (statusNode.name === status && statusNode.event_id) {
              foundId = statusNode.event_id;
              break;
            }
          }
          if (foundId) break;
        }
        if (foundId) break;
      }
      setSearchValue(foundId ?? "");
      setMatchedNodeId(foundId);
      if (!foundId) setMatchedNodeObj(null);
      return;
    }

    // If only action is selected (search all actions)
    if (!entity && action && !status) {
      setSearchValue(action);
      setMatchedNodeId(action);
      setMatchedNodeObj(null);
      return;
    }

    // If only status is selected (search all statuses)
    if (!entity && !action && status) {
      // Find the first status node with this name
      let foundId: string | null = null;
      for (const entityNode of treeData.children || []) {
        for (const actionNode of entityNode.children || []) {
          for (const statusNode of actionNode.children || []) {
            if (statusNode.name === status && statusNode.event_id) {
              foundId = statusNode.event_id;
              break;
            }
          }
          if (foundId) break;
        }
        if (foundId) break;
      }
      setSearchValue(foundId ?? "");
      setMatchedNodeId(foundId);
      if (!foundId) setMatchedNodeObj(null);
      return;
    }

    // If action and status are selected (but no entity)
    if (!entity && action && status) {
      let foundId: string | null = null;
      for (const entityNode of treeData.children || []) {
        for (const actionNode of entityNode.children || []) {
          if (actionNode.name !== action) continue;
          for (const statusNode of actionNode.children ?? []) {
            if (statusNode.name === status && statusNode.event_id) {
              foundId = statusNode.event_id;
              break;
            }
          }
          if (foundId) break;
        }
        if (foundId) break;
      }
      setSearchValue(foundId ?? "");
      setMatchedNodeId(foundId);
      if (!foundId) setMatchedNodeObj(null);
      return;
    }
  }

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          flex: "1 1 auto",
          display: "flex",
          alignItems: "flex-start",
          paddingTop: "80px",
          paddingLeft: "20px",
          paddingRight: "20px",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        <div style={{
          flex: "0 0 25%",
          width: "25%",
          minWidth: 180,
          maxWidth: "30%",
          height: "100%",
          overflowY: "auto"
        }}>
          <TreeControls
            {...{
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
              onPathSearch: handlePathSearch,
              selectedEntity,
              setSelectedEntity,
              selectedAction,
              setSelectedAction,
              selectedStatus,
              setSelectedStatus,
            }}
          />
        </div>
        <div style={{
          flex: "0 0 50%",
          width: "50%",
          minWidth: 0,
          height: "100%",
          overflow: "auto",
          display: "flex",
          flexDirection: "column"
        }}>
          {treeData && (
            <VizTree
              treeData={treeData}
              collapseEntities={collapseEntities}
              collapseActions={collapseActions}
              collapseStatuses={collapseStatuses}
              matchedNodeId={matchedNodeId}
              setHoveredNode={setHoveredNode}
              showAnomalySymbols={true}
            />
          )}
        </div>
        <div style={{
          flex: "0 0 25%",
          width: "25%",
          minWidth: 180,
          maxWidth: "30%",
          height: "100%",
          overflowY: "auto"
        }}>
          <TreeInfoPanel node={searchValue && matchedNodeObj ? matchedNodeObj : hoveredNode} />
        </div>
      </div>
      <div style={{ flex: "0 0 auto" }}>
        <Footer />
      </div>
    </div>
  );
};
