import { select } from "d3-selection";
import type { HierarchyNode } from "d3-hierarchy";
import { decorateNode } from "./node_styling";
import { highlightRelated, resetHighlight } from "../viz_tree_utils";
import {
  getFontSize,
  linkBorderColor,
  isNodeHidden,
} from "../../../tree_utils";
import { type TreeNode } from "../../../tree_utils";
import type { TreeLink } from "../types";


interface DrawVizTreeParams {
  svgRef: React.RefObject<SVGSVGElement | null>;
  root: HierarchyNode<TreeNode>;
  widestByDepth: number[];
  font: string;
  adjustedWidth: number;
  height: number;
  BASE_FONT: number;
  collapseEntities: boolean;
  matchedNodeId?: string | null;
  setHoveredNode?: (node: any) => void;
  showAnomalySymbols: boolean;
  collapsible: boolean;
  clickableNodes: boolean;
  disableHoverHighlight: boolean;
  onNodeClick?: (node: any) => void;
}

export function drawVizTree({
  svgRef,
  root,
  widestByDepth,
  font,
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
}: DrawVizTreeParams) {
  const levelLabels = ["Entity", "Action", "Status"];
  const labelFontSize = 30;
  const labelToTreeGap = 8;

  let x0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  root.each(d => {
    if ((d.x ?? 0) > x1) x1 = d.x ?? 0;
    if ((d.x ?? 0) < x0) x0 = d.x ?? 0;
    if ((d.y ?? 0) > y1) y1 = d.y ?? 0;
  });

  let width = y1 + 200;
  if (collapseEntities) width = y1 + widestByDepth[1] + 20;
  const minRootWidth = 400;
  const svgWidth = root.descendants().length === 1 ? minRootWidth : width;

  if (!svgRef || !svgRef.current) {
    return;
  }
  const svg = select(svgRef.current as SVGSVGElement);
  svg.selectAll("*").remove();
  const verticalOffset = labelFontSize + labelToTreeGap;
  const extraBottomPadding = 40;
  svg
    .attr("width", svgWidth + 35)
    .attr("height", height + verticalOffset + extraBottomPadding)
    .attr("viewBox", `0 ${x0 - BASE_FONT - verticalOffset} ${svgWidth} ${height + verticalOffset + extraBottomPadding}`)
    .attr("style", "max-width: 100%; height: auto; font: 10px;")
    .attr("font-family", font);

  svg.append("g")
    .attr("class", "level-labels")
    .selectAll("text")
    .data(levelLabels)
    .join("text")
    .attr("x", (_d, i) => {
      const nodesAtDepth = root.descendants().filter(d => d.depth === i + 1 && !isNodeHidden(d));
      if (nodesAtDepth.length === 0) return 0;
      return Math.min(...nodesAtDepth.map(d => d.y ?? 0));
    })
    .attr("y", x0 - BASE_FONT + labelFontSize)
    .attr("text-anchor", "start")
    .attr("font-size", labelFontSize)
    .attr("font-weight", "bold")
    .attr("fill", (_d, i) => linkBorderColor({ source: { depth: i } }))
    .attr("opacity", (_d, i) => {
      const nodesAtDepth = root.descendants().filter(d => d.depth === i + 1 && !isNodeHidden(d));
      return nodesAtDepth.length === 0 ? 0 : 1;
    })
    .text(d => d);
 

  // Draw links
  svg.append("g").attr("fill", "none").attr("stroke-width", 1.5)
    .selectAll<SVGPathElement, TreeLink>("path")
    .data(root.links())
    .join("path")
    .attr("d", (d: TreeLink) => {
      const sourceWidth = widestByDepth[d.source.depth];
      const sourceY = (d.source.y ?? 0) + sourceWidth - 20;
      const sourceX = (d.source.x ?? 0) + labelFontSize + labelToTreeGap;
      const targetY = d.target.y ?? 0;
      const targetX = (d.target.x ?? 0) + labelFontSize + labelToTreeGap;
      const midY = (sourceY + targetY) / 2;
      return [
        `M${sourceY},${sourceX}`,
        `H${midY}`,
        `V${targetX}`,
        `H${targetY}`
      ].join(" ");
    })
    .attr("stroke", linkBorderColor)
    .attr("opacity", d => (isNodeHidden(d.source) || isNodeHidden(d.target)) ? 0 : 1);

  // Draw nodes
  const node = svg.append("g")
    .attr("stroke-linejoin", "round")
    .attr("stroke-width", 2)
    .selectAll<SVGGElement, HierarchyNode<TreeNode>>("g")
    .data(root.descendants())
    .join("g")
    .attr("transform", (d: HierarchyNode<TreeNode>) => `translate(${d.y},${(d.x ?? 0) + labelFontSize + labelToTreeGap})`)
    .attr("opacity", d => isNodeHidden(d) ? 0 : 1)
    .attr("pointer-events", d => isNodeHidden(d) ? "none" : "auto")
    .on("mouseover", function (_event: MouseEvent, d: HierarchyNode<TreeNode>) {
      if (!(this instanceof SVGElement) || disableHoverHighlight) return;
      highlightRelated(svg, d);
      if (setHoveredNode) setHoveredNode(d);
    })
    .on("mouseout", function () {
      if (!(this instanceof SVGElement) || disableHoverHighlight) return;
      resetHighlight(svg);
      if (setHoveredNode) setHoveredNode(null);
    })

  // Draw node labels and decorations
  node.append("text")
    .attr("class", "node-label")
    .attr("dy", "0.31em")
    .attr("x", (d: HierarchyNode<TreeNode>) => getFontSize(d.depth) * 0.2)
    .attr("text-anchor", "start")
    .text((d: HierarchyNode<TreeNode>) => d.data.name)
    .attr("fill", "#000")
    .attr("font-size", (d: HierarchyNode<TreeNode>) => getFontSize(d.depth))
    .each(function (this: SVGTextElement, d: HierarchyNode<TreeNode>) {
      decorateNode.call(
        this,
        d,
        widestByDepth,
        {
          clickableNodes,
          collapsible,
          showAnomalySymbols,
        }
      );
    });

  if (clickableNodes && onNodeClick) {
    node.on("click", function (_event, d) {
      onNodeClick(d);
    });
  }


  // Highlight matched node
  if (matchedNodeId) {
    const matched = root.descendants().find(
      d =>
        d.data.name === matchedNodeId ||
        (d.data.event_id && d.data.event_id === matchedNodeId)
    );
    if (matched) {
      highlightRelated(svg, matched); // highlight matched node
    }
  }
}