import React, { useEffect, useRef, useState } from "react";
import { hierarchy, tree as d3Tree } from "d3-hierarchy";
import { select } from "d3-selection";
import type { TreeNode } from "../../../tree_utils";
import {
  addIndexPath,
  toggleNodeByIndexPath,
  setCollapseAtDepth,
  BASE_FONT,
  getCssVar,
  getWidestByDepth,
} from "../../../tree_utils";
import type { 
  VizTreeProps,
} from "../types";
import {
  childrenOrCollapsed,
  offsetSubtree,
} from "../viz_tree_utils";
import { drawVizTree } from "./draw_viz_tree";

const DEFAULT_FONT = "sans-serif";
const FONT_CSS_VAR = "--font-WPIfont";
const EXTRA_COL_SPACING = [0, 60, 60, 60];
const NODE_SIZE_X = 40;
const NODE_SIZE_Y = 0;
const MIN_ENTITY_GAP = 50;
const SVG_PADDING = 200;
const COLLAPSED_WIDTH_PADDING = 20;
const MIN_ROOT_WIDTH = 400;
const DIV_STYLE = { flex: 1, width: "100%", height: "100%", overflow: "auto" };

export const VizTree: React.FC<VizTreeProps> = ({
  treeData,
  collapseEntities,
  collapseActions,
  collapseStatuses,
  matchedNodeId,
  setHoveredNode,
  showAnomalySymbols = true,
  collapsible = true,
  disableHoverHighlight = false,
  onNodeClick,
  clickableNodes = false,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [localTree, setLocalTree] = useState<TreeNode | null>(null);

  useEffect(() => {
    if (!treeData) return;
    const cloned = JSON.parse(JSON.stringify(treeData)) as TreeNode;
    setCollapseAtDepth(cloned, 1, collapseEntities);
    setCollapseAtDepth(cloned, 2, collapseActions);
    setCollapseAtDepth(cloned, 3, collapseStatuses);
    addIndexPath(cloned);
    setLocalTree(cloned);
  }, [treeData, collapseEntities, collapseActions, collapseStatuses]);

  useEffect(() => {
    if (!svgRef.current || !localTree) return;

    const font = getCssVar(FONT_CSS_VAR) || DEFAULT_FONT;
    const widestByDepth = getWidestByDepth(localTree, font);

    const extraColSpacing = EXTRA_COL_SPACING;
    const colOffsets = [0];
    for (let i = 1; i < widestByDepth.length; i++) {
      colOffsets[i] = (colOffsets[i - 1] || 0) + widestByDepth[i - 1] + extraColSpacing[i];
    }
    const getYByDepth = (depth: number) => colOffsets[depth];

    const root = hierarchy<TreeNode>(localTree, childrenOrCollapsed);
    d3Tree<TreeNode>().nodeSize([NODE_SIZE_X, NODE_SIZE_Y]).separation(() => 1)(root);

    // Ensure minimum gap between entity nodes
    const minEntityGap = MIN_ENTITY_GAP;
    const entityNodes = root.children || [];
    for (let i = 1; i < entityNodes.length; i++) {
      const prev = entityNodes[i - 1];
      const curr = entityNodes[i];
      if (curr.x! - prev.x! < minEntityGap) {
        const offset = minEntityGap - (curr.x! - prev.x!);
        offsetSubtree(curr, offset);
        for (let j = i + 1; j < entityNodes.length; j++) {
          offsetSubtree(entityNodes[j], offset);
        }
      }
    }

    root.each(node => { node.y = getYByDepth(node.depth); });

    // Calculate height and width for SVG
    let x0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    root.each(d => {
      if ((d.x ?? 0) > x1) x1 = d.x ?? 0;
      if ((d.x ?? 0) < x0) x0 = d.x ?? 0;
      if ((d.y ?? 0) > y1) y1 = d.y ?? 0;
    });

    let width = y1 + SVG_PADDING;
    if (collapseEntities) width = y1 + widestByDepth[1] + COLLAPSED_WIDTH_PADDING;
    const minRootWidth = MIN_ROOT_WIDTH;
    const adjustedWidth = root.descendants().length === 1 ? minRootWidth : width;
    const height = x1 - x0 + BASE_FONT * 2;

    drawVizTree({
      svgRef,
      root,
      widestByDepth,
      font,
      adjustedWidth,
      height,
      BASE_FONT,
      collapseEntities,
      matchedNodeId,
      setHoveredNode,
      showAnomalySymbols,
      collapsible,
      clickableNodes,
      disableHoverHighlight,
      onNodeClick,
    });

    // Collapse/expand logic for nodes
    if (collapsible) {
      const svg = svgRef.current;
      if (svg) {
        select(svg).selectAll("g")
          .on("click", function (event: any, d: any) {
            event.stopPropagation();
            if (!d.data.indexPath) return;
            setLocalTree(prev => {
              if (!prev) return null;
              const updated = toggleNodeByIndexPath(prev, d.data.indexPath!);
              addIndexPath(updated);
              return updated;
            });
          });
      }
    }
  }, [
    localTree,
    matchedNodeId,
    setHoveredNode,
    showAnomalySymbols,
    collapsible,
    clickableNodes,
    disableHoverHighlight,
    onNodeClick,
  ]);

  return (
    <div className="mb-8" style={DIV_STYLE}>
      <svg ref={svgRef} style={{ display: "block" }} />
    </div>
  );
};