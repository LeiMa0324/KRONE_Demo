import React from "react";
import type { HierarchyNode } from "d3-hierarchy";
import type { TreeNode } from "../tree_utils";

type TreeInfoPanelProps = {
  node: HierarchyNode<TreeNode> | null;
  title?: string;
  hideNodeName?: boolean;
  sortLogKeys?: boolean;
  multiLineAnomaly?: boolean;
  includeKnowledgeBaseButton?: boolean
};

function getLogKeySubsequence(node: HierarchyNode<TreeNode>): string[] {
  if (!node) return [];
  if (node.depth === 3 && node.data.event_id) return [node.data.event_id];
  const keys: string[] = [];
  function collect(n: HierarchyNode<TreeNode>) {
    if (n.depth === 3 && n.data.event_id) {
      keys.push(n.data.event_id);
    }
    if (n.children) n.children.forEach(collect);
  }
  collect(node);
  return keys;
}

export const TreeInfoPanel: React.FC<TreeInfoPanelProps> = ({
  node,
  title,
  hideNodeName = false,
  sortLogKeys = false,
  multiLineAnomaly = false,
  includeKnowledgeBaseButton = false,
}) => {
  if (!node) {
    return (
      <div
        style={{
          padding: "1.25rem",
          background: "#fff",
          borderRadius: 8,
          color: "#888",
          border: "1.5px solid #e0e0e0",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          fontSize: 18,
          minWidth: 0,
        }}
      >
        No node selected
      </div>
    );
  }

  let numEntities = 0,
    numActions = 0,
    numStatuses = 0;
  const normalLogKeys: string[] = [];
  const abnormalLogKeys: string[] = [];

  if (node.depth === 0) {
    // Root node
    numEntities = node.data.children?.length ?? 0;
    for (const entity of node.data.children ?? []) {
      numActions += entity.children?.length ?? 0;
      for (const action of entity.children ?? []) {
        numStatuses += action.children?.length ?? 0;
        for (const status of action.children ?? []) {
          if (status.event_id) {
            if (status.isAnomaly) {
              abnormalLogKeys.push(status.event_id);
            } else {
              normalLogKeys.push(status.event_id);
            }
          }
        }
      }
    }
  } else if (node.depth === 1) {
    // Entity node
    numActions = node.data.children?.length ?? 0;
    for (const action of node.data.children ?? []) {
      numStatuses += action.children?.length ?? 0;
      for (const status of action.children ?? []) {
        if (status.event_id) {
          if (status.isAnomaly) {
            abnormalLogKeys.push(status.event_id);
          } else {
            normalLogKeys.push(status.event_id);
          }
        }
      }
    }
  } else if (node.depth === 2) {
    // Action node
    numStatuses = node.data.children?.length ?? 0;
    for (const status of node.data.children ?? []) {
      if (status.event_id) {
        if (status.isAnomaly) {
          abnormalLogKeys.push(status.event_id);
        } else {
          normalLogKeys.push(status.event_id);
        }
      }
    }
  } else if (node.depth === 3) {
    // Status node
    if (node.data.event_id) {
      if (node.data.isAnomaly) {
        abnormalLogKeys.push(node.data.event_id);
      } else {
        normalLogKeys.push(node.data.event_id);
      }
    }
  }

  if (sortLogKeys) {
    normalLogKeys.sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    );
    abnormalLogKeys.sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    );
  }

  return (
    <div
      style={{
        padding: "1.25rem",
        background: "#fff",
        borderRadius: 8,
        marginBottom: 8,
        border: "1.5px solid #e0e0e0",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        minWidth: 0,
        textAlign: "left",
      }}
    >
      <div
        style={{
          fontWeight: 700,
          fontSize: 20,
          marginBottom: 12,
          letterSpacing: 0.2,
          color: "#222",
          textAlign: "center",
        }}
      >
        {title ? (
          title
        ) : (
          !hideNodeName &&
          <>
            {node.depth === 1 && <>Entity: <b>{node.data.name}</b></>}
            {node.depth === 2 && <>Action: <b>{node.data.name}</b></>}
            {node.depth === 3 && (
              <>
                Status: <b>{node.data.name}</b>
                {node.data.log_template && (
                  <div style={{ fontWeight: 400, fontSize: 15, color: "#555", marginTop: 6 }}>
                    <span style={{ color: "#888" }}>Log template:</span>
                    <span style={{ marginLeft: 6 }}>{node.data.log_template}</span>
                  </div>
                )}
                {node.data.event_id && (
                  <div style={{ fontWeight: 400, fontSize: 15, color: "#555", marginTop: 6 }}>
                    <span style={{ color: "#888" }}>Log key:</span>
                    <span style={{ marginLeft: 6 }}>{node.data.event_id}</span>
                  </div>
                )}
              </>
            )}
            {node.depth === 0 && <>{node.data.name}</>}
          </>
        )}
      </div>
      <div style={{ fontSize: 17, marginBottom: 8, color: "#333", textAlign: "left" }}>
        {node.depth === 0 && (
          <>
            <div>
              Entities: <b>{numEntities}</b>
            </div>
            <div>
              Actions: <b>{numActions}</b>
            </div>
            <div>
              Statuses: <b>{numStatuses}</b>
            </div>
          </>
        )}
        {node.depth === 1 && (
          <>
            <div>
              Actions: <b>{numActions}</b>
            </div>
            <div>
              Statuses: <b>{numStatuses}</b>
            </div>
          </>
        )}
        {node.depth === 2 && (
          <>
            <div>
              Statuses: <b>{numStatuses}</b>
            </div>
          </>
        )}
      </div>
      {node.depth != 3 && (
        <div style={{ fontSize: 16, marginTop: 10, textAlign: "left" }}>
          <div>
            <span style={{ color: "#4caf50", fontWeight: 500 }}>
              Normal log keys:
            </span>
            <span style={{ marginLeft: 6 }}>
              {normalLogKeys.length > 0 ? (
                normalLogKeys.join(", ")
              ) : (
                <span style={{ color: "#aaa" }}>None</span>
              )}
            </span>
          </div>
          <div>
            <span style={{ color: "#f44336", fontWeight: 500 }}>
              Abnormal log keys:
            </span>
            <span style={{ marginLeft: 6 }}>
              {abnormalLogKeys.length > 0 ? (
                abnormalLogKeys.join(", ")
              ) : (
                <span style={{ color: "#aaa" }}>None</span>
              )}
            </span>
          </div>
        </div>
      )}

      {node.data.isAnomaly && (
        <>
          <div>
            <span style={{ color: "#f44336", fontWeight: 500 }}>
              Anomaly Type:
            </span>
            <span style={{ marginLeft: 6 }}>
              {multiLineAnomaly? "Pattern" : "Template"}
            </span>
          </div>
          <div>
            <span style={{ color: "#f44336", fontWeight: 500 }}>
              Anomaly Reason:
            </span>
            <span style={{ marginLeft: 6 }}>
              {node.data.anomalyReason}
            </span>
          </div>
        </>
    )}
    {includeKnowledgeBaseButton && (
      <button
        style={{
          marginTop: 16,
          padding: "10px 18px",
          background: "#c8102e",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          fontWeight: 600,
          fontSize: 16,
          cursor: "pointer"
        }}
        onClick={() => {
          const logKeys = getLogKeySubsequence(node);
          if (logKeys.length === 0) return;
          // Navigate to knowledge base page with logkeys as query param
          window.location.href = `/knowledge-base?logkeys=[${encodeURIComponent(logKeys.join(","))}]`;
        }}
      >
        Search in Knowledge Base
      </button>
    )}

    </div>
    
  );
};
