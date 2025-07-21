import { hierarchy } from "d3-hierarchy";
import { select } from "d3-selection";
import type { HierarchyLink, HierarchyNode } from "d3-hierarchy";
import type { Selection } from "d3-selection";

export type TreeNode = {
  name: string;
  children?: TreeNode[];
  _children?: TreeNode[];
  collapsed?: boolean;
  indexPath?: number[];
  isAnomaly?: boolean;
  anomalyReason?: string;
  isRelatedToAnomaly?: boolean;
  lineNumber?: number;
  event_id?: string;
  log_template?: string;
};


export type CsvRow = {
  entity_node_id?: string;
  action_node_id?: string;
  status_node_id?: string;
  isAnomaly?: string;
  anomalyExplanation?: string;
  log_template?: string;
  event_id?: string; 
  [key: string]: string | undefined;
};

export const ENTITY_BORDER = "#c8102e";
export const ACTION_BORDER = "#eec000";
export const STATUS_BORDER = "#888";
export const ENTITY_FILL = "#fde2e5";
export const ACTION_FILL = "#fff8e8";
export const STATUS_FILL = "#ededed";
export const BASE_FONT = 28;
export const MIN_FONT = 15;
export const FONT_STEP = 5;
export const BASE_PADDING = 0.35;
export const BASE_RADIUS = 0.25;
export const DEPTH_SPACING = 14;

// Function to build a tree structure from CSV rows
// Each row represents a node in the tree with entity, action, and status information
export function buildTree(rows: CsvRow[]): TreeNode {
  const root: TreeNode = { name: "Root", children: [] };
  const entityMap: Record<string, TreeNode> = {};

  rows.forEach((row) => {
    const entity = row.entity_node_id || "Unknown";
    const action = row.action_node_id || "Unknown";
    const status = row.status_node_id || "Unknown";
    const is_anomaly = row.is_anomaly === "True";
    const anomaly_explanation = row.is_anomaly_reason || "";
    const log_template = row.log_template || "";
    const event_id = row.event_id || "";

    if (!entityMap[entity]) {
      entityMap[entity] = { name: entity, children: [] };
      root.children!.push(entityMap[entity]);
    }
    const entityNode = entityMap[entity];

    let actionNode = entityNode.children!.find((child) => child.name === action);
    if (!actionNode) {
      actionNode = { name: action, children: [] };
      entityNode.children!.push(actionNode);
    }

    if (!actionNode.children!.find((child) => child.name === status)) {
      actionNode.children!.push({
        name: status,
        isAnomaly: is_anomaly,
        anomalyReason: anomaly_explanation,
        log_template,
        event_id, 
      });
    }
  });

  return root;
}

// Collapse and expand functions for tree nodes
// These functions allow collapsing and expanding nodes at a specific depth in the tree structure.
export function collapseAtDepth(node: TreeNode, targetDepth: number, currentDepth = 0) {
  if (!node.children) return;
  if (currentDepth === targetDepth) {
    node._children = node.children;
    node.children = undefined;
  } else {
    node.children.forEach((child) => collapseAtDepth(child, targetDepth, currentDepth + 1));
  }
}

export function expandAtDepth(node: TreeNode, targetDepth: number, currentDepth = 0) {
  if (currentDepth === targetDepth && node._children) {
    node.children = node._children;
    node._children = undefined;
  }
  if (node.children) {
    node.children.forEach((child) => expandAtDepth(child, targetDepth, currentDepth + 1));
  }
  if (node._children) {
    node._children.forEach((child) => expandAtDepth(child, targetDepth, currentDepth + 1));
  }
}



// Add index paths to each node in the tree
// This function traverses the tree and assigns an index path to each node, which can be used for toggling nodes by their path.
export function addIndexPath(node: TreeNode, path: number[] = []): void {
  node.indexPath = path;
  (node.children || []).forEach((c, i) => addIndexPath(c, [...path, i]));
}

// Toggle a node by its index path
export function toggleNodeByIndexPath(node: TreeNode, path: number[]): TreeNode {
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

// Collapse/expand all nodes at a given depth
export function setCollapseAtDepth(node: TreeNode, depth: number, collapse: boolean, cur = 1) {
  if (!node.children) return;
  if (cur === depth) {
    node.children.forEach(child => {
      child.collapsed = collapse;
    });
  } else {
    node.children.forEach(c => setCollapseAtDepth(c, depth, collapse, cur + 1));
  }
}

// Is this node or any ancestor collapsed?
export function isNodeHidden(node: HierarchyNode<TreeNode>): boolean {
  let current = node.parent;
  while (current) {
    if (current.data.collapsed) return true;
    current = current.parent;
  }
  return false;
}


export function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// Get the first anomaly reason from a node or its children
export function getFirstAnomalyReason(node: HierarchyNode<TreeNode>): string | undefined {
  if (node.children) {
    for (const child of node.children) {
      if ((child.data.isAnomaly || child.data.isAnomaly) && (child.data.anomalyReason || child.data.anomalyReason)) {
        return child.data.anomalyReason || child.data.anomalyReason;
      }
      if (child.children) {
        for (const grandchild of child.children) {
          if ((grandchild.data.isAnomaly || grandchild.data.isAnomaly) && (grandchild.data.anomalyReason || grandchild.data.anomalyReason)) {
            return grandchild.data.anomalyReason || grandchild.data.anomalyReason;
          }
        }
      }
    }
  }
  return undefined;
}

export function getFontSize(depth: number) {
  return Math.max(BASE_FONT - depth * FONT_STEP, MIN_FONT);
}
export function getPadding(fontSize: number) {
  return fontSize * BASE_PADDING;
}
export function getRadius(fontSize: number) {
  return fontSize * BASE_RADIUS;
}
export function getCssVar(n: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(n).trim();
}

export function linkBorderColor(d: { source: { depth: number } }) {
  return [ENTITY_BORDER, ACTION_BORDER, STATUS_BORDER, "#000"][d.source.depth] || "#000";
}
export function linkFillColor(d: { source: { depth: number } }) {
  return [ENTITY_FILL, ACTION_FILL, STATUS_FILL, "#fff"][d.source.depth] || "#fff";
}

// Get the widest label width for each depth in the tree
// This function creates a temporary SVG element to measure the width of text labels at different depths.
export function getWidestByDepth(tree: TreeNode, font: string) {
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

// Initialize the SVG element for the tree visualization
export function svgInit(svgRef: React.RefObject<SVGSVGElement | null>, width: number, height: number, font: string, viewBoxParam: number, x0: number) {
  const svg = select(svgRef.current);
  svg.selectAll("*").remove();
  svg
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `${viewBoxParam} ${x0 - BASE_FONT} ${width} ${height}`)
      .attr("style", "max-width: 100%; height: auto; font: 10px;")
      .attr("font-family", font);

  return svg;
}

// Append lines to the SVG for the tree links
// This function draws the lines connecting the nodes in the tree, adjusting for the widest label at each depth.
export function svgLines(
    svg: Selection<SVGSVGElement | null, unknown, null, undefined>, 
    root: HierarchyNode<TreeNode>, 
    widestByDepth: number[], ) 
  {
  svg.append("g")
      .attr("fill", "none")
      .attr("stroke-width", 1.5)
      .selectAll("path")
      .data(root.links())
      .join("path")
      .attr("d", (d: HierarchyLink<TreeNode>) => {
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
      .attr("opacity", (d: HierarchyLink<TreeNode>)  => (isNodeHidden(d.source) || isNodeHidden(d.target)) ? 0 : 1);

  return svg;
}

// Append nodes to the SVG for the tree visualization
// This function creates groups for each node in the tree, setting their position and event handlers for mouse interactions.
export function svgNodes(
    svg: Selection<SVGSVGElement | null, unknown, null, undefined>, 
    root: HierarchyNode<TreeNode>,
    mouseoverHandler: (event: MouseEvent, d: HierarchyNode<TreeNode>) => void,
    mouseoutHandler: (event: MouseEvent, d: HierarchyNode<TreeNode>) => void,
    clickHandler: (event: MouseEvent, d: HierarchyNode<TreeNode>) => void)
  {
  return svg.append("g")
    .attr("stroke-linejoin", "round")
    .attr("stroke-width", 2)
    .selectAll("g")
    .data(root.descendants())
    .join("g")
    .attr("transform", (d: HierarchyNode<TreeNode>) => `translate(${d.y},${d.x})`)
    .on("mouseover", mouseoverHandler)
    .on("mouseout", mouseoutHandler)
    .on("click", clickHandler)
}