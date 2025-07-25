import { select } from "d3-selection";
import type { HierarchyNode } from "d3-hierarchy";
import { hasHiddenChildren } from "@/components/viz_tree_components/viz_tree_utils";
import {
  getFontSize,
  getPadding,
  getRadius,
  linkFillColor,
  linkBorderColor,
} from "@/tree_utils";

import type { TreeNode } from "@/tree_utils";

interface TreeNodeData extends TreeNode {
  collapsed?: boolean;
  indexPath?: number[];
  isAnomaly?: boolean;
  anomalyReason?: string;
}

export function decorateNode(
  this: SVGTextElement,
  d: HierarchyNode<TreeNodeData>,
  widestByDepth: number[],
  {
    clickableNodes,
    collapsible,
    showAnomalySymbols,
  }: {
    clickableNodes: boolean;
    collapsible: boolean;
    showAnomalySymbols: boolean;
  }
) {
  const fontSize = getFontSize(d.depth);
  const padding = getPadding(fontSize);
  const radius = getRadius(fontSize);
  const nodeGroup = select(this.parentNode as SVGGElement);
  const bbox = this.getBBox();

  // Label background
  nodeGroup.insert("rect", "text")
    .attr("x", bbox.x - padding)
    .attr("y", bbox.y - padding / 2)
    .attr("width", widestByDepth[d.depth])
    .attr("height", bbox.height + padding)
    .attr("fill", linkFillColor({ source: { depth: d.depth - 1 } }))
    .attr("stroke", linkBorderColor({ source: { depth: d.depth - 1 } }))
    .attr("rx", radius).attr("ry", radius)
    .style("cursor", clickableNodes ? "pointer" : "default");

  // Clickable node highlight
  if (clickableNodes) {
    nodeGroup
      .on("mouseover.button", function () {
        select(this).select("rect").attr("filter", "brightness(0.85)");
      })
      .on("mouseout.button", function () {
        select(this).select("rect").attr("filter", null);
      })
      .on("mousedown.button", function () {
        select(this).select("rect").attr("filter", "brightness(0.75)");
      })
      .on("mouseup.button", function () {
        select(this).select("rect").attr("filter", "brightness(0.85)");
      });
  }

  // Collapse indicator
  if (collapsible && d.data.collapsed === true && d.data.indexPath && d.depth < 3) {
    nodeGroup.insert("text", "text")
      .attr("class", "collapse-indicator")
      .attr("x", (bbox.x - padding) + widestByDepth[d.depth] + padding * 1.5)
      .attr("y", bbox.y + bbox.height / 2 + 2)
      .attr("alignment-baseline", "middle")
      .attr("font-size", Math.max(fontSize * 0.8, 16))
      .attr("fill", "#888")
      .attr("text-anchor", "start")
      .style("cursor", "pointer")
      .text("▶");
  }

  // Anomaly warning symbol
  if (
    showAnomalySymbols &&
    d.depth === 3 &&
    !d.children &&
    !hasHiddenChildren(d) &&
    d.data.isAnomaly
  ) {
    nodeGroup.insert("text", "text")
      .attr("class", "anomaly-warning")
      .attr("x", bbox.x - padding * 2.5 - 15)
      .attr("y", bbox.y + bbox.height / 2 + 2)
      .attr("alignment-baseline", "middle")
      .attr("font-size", Math.max(fontSize * 0.8, 14))
      .attr("fill", "#FFD100")
      .attr("text-anchor", "start")
      .style("cursor", "pointer")
      .text("⚠️")
      .append("title")
      .text(function() {
        return d.data.anomalyReason || "Anomaly detected";
      });
  }
}