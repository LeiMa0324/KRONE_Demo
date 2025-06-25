import React, { useEffect, useRef, useState } from "react";
import { hierarchy, tree as d3Tree, type HierarchyNode } from "d3-hierarchy";
import { select } from "d3-selection";
import type { TreeNode } from "../tree_utils";

type TreeLink = { source: HierarchyNode<TreeNode>; target: HierarchyNode<TreeNode> };

type TreeRendererProps = {
  treeData: TreeNode;
  collapseEntities: boolean;
  collapseActions: boolean;
  collapseStatuses: boolean;
  matchedNodeId: string | null;
  setHoveredNode: (node: HierarchyNode<TreeNode> | null) => void;
};

// helper type for nodes with _children
type HierarchyNodeWithHiddenChildren<T> = HierarchyNode<T> & { _children?: HierarchyNode<T>[] };

// helper function for type guard
function hasHiddenChildren(node: HierarchyNode<TreeNode>): node is HierarchyNodeWithHiddenChildren<TreeNode> {
  return Array.isArray((node as HierarchyNodeWithHiddenChildren<TreeNode>)._children);
}

export const TreeRenderer: React.FC<TreeRendererProps> = ({
  treeData,
  collapseEntities,
  collapseActions,
  collapseStatuses,
  matchedNodeId,
  setHoveredNode,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [localTree, setLocalTree] = useState<TreeNode | null>(null);

  // Only reset localTree when treeData changes
  useEffect(() => {
    setLocalTree(JSON.parse(JSON.stringify(treeData)));
  }, [treeData]);

  useEffect(() => {
    if (!svgRef.current || !localTree) return;

    // Collapse/expand logic
    function collapseAtDepth(
      node: HierarchyNode<TreeNode>,
      targetDepth: number,
      currentDepth = 0
    ) {
      if (!node.children) return;
      if (currentDepth === targetDepth) {
        node.data._children = node.children.map(child => child.data);
        (node as HierarchyNodeWithHiddenChildren<TreeNode>)._children = node.children;
        node.children = undefined;
      } else {
        node.children.forEach((child) =>
          collapseAtDepth(child, targetDepth, currentDepth + 1)
        );
      }
    }
    function expandAtDepth(
      node: HierarchyNode<TreeNode>,
      targetDepth: number,
      currentDepth = 0
    ) {
      if (
        currentDepth === targetDepth &&
        hasHiddenChildren(node)
      ) {
        node.children = node._children;
        node._children = undefined;
      }
      if (node.children) {
        node.children.forEach((child) =>
          expandAtDepth(child, targetDepth, currentDepth + 1)
        );
      }
      if (hasHiddenChildren(node) && node._children) {
        node._children.forEach((child) =>
          expandAtDepth(child, targetDepth, currentDepth + 1)
        );
      }
    }

    const root = hierarchy<TreeNode>(localTree, (d) => d.children);

    if (collapseEntities) collapseAtDepth(root, 0);
    else expandAtDepth(root, 1);
    if (collapseActions) collapseAtDepth(root, 1);
    else expandAtDepth(root, 2);
    if (collapseStatuses) collapseAtDepth(root, 2);
    else expandAtDepth(root, 3);

    const baseFont = 28, minFont = 15, fontStep = 5;
    const basePadding = 0.25, baseRadius = 0.25;
    const siblingSpacing = 13;

    const getFontSize = (depth: number) => Math.max(baseFont - depth * fontStep, minFont);
    const getPadding = (fontSize: number) => fontSize * basePadding;
    const getRadius = (fontSize: number) => fontSize * baseRadius;

    const getSeparation = (a: HierarchyNode<TreeNode>, b: HierarchyNode<TreeNode>) => {
      const fontA = getFontSize(a.depth);
      const fontB = getFontSize(b.depth);
      return (Math.max(fontA, fontB) + 8) / 14;
    };

    const getCssVar = (name: string) =>
      getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const wpired = getCssVar('--color-WPIRed');
    const wpigold = getCssVar('--color-WPIGold');
    const wpigrey = getCssVar('--color-WPIGrey');
    const font = getCssVar('--font-WPIfont');

    const linkColor = (d: { source: { depth: number } }) => {
      switch (d.source.depth) {
        case 0: return wpired;
        case 1: return wpigold;
        case 2: return wpigrey;
        default: return "#000000";
      }
    };

    // Widest label calculation for spacing
    function getWidestLabels(tree: TreeNode) {
      let widestEntity = 0, widestAction = 0;
      const root = hierarchy(tree, d => d.children || d._children);
      const tempSvg = select(document.body).append("svg")
        .attr("style", "position:absolute; visibility:hidden;").attr("font-family", font);

      root.descendants().forEach((node) => {
        const fontSize = getFontSize(node.depth);
        const tempText = tempSvg.append("text")
          .attr("font-size", fontSize)
          .text(node.data.name);
        const bbox = (tempText.node() as SVGTextElement).getBBox();
        const labelWidth = bbox.width + getPadding(fontSize) * 2;
        if (node.depth === 1 && labelWidth > widestEntity) widestEntity = labelWidth;
        if (node.depth === 2 && labelWidth > widestAction) widestAction = labelWidth;
        tempText.remove();
      });
      tempSvg.remove();
      return { widestEntity, widestAction };
    }

    const { widestEntity, widestAction } = getWidestLabels(treeData);
    const dyRootToEntity = widestEntity + 60;
    const dyEntityToAction = widestAction + 60;
    const dyActionToStatus = 150;

    const getYByDepth = (depth: number) => {
      if (depth === 0) return 0;
      if (depth === 1) return dyRootToEntity;
      if (depth === 2) return dyRootToEntity + dyEntityToAction;
      if (depth === 3) return dyRootToEntity + dyEntityToAction + dyActionToStatus;
      return 0;
    };

    (d3Tree<TreeNode>().nodeSize([40, 0]).separation(() => 1))(root);
    root.each((node: HierarchyNode<TreeNode>) => {
      node.y = getYByDepth(node.depth);
    });

    const svg = select(svgRef.current);

    function render() {
      const treeLayout = d3Tree<TreeNode>()
        .nodeSize([siblingSpacing + 4, Math.max(widestEntity + 20, widestAction + 40)])
        .separation(getSeparation);
      treeLayout(root);

      const leftMargin = 80;
      root.each((node: HierarchyNode<TreeNode>) => {
        node.y = getYByDepth(node.depth) + leftMargin;
      });

      let x0 = Infinity, x1 = -Infinity, maxY = 0, widestStatus = 0;
      const tempSvg = select(document.body).append("svg")
        .attr("style", "position:absolute; visibility:hidden;").attr("font-family", font);

      root.descendants().forEach((node: HierarchyNode<TreeNode>) => {
        const fontSize = getFontSize(node.depth);
        const tempText = tempSvg.append("text")
          .attr("font-size", fontSize)
          .text(node.data.name);
        const bbox = (tempText.node() as SVGTextElement).getBBox();
        let labelWidth = bbox.width + getPadding(fontSize) * 2;
        if (
          !node.children &&
          !hasHiddenChildren(node) &&
          node.data.is_anomaly
        ) {
          labelWidth += fontSize * 1.2;
        }
        if (node.depth === 3 && labelWidth > widestStatus) widestStatus = labelWidth;
        if (typeof node.y === "number" && node.y > maxY) maxY = node.y;
        tempText.remove();

        if ((node.x ?? 0) > x1) x1 = node.x ?? 0;
        if ((node.x ?? 0) < x0) x0 = node.x ?? 0;
      });
      tempSvg.remove();

      const width = maxY + widestStatus + 20;
      const minRootWidth = 400;
      const adjustedWidth = root.descendants().length === 1 ? minRootWidth : width;
      const height = x1 - x0 + baseFont * 2;

      svg.selectAll("*").remove();
      svg.attr("width", adjustedWidth)
        .attr("height", height)
        .attr("viewBox", `0 ${x0 - baseFont} ${adjustedWidth} ${height}`)
        .attr("style", "max-width: 100%; height: auto; font: 10px;")
        .attr("font-family", font);

      // links
      svg.append("g").attr("fill", "none").attr("stroke-width", 1.5)
        .selectAll("path")
        .data(root.links())
        .join("path")
        .attr("d", (d: { source: HierarchyNode<TreeNode>, target: HierarchyNode<TreeNode> }) => {
          const gap = 18;
          const sourceY = typeof d.source.y === "number" ? d.source.y : 0;
          const targetY = typeof d.target.y === "number" ? d.target.y : 0;
          const sourceStubY = sourceY + gap;
          return [`M${sourceY},${d.source.x}`, `H${sourceStubY}`, `V${d.target.x}`, `H${targetY}`].join(" ");
        })
        .attr("stroke", linkColor);

      // nodes
      const node = svg.append("g")
        .attr("stroke-linejoin", "round")
        .attr("stroke-width", 3)
        .selectAll("g")
        .data(root.descendants())
        .join("g")
        .attr("transform", (d: HierarchyNode<TreeNode>) => `translate(${d.y},${d.x})`);

      // node text and background
      node.append("text")
        .attr("class", "node-label")
        .attr("dy", "0.31em")
        .attr("x", (d: HierarchyNode<TreeNode>) => {
          const fontSize = getFontSize(d.depth);
          return (d.children || hasHiddenChildren(d) ? -fontSize * 0.2 : fontSize * 0.2);
        })
        .attr("text-anchor", (d: HierarchyNode<TreeNode>) => (d.children || hasHiddenChildren(d) ? "end" : "start"))
        .text((d: HierarchyNode<TreeNode>) => d.data.name)
        .attr("fill", "#fff")
        .attr("font-size", (d: HierarchyNode<TreeNode>) => getFontSize(d.depth))
        .on("mouseover", function (event: React.MouseEvent<SVGTextElement, MouseEvent>, d: HierarchyNode<TreeNode>) {
          if (!matchedNodeId) {
            highlightText(this, event, d);
            setHoveredNode(d);
          }
        })
        .on("mouseout", function (event: React.MouseEvent<SVGTextElement, MouseEvent>, d: HierarchyNode<TreeNode>) {
          if (!matchedNodeId) {
            unhighlightText(this, event, d);
            setHoveredNode(null);
          }
        })
        .on("click", function (
          event: React.MouseEvent<SVGTextElement, MouseEvent>,
          d: HierarchyNode<TreeNode>
        ) {
          event.stopPropagation();
          if (d.depth === 0) return;
          if (d.children) {
            (d as HierarchyNodeWithHiddenChildren<TreeNode>)._children = d.children;
            d.children = undefined;
          } else if (hasHiddenChildren(d)) {
            d.children = d._children;
            d._children = undefined;
          }
          render();
        })
        .each(function (this: SVGTextElement, d: HierarchyNode<TreeNode>) {
          const fontSize = getFontSize(d.depth);
          const padding = getPadding(fontSize);
          const radius = getRadius(fontSize);
          const nodeGroup = select(this.parentNode as Element);
          const bbox = this.getBBox();
          nodeGroup.insert("rect", "text")
            .attr("x", bbox.x - padding)
            .attr("y", bbox.y - padding / 2)
            .attr("width", bbox.width + 2 * padding)
            .attr("height", bbox.height + padding)
            .attr("fill", linkColor({ source: { depth: d.depth - 1 } }))
            .attr("rx", radius).attr("ry", radius);

          if (
            !d.children &&
            !hasHiddenChildren(d) &&
            d.data.is_anomaly
          ) {
            nodeGroup.append("text")
              .attr("x", bbox.x + bbox.width + padding * 2)
              .attr("y", bbox.y + bbox.height / 2 + 2)
              .attr("alignment-baseline", "middle")
              .attr("font-size", Math.max(fontSize * 0.8, 14))
              .attr("fill", "#FFD100")
              .text("⚠️");
          }
        });

      // search highlight matched node
      if (matchedNodeId) {
        const matched = root.descendants().find(
          d => d.depth === 3 && d.data.event_id === matchedNodeId
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
            if (hasHiddenChildren(node) && node._children)
              node._children.forEach(collectDescendants);
          }
          collectDescendants(matched);

          svg.selectAll<SVGTextElement, HierarchyNode<TreeNode>>("text")
            .each(function(n) {
              const isRelated = ancestorNodes.has(n) || descendantNodes.has(n);
              select(this)
                .attr("fill", isRelated ? "#003366" : "#fff");
              select(this.parentNode as Element).select("rect")
                .attr("fill", isRelated ? "#B3D8FF" : linkColor({ source: { depth: n.depth - 1 } }))
                .attr("stroke-width", isRelated ? 5 : 1.5);
            });

          svg.selectAll<SVGPathElement, TreeLink>("path")
            .attr("stroke", lnk => {
              const isAncestorPath =
                ancestorNodes.has(lnk.source as HierarchyNode<TreeNode>) &&
                ancestorNodes.has(lnk.target as HierarchyNode<TreeNode>);
              const isDescendantPath =
                descendantNodes.has(lnk.source as HierarchyNode<TreeNode>) &&
                descendantNodes.has(lnk.target as HierarchyNode<TreeNode>);
              return (isAncestorPath || isDescendantPath) ? "#B3D8FF" : linkColor(lnk);
            })
            .attr("stroke-width", lnk => {
              const isAncestorPath =
                ancestorNodes.has(lnk.source as HierarchyNode<TreeNode>) &&
                ancestorNodes.has(lnk.target as HierarchyNode<TreeNode>);
              const isDescendantPath =
                descendantNodes.has(lnk.source as HierarchyNode<TreeNode>) &&
                descendantNodes.has(lnk.target as HierarchyNode<TreeNode>);
              return (isAncestorPath || isDescendantPath) ? 5 : 1.5;
            });
        }
      }
    }

    function highlightText(
      _that: SVGTextElement,
      _event: React.MouseEvent<SVGTextElement, MouseEvent>,
      d: HierarchyNode<TreeNode>
    ) {
      const svg = select(svgRef.current);
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
        if (hasHiddenChildren(node) && node._children)
          node._children.forEach(collectDescendants);
      }
      collectDescendants(d);

      svg.selectAll<SVGTextElement, HierarchyNode<TreeNode>>("text")
        .each(function(n) {
          const isRelated = ancestorNodes.has(n) || descendantNodes.has(n);
          select(this)
            .attr("fill", isRelated ? "#003366" : "#fff");
          select(this.parentNode as Element).select("rect")
            .attr("fill", isRelated ? "#B3D8FF" : linkColor({ source: { depth: n.depth - 1 } }))
            .attr("stroke-width", isRelated ? 5 : 1.5);
        });

      svg.selectAll<SVGPathElement, TreeLink>("path")
        .attr("stroke", lnk => {
          const isAncestorPath =
            ancestorNodes.has(lnk.source as HierarchyNode<TreeNode>) &&
            ancestorNodes.has(lnk.target as HierarchyNode<TreeNode>);
          const isDescendantPath =
            descendantNodes.has(lnk.source as HierarchyNode<TreeNode>) &&
            descendantNodes.has(lnk.target as HierarchyNode<TreeNode>);
          return (isAncestorPath || isDescendantPath) ? "#B3D8FF" : linkColor(lnk);
        })
        .attr("stroke-width", lnk => {
          const isAncestorPath =
            ancestorNodes.has(lnk.source as HierarchyNode<TreeNode>) &&
            ancestorNodes.has(lnk.target as HierarchyNode<TreeNode>);
          const isDescendantPath =
            descendantNodes.has(lnk.source as HierarchyNode<TreeNode>) &&
            descendantNodes.has(lnk.target as HierarchyNode<TreeNode>);
          return (isAncestorPath || isDescendantPath) ? 5 : 1.5;
        });
    }
/* eslint-disable @typescript-eslint/no-unused-vars */
    function unhighlightText(
      _that: SVGTextElement,
      _event: React.MouseEvent<SVGTextElement, MouseEvent>,
      _d: HierarchyNode<TreeNode>
    ) {
      const svg = select(svgRef.current);
      svg.selectAll<SVGTextElement, HierarchyNode<TreeNode>>("text")
        .attr("fill", "#fff");
      svg.selectAll<SVGGElement, HierarchyNode<TreeNode>>("g")
        .select("rect")
        .attr("fill", n => linkColor({ source: { depth: n.depth - 1 } }))
        .attr("stroke-width", 1.5);
      svg.selectAll<SVGPathElement, TreeLink>("path")
        .attr("stroke", linkColor)
        .attr("stroke-width", 1.5);
    }

    render();

  }, [localTree, collapseEntities, collapseActions, collapseStatuses, matchedNodeId, setHoveredNode, treeData]);
/* eslint-enable @typescript-eslint/no-unused-vars */

  return (
    <div style={{ flex: 1, width: "100%", height: "100%", overflow: "auto" }}>
      <svg ref={svgRef} style={{ display: "block" }} />
    </div>
  );
};
