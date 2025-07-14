import React, { useMemo } from "react";
import type { HierarchyNode } from "d3-hierarchy";
import type { TreeNode } from "../../../tree_utils";

import {
  NodeTitle,
  NodeStats,
  LogKeys,
  SequencePanel,
} from "./info_panel_parts";
import {
  panelStyle,
  titleStyle,
  infoStyle,
} from "./info_panel_styles";

type TreeInfoPanelProps = {
  node: HierarchyNode<TreeNode> | null;
  title?: string;
  hideNodeName?: boolean;
  sortLogKeys?: boolean;
  multiLineAnomaly?: boolean;
  isSequencePanel?: boolean;
  onLogKeySearch?: (logKey: string) => void;
};

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
  multiLineAnomaly = false,
  isSequencePanel = false,
  onLogKeySearch,
}) => {
  if (!node) {
    return (
      <div style={{ ...panelStyle, color: "#888", fontSize: 18 }}>
        No node selected
      </div>
    );
  }

  const { numEntities, numActions, numStatuses, normalLogKeys, abnormalLogKeys } = collectStats(node);

  const sortedNormalLogKeys = useMemo(
    () => [...normalLogKeys].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [normalLogKeys]
  );
  const sortedAbnormalLogKeys = useMemo(
    () => [...abnormalLogKeys].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [abnormalLogKeys]
  );

  const showLogKeys = (node.depth !== 3 && !isSequencePanel) || (node.depth === 3 && !isSequencePanel);

  return (
    <div style={panelStyle}>
      <div style={titleStyle}>
        <NodeTitle node={node} title={title} hideNodeName={hideNodeName} isSequencePanel={isSequencePanel} />
      </div>
      <div style={infoStyle}>
        <NodeStats node={node} numEntities={numEntities} numActions={numActions} numStatuses={numStatuses} />
      </div>
      {showLogKeys && (
        <LogKeys
          normalLogKeys={sortedNormalLogKeys}
          abnormalLogKeys={sortedAbnormalLogKeys}
          onLogKeySearch={onLogKeySearch}
        />
      )}
      {isSequencePanel && (
        <SequencePanel node={node} multiLineAnomaly={multiLineAnomaly} />
      )}
    </div>
  );
};