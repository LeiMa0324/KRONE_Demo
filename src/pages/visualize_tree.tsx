import React, { useEffect, useState } from "react";
import { csv } from "d3-fetch";
import { hierarchy } from "d3-hierarchy";
import type { HierarchyNode } from "d3-hierarchy";
import { buildTree } from "../tree_utils";
import type { TreeNode } from "../tree_utils";
import { TreeControls } from "../components/viz_tree_controls";
import { VizTree } from "../components/viz_tree";
import { TreeInfoPanel } from "../components/tree_info_panel";

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

  useEffect(() => {
    csv("/Krone_Tree.csv").then(rows => {
      setTreeData(buildTree(rows));
    });
  }, []);

  useEffect(() => {
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
  }, [searchValue, treeData]);

  useEffect(() => {
    if (!treeData || !matchedNodeId) { setMatchedNodeObj(null); return; }
    const root = hierarchy(treeData, d => d.children || d._children);
    let found: HierarchyNode<TreeNode> | null = null;
    root.each(node => {
      if (node.depth === 3 && node.data.event_id === matchedNodeId) found = node;
    });
    setMatchedNodeObj(found);
  }, [treeData, matchedNodeId]);

  function handleSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSearchValue(searchInput.trim());
    if (!searchInput.trim()) setHoveredNode(null);
  }

  function handleClearSearch() {
    setSearchInput("");
    setSearchValue("");
    setMatchedNodeId(null);
    setMatchedNodeObj(null);
  }

  function handlePathSearch(entity: string, action: string, status: string) {
    if (!treeData) return;

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
  }

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
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
  );
};
