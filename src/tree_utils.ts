export type TreeNode = {
  name: string;
  children?: TreeNode[];
  _children?: TreeNode[];
  is_anomaly?: boolean;
  anomaly_explanation?: string;
  log_template?: string;
  event_id?: string;
};

export type CsvRow = {
  entity_node_id?: string;
  action_node_id?: string;
  status_node_id?: string;
  is_anomaly?: string;
  is_anomaly_reason?: string;
  log_template?: string;
  event_id?: string; 
  [key: string]: string | undefined;
};

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
        is_anomaly,
        anomaly_explanation,
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