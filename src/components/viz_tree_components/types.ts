import type { HierarchyNode } from "d3-hierarchy";


export type TreeLink = { source: HierarchyNode<TreeNode>; target: HierarchyNode<TreeNode> };

export type VizTreeProps = {
  treeData: TreeNode;
  collapseEntities: boolean;
  collapseActions: boolean;
  collapseStatuses: boolean;
  matchedNodeId: string | null;
  setHoveredNode?: (node: HierarchyNode<TreeNode> | null) => void;
  showAnomalySymbols?: boolean;
  collapsible?: boolean;
  disableHoverHighlight?: boolean;
  onNodeClick?: (node: HierarchyNode<TreeNode>) => void;
  clickableNodes?: boolean;
};

export type HierarchyNodeWithHiddenChildren<T> = HierarchyNode<T> & { _children?: HierarchyNode<T>[] };

export type TreeNode = {
  name: string;
  children?: TreeNode[];
  event_id?: string;
  log_template?: string;
};

export type CollapseState = {
  entities: boolean;
  actions: boolean;
  statuses: boolean;
  setEntities: (v: boolean) => void;
  setActions: (v: boolean) => void;
  setStatuses: (v: boolean) => void;
};

export type SearchState = {
  input: string;
  setInput: (v: string) => void;
  value: string;
  matchedNodeId: string | null;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  handleClear: () => void;
};

export type SelectionState = {
  entity: string | null;
  setEntity: (v: string | null) => void;
  action: string | null;
  setAction: (v: string | null) => void;
  status: string | null;
  setStatus: (v: string | null) => void;
  onPathSearch: (entity: string, action: string, status: string) => void;
};

export type TreeControlsProps = {
  collapse: CollapseState;
  search: SearchState;
  selection: SelectionState;
  treeData: TreeNode | null;
};