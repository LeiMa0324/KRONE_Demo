import { getLogKeySubsequence } from "../viz_tree_utils";
import { useState } from "react";
import type { TreeNode } from "../../../tree_utils";

import {
  logTemplateStyle,
  logLabelStyle,
  logKeyStyle,
  buttonStyle,
} from "./info_panel_styles";
import type { HierarchyNode } from "d3-hierarchy";



interface NodeTitleProps {
  node: HierarchyNode<TreeNode>;
  title?: string;
  hideNodeName?: boolean;
  isSequencePanel?: boolean;
}

export function NodeTitle({ node, title, hideNodeName, isSequencePanel }: NodeTitleProps) {
  if (title) return <>{title}</>;
  if (hideNodeName) return null;

  switch (node.depth) {
    case 1:
      return <>Entity: <b>{node.data.name}</b></>;
    case 2:
      return <>Action: <b>{node.data.name}</b></>;
    case 3:
      return (
        <>
          Status: <b>{node.data.name}</b>
          {isSequencePanel && <h2 className="font-bold">Node Information</h2>}
          {node.data.log_template && (
            <div style={logTemplateStyle}>
              <span style={logLabelStyle}>Log template:</span>
              <span style={{ marginLeft: 6 }}>{node.data.log_template}</span>
            </div>
          )}
          {node.data.event_id && (
            <div style={logTemplateStyle}>
              <span style={logLabelStyle}>Log key:</span>
              <span style={{ marginLeft: 6 }}>{node.data.event_id}</span>
            </div>
          )}
        </>
      );
    case 0:
      return <>{node.data.name}</>;
    default:
      return null;
  }
}

interface NodeStatsProps {
  node: HierarchyNode<TreeNode>;
  numEntities: number;
  numActions: number;
  numStatuses: number;
}

export function NodeStats({ node, numEntities, numActions, numStatuses }: NodeStatsProps) {
  switch (node.depth) {
    case 0:
      return (
        <>
          <div>Entities: <b>{numEntities}</b></div>
          <div>Actions: <b>{numActions}</b></div>
          <div>Statuses: <b>{numStatuses}</b></div>
        </>
      );
    case 1:
      return (
        <>
          <div>Actions: <b>{numActions}</b></div>
          <div>Statuses: <b>{numStatuses}</b></div>
        </>
      );
    case 2:
      return (
        <div>Statuses: <b>{numStatuses}</b></div>
      );
    default:
      return null;
  }
}

interface LogKeysProps {
  normalLogKeys: string[];
  abnormalLogKeys: string[];
  onLogKeySearch?: (key: string) => void;
}

export function LogKeys({ normalLogKeys, abnormalLogKeys, onLogKeySearch }: LogKeysProps) {
  const renderLogKeys = (keys: string[], color: string) =>
    keys.length > 0 ? (
      keys.map((key, idx) => (
        <span
          key={key}
          style={{
            marginRight: 6,
            cursor: "pointer",
            color,
            textDecoration: "underline",
          }}
          onClick={() => onLogKeySearch?.(key)}
          title="Search this log key"
        >
          {key}
          {idx < keys.length - 1 ? "," : ""}
        </span>
      ))
    ) : (
      <span style={{ color: "#aaa" }}>None</span>
    );

  return (
    <div style={logKeyStyle}>
      <div>
        <span style={{ color: "#4caf50", fontWeight: 500 }}>{`Normal Log Keys (${normalLogKeys.length} Total): `}</span>
        <span
          style={{
            marginLeft: 6,
            display: "flex",
            flexWrap: "wrap",
            gap: 2,
            alignItems: "center",
            minWidth: 0,
          }}
        >
          {renderLogKeys(normalLogKeys, "#4caf50")}
        </span>
      </div>
      <br></br>
      <div>
        <span style={{ color: "#f44336", fontWeight: 500 }}>{`Abnormal Log Keys (${abnormalLogKeys.length} Total): `}</span>
        <span
          style={{
            marginLeft: 6,
            display: "flex",
            flexWrap: "wrap",
            gap: 2,
            alignItems: "center",
            minWidth: 0,
          }}
        >
          {renderLogKeys(abnormalLogKeys, "#f44336")}
        </span>
      </div>
    </div>
  );
}

interface SequencePanelProps {
  node: HierarchyNode<TreeNode>;
  multiLineAnomaly?: boolean;
}

export function SequencePanel({ node, multiLineAnomaly }: SequencePanelProps) {
  const [includeNormal, setIncludeNormal] = useState(true);
  const [includeAnomalous, setIncludeAnomalous] = useState(true);

  const handleNormalChange = (checked: boolean) => {
    if (!checked && !includeAnomalous) return;
    setIncludeNormal(checked);
  };
  const handleAnomalousChange = (checked: boolean) => {
    if (!checked && !includeNormal) return;
    setIncludeAnomalous(checked);
  };

  return (
    <>
      {node.data.isAnomaly && (
        <>
          <div>
            <span style={{ color: "#f44336", fontWeight: 500 }}>Anomaly Type:</span>
            <span style={{ marginLeft: 6 }}>{multiLineAnomaly ? "Pattern" : "Template"}</span>
          </div>
          <div>
            <span style={{ color: "#f44336", fontWeight: 500 }}>Anomaly Reason:</span>
            <span style={{ marginLeft: 6 }}>{node.data.anomalyReason}</span>
          </div>
        </>
      )}
      <h2 className="font-bold">Sequence Info</h2>
      <div>
        <span style={{ fontWeight: 500 }}>Log Sequence:</span>
        <p>[{getLogKeySubsequence(node).join(", ")}]</p>
      </div>
      <button
          style={buttonStyle}
        onClick={() => {
          const logKeys = getLogKeySubsequence(node);
          if (logKeys.length === 0) return;
          // Add includeNormal and includeAnomalous as query params
          window.location.href =
            `/knowledge-base?logkeys=[${encodeURIComponent(logKeys.join(","))}]&tab=train`;
        }}>
          Search for Exact Sequence
      </button>
      <button
        style={buttonStyle}
        onClick={() => {
          const logKeys = getLogKeySubsequence(node);
          if (logKeys.length === 0) return;
          let parent = "";
          let level = "";
          if (node.depth === 3 && node.parent) {
            parent = node.parent.data.name;
            level = "STATUS";
          } else if (node.depth === 2 && node.parent) {
            parent = node.parent.data.name;
            level = "ACTION";
          } else if (node.depth === 1) {
            parent = "";
            level = "ENTITY";
          }
          window.location.href =
            `/knowledge-base?logkeys=[${encodeURIComponent(logKeys.join(","))}]&tab=approx` +
            `&includeNormal=${includeNormal ? "1" : "0"}&includeAnomalous=${includeAnomalous ? "1" : "0"}` +
            `&parent=${encodeURIComponent(parent)}` +
            `&level=${encodeURIComponent(level)}`;
        }}
      >
        Search for Approximate Sequences
      </button>
      {/* Add checkboxes below the button */}
      <div style={{ marginTop: 12, display: "flex", gap: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            type="checkbox"
            checked={includeNormal}
            onChange={e => handleNormalChange(e.target.checked)}
          />
          Include normal sequences
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            type="checkbox"
            checked={includeAnomalous}
            onChange={e => handleAnomalousChange(e.target.checked)}
          />
          Include anomalous sequences
        </label>
      </div>
    </>
  );
}