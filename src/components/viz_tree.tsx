import React, { useEffect, useRef, useState } from "react";
import { hierarchy, tree as d3Tree, type HierarchyNode } from "d3-hierarchy";
import { select } from "d3-selection";
import type { TreeNode } from "../tree_utils";

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
};

// Add indexPath to each node for collapse toggling
function addIndexPath(node: TreeNode, path: number[] = []): void {
  (node as any).indexPath = path;
  (node.children || []).forEach((c, i) => addIndexPath(c, [...path, i]));
}

// Toggle collapse by indexPath (like sequence_tree)
function toggleNodeByIndexPath(node: TreeNode, path: number[]): TreeNode {
  if (path.length === 0) return node;
  const [currentIndex, ...remainingPath] = path;
  if (!node.children || !node.children[currentIndex]) return node;
  const updatedChildren = [...node.children];
  if (remainingPath.length === 0) {
    updatedChildren[currentIndex] = {
      ...updatedChildren[currentIndex],
      collapsed: !updatedChildren[currentIndex].collapsed,
    };
  } else {
    updatedChildren[currentIndex] = toggleNodeByIndexPath(updatedChildren[currentIndex], remainingPath);
  }
  return {
    ...node,
    children: updatedChildren,
  };
}

// Collapse/expand all nodes at a given depth (like sequence_tree)
function setCollapseAtDepth(node: TreeNode, depth: number, collapse: boolean, cur = 1) {
  if (!node.children) return;
  if (cur === depth) {
    node.children.forEach(child => {
      child.collapsed = collapse;
    });
  } else {
    node.children.forEach(c => setCollapseAtDepth(c, depth, collapse, cur + 1));
  }
}

// Helper: is this node or any ancestor collapsed?
function isNodeHidden(node: HierarchyNode<TreeNode>): boolean {
  let current = node.parent;
  while (current) {
    if (current.data.collapsed) return true;
    current = current.parent;
  }
  return false;
}

// Helper: does this node have hidden children due to collapse?
function hasHiddenChildren(d: HierarchyNode<TreeNode>) {
  if (!d.children || d.children.length === 0) return false;
  if (d.data.collapsed) return true;
  return d.children.some(child => hasHiddenChildren(child));
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

    // --- Color variables and helpers (match sequence_tree.tsx) ---
    const getCssVar = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    const wpired = getCssVar('--color-WPIRed') || "#c8102e";
    const wpigold = getCssVar('--color-WPIGold') || "#ffd100";
    const wpigrey = getCssVar('--color-WPIGrey') || "#888";
    const font = getCssVar('--font-WPIfont') || "sans-serif";
    const redBG = "#fde2e5", yellowBG = "#fff8e8", greyBG = "#ededed";
    const linkBorderColor = (d: { source: { depth: number } }) => [wpired, wpigold, wpigrey, "#000"][d.source.depth] || "#000";
    const linkFillColor = (d: { source: { depth: number } }) => [redBG, yellowBG, greyBG, "#fff"][d.source.depth] || "#fff";

    // Compute widest label for each depth (column) for uniform node width
    function getWidestByDepth(tree: TreeNode) {
      const widestByDepth = [75, 0, 0, 0];
      const root = hierarchy(tree, d => d.children);
      const tempSvg = select(document.body).append("svg")
        .attr("style", "position:absolute; visibility:hidden;").attr("font-family", font);

      root.descendants().forEach((node) => {
        const fontSize = getFontSize(node.depth);
        const tempText = tempSvg.append("text")
          .attr("font-size", fontSize)
          .text(node.data.name);
        const bbox = (tempText.node() as SVGTextElement).getBBox();
        const labelWidth = bbox.width + getPadding(fontSize) * 2;
        if (node.depth >= 1 && node.depth <= 3 && labelWidth > widestByDepth[node.depth]) {
          widestByDepth[node.depth] = labelWidth;
        }
        tempText.remove();
      });
      tempSvg.remove();
      return widestByDepth;
    }

    const baseFont = 28, minFont = 15, fontStep = 5;
    const basePadding = 0.25, baseRadius = 0.25;
    const siblingSpacing = 13;
    const getFontSize = (depth: number) => Math.max(baseFont - depth * fontStep, minFont);
    const getPadding = (fontSize: number) => fontSize * basePadding;
    const getRadius = (fontSize: number) => fontSize * baseRadius;

    const widestByDepth = getWidestByDepth(localTree);

    // Calculate y positions for each depth based on widestByDepth
    const extraColSpacing = [0, 60, 60, 60];
    const colOffsets = [0];
    for (let i = 1; i < widestByDepth.length; i++) {
      colOffsets[i] = (colOffsets[i - 1] || 0) + widestByDepth[i - 1] + extraColSpacing[i];
    }
    const getYByDepth = (depth: number) => colOffsets[depth];

    // Always use all children, never prune for collapse
    const root = hierarchy<TreeNode>(localTree, d => d.children);

    // Use nodeSize for vertical spacing, but we'll manually set y for columns
    (d3Tree<TreeNode>().nodeSize([40, 0]).separation(() => 1))(root);

    // Top align: set all parents' x to their first child's x
    function topAlign(node: HierarchyNode<TreeNode>) {
      if (node.children && node.children.length > 0) {
        node.children.forEach(topAlign);
        node.x = node.children[0].x;
      }
    }
    //topAlign(root);

    // Enforce minimum vertical gap between entity nodes
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

    // Set y for each node by column
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
    const height = x1 - x0 + baseFont * 2;

    const svg = select(svgRef.current);
    svg.selectAll("*").remove();
    svg
      .attr("width", adjustedWidth)
      .attr("height", height)
      .attr("viewBox", `0 ${x0 - baseFont} ${adjustedWidth} ${height}`)
      .attr("style", "max-width: 100%; height: auto; font: 10px;")
      .attr("font-family", font);

    // --- Draw links: always from right edge of source to left edge of target ---
    svg.append("g").attr("fill", "none").attr("stroke-width", 2)
      .selectAll("path")
      .data(root.links())
      .join("path")
      .attr("d", (d: { source: HierarchyNode<TreeNode>, target: HierarchyNode<TreeNode> }) => {
        const sourceWidth = widestByDepth[d.source.depth];
        const sourceY = (d.source.y ?? 0) + sourceWidth - 20; // right edge of source
        const sourceX = d.source.x;
        const targetY = d.target.y ?? 0; // left edge of target
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

    // nodes
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
        highlightText.call(this, event, d);
        setHoveredNode(d);
      })
      .on("mouseout", function () {
        if (!(this instanceof SVGElement)) return;
        unhighlightText.call(this);
        setHoveredNode(null);
      })
      .on("click", function (event, d) {
        event.stopPropagation();
        if (!collapsible) return;
        if (!d.data.indexPath) return;
        setLocalTree(prev => {
          if (!prev) return null;
          const updated = toggleNodeByIndexPath(prev, d.data.indexPath);
          addIndexPath(updated);
          return updated;
        });
      });

    node.append("text")
      .attr("class", "node-label")
      .attr("dy", "0.31em")
      .attr("x", (d: HierarchyNode<TreeNode>) => {
        const fontSize = getFontSize(d.depth);
        return (d.children ? -fontSize * 0.2 : fontSize * 0.2);
      })
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
        if (d.children && d.children.length > 0 && d.data.collapsed && !d.parent?.data.collapsed) {
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

        // --- Warning symbol logic like sequence_tree.tsx ---
        // Show warning for anomaly nodes (not hidden by collapse)
        if (
          showAnomalySymbols &&
          (d.data as any).is_anomaly &&
          !isNodeHidden(d) &&
          !d.parent?.data.collapsed &&
          !d.parent?.parent?.data.collapsed
        ) {
          nodeGroup.append("text")
            .attr("class", "anomaly-warning")
            .attr("x", bbox.x - padding * 2.5 - 15)
            .attr("y", d.depth === 3 ? bbox.y + bbox.height / 2 + 2 : bbox.y - padding / 2 + 8)
            .attr("alignment-baseline", d.depth === 3 ? "middle" : "hanging")
            .attr("font-size", Math.max(fontSize * 0.8, d.depth === 3 ? 14 : 18))
            .attr("fill", "#FFD100")
            .attr("text-anchor", "start")
            .style("cursor", "pointer")
            .text("⚠️");
        }
        // Show warning for collapsed parent that is related to anomaly
        else if (
          showAnomalySymbols &&
          (d.data as any).is_related_to_anomaly &&
          d.data.collapsed &&
          !d.parent?.data.collapsed
        ) {
          nodeGroup.append("text")
            .attr("class", "anomaly-warning")
            .attr("x", bbox.x - padding * 2.5 - 15)
            .attr("y", d.depth === 3 ? bbox.y + bbox.height / 2 + 2 : bbox.y - padding / 2 + 8)
            .attr("alignment-baseline", d.depth === 3 ? "middle" : "hanging")
            .attr("font-size", Math.max(fontSize * 0.8, d.depth === 3 ? 14 : 18))
            .attr("fill", "#FFD100")
            .attr("text-anchor", "start")
            .style("cursor", "pointer")
            .text("⚠️");
        }
      });

    // search highlight matched node
    if (matchedNodeId) {
      const matched = root.descendants().find(
        d => d.depth === 3 && (d.data as any).event_id === matchedNodeId
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
          .each(function(n) {
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
        .each(function(n) {
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