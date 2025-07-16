import { getLogKeySubsequence } from "../viz_tree_utils";

import {
  logTemplateStyle,
  logLabelStyle,
  logKeyStyle,
  buttonStyle,
} from "./info_panel_styles";



export function NodeTitle({ node, title, hideNodeName, isSequencePanel }: any) {
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

export function NodeStats({ node, numEntities, numActions, numStatuses }: any) {
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

export function LogKeys({ normalLogKeys, abnormalLogKeys, onLogKeySearch }: any) {
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

export function SequencePanel({ node, multiLineAnomaly }: any) {
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
          window.location.href = `/knowledge-base?logkeys=[${encodeURIComponent(logKeys.join(","))}]`;
        }}
      >
        Search Sequence in Knowledge Base
      </button>
    </>
  );
}