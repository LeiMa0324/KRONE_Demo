import React from "react";
import type { HierarchyNode } from "d3-hierarchy";
import type { TreeNode } from "../../tree_utils";

type TreeInfoPanelProps = {
  node: HierarchyNode<TreeNode> | null;
  title?: string;
  hideNodeName?: boolean;
  sortLogKeys?: boolean;
  multiLineAnomaly?: boolean;
  isSequencePanel?: boolean
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

function collectStats(node: HierarchyNode<TreeNode> | null) {
  let numEntities = 0, numActions = 0, numStatuses = 0;
  const normalLogKeys: string[] = [];
  const abnormalLogKeys: string[] = [];

  function traverse(n: any, depth: number) {
    if (!n) return;
    if (depth === 0) {
      numEntities = n.children?.length ?? 0;
      n.children?.forEach((entity: any) => traverse(entity, 1));
    } else if (depth === 1) {
      numActions += n.children?.length ?? 0;
      n.children?.forEach((action: any) => traverse(action, 2));
    } else if (depth === 2) {
      numStatuses += n.children?.length ?? 0;
      n.children?.forEach((status: any) => traverse(status, 3));
    } else if (depth === 3) {
      if (n.event_id) {
        (n.isAnomaly ? abnormalLogKeys : normalLogKeys).push(n.event_id);
      }
    }
  }

  if (node) traverse(node.data, node.depth);

  return { numEntities, numActions, numStatuses, normalLogKeys, abnormalLogKeys };
}

export const TreeInfoPanel: React.FC<TreeInfoPanelProps> = ({
  node,
  title,
  hideNodeName = false,
  sortLogKeys = false,
  multiLineAnomaly = false,
  isSequencePanel = false,
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

  const { numEntities, numActions, numStatuses, normalLogKeys, abnormalLogKeys } = collectStats(node);

  if (sortLogKeys) {
    normalLogKeys.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    abnormalLogKeys.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
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
                {isSequencePanel && (
                  <h2 className="font-bold">Node Information</h2>
                )}
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
      {node.depth != 3 && !isSequencePanel && (
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
    {isSequencePanel && (
      <>
        <h2 className="font-bold">Sequence Info</h2>
        <div>
          <span style={{fontWeight: 500 }}>Log Sequence:</span>
          <p>[{ getLogKeySubsequence(node).join(", ")}]</p>
        </div>
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
          Search Sequence in Knowledge Base
        </button>
      </>
    )}

    </div>
    
  );
};
