import React, { useEffect, useRef, useState } from "react";
import { hierarchy, tree } from "d3-hierarchy";
import type { HierarchyNode } from "d3-hierarchy";
import { select } from "d3-selection";
import { Textarea } from "@/components/ui/textarea"
// import { linkHorizontal } from "d3-shape";
import { csv } from "d3-fetch";
import { Switch } from "@/components/ui/switch";

// TODO set proper x and y for anomaly hover
type TreeNode = {
  name: string;
  children?: TreeNode[];
  _children?: TreeNode[];
  is_anomaly?: boolean;
  anomaly_explanation?: string;
};

type CustomHierarchyNode = HierarchyNode<TreeNode> & {
  _children?: CustomHierarchyNode[];
};

type HierarchyTreeNode = HierarchyNode<TreeNode> & { _children?: HierarchyTreeNode[] };

type CsvRow = {
  // entity?: string;
  // action?: string;
  // status?: string;
  entity_node_id?: string;
  action_node_id?: string;
  status_node_id?: string;
  is_anomaly?: string;
  is_anomaly_reason?: string;
  [key: string]: string | undefined;
};

function buildTree(rows: CsvRow[]): TreeNode {
  const root: TreeNode = { name: "Root", children: [] };
  const entityMap: Record<string, TreeNode> = {};

  rows.forEach((row) => {
    // const entity = row.entity || "Unknown";
    // const action = row.action || "Unknown";
    // const status = row.status || "Unknown";
    const entity = row.entity_node_id || "Unknown";
    const action = row.action_node_id || "Unknown";
    const status = row.status_node_id || "Unknown";
    const is_anomaly = row.is_anomaly === "True";
    const anomaly_explanation = row.is_anomaly_reason || "";

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
      actionNode.children!.push({ name: status, is_anomaly, anomaly_explanation });
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

  // Remove hoveredAnomaly state
  // Add hoveredNode state
  const [hoveredNode, setHoveredNode] = useState<HierarchyNode<TreeNode> | null>(null);

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
    csv("/Krone_Tree.csv").then((rows) => {
      setTreeData(buildTree(rows));
    });
  }, []);

  useEffect(() => {
    if (!svgRef.current || !treeData) return;

    const clonedTree = JSON.parse(JSON.stringify(treeData));
    const root = hierarchy<TreeNode>(clonedTree, (d) => d.children) as d3.HierarchyNode<TreeNode> & { _children?: TreeNode[] };

    if (collapseEntities) collapseAtDepth(root, 0);
    else expandAtDepth(root, 1);

    if (collapseActions) collapseAtDepth(root, 1);
    else expandAtDepth(root, 2);

    if (collapseStatuses) collapseAtDepth(root, 2);
    else expandAtDepth(root, 3);

    const baseFont = 28;
    const minFont = 15;
const fontStep = 5;
const basePadding = 0.25;
const baseRadius = 0.25; 
const depthSpacing = 14;
const siblingSpacing = 13;

const getFontSize = (depth: number) => Math.max(baseFont - depth * fontStep, minFont);
const getPadding = (fontSize: number) => fontSize * basePadding;
const getRadius = (fontSize: number) => fontSize * baseRadius;

const getSeparation = (a: HierarchyNode<TreeNode>, b: HierarchyNode<TreeNode>) => {
  const fontA = getFontSize(a.depth);
  const fontB = getFontSize(b.depth);
  return (Math.max(fontA, fontB) + 8) / depthSpacing;
};


const getCss = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const textFont = getCss('--font-WPIfont');
let widestEntity = 0;
let widestAction = 0;

const tempSvg = select(document.body)
  .append("svg")
  .attr("style", "position: absolute; visibility: hidden;")
  .attr("font-family", textFont);

root.descendants().forEach((node) => {
  const fontSize = getFontSize(node.depth);
  const tempText = tempSvg.append("text")
    .attr("font-size", fontSize)
    .attr("font-family", textFont)
    .text(node.data.name);
  const bbox = (tempText.node() as SVGTextElement).getBBox();
  const labelWidth = bbox.width + getPadding(fontSize) * 2;

  if (node.depth === 1 && labelWidth > widestEntity) widestEntity = labelWidth;
  if (node.depth === 2 && labelWidth > widestAction) widestAction = labelWidth;

  tempText.remove();
});
tempSvg.remove();

const dy = Math.max(widestEntity + 20, widestAction + 40);
const treeLayout = tree<TreeNode>()
  .nodeSize([siblingSpacing + 4, dy])
  .separation(getSeparation);

const svg = select(svgRef.current);

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

    const render = () => {
      treeLayout(root);

      const statusDy = 150;
      if (collapseStatuses) {
        root.each(node => {
          if (node.depth === 3 && node.parent && typeof node.parent.y === "number") {
            node.y = node.parent ? node.parent.y + statusDy : 0;
          }
        });
      } else {
        root.each(node => {
          if (node.depth === 3 && node.parent && typeof node.parent.y === "number") {
            node.y = node.parent.y + statusDy;
          }
        });
      }
      const entityOffset = 80;
      root.each(node => {
        if (node.depth > 0) {
          node.y = (typeof node.y === "number" ? node.y : 0) + entityOffset;
        }
        if (node.depth === 3) {
          if (node.parent && typeof node.parent.y === "number") {
            node.y = node.parent.y + statusDy;
          }
        }
      });

      let x0 = Infinity, x1 = -Infinity;
      let y0 = Infinity, y1 = -Infinity;
      root.each((d) => {
        if ((d.x ?? 0) > x1) x1 = d.x ?? 0;
        if ((d.x ?? 0) < x0) x0 = d.x ?? 0;
        if ((d.y ?? 0) > y1) y1 = d.y ?? 0;
        if ((d.y ?? 0) < y0) y0 = d.y ?? 0;
      });

      let maxY = 0;
      let widestLabel = 0;

      const tempSvg = select(document.body)
        .append("svg")
        .attr("style", "position: absolute; visibility: hidden;")
        .attr("font-family", font);

      root.descendants().forEach((node) => {
        const fontSize = getFontSize(node.depth);
        const tempText = tempSvg.append("text")
          .attr("font-size", fontSize)
          .attr("font-family", font)
          .text(node.data.name);
        const bbox = (tempText.node() as SVGTextElement).getBBox();
        let labelWidth = bbox.width + getPadding(fontSize) * 2;

        if (!node.children && !node._children && node.data.is_anomaly) {
          labelWidth += fontSize * 1.2;
        }

        if (labelWidth > widestLabel) widestLabel = labelWidth;
        if (typeof node.y === "number" && node.y > maxY) maxY = node.y;
        tempText.remove();
      });
      tempSvg.remove();

      const width = maxY + widestLabel + 60;

      const minRootWidth = 400;
      const visibleNodes = root.descendants().length;
      const adjustedWidth =
        visibleNodes === 1 ? minRootWidth : width;

      const height = x1 - x0 + baseFont * 2;

      svg.selectAll("*").remove();
      svg
        .attr("width", adjustedWidth + entityOffset)
        .attr("height", height)
        .attr("viewBox", `${-entityOffset} ${x0 - baseFont} ${width + entityOffset} ${height}`)
        .attr("style", "max-width: 100%; height: auto; font: 10px;")
        .attr("font-family", font);

      // Links
      svg
        .append("g")
        .attr("fill", "none")
        .attr("stroke-opacity", 0.4)
        .attr("stroke-width", 1.5)
        .selectAll("path")
        .data(root.links() as d3.HierarchyPointLink<TreeNode>[])
        .join("path")

        // Flowing Nodes
        // .attr("d", (d: d3.HierarchyPointLink<TreeNode>) =>
        //   linkHorizontal()({
        //     source: [d.source.y, d.source.x],
        //     target: [d.target.y, d.target.x],
        //   })
        // )

        // Right Angle Nodes
        .attr("d", (d: d3.HierarchyPointLink<TreeNode>) => {
          const gap = 18;
          const sourceStubY = d.source.y + gap;
          return [
            `M${d.source.y},${d.source.x}`,           
            `H${sourceStubY}`,                        
            `V${d.target.x}`,                         
            `H${d.target.y}`                          
          ].join(" ");
        })
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

    function handleNodeClick(_event: unknown, d: CustomHierarchyNode) {
    if (d.depth === 0) return;
    if (d.children) {
      d._children = d.children as CustomHierarchyNode[];
      d.children = undefined;
    } else if (d._children) {
      d.children = d._children;
      d._children = undefined; 
    }
    render();
  }

  function collectRelatedNodes(d: HierarchyNode<TreeNode>) {
    const related = new Set<HierarchyNode<TreeNode>>();
    related.add(d);
    let ancestor = d.parent;
    while (ancestor) {
      related.add(ancestor);
      ancestor = ancestor.parent;
    }
    d.descendants().forEach(desc => related.add(desc));
    return related;
  }

  function highlightText(this: SVGTextElement, _event: React.MouseEvent<SVGTextElement, MouseEvent>, d: HierarchyNode<TreeNode>) {
    const related = collectRelatedNodes(d);

    svg.selectAll<SVGTextElement, HierarchyNode<TreeNode>>("text")
      .each(function(n) {
        const isRelated = related.has(n);
        select(this)
          .attr("fill", isRelated ? "#003366" : "#fff") // dark blue
        select(this.parentNode as Element).select("rect")
          .attr("fill", isRelated ? "#B3D8FF" : linkColor({ source: { depth: n.depth - 1 } })); // light blue
      });

      // highlight related nodes
      svg.selectAll<SVGPathElement, d3.HierarchyPointLink<TreeNode>>("path")
      .attr("stroke", lnk =>
        related.has(lnk.source as HierarchyNode<TreeNode>) || related.has(lnk.target as HierarchyNode<TreeNode>)
          ? "#B3D8FF" // light blue
          : linkColor(lnk)
      )
      .attr("stroke-opacity", lnk =>
        related.has(lnk.source as HierarchyNode<TreeNode>) || related.has(lnk.target as HierarchyNode<TreeNode>)
          ? 1
          : 0.4
      );
  }

  // d3 implicitly passes event as second param
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function unhighlightText(this: SVGTextElement, _event: MouseEvent, _d: HierarchyNode<TreeNode>) {
    svg.selectAll<SVGTextElement, HierarchyNode<TreeNode>>("text")
      .attr("fill", "#fff")
      .attr("font-weight", null);
    svg.selectAll<SVGGElement, HierarchyNode<TreeNode>>("g")
      .select("rect")
      .attr("fill", n => linkColor({ source: { depth: n.depth - 1 } }));
    svg.selectAll<SVGPathElement, d3.HierarchyPointLink<TreeNode>>("path")
      .attr("stroke", linkColor)
      .attr("stroke-opacity", 0.4);
  }

  node
    .append("text")
    .attr("class", "node-label")
    .attr("dy", "0.31em")
    .attr("x", (d) => {
      const fontSize = getFontSize(d.depth);
      return (d.children || d._children ? -fontSize * 0.2 : fontSize * 0.2);
    })
    .attr("text-anchor", (d) => (d.children || d._children ? "end" : "start"))
    .text((d) => d.data.name)
    .attr("fill", "#fff")
    .attr("font-size", (d) => getFontSize(d.depth))
    .on("click", function (_event, d) {
      handleNodeClick(_event, d as CustomHierarchyNode);
    })
    .on("mouseover", function (event, d) {
      highlightText.call(this, event, d);
      setHoveredNode(d); // Set hovered node here
    })
    .on("mouseout", function (event, d) {
      unhighlightText.call(this, event, d);
      setHoveredNode(null); // Clear hovered node
    })
    .each(function (this: SVGTextElement, d) {
      const fontSize = getFontSize(d.depth);
      const padding = getPadding(fontSize);
      const radius = getRadius(fontSize);
      const nodeGroup = select(this.parentNode as Element);
      const bbox = this.getBBox();
      nodeGroup
        .insert("rect", "text")
        .attr("x", bbox.x - padding)
        .attr("y", bbox.y - padding / 2)
        .attr("width", bbox.width + 2 * padding)
        .attr("height", bbox.height + padding)
        .attr("fill", () => linkColor({ source: { depth: d.depth - 1 } }))
        .attr("rx", radius)
        .attr("ry", radius);

      if (!d.children && !d._children && d.data.is_anomaly) {
        nodeGroup
          .append("text")
          .attr("class", "anomaly-warning")
          .attr("x", bbox.x + bbox.width + padding * 2)
          .attr("y", bbox.y + bbox.height / 2 + 2)
          .attr("alignment-baseline", "middle")
          .attr("font-size", Math.max(fontSize * 0.8, 14))
          .attr("fill", "#FFD100")
          .text("⚠️");
      }
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
        position: "relative",
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
      <svg ref={svgRef} />
      {/* Info section for hovered node */}
      <div
        style={{
          minWidth: 200,
          minHeight: 60,
          borderRadius: 8,
          padding: "1rem",
          marginLeft: "2rem",
          marginTop: "2rem",
          fontSize: 18,
          color: "#222",
        }}
      >
        <strong>Node Info</strong>
        <Textarea
          readOnly
          value={hoveredNode ? hoveredNode.data.name : "Hover over a node"}
          style={{
            marginTop: 8,
            fontSize: 16,
            background: "#fff",
            border: "1px solid #ccc",
            borderRadius: 6,
            minHeight: 40,
            resize: "none",
          }}
        />
      </div>
    </div>
  );
};
