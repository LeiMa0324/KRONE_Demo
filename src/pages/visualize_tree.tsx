import React, { useEffect, useRef, useState } from "react";
import { hierarchy, tree } from "d3-hierarchy";
import type { HierarchyNode } from "d3-hierarchy";
import { select } from "d3-selection";
import { linkHorizontal } from "d3-shape";
import { csv } from "d3-fetch";
import { Switch } from "@/components/ui/switch"

type TreeNode = {
  name: string;
  children?: TreeNode[];
  _children?: TreeNode[];
};

type HierarchyTreeNode = HierarchyNode<TreeNode> & { _children?: HierarchyTreeNode[] };

type CsvRow = {
  entity?: string;
  action?: string;
  status?: string;
  [key: string]: string | undefined;
};

function buildTree(rows: CsvRow[]): TreeNode {
  const root: TreeNode = { name: "Root", children: [] };
  const entityMap: Record<string, TreeNode> = {};

  rows.forEach((row) => {
    const entity = row.entity || "Unknown";
    const action = row.action || "Unknown";
    const status = row.status || "Unknown";

    // Entity node
    if (!entityMap[entity]) {
      entityMap[entity] = { name: entity, children: [] };
      root.children!.push(entityMap[entity]);
    }
    const entityNode = entityMap[entity];

    // Action node
    let actionNode = entityNode.children!.find((child) => child.name === action);
    if (!actionNode) {
      actionNode = { name: action, children: [] };
      entityNode.children!.push(actionNode);
    }

    // Status node
    if (!actionNode.children!.find((child) => child.name === status)) {
      actionNode.children!.push({ name: status });
    }
  });

  return root;
}

export const VisualizeTree: React.FC = () => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [treeData, setTreeData] = useState<TreeNode | null>(null);

  const [collapseEntities, setCollapseEntities] = useState(false);
  const [collapseActions, setCollapseActions] = useState(false);
  const [collapseStatuses, setCollapseStatuses] = useState(false);

  function collapseAtDepth(node: TreeNode, targetDepth: number, currentDepth = 0) {
    if (!node.children) return;
    if (currentDepth === targetDepth) {
      node._children = node.children;
      node.children = undefined;
    } else {
      node.children.forEach((child) =>
        collapseAtDepth(child, targetDepth, currentDepth + 1)
      );
    }
  }
  function expandAtDepth(node: TreeNode, targetDepth: number, currentDepth = 0) {
    if (currentDepth === targetDepth && node._children) {
      node.children = node._children;
      node._children = undefined;
    }
    if (node.children) {
      node.children.forEach((child) =>
        expandAtDepth(child, targetDepth, currentDepth + 1)
      );
    }
    if (node._children) {
      node._children.forEach((child) =>
        expandAtDepth(child, targetDepth, currentDepth + 1)
      );
    }
  }

  useEffect(() => {
    csv("/structured_processes.csv").then((rows) => {
      setTreeData(buildTree(rows));
    });
  }, []);

  useEffect(() => {
    if (!svgRef.current || !treeData) return;

    const width = 928;
    // const dx = 16;

    const clonedTree = JSON.parse(JSON.stringify(treeData));
    const root = hierarchy<TreeNode>(clonedTree, (d) => d.children) as d3.HierarchyNode<TreeNode> & { _children?: TreeNode[] };

    if (collapseEntities) collapseAtDepth(root, 0);
    else expandAtDepth(root, 1);

    if (collapseActions) collapseAtDepth(root, 1);
    else expandAtDepth(root, 2);

    if (collapseStatuses) collapseAtDepth(root, 2);
    else expandAtDepth(root, 3);

    const baseFont = 30;
const minFont = 15;
const fontStep = 5;

const getFontSize = (depth: number) => Math.max(baseFont - depth * fontStep, minFont);

const getSeparation = (a: HierarchyNode<TreeNode>, b: HierarchyNode<TreeNode>) => {
  const fontA = getFontSize(a.depth);
  const fontB = getFontSize(b.depth);
  return (Math.max(fontA, fontB) + 8) / 16;
};

const dy = width / (root.height + 1);
const treeLayout = tree<TreeNode>()
  .nodeSize([16, dy])
  .separation(getSeparation);

const svg = select(svgRef.current);

const linkColor = (d: { source: { depth: number } }) => {
  switch (d.source.depth) {
    case 0: return "#B31B1B";
    case 1: return "#FFD100";
    case 2: return "#888B8D";
    default: return "#000000";
  }
};

const render = () => {
  treeLayout(root);

  let x0 = Infinity;
  let x1 = -Infinity;
  root.each((d) => {
    if ((d.x ?? 0) > x1) x1 = d.x ?? 0;
    if ((d.x ?? 0) < x0) x0 = d.x ?? 0;
  });

  const height = x1 - x0 + baseFont * 2;

  svg.selectAll("*").remove();
  svg
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `${-dy / 3} ${x0 - baseFont} ${width} ${height}`)
    .attr("style", "max-width: 100%; height: auto; font: 10px sans-serif;");

  // Links
  svg
    .append("g")
    .attr("fill", "none")
    .attr("stroke-opacity", 0.4)
    .attr("stroke-width", 1.5)
    .selectAll("path")
    .data(root.links() as d3.HierarchyPointLink<TreeNode>[])
    .join("path")
    .attr("d", (d: d3.HierarchyPointLink<TreeNode>) =>
      linkHorizontal()({
        source: [d.source.y, d.source.x],
        target: [d.target.y, d.target.x],
      })
    )
    .attr("stroke", linkColor);

  // Nodes
  const node = svg
    .append("g")
    .attr("stroke-linejoin", "round")
    .attr("stroke-width", 3)
    .selectAll("g")
    .data(root.descendants() as HierarchyTreeNode[])
    .join("g")
    .attr("transform", (d) => `translate(${d.y},${d.x})`);

  // handler for toggling collapse/expand
  function handleNodeClick(_: unknown, d: HierarchyNode<TreeNode> & { _children?: HierarchyNode<TreeNode>[] }) {
    if (d.children) {
      d._children = d.children;
      d.children = undefined;
    } else if (d._children) {
      d.children = d._children;
      d._children = undefined;
    }
    render();
  }

  node
    .append("circle")
    .attr("fill", (d) => (d._children ? "#555" : "#999"))
    .attr("r", 0)
    .on("click", handleNodeClick); 

  node
    .append("text")
    .attr("dy", "0.31em")
    .attr("x", (d) => (d.children || d._children ? -6 : 6))
    .attr("text-anchor", (d) => (d.children || d._children ? "end" : "start"))
    .text((d) => d.data.name)
    .attr("fill", "#fff")
    .attr("font-size", (d) => {
      const base = 30;
      const min = 15;
      return Math.max(base - d.depth * 5, min);
    })
    .on("click", handleNodeClick) 
    .each(function (this: SVGTextElement, d) {
      const nodeGroup = select(this.parentNode as Element);
      const bbox = this.getBBox();
      nodeGroup
        .insert("rect", "text")
        .attr("x", bbox.x - 4)
        .attr("y", bbox.y - 2)
        .attr("width", bbox.width + 8)
        .attr("height", bbox.height + 4)
        .attr("fill", () => linkColor({ source: { depth: d.depth - 1 } }))
        .attr("rx", 4)
        .attr("ry", 4);
    });
};

    render();
  }, [treeData, collapseEntities, collapseActions, collapseStatuses]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "65px",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginRight: "2rem", marginTop: "2rem" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Switch checked={collapseEntities} onCheckedChange={setCollapseEntities} />
          Collapse Entities
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Switch checked={collapseActions} onCheckedChange={setCollapseActions} />
          Collapse Actions
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Switch checked={collapseStatuses} onCheckedChange={setCollapseStatuses} />
          Collapse Statuses
        </label>
      </div>
      {/* Tree SVG */}
      <svg
        ref={svgRef}
      />
    </div>
  );
};
