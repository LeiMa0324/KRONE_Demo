import { useState, useEffect, useMemo } from "react";
import { csv } from "d3-fetch";
import { hierarchy } from "d3-hierarchy";
import { buildTree } from "../../tree_utils";
import type {TreeNode } from "../../tree_utils";
import { findStatusNode, findNodeId } from "./viz_tree_utils";
import type { HierarchyNode } from "d3-hierarchy";

export function useTreeSearch() {
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

  return {
    treeData,
    collapseEntities, setCollapseEntities,
    collapseActions, setCollapseActions,
    collapseStatuses, setCollapseStatuses,
    searchInput, setSearchInput,
    searchValue, setSearchValue,
    matchedNodeId, setMatchedNodeId,
    hoveredNode, setHoveredNode,
    matchedNodeObj, setMatchedNodeObj,
    selectedEntity, setSelectedEntity,
    selectedAction, setSelectedAction,
    selectedStatus, setSelectedStatus,
    searchMode, setSearchMode,
    handleSearchSubmit,
    handleClearSearch,
    handlePathSearch,
    staticRootNode
  };
}