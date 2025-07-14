interface StatusNode {
  name: string;
}

interface ActionNode {
  name: string;
  children?: StatusNode[];
}

interface EntityNode {
  name: string;
  children?: ActionNode[];
}

interface TreeData {
  children?: EntityNode[];
}

export function getEntities(treeData: TreeData): string[] {
  return treeData?.children?.map(e => e.name) ?? [];
}

export function getActions(treeData: TreeData, entity: string | null): string[] {
  if (!treeData) return [];
  if (entity) {
    const entityNode = treeData.children?.find(e => e.name === entity);
    return entityNode?.children?.map(a => a.name) ?? [];
  }
  const allActions = (treeData.children ?? []).flatMap(e => e.children ?? []).map(a => a.name);
  return Array.from(new Set(allActions));
}

export function getStatuses(treeData: TreeData, entity: string | null, action: string | null): string[] {
  if (!treeData) return [];
  if (entity && action) {
    const entityNode = treeData.children?.find(e => e.name === entity);
    const actionNode = entityNode?.children?.find(a => a.name === action);
    return actionNode?.children?.map(s => s.name) ?? [];
  }
  if (action && !entity) {
    const allStatuses = (treeData.children ?? [])
      .flatMap(e =>
        (e.children ?? [])
          .filter(a => a.name === action)
          .flatMap(a => a.children ?? [])
      )
      .map(s => s.name);
    return Array.from(new Set(allStatuses));
  }
  if (entity && !action) {
    const entityNode = treeData.children?.find(e => e.name === entity);
    const allStatuses = (entityNode?.children ?? [])
      .flatMap(a => a.children ?? [])
      .map(s => s.name);
    return Array.from(new Set(allStatuses));
  }
  const allStatuses = (treeData.children ?? [])
    .flatMap(e =>
      (e.children ?? [])
        .flatMap(a => a.children ?? [])
    )
    .map(s => s.name);
  return Array.from(new Set(allStatuses));
}