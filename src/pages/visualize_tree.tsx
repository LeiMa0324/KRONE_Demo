import React, { useEffect, useRef, useState } from "react";
import { hierarchy, tree } from "d3-hierarchy";
import type { HierarchyNode } from "d3-hierarchy";
import { select } from "d3-selection";
import { csv } from "d3-fetch";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

// TODO fix status toggle (toggle action + status, expand entity, then untoggle status)
// TODO center tree
// TODO when hovering on a node, then collapse and it moves, hover box doesn't clear
type TreeNode = {
  name: string;
  children?: TreeNode[];
  _children?: TreeNode[];
  is_anomaly?: boolean;
  anomaly_explanation?: string;
  log_template?: string;
  event_id?: string;
};

type CustomHierarchyNode = HierarchyNode<TreeNode> & {
  _children?: CustomHierarchyNode[];
};

type HierarchyTreeNode = HierarchyNode<TreeNode> & { _children?: HierarchyTreeNode[] };

type CsvRow = {
  entity_node_id?: string;
  action_node_id?: string;
  status_node_id?: string;
  is_anomaly?: string;
  is_anomaly_reason?: string;
  log_template?: string;
  event_id?: string; 
  [key: string]: string | undefined;
};

// csv rows data
function buildTree(rows: CsvRow[]): TreeNode {
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

    // entity node
    if (!entityMap[entity]) {
      entityMap[entity] = { name: entity, children: [] };
      root.children!.push(entityMap[entity]);
    }
    const entityNode = entityMap[entity];

    // action node
    let actionNode = entityNode.children!.find((child) => child.name === action);
    if (!actionNode) {
      actionNode = { name: action, children: [] };
      entityNode.children!.push(actionNode);
    }

    // status node
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

export const VisualizeTree: React.FC = () => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [treeData, setTreeData] = useState<TreeNode | null>(null);

  // collapse toggles for each tree level
  const [collapseEntities, setCollapseEntities] = useState(false);
  const [collapseActions, setCollapseActions] = useState(false);
  const [collapseStatuses, setCollapseStatuses] = useState(false);

  // track hovered node for info panel
  const [hoveredNode, setHoveredNode] = useState<HierarchyNode<TreeNode> | null>(null);

  // search statue
  const [searchValue, setSearchValue] = useState("");
  const [matchedNodeId, setMatchedNodeId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(""); // <-- new: controlled input

  // matched node for search
  const [matchedNodeObj, setMatchedNodeObj] = useState<HierarchyNode<TreeNode> | null>(null);

  function handleSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSearchValue(searchInput.trim());
    if (!searchInput.trim()) {
      setHoveredNode(null);
  }
}

  function handleClearSearch() {
    setSearchInput("");
    setSearchValue("");
    setMatchedNodeId(null);
    setMatchedNodeObj(null);
  }

  function collapseAtDepth(node: TreeNode, targetDepth: number, currentDepth = 0) {
    if (!node.children) return;
    if (currentDepth === targetDepth) {
      node._children = node.children;
      node.children = undefined;
    } else {
      node.children.forEach((child) =>
        collapseAtDepth(child, targetDepth, currentDepth + 1)
      );
    }
  }

  function expandAtDepth(node: TreeNode, targetDepth: number, currentDepth = 0) {
    if (currentDepth === targetDepth && node._children) {
      node.children = node._children;
      node._children = undefined;
    }
    if (node.children) {
      node.children.forEach((child) =>
        expandAtDepth(child, targetDepth, currentDepth + 1)
      );
    }
    if (node._children) {
      node._children.forEach((child) =>
        expandAtDepth(child, targetDepth, currentDepth + 1)
      );
    }
  }

  useEffect(() => {
    csv("/Krone_Tree.csv").then((rows) => {
      setTreeData(buildTree(rows));
    });
  }, []);

  useEffect(() => {
    if (!treeData || !searchValue) {
      setMatchedNodeId(null);
      return;
    }
    function findStatusNode(node: TreeNode): string | null {
      if (node.event_id && node.event_id === searchValue) {
        return node.event_id;
      }
      if (node.children) {
        for (const child of node.children) {
          const found = findStatusNode(child);
          if (found) return found;
        }
      }
      if (node._children) {
        for (const child of node._children) {
          const found = findStatusNode(child);
          if (found) return found;
        }
      }
      return null;
    }
    const foundId = findStatusNode(treeData);
    setMatchedNodeId(foundId);
  }, [searchValue, treeData]);

  useEffect(() => {
    if (!treeData || !matchedNodeId) {
      setMatchedNodeObj(null);
      return;
    }
    const root = hierarchy<TreeNode>(treeData, d => d.children || d._children);
    let found: HierarchyNode<TreeNode> | null = null;
    root.each(node => {
      if (node.depth === 3 && node.data.event_id === matchedNodeId) {
        found = node;
      }
    });
    setMatchedNodeObj(found);
  }, [treeData, matchedNodeId]);

  // tree visualization
  useEffect(() => {
    if (!svgRef.current || !treeData) return;

    // clone tree data to avoid mutating state
    const clonedTree = JSON.parse(JSON.stringify(treeData));
    const root = hierarchy<TreeNode>(clonedTree, (d) => d.children) as d3.HierarchyNode<TreeNode> & { _children?: TreeNode[] };

    // collapse toggles
    if (collapseEntities) collapseAtDepth(root, 0);
    else expandAtDepth(root, 1);

    if (collapseActions) collapseAtDepth(root, 1);
    else expandAtDepth(root, 2);

    if (collapseStatuses) collapseAtDepth(root, 2);
    else expandAtDepth(root, 3);

    // base fonts and spacing
    const baseFont = 28, minFont = 15, fontStep = 5;
    const basePadding = 0.25, baseRadius = 0.25;
    const depthSpacing = 14, siblingSpacing = 13;

    const getFontSize = (depth: number) => Math.max(baseFont - depth * fontStep, minFont);
    const getPadding = (fontSize: number) => fontSize * basePadding;
    const getRadius = (fontSize: number) => fontSize * baseRadius;

    const getSeparation = (a: HierarchyNode<TreeNode>, b: HierarchyNode<TreeNode>) => {
      const fontA = getFontSize(a.depth);
      const fontB = getFontSize(b.depth);
      return (Math.max(fontA, fontB) + 8) / depthSpacing;
    };

    const getCss = (name: string) =>
      getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const textFont = getCss('--font-WPIfont');

    function getWidestLabels(tree: TreeNode, getFontSize: (depth: number) => number, getPadding: (fontSize: number) => number, textFont: string) {
      let widestEntity = 0, widestAction = 0;
      const root = hierarchy(tree, d => d.children || d._children);

      // temp svg to measure widest text for each level
      const tempSvg = select(document.body)
        .append("svg")
        .attr("style", "position: absolute; visibility: hidden;")
        .attr("font-family", textFont);

      root.descendants().forEach((node) => {
        const fontSize = getFontSize(node.depth);
        const tempText = tempSvg.append("text")
          .attr("font-size", fontSize)
          .attr("font-family", textFont)
          .text(node.data.name);
        const bbox = (tempText.node() as SVGTextElement).getBBox();
        const labelWidth = bbox.width + getPadding(fontSize) * 2;

        if (node.depth === 1 && labelWidth > widestEntity) widestEntity = labelWidth;
        if (node.depth === 2 && labelWidth > widestAction) widestAction = labelWidth;

        tempText.remove();
      });
      tempSvg.remove();

      return { widestEntity, widestAction };
    }

    // tree level spacings - based on widest entity, action, and status + padding
    const { widestEntity, widestAction } = getWidestLabels(treeData, getFontSize, getPadding, textFont);
    const dyRootToEntity = widestEntity + 60;
    const dyEntityToAction = widestAction + 60;
    const dyActionToStatus = 150;

    function getYByDepth(depth: number) {
      if (depth === 0) return 0;
      if (depth === 1) return dyRootToEntity;
      if (depth === 2) return dyRootToEntity + dyEntityToAction;
      if (depth === 3) return dyRootToEntity + dyEntityToAction + dyActionToStatus;
      return 0;
    }

    // initial tree
    (tree<TreeNode>()
      .nodeSize([40, 0])
      .separation(() => 1)
    )(root);

    root.each((node) => {
      node.y = getYByDepth(node.depth);
    });

    // get the wpi colors
    const svg = select(svgRef.current);

    const getCssVar = (name: string) =>
      getComputedStyle(document.documentElement).getPropertyValue(name).trim();

    const wpired = getCssVar('--color-WPIRed');
    const wpigold = getCssVar('--color-WPIGold');
    const wpigrey = getCssVar('--color-WPIGrey');
    const font = getCssVar('--font-WPIfont');

    const linkColor = (d: { source: { depth: number } }) => {
      switch (d.source.depth) {
        case 0: return wpired;
        case 1: return wpigold;
        case 2: return wpigrey;
        default: return "#000000";
      }
    };

    // main render for tree
    const render = () => {
      // render trees based on current widest nodes
      const treeLayout = tree<TreeNode>()
        .nodeSize([siblingSpacing + 4, Math.max(widestEntity + 20, widestAction + 40)])
        .separation(getSeparation);

      treeLayout(root);

      // adjust y positions for left margin - for the root node
      const leftMargin = 80;  
      root.each((node) => {
        node.y = getYByDepth(node.depth) + leftMargin;
      });

      // temp svg used for calculating status spacing 
      let x0 = Infinity, x1 = -Infinity, maxY = 0, widestLabel = 0, widestStatus = 0;
      const tempSvg = select(document.body)
        .append("svg")
        .attr("style", "position: absolute; visibility: hidden;")
        .attr("font-family", font);

      root.descendants().forEach((node) => {
        const fontSize = getFontSize(node.depth);
        const tempText = tempSvg.append("text")
          .attr("font-size", fontSize)
          .attr("font-family", font)
          .text(node.data.name);
        const bbox = (tempText.node() as SVGTextElement).getBBox();
        let labelWidth = bbox.width + getPadding(fontSize) * 2;

        // add extra space for anomaly icon
        if (!node.children && !node._children && node.data.is_anomaly) {
          labelWidth += fontSize * 1.2;
        }

        if (node.depth === 3 && labelWidth > widestStatus) widestStatus = labelWidth;
        if (labelWidth > widestLabel) widestLabel = labelWidth;
        if (typeof node.y === "number" && node.y > maxY) maxY = node.y;
        tempText.remove();

        if ((node.x ?? 0) > x1) x1 = node.x ?? 0;
        if ((node.x ?? 0) < x0) x0 = node.x ?? 0;
      });
      tempSvg.remove();

      // set SVG dimensions
      const rightPadding = 20;
      const width = maxY + widestStatus + rightPadding;
      const minRootWidth = 400;
      const visibleNodes = root.descendants().length;
      const adjustedWidth = visibleNodes === 1 ? minRootWidth : width;
      const height = x1 - x0 + baseFont * 2;

      svg.selectAll("*").remove();
      svg
        .attr("width", adjustedWidth)
        .attr("height", height)
        .attr("viewBox", `0 ${x0 - baseFont} ${adjustedWidth} ${height}`)
        .attr("style", "max-width: 100%; height: auto; font: 10px;")
        .attr("font-family", font);

      // draw links - using custom right edge links 
      svg
        .append("g")
        .attr("fill", "none")
        .attr("stroke-width", 1.5)
        .selectAll("path")
        .data(root.links() as d3.HierarchyPointLink<TreeNode>[])
        .join("path")
        .attr("d", (d: d3.HierarchyPointLink<TreeNode>) => {
          const gap = 18; // gap between node and start of edge
          const sourceStubY = d.source.y + gap;
          return [
            `M${d.source.y},${d.source.x}`,
            `H${sourceStubY}`,
            `V${d.target.x}`,
            `H${d.target.y}`
          ].join(" ");
        })
        .attr("stroke", linkColor);

      // draw node objects (node group)
      const node = svg
        .append("g")
        .attr("stroke-linejoin", "round")
        .attr("stroke-width", 3)
        .selectAll("g")
        .data(root.descendants() as HierarchyTreeNode[])
        .join("g")
        .attr("transform", (d) => `translate(${d.y},${d.x})`);

      // collapse and expand
      function handleNodeClick(_event: unknown, d: CustomHierarchyNode) {
        if (d.depth === 0) return;
        if (d.children) {
          d._children = d.children as CustomHierarchyNode[];
          d.children = undefined;
        } else if (d._children) {
          d.children = d._children;
          d._children = undefined;
        }
        render();
      }

      // highlight nodes and edges for hovered node
      function highlightText(this: SVGTextElement, _event: React.MouseEvent<SVGTextElement, MouseEvent>, d: HierarchyNode<TreeNode>) {
        const ancestorNodes = new Set<HierarchyNode<TreeNode>>();
        let current: HierarchyNode<TreeNode> | null = d;
        while (current) {
          ancestorNodes.add(current);
          current = current.parent;
        }
        const descendantNodes = new Set<HierarchyNode<TreeNode>>();
        function collectDescendants(node: HierarchyNode<TreeNode>) {
          descendantNodes.add(node);
          if (node.children) node.children.forEach(collectDescendants);
          if ((node as any)._children) (node as any)._children.forEach(collectDescendants);
        }
        collectDescendants(d);

        svg.selectAll<SVGTextElement, HierarchyNode<TreeNode>>("text")
          .each(function(n) {
            const isRelated = ancestorNodes.has(n) || descendantNodes.has(n);
            select(this)
              .attr("fill", isRelated ? "#003366" : "#fff");
            select(this.parentNode as Element).select("rect")
              .attr("fill", isRelated ? "#B3D8FF" : linkColor({ source: { depth: n.depth - 1 } }))
              .attr("stroke-width", isRelated ? 5 : 1.5);
          });

        svg.selectAll<SVGPathElement, d3.HierarchyPointLink<TreeNode>>("path")
          .attr("stroke", lnk => {
            const isAncestorPath =
              ancestorNodes.has(lnk.source as HierarchyNode<TreeNode>) &&
              ancestorNodes.has(lnk.target as HierarchyNode<TreeNode>);
            const isDescendantPath =
              descendantNodes.has(lnk.source as HierarchyNode<TreeNode>) &&
              descendantNodes.has(lnk.target as HierarchyNode<TreeNode>);
            return (isAncestorPath || isDescendantPath) ? "#B3D8FF" : linkColor(lnk);
          })
          .attr("stroke-width", lnk => {
            const isAncestorPath =
              ancestorNodes.has(lnk.source as HierarchyNode<TreeNode>) &&
              ancestorNodes.has(lnk.target as HierarchyNode<TreeNode>);
            const isDescendantPath =
              descendantNodes.has(lnk.source as HierarchyNode<TreeNode>) &&
              descendantNodes.has(lnk.target as HierarchyNode<TreeNode>);
            return (isAncestorPath || isDescendantPath) ? 5 : 1.5;
          });
      }

      // remove highlight 
      function unhighlightText(this: SVGTextElement, _event: MouseEvent, _d: HierarchyNode<TreeNode>) {
        svg.selectAll<SVGTextElement, HierarchyNode<TreeNode>>("text")
          .attr("fill", "#fff")
          .attr("font-weight", null);
        svg.selectAll<SVGGElement, HierarchyNode<TreeNode>>("g")
          .select("rect")
          .attr("fill", n => linkColor({ source: { depth: n.depth - 1 } }));
        svg.selectAll<SVGPathElement, d3.HierarchyPointLink<TreeNode>>("path")
          .attr("stroke", linkColor)
          .attr("stroke-width", 1.5);
      }

      // draw node labels and backgrounds
      node
        .append("text")
        .attr("class", "node-label")
        .attr("dy", "0.31em")
        .attr("x", (d) => {
          const fontSize = getFontSize(d.depth);
          return (d.children || d._children ? -fontSize * 0.2 : fontSize * 0.2);
        })
        .attr("text-anchor", (d) => (d.children || d._children ? "end" : "start"))
        .text((d) => d.data.name)
        .attr("fill", "#fff")
        .attr("font-size", (d) => getFontSize(d.depth))
        .on("click", function (_event, d) {
          handleNodeClick(_event, d as CustomHierarchyNode);
        })
        .on("mouseover", function (event, d) {
          if (!searchValue) {
            highlightText.call(this, event, d);
            setHoveredNode(d);
          }
        })
        .on("mouseout", function (event, d) {
          if (!searchValue) {
            unhighlightText.call(this, event, d);
            setHoveredNode(null);
          }
        })
        .each(function (this: SVGTextElement, d) {
          // draw background rectangle behind text
          const fontSize = getFontSize(d.depth);
          const padding = getPadding(fontSize);
          const radius = getRadius(fontSize);
          const nodeGroup = select(this.parentNode as Element);
          const bbox = this.getBBox();
          nodeGroup
            .insert("rect", "text")
            .attr("x", bbox.x - padding)
            .attr("y", bbox.y - padding / 2)
            .attr("width", bbox.width + 2 * padding)
            .attr("height", bbox.height + padding)
            .attr("fill", () => linkColor({ source: { depth: d.depth - 1 } }))
            .attr("rx", radius)
            .attr("ry", radius);

          // add anomaly warning icon
          if (!d.children && !d._children && d.data.is_anomaly) {
            nodeGroup
              .append("text")
              .attr("class", "anomaly-warning")
              .attr("x", bbox.x + bbox.width + padding * 2)
              .attr("y", bbox.y + bbox.height / 2 + 2)
              .attr("alignment-baseline", "middle")
              .attr("font-size", Math.max(fontSize * 0.8, 14))
              .attr("fill", "#FFD100")
              .text("⚠️");
          }
        });

      if (matchedNodeId) {
        // find the matched node
        const matched = root.descendants().find(
          d => d.depth === 3 && d.data.event_id === matchedNodeId
        );
        if (matched) {
          // collect ancestors and descendants
          const ancestorNodes = new Set<HierarchyNode<TreeNode>>();
          let current: HierarchyNode<TreeNode> | null = matched;
          while (current) {
            ancestorNodes.add(current);
            current = current.parent;
          }
          const descendantNodes = new Set<HierarchyNode<TreeNode>>();
          function collectDescendants(node: HierarchyNode<TreeNode>) {
            descendantNodes.add(node);
            if (node.children) node.children.forEach(collectDescendants);
            if ((node as any)._children) (node as any)._children.forEach(collectDescendants);
          }
          collectDescendants(matched);

          // highlight text and backgrounds
          svg.selectAll<SVGTextElement, HierarchyNode<TreeNode>>("text")
            .each(function(n) {
              const isRelated = ancestorNodes.has(n) || descendantNodes.has(n);
              select(this)
                .attr("fill", isRelated ? "#003366" : "#fff");
              select(this.parentNode as Element).select("rect")
                .attr("fill", isRelated ? "#B3D8FF" : linkColor({ source: { depth: n.depth - 1 } }))
                .attr("stroke-width", isRelated ? 5 : 1.5);
            });

          // highlight links
          svg.selectAll<SVGPathElement, d3.HierarchyPointLink<TreeNode>>("path")
            .attr("stroke", lnk => {
              const isAncestorPath =
                ancestorNodes.has(lnk.source as HierarchyNode<TreeNode>) &&
                ancestorNodes.has(lnk.target as HierarchyNode<TreeNode>);
              const isDescendantPath =
                descendantNodes.has(lnk.source as HierarchyNode<TreeNode>) &&
                descendantNodes.has(lnk.target as HierarchyNode<TreeNode>);
              return (isAncestorPath || isDescendantPath) ? "#B3D8FF" : linkColor(lnk);
            })
            .attr("stroke-width", lnk => {
              const isAncestorPath =
                ancestorNodes.has(lnk.source as HierarchyNode<TreeNode>) &&
                ancestorNodes.has(lnk.target as HierarchyNode<TreeNode>);
              const isDescendantPath =
                descendantNodes.has(lnk.source as HierarchyNode<TreeNode>) &&
                descendantNodes.has(lnk.target as HierarchyNode<TreeNode>);
              return (isAncestorPath || isDescendantPath) ? 5 : 1.5;
            });
        }
      }
    };

    render();
  }, [treeData, collapseEntities, collapseActions, collapseStatuses, matchedNodeId]);

// retrieve info for the hovered node
function getNodeInfo(node: HierarchyNode<TreeNode> | null) {
  if (!node) {
    return {
      title: "",
      content: `<div style="color:#888; text-align:center; padding:16px 0;">Hover on a node to see more details.</div>`
    };
  }
  if (node.depth === 0) {
    const entities = node.children || (node as unknown as HierarchyTreeNode)._children || [];
    const numEntities = entities.length;
    let numActions = 0;
    let numStatuses = 0;
    entities.forEach(entity => {
      const actions = (entity as HierarchyTreeNode).children || (entity as HierarchyTreeNode)._children || [];
      numActions += actions.length;
      actions.forEach(action => {
        const statuses = (action as HierarchyTreeNode).children || (action as HierarchyTreeNode)._children || [];
        numStatuses += statuses.length;
      });
    });
    return {
      title: "Root",
      content: `<div>
        <div style="margin-bottom:2px;"><b># of Entities:</b> ${numEntities}</div>
        <div style="margin-bottom:2px;"><b># of Actions:</b> ${numActions}</div>
        <div><b># of Statuses:</b> ${numStatuses}</div>
      </div>`
    };
  }
  if (node.depth === 1) {
    const actions = node.children || (node as unknown as HierarchyTreeNode)._children || [];
    const numActions = actions.length;
    let numStatuses = 0;
    actions.forEach(action => {
      const statuses = (action as HierarchyTreeNode).children || (action as HierarchyTreeNode)._children || [];
      numStatuses += statuses.length;
    });
    return {
      title: `Entity: ${node.data.name}`,
      content: `<div>
        <div style="margin-bottom:2px;"><b># of Actions:</b> ${numActions}</div>
        <div><b># of Statuses:</b> ${numStatuses}</div>
      </div>`
    };
  }
  if (node.depth === 2) {
    const n = node as HierarchyTreeNode;
    const statusCount =
      (n.children?.length || 0) + (n._children?.length || 0);
    return {
      title: `Action: ${node.data.name}`,
      content: `<div><b># of Statuses:</b> ${statusCount}</div>`
    };
  }
  if (node.depth === 3) {
    return {
      title: `Status: ${node.data.name}`,
      content: `<div>
        <div style="margin-bottom: 2px;"><b>Log Key:</b> ${node.data.event_id || "N/A"}</div>
        <div style="margin-bottom: 2px;"><b>Log Template:</b> ${node.data.log_template || "N/A"}</div>
        <div><b>Anomaly explanation:</b> ${
          node.data.is_anomaly
            ? (node.data.anomaly_explanation || "No explanation")
            : "Normal"
        }</div>
      </div>`
    };
  }
  return { title: node.data.name, content: "" };
}

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "flex-start",
        paddingTop: "65px",
        position: "relative",
      }}
    >
      {/* Left toggle panel */}
      <div
        style={{
          position: "fixed",
          top: "90px",
          left: "32px",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          padding: "1rem",
          background: "#fff",
          borderRadius: 8,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          zIndex: 10,
          minWidth: 140,
          width: 270,
        }}
      >
        {/* Toggles */}
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Switch checked={collapseEntities} onCheckedChange={setCollapseEntities} />
          Collapse Entities
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Switch checked={collapseActions} onCheckedChange={setCollapseActions} />
          Collapse Actions
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Switch checked={collapseStatuses} onCheckedChange={setCollapseStatuses} />
          Collapse Statuses
        </label>
        {/* --- Search bar --- */}
        <div style={{ marginTop: "1rem" }}>
          <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: 4 }}>
            <input
              type="text"
              placeholder="Search Log Key"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 10px",
                fontSize: 16,
                borderRadius: 4,
                border: "1px solid #ccc",
                outline: "none",
                flex: 1,
                height: 38,
              }}
              onKeyDown={e => {
                if (e.key === "Escape") handleClearSearch();
              }}
            />
            <Button
              type="submit"
            >
              Enter
            </Button>
            {searchValue && (
              <Button
                type="button"
                onClick={handleClearSearch}
        
              >
                Clear
              </Button>
            )}
          </form>
          {searchValue && !matchedNodeId && (
            <div style={{ color: "#c00", fontSize: 13, marginTop: 2 }}>
              No status node found.
            </div>
          )}
        </div>
      </div>

      {/* Center: SVG scrollable wrapper */}
      <div
        style={{
          flex: 1,
          marginLeft: 300,
          marginRight: 450,
          height: "100%",
          overflowX: "auto",
          overflowY: "auto",
        }}
      >
        <svg ref={svgRef} width={2000} height={500} />
      </div>

      {/* Right info panel */}
      <div
        style={{
          position: "fixed",
          top: "90px",
          right: "32px",
          minWidth: 340,
          width: 380,
          minHeight: 100,
          borderRadius: 8,
          padding: "1rem",
          fontSize: 18,
          color: "#222",
          background: "#fff",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          zIndex: 10,
          wordBreak: "break-word",
          boxSizing: "border-box",
        }}
      >
        {getNodeInfo(
          searchValue && matchedNodeObj
            ? matchedNodeObj
            : hoveredNode
        ).title && (
          <div style={{ fontWeight: "bold", marginBottom: 8, textAlign: "center" }}>
            {getNodeInfo(
              searchValue && matchedNodeObj
                ? matchedNodeObj
                : hoveredNode
            ).title}
          </div>
        )}
        <div
          style={{
            fontSize: 16,
            background: "#fff",
            border: "1px solid #ccc",
            borderRadius: 6,
            minHeight: 80,
            width: "100%",
            padding: 8,
            whiteSpace: "pre-line",
            wordBreak: "break-word",
            overflowWrap: "break-word",
            boxSizing: "border-box",
            textAlign: "left",
          }}
          dangerouslySetInnerHTML={{
            __html: getNodeInfo(
              searchValue && matchedNodeObj
                ? matchedNodeObj
                : hoveredNode
            ).content
          }}
        />
      </div>
    </div>
  );
};
