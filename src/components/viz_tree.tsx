import React, { useEffect, useRef, useState } from "react";
import { hierarchy, tree as d3Tree, type HierarchyNode } from "d3-hierarchy";
import { select } from "d3-selection";
import type { TreeNode } from "../tree_utils";
import {
  addIndexPath,
  toggleNodeByIndexPath,
  setCollapseAtDepth,
  isNodeHidden,
  BASE_FONT,
  getFontSize,
  getPadding,
  getRadius,
  getCssVar,
  linkBorderColor,
  linkFillColor,
  getWidestByDepth,
} from "../tree_utils";

type TreeLink = { source: HierarchyNode<TreeNode>; target: HierarchyNode<TreeNode> };

type VizTreeProps = {
  treeData: TreeNode;
  collapseEntities: boolean;
  collapseActions: boolean;
  collapseStatuses: boolean;
  matchedNodeId: string | null;
  setHoveredNode: (node: HierarchyNode<TreeNode> | null) => void;
  showAnomalySymbols?: boolean;
  collapsible?: boolean;
  disableHoverHighlight?: boolean;
};

type HierarchyNodeWithHiddenChildren<T> = HierarchyNode<T> & { _children?: HierarchyNode<T>[] };

function hasHiddenChildren(node: HierarchyNode<TreeNode>): node is HierarchyNodeWithHiddenChildren<TreeNode> {
  return Array.isArray((node as HierarchyNodeWithHiddenChildren<TreeNode>)._children);
}

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

    const font = getCssVar('--font-WPIfont') || "sans-serif";
    const widestByDepth = getWidestByDepth(localTree, font);

    const extraColSpacing = [0, 60, 60, 60];
    const colOffsets = [0];
    for (let i = 1; i < widestByDepth.length; i++) {
      colOffsets[i] = (colOffsets[i - 1] || 0) + widestByDepth[i - 1] + extraColSpacing[i];
    }
    const getYByDepth = (depth: number) => colOffsets[depth];

    function childrenOrCollapsed(d: TreeNode) {
      if (d.collapsed) return undefined;
      return d.children;
    }

    const root = hierarchy<TreeNode>(localTree, childrenOrCollapsed);
    (d3Tree<TreeNode>().nodeSize([40, 0]).separation(() => 1))(root);

    const minEntityGap = 50;
    const entityNodes = root.children || [];
    for (let i = 1; i < entityNodes.length; i++) {
      const prev = entityNodes[i - 1];
      const curr = entityNodes[i];
      if (curr.x! - prev.x! < minEntityGap) {
        const offset = minEntityGap - (curr.x! - prev.x!);
        function offsetSubtree(node: HierarchyNode<TreeNode>, delta: number) {
          node.x! += delta;
          if (node.children) node.children.forEach(child => offsetSubtree(child, delta));
        }
        offsetSubtree(curr, offset);
        for (let j = i + 1; j < entityNodes.length; j++) {
          offsetSubtree(entityNodes[j], offset);
        }
      }
    }

    root.each(node => {
      node.y = getYByDepth(node.depth);
    });

    let x0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    root.each(d => {
      if ((d.x ?? 0) > x1) x1 = d.x ?? 0;
      if ((d.x ?? 0) < x0) x0 = d.x ?? 0;
      if ((d.y ?? 0) > y1) y1 = d.y ?? 0;
    });

    const width = y1 + 200;
    const minRootWidth = 400;
    const adjustedWidth = root.descendants().length === 1 ? minRootWidth : width;
    const height = x1 - x0 + BASE_FONT * 2;

    const svg = select(svgRef.current);
    svg.selectAll("*").remove();
    svg
      .attr("width", adjustedWidth + 35)
      .attr("height", height)
      .attr("viewBox", `0 ${x0 - BASE_FONT} ${adjustedWidth} ${height}`)
      .attr("style", "max-width: 100%; height: auto; font: 10px;")
      .attr("font-family", font);

    svg.append("g").attr("fill", "none").attr("stroke-width", 1.5)
      .selectAll("path")
      .data(root.links())
      .join("path")
      .attr("d", (d: { source: HierarchyNode<TreeNode>, target: HierarchyNode<TreeNode> }) => {
        const sourceWidth = widestByDepth[d.source.depth];
        const sourceY = (d.source.y ?? 0) + sourceWidth - 20;
        const sourceX = d.source.x;
        const targetY = d.target.y ?? 0;
        const targetX = d.target.x;
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

    const node = svg.append("g")
      .attr("stroke-linejoin", "round")
      .attr("stroke-width", 2)
      .selectAll("g")
      .data(root.descendants())
      .join("g")
      .attr("transform", (d: HierarchyNode<TreeNode>) => `translate(${d.y},${d.x})`)
      .attr("opacity", d => isNodeHidden(d) ? 0 : 1)
      .attr("pointer-events", d => isNodeHidden(d) ? "none" : "auto")
      .on("mouseover", function (event, d) {
        if (!(this instanceof SVGElement)) return;
        if (disableHoverHighlight) return;
        highlightText.call(this, event, d);
        setHoveredNode(d);
      })
      .on("mouseout", function () {
        if (!(this instanceof SVGElement)) return;
        if (disableHoverHighlight) return;
        unhighlightText.call(this);
        setHoveredNode(null);
      })
      .on("click", function (event, d) {
        event.stopPropagation();
        if (!collapsible) return;
        if (!d.data.indexPath) return;
        setLocalTree(prev => {
          if (!prev) return null;
          const updated = toggleNodeByIndexPath(prev, d.data.indexPath!);
          addIndexPath(updated);
          return updated;
        });
      });

    node.append("text")
      .attr("class", "node-label")
      .attr("dy", "0.31em")
      .attr("x", (d: HierarchyNode<TreeNode>) => getFontSize(d.depth) * 0.2)
      .attr("text-anchor", "start")
      .text((d: HierarchyNode<TreeNode>) => d.data.name)
      .attr("fill", "#000")
      .attr("font-size", (d: HierarchyNode<TreeNode>) => getFontSize(d.depth))
      .each(function (this: SVGTextElement, d: HierarchyNode<TreeNode>) {
        const fontSize = getFontSize(d.depth);
        const padding = getPadding(fontSize);
        const radius = getRadius(fontSize);
        const nodeGroup = select(this.parentNode as Element);
        const bbox = this.getBBox();
        nodeGroup.insert("rect", "text")
          .attr("x", bbox.x - padding)
          .attr("y", bbox.y - padding / 2)
          .attr("width", widestByDepth[d.depth])
          .attr("height", bbox.height + padding)
          .attr("fill", linkFillColor({ source: { depth: d.depth - 1 } }))
          .attr("stroke", linkBorderColor({ source: { depth: d.depth - 1 } }))
          .attr("rx", radius).attr("ry", radius);

        // Collapse indicator (▶) if node is collapsed
        if (
          collapsible &&
          d.data.collapsed === true &&
          d.data.indexPath &&
          d.depth < 3
        ) {
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

        // Anomaly warning symbol to the left of the label, like sequence_tree.tsx
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
            .text(d.data.anomalyReason || "Anomaly detected");
        }
      });

    if (matchedNodeId) {
      const matched = root.descendants().find(
        d =>
          d.data.name === matchedNodeId ||
          (d.data.event_id && d.data.event_id === matchedNodeId)
      );
      if (matched) {
        const ancestorNodes = new Set<HierarchyNode<TreeNode>>();
        let current: HierarchyNode<TreeNode> | null = matched;
        while (current) {
          ancestorNodes.add(current);
          current = current.parent;
        }
        const descendantNodes = new Set<HierarchyNode<TreeNode>>();
        function collectDescendants(node: HierarchyNode<TreeNode>) {
          descendantNodes.add(node);
          if (node.children) node.children.forEach(collectDescendants);
        }
        collectDescendants(matched);

        svg.selectAll<SVGTextElement, HierarchyNode<TreeNode>>("text.node-label")
          .each(function (n) {
            const isRelated = ancestorNodes.has(n) || descendantNodes.has(n);
            select(this)
              .attr("fill", isRelated ? "#003366" : "#000");
            select(this.parentNode as Element).select("rect")
              .attr("fill", isRelated ? "#B3D8FF" : linkFillColor({ source: { depth: n.depth - 1 } }))
              .attr("stroke", linkBorderColor({ source: { depth: n.depth - 1 } }))
              .attr("stroke-width", isRelated ? 5 : 2);
          });

        svg.selectAll<SVGPathElement, TreeLink>("path")
          .attr("stroke", lnk => {
            const isAncestorPath =
              ancestorNodes.has(lnk.source as HierarchyNode<TreeNode>) &&
              ancestorNodes.has(lnk.target as HierarchyNode<TreeNode>);
            const isDescendantPath =
              descendantNodes.has(lnk.source as HierarchyNode<TreeNode>) &&
              descendantNodes.has(lnk.target as HierarchyNode<TreeNode>);
            return (isAncestorPath || isDescendantPath) ? "#B3D8FF" : linkBorderColor(lnk);
          })
          .attr("stroke-width", lnk => {
            const isAncestorPath =
              ancestorNodes.has(lnk.source as HierarchyNode<TreeNode>) &&
              ancestorNodes.has(lnk.target as HierarchyNode<TreeNode>);
            const isDescendantPath =
              descendantNodes.has(lnk.source as HierarchyNode<TreeNode>) &&
              descendantNodes.has(lnk.target as HierarchyNode<TreeNode>);
            return (isAncestorPath || isDescendantPath) ? 5 : 2;
          });
      }
    }

    function highlightText(
      this: SVGElement,
      _event: React.MouseEvent<SVGTextElement, MouseEvent>,
      d: HierarchyNode<TreeNode>
    ) {
      const ancestorNodes = new Set<HierarchyNode<TreeNode>>();
      let current: HierarchyNode<TreeNode> | null = d;
      while (current) {
        ancestorNodes.add(current);
        current = current.parent;
      }
      const descendantNodes = new Set<HierarchyNode<TreeNode>>();
      function collectDescendants(node: HierarchyNode<TreeNode>) {
        descendantNodes.add(node);
        if (node.children) node.children.forEach(collectDescendants);
      }
      collectDescendants(d);

      svg.selectAll<SVGTextElement, HierarchyNode<TreeNode>>("text.node-label")
        .each(function (n) {
          const isRelated = ancestorNodes.has(n) || descendantNodes.has(n);
          select(this)
            .attr("fill", isRelated ? "#003366" : "#000");
          select(this.parentNode as Element).select("rect")
            .attr("fill", isRelated ? "#B3D8FF" : linkFillColor({ source: { depth: n.depth - 1 } }))
            .attr("stroke", linkBorderColor({ source: { depth: n.depth - 1 } }))
            .attr("stroke-width", isRelated ? 5 : 2);
        });

      svg.selectAll<SVGPathElement, TreeLink>("path")
        .attr("stroke", lnk => {
          const isAncestorPath =
            ancestorNodes.has(lnk.source as HierarchyNode<TreeNode>) &&
            ancestorNodes.has(lnk.target as HierarchyNode<TreeNode>);
          const isDescendantPath =
            descendantNodes.has(lnk.source as HierarchyNode<TreeNode>) &&
            descendantNodes.has(lnk.target as HierarchyNode<TreeNode>);
          return (isAncestorPath || isDescendantPath) ? "#B3D8FF" : linkBorderColor(lnk);
        })
        .attr("stroke-width", lnk => {
          const isAncestorPath =
            ancestorNodes.has(lnk.source as HierarchyNode<TreeNode>) &&
            ancestorNodes.has(lnk.target as HierarchyNode<TreeNode>);
          const isDescendantPath =
            descendantNodes.has(lnk.source as HierarchyNode<TreeNode>) &&
            descendantNodes.has(lnk.target as HierarchyNode<TreeNode>);
          return (isAncestorPath || isDescendantPath) ? 5 : 2;
        });
    }

    function unhighlightText(this: SVGElement) {
      svg.selectAll<SVGTextElement, HierarchyNode<TreeNode>>("text.node-label")
        .attr("fill", "#000");
      svg.selectAll<SVGGElement, HierarchyNode<TreeNode>>("g")
        .select("rect")
        .attr("fill", n => linkFillColor({ source: { depth: n.depth - 1 } }))
        .attr("stroke", n => linkBorderColor({ source: { depth: n.depth - 1 } }))
        .attr("stroke-width", 2);
      svg.selectAll<SVGPathElement, TreeLink>("path")
        .attr("stroke", linkBorderColor)
        .attr("stroke-width", 2);
    }
  }, [localTree, matchedNodeId, setHoveredNode, showAnomalySymbols, collapsible]);

  return (
    <div style={{ flex: 1, width: "100%", height: "100%", overflow: "auto" }}>
      <svg ref={svgRef} style={{ display: "block" }} />
    </div>
  );
};