import React from "react";
import type { HierarchyNode } from "d3-hierarchy";
import type { TreeNode } from "../tree_utils";

type TreeNodeWithChildren = TreeNode & {
  _children?: TreeNodeWithChildren[];
  children?: TreeNodeWithChildren[];
};

type InfoPanelProps = {
  node: HierarchyNode<TreeNodeWithChildren> | null;
};

function getAllDataChildren(data: TreeNodeWithChildren): TreeNodeWithChildren[] {
  const children: TreeNodeWithChildren[] = [];
  if (Array.isArray(data.children)) children.push(...data.children);
  if (Array.isArray(data._children)) children.push(...data._children);
  return children;
}

function collectStatusesFromData(
  data: TreeNodeWithChildren,
  depth = 0,
  arr: TreeNodeWithChildren[] = []
): TreeNodeWithChildren[] {
  if (depth === 3 && data.event_id) arr.push(data);
  getAllDataChildren(data).forEach(child => collectStatusesFromData(child, depth + 1, arr));
  return arr;
}

export const TreeInfoPanel: React.FC<InfoPanelProps> = ({ node }) => {
  function getNodeInfo(
    node: HierarchyNode<TreeNodeWithChildren> | null
  ): { title: string; content: string } {
    console.log("Node data:", node?.data);
    const wpired =
      typeof window !== "undefined"
        ? getComputedStyle(document.documentElement)
            .getPropertyValue("--color-WPIRed")
            .trim() || "#c00"
        : "#c00";

    if (!node) {
      return {
        title: "",
        content:
          '<div style="color:#888; text-align:center; padding:16px 0;">Hover on a node to see more details.</div>',
      };
    }

    if (node.depth === 0) {
      const entities = getAllDataChildren(node.data);
      let numActions = 0,
        numStatuses = 0;

      entities.forEach((entityData) => {
        const actions = getAllDataChildren(entityData);
        numActions += actions.length;
        actions.forEach((actionData) => {
          const statuses = getAllDataChildren(actionData);
          numStatuses += statuses.length;
        });
      });

      const statuses = collectStatusesFromData(node.data, 0);
      const normal = statuses.filter((s) => !s.isAnomaly).map((s) => s.event_id);
      const abnormal = statuses.filter((s) => s.isAnomaly).map((s) => s.event_id);

      return {
        title: "Root",
        content: `
          <div><b># of Entities:</b> ${entities.length}</div>
          <div><b># of Actions:</b> ${numActions}</div>
          <div><b># of Statuses:</b> ${numStatuses}</div>
          <div style="margin-top:4px;">
            <b>Normal Log Keys:</b> ${normal.length > 0 ? normal.join(", ") : "<i>None</i>"}
          </div>
          <div><b>Abnormal Log Keys:</b> <span style="color:${abnormal.length > 0 ? wpired : '#000'}">${abnormal.length > 0 ? abnormal.join(", ") : "<i>None</i>"}</span></div>
        `,
      };
    }

    if (node.depth === 1 || node.depth === 2) {
      const statuses = collectStatusesFromData(node.data, node.depth);
      const normal = statuses.filter((s) => !s.isAnomaly).map((s) => s.event_id);
      const abnormal = statuses.filter((s) => s.isAnomaly).map((s) => s.event_id);
      const actions = getAllDataChildren(node.data);
      const numActions = node.depth === 1 ? actions.length : undefined;
      const numStatuses =
        node.depth === 2
          ? getAllDataChildren(node.data).length
          : undefined;

      return {
        title: `${node.depth === 1 ? "Entity" : "Action"}: ${node.data.name}`,
        content: `
          ${numActions !== undefined ? `<div><b># of Actions:</b> ${numActions}</div>` : ""}
          ${numStatuses !== undefined ? `<div><b># of Statuses:</b> ${numStatuses}</div>` : ""}
          <div style="margin-top:4px;">
            <b>Normal Log Keys:</b> ${normal.length > 0 ? normal.join(", ") : "<i>None</i>"}
          </div>
          <div><b>Abnormal Log Keys:</b> <span style="color:${abnormal.length > 0 ? wpired : '#000'}">${abnormal.length > 0 ? abnormal.join(", ") : "<i>None</i>"}</span></div>
        `,
      };
    }

    if (node.depth === 3) {
      return {
        title: `Status: ${node.data.name}`,
        content: `
          <div><b>Log Key:</b> ${node.data.event_id || "N/A"}</div>
          <div><b>Log Template:</b> ${node.data.log_template || "N/A"}</div>
          <div><b>Anomaly:</b> ${
            node.data.isAnomaly
              ? node.data.anomalyReason || "No explanation"
              : "Normal"
          }</div>
        `,
      };
    }

    return { title: node.data.name, content: "" };
  }

  const nodeInfo = getNodeInfo(node);

  return (
    <div
      style={{
        minWidth: 0,
        width: "100%",
        borderRadius: 8,
        padding: "1rem",
        fontSize: 18,
        background: "#fff",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        zIndex: 10,
        wordBreak: "break-word",
        height: "100%",
        boxSizing: "border-box",
      }}
    >
      {nodeInfo.title && (
        <div
          style={{
            fontWeight: "bold",
            marginBottom: 8,
            textAlign: "center",
          }}
        >
          {nodeInfo.title}
        </div>
      )}
      <div
        style={{
          fontSize: 16,
          background: "#fff",
          border: "1px solid #ccc",
          borderRadius: 6,
          minHeight: 80,
          padding: 8,
          textAlign: "left",
          wordWrap: "break-word",
        }}
        dangerouslySetInnerHTML={{ __html: nodeInfo.content }}
      />
    </div>
  );
};
