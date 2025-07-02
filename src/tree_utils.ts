export type TreeNode = {
  name: string;
  children?: TreeNode[];
  _children?: TreeNode[]; // for d3 collapse
  collapsed?: boolean;
  indexPath?: number[];
  isAnomaly?: boolean; // unified anomaly flag
  anomalyReason?: string; // unified anomaly explanation
  isRelatedToAnomaly?: boolean;
  lineNumber?: number;
  event_id?: string;
  log_template?: string;
  // Add any other fields needed by either tree
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
export const ACTION_BORDER = "#ffd100";
export const STATUS_BORDER = "#888";
export const ENTITY_FILL = "#fde2e5";
export const ACTION_FILL = "#fff8e8";
export const STATUS_FILL = "#ededed";

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

import type { HierarchyNode } from "d3-hierarchy";

// --- Shared TreeNode type ---

// --- Add indexPath recursively ---
export function addIndexPath(node: TreeNode, path: number[] = []): void {
  node.indexPath = path;
  (node.children || []).forEach((c, i) => addIndexPath(c, [...path, i]));
}

// --- Toggle collapse by indexPath ---
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

// --- Collapse/expand all nodes at a given depth ---
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

// --- Is this node or any ancestor collapsed? ---
export function isNodeHidden(node: HierarchyNode<TreeNode>): boolean {
  let current = node.parent;
  while (current) {
    if (current.data.collapsed) return true;
    current = current.parent;
  }
  return false;
}

// --- Optionally: arraysEqual (used in sequence_tree) ---
export function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// --- Optionally: getFirstAnomalyReason (used in sequence_tree) ---
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