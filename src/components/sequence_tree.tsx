import React, { useRef, useEffect, useState } from 'react';
import type { KroneDecompRow, KroneDetectRow } from '@/pages/visualize_table';
import { hierarchy, tree } from 'd3-hierarchy';
import type { HierarchyNode } from 'd3-hierarchy';
import { select } from 'd3-selection';
import Papa from 'papaparse';

type SequenceTreeProps = {
    kroneDecompData: KroneDecompRow[];
    kroneDetectData: KroneDetectRow[];
};

type StatusNode = {
    name: string;
    logTemplate: string;
    isAnomaly: boolean;
    anomalyReason?: string;
    lineNumber?: number;
};

type ActionNode = {
    name: string;
    statuses: StatusNode[];
    isAnomaly: boolean;
    anomalyReason?: string;
};

type EntityNode = {
    name: string;
    actions: ActionNode[];
    isAnomaly: boolean;
    anomalyReason?: string;
};

type SequenceTreeData = {
    entities: EntityNode[];
};

type TreeNode = {
    name: string;
    children?: TreeNode[];
    _children?: TreeNode[];
    isAnomaly?: boolean;
    anomalyReason?: string;
    indexPath?: number[];
    lineNumber?: number;
};

// Add index path to each node
function addIndexPath(node: TreeNode, path: number[] = []): void {
    node.indexPath = path;
    (node.children || []).forEach((child, i) => addIndexPath(child, [...path, i]));
    (node._children || []).forEach((child, i) => addIndexPath(child, [...path, i]));
}

// Toggle children by index path
function toggleNodeByIndexPath(node: TreeNode, path: number[]): TreeNode {
    if (path.length === 0) return node;
    const [head, ...rest] = path;
    const childrenArr = node.children ?? node._children;
    if (!childrenArr || !childrenArr[head]) return node;
    const newChildren = [...childrenArr];
    if (rest.length === 0) {
        const target = newChildren[head];
        const isExpanded = !!target.children;
        newChildren[head] = {
            ...target,
            children: isExpanded ? undefined : target._children,
            _children: isExpanded ? target.children : undefined
        };
    } else {
        newChildren[head] = toggleNodeByIndexPath(newChildren[head], rest);
    }
    return {
        ...node,
        children: node.children ? newChildren : undefined,
        _children: node._children ? newChildren : undefined
    };
}

function toTreeNode(data: SequenceTreeData): TreeNode {
    return {
        name: "Root",
        children: data.entities.map(entity => ({
            name: entity.name,
            children: entity.actions.map(action => ({
                name: action.name,
                children: action.statuses.map(status => ({
                    name: `${status.name} (${status.logTemplate})`,
                    isAnomaly: status.isAnomaly,
                    anomalyReason: status.anomalyReason,
                    lineNumber: status.lineNumber
                })),
                isAnomaly: action.isAnomaly,
                anomalyReason: action.anomalyReason
            })),
            isAnomaly: entity.isAnomaly,
            anomalyReason: entity.anomalyReason
        }))
    };
}

// Collapse/expand at a given depth
function setCollapseAtDepth(node: TreeNode, targetDepth: number, collapse: boolean, currentDepth = 0) {
    if (!node.children && !node._children) return;
    if (currentDepth === targetDepth) {
        if (collapse && node.children) {
            node._children = node.children;
            node.children = undefined;
        } else if (!collapse && node._children) {
            node.children = node._children;
            node._children = undefined;
        }
    } else {
        (node.children || node._children || []).forEach(child =>
            setCollapseAtDepth(child, targetDepth, collapse, currentDepth + 1)
        );
    }
}

// Annotate anomalies in the SequenceTreeData structure
function annotateAnomalies(
    tree: SequenceTreeData,
    decomp: KroneDecompRow,
    detect: KroneDetectRow[]
) {
    const anomalies = detect.filter(d => d.seq_id === decomp.seq_id);

    for (const anomaly of anomalies) {
        const anomalySeg = anomaly.anomaly_seg;
        const anomalyLevel = anomaly.anomaly_level;
        const anomalyReason = anomaly.anomaly_reason;

        if (!anomalySeg || anomalySeg.length === 0) continue;

        if (anomalyLevel === "status") {
            for (const entity of tree.entities) {
                for (const action of entity.actions) {
                    for (const status of action.statuses) {
                        if (anomalySeg.includes(status.logTemplate)) {
                            status.isAnomaly = true;
                            status.anomalyReason = anomalyReason;
                            action.isAnomaly = true;
                            action.anomalyReason = anomalyReason;
                            entity.isAnomaly = true;
                            entity.anomalyReason = anomalyReason;
                        }
                    }
                }
            }
        } else if (anomalyLevel === "action" || anomalyLevel === "entity") {
            // Flatten all status logTemplates in order
            const allStatuses: StatusNode[] = [];
            for (const entity of tree.entities) {
                for (const action of entity.actions) {
                    for (const status of action.statuses) {
                        allStatuses.push(status);
                    }
                }
            }
            // Sliding window to match contiguous subsequence
            for (let i = 0; i <= allStatuses.length - anomalySeg.length; i++) {
                let match = true;
                for (let j = 0; j < anomalySeg.length; j++) {
                    if (allStatuses[i + j].logTemplate !== anomalySeg[j]) {
                        match = false;
                        break;
                    }
                }
                if (match) {
                    for (let j = 0; j < anomalySeg.length; j++) {
                        const status = allStatuses[i + j];
                        status.isAnomaly = true;
                        status.anomalyReason = anomalyReason;
                    }
                }
            }
            // Mark parent actions/entities if any of their children are anomalies
            for (const entity of tree.entities) {
                let entityHasAnomaly = false;
                for (const action of entity.actions) {
                    let actionHasAnomaly = false;
                    for (const status of action.statuses) {
                        if (status.isAnomaly) {
                            actionHasAnomaly = true;
                        }
                    }
                    if (actionHasAnomaly) {
                        action.isAnomaly = true;
                        action.anomalyReason = anomalyReason;
                        entityHasAnomaly = true;
                    }
                }
                if (entityHasAnomaly) {
                    entity.isAnomaly = true;
                    entity.anomalyReason = anomalyReason;
                }
            }
        }
    }
}

export const SequenceTree: React.FC<SequenceTreeProps> = ({ kroneDecompData, kroneDetectData }) => {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const [treeData, setTreeData] = useState<TreeNode | null>(null);
    const [hoveredAnomaly, setHoveredAnomaly] = useState<{ explanation: string; x: number; y: number } | null>(null);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [eventIdToLogTemplate, setEventIdToLogTemplate] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    const [entitiesCollapsed, setEntitiesCollapsed] = useState(false);
    const [actionsCollapsed, setActionsCollapsed] = useState(false);

    function buildSequenceTreeData(decomp: KroneDecompRow): SequenceTreeData {
        const entities: EntityNode[] = [];
        const { entity_nodes_for_logkeys, action_nodes_for_logkeys, status_nodes_for_logkeys, seq } = decomp;

        let i = 0;
        let lineNumber = 1;
        while (i < entity_nodes_for_logkeys.length) {
            const entityName = entity_nodes_for_logkeys[i];
            const entityNode: EntityNode = {
                name: entityName,
                actions: [],
                isAnomaly: false,
            };

            let j = i;
            while (
                j < entity_nodes_for_logkeys.length &&
                entity_nodes_for_logkeys[j] === entityName
            ) {
                const actionName = action_nodes_for_logkeys[j];
                const actionNode: ActionNode = {
                    name: actionName,
                    statuses: [],
                    isAnomaly: false,
                };

                let k = j;
                while (
                    k < entity_nodes_for_logkeys.length &&
                    entity_nodes_for_logkeys[k] === entityName &&
                    action_nodes_for_logkeys[k] === actionName
                ) {
                    actionNode.statuses.push({
                        name: status_nodes_for_logkeys[k],
                        logTemplate: seq[k],
                        isAnomaly: false,
                        lineNumber: lineNumber++,
                    });
                    k++;
                }

                entityNode.actions.push(actionNode);
                j = k;
            }

            entities.push(entityNode);
            i = j;
        }

        return { entities };
    }

    function handleNodeClick(d: HierarchyNode<TreeNode>) {
        const indexPath = d.data.indexPath;
        if (!indexPath) return;
        setTreeData(prev => {
            if (!prev) return null;
            const updated = toggleNodeByIndexPath(prev, indexPath);
            addIndexPath(updated);  
            return updated;
        });
    }

    useEffect(() => {
        fetch("/structured_processes.csv")
            .then(res => res.text())
            .then(csvText => {
                Papa.parse(csvText, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        const mapping: Record<string, string> = {};
                        type CsvRow = { event_id?: string; log_template?: string };
                        for (const row of results.data as CsvRow[]) {
                            if (row.event_id && row.log_template) {
                                mapping[String(row.event_id)] = String(row.log_template);
                            }
                        }
                        setEventIdToLogTemplate(mapping);
                    }
                });
            });
    }, []);

    useEffect(() => {
        if (
            kroneDecompData.length > 0 &&
            selectedIndex >= 0 &&
            selectedIndex < kroneDecompData.length
        ) {
            setLoading(true);
            const decomp = kroneDecompData[selectedIndex];
            const treeStruct = buildSequenceTreeData(decomp);
            annotateAnomalies(treeStruct, decomp, kroneDetectData);
            const treeNode = toTreeNode(treeStruct);
            addIndexPath(treeNode);
            setTreeData(treeNode);
            setLoading(false);
        }
    }, [kroneDecompData, kroneDetectData, selectedIndex]);

    useEffect(() => {
        if (!treeData) return;
        const cloned = JSON.parse(JSON.stringify(treeData)) as TreeNode;
        setCollapseAtDepth(cloned, 1, entitiesCollapsed);
        setCollapseAtDepth(cloned, 2, actionsCollapsed);
        addIndexPath(cloned);
        setTreeData(cloned);
    }, [entitiesCollapsed, actionsCollapsed]);

    useEffect(() => {
        if (!treeData || !svgRef.current) return;
        addIndexPath(treeData);

        const root = hierarchy<TreeNode>(treeData, d => d.children); 

        const baseFont = 28, minFont = 15, fontStep = 5, basePadding = 0.25, baseRadius = 0.25, depthSpacing = 14, siblingSpacing = 13;
        const getFontSize = (depth: number) => Math.max(baseFont - depth * fontStep, minFont);
        const getPadding = (fontSize: number) => fontSize * basePadding;
        const getRadius = (fontSize: number) => fontSize * baseRadius;
        const getCssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        const wpired = getCssVar('--color-WPIRed') || "#c8102e";
        const wpigold = getCssVar('--color-WPIGold') || "#ffd100";
        const wpigrey = getCssVar('--color-WPIGrey') || "#888";
        const font = getCssVar('--font-WPIfont') || "sans-serif";
        const redBG = "#fde2e5", yellowBG = "#fff8e8", greyBG = "#ededed";
        const linkBorderColor = (d: { source: { depth: number } }) => [wpired, wpigold, wpigrey, "#000000"][d.source.depth] || "#000000";
        const linkFillColor = (d: { source: { depth: number } }) => [redBG, yellowBG, greyBG, "#ffffff"][d.source.depth] || "#ffffff";

        let widestEntity = 0, widestAction = 0;
        const tempSvg = select(document.body).append("svg").attr("style", "position: absolute; visibility: hidden;").attr("font-family", font);
        root.descendants().forEach((node) => {
            const fontSize = getFontSize(node.depth);
            const tempText = tempSvg.append("text").attr("font-size", fontSize).attr("font-family", font).text(node.data.name);
            const bbox = (tempText.node() as SVGTextElement).getBBox();
            const labelWidth = bbox.width + getPadding(fontSize) * 2;
            if (node.depth === 1 && labelWidth > widestEntity) widestEntity = labelWidth;
            if (node.depth === 2 && labelWidth > widestAction) widestAction = labelWidth;
            tempText.remove();
        });
        tempSvg.remove();

        const dy = Math.max(widestEntity + 20, widestAction + 40);
        tree<TreeNode>().nodeSize([siblingSpacing + 4, dy]).separation((a, b) => (Math.max(getFontSize(a.depth), getFontSize(b.depth)) + 8) / depthSpacing)(root);

        const statusDy = 150;
        root.each(node => { if (node.depth === 3 && node.parent && typeof node.parent.y === "number") node.y = node.parent.y + statusDy; });

        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        root.each((d) => {
            if ((d.x ?? 0) > x1) x1 = d.x ?? 0;
            if ((d.x ?? 0) < x0) x0 = d.x ?? 0;
            if ((d.y ?? 0) > y1) y1 = d.y ?? 0;
            if ((d.y ?? 0) < y0) y0 = d.y ?? 0;
        });

        let maxStatusLabelRight = 0, maxLogTemplateRight = 0;
        const tempSvg2 = select(document.body).append("svg").attr("style", "position: absolute; visibility: hidden;").attr("font-family", font);
        root.descendants().forEach((node) => {
            const fontSize = getFontSize(node.depth);
            const tempText = tempSvg2.append("text").attr("font-size", fontSize).attr("font-family", font).text(node.data.name);
            const bbox = (tempText.node() as SVGTextElement).getBBox();
            if (node.depth === 3) {
                const rightEdge = bbox.x + bbox.width + getPadding(fontSize);
                if (rightEdge > maxStatusLabelRight) maxStatusLabelRight = rightEdge;
                let eventId = "";
                const match = /\(([^)]+)\)$/.exec(node.data.name);
                if (match) eventId = match[1];
                const logTemplate = eventIdToLogTemplate[eventId] || "";
                if (logTemplate) {
                    const linePrefix = typeof node.data.lineNumber === "number" ? `${node.data.lineNumber}. ` : "";
                    const tempLogText = tempSvg2.append("text").attr("font-size", Math.max(fontSize * 0.8, 14)).attr("font-family", font).text(linePrefix + logTemplate);
                    const logBBox = (tempLogText.node() as SVGTextElement).getBBox();
                    const logRight = rightEdge + getPadding(fontSize) * 2 + logBBox.width;
                    if (logRight > maxLogTemplateRight) maxLogTemplateRight = logRight;
                    tempLogText.remove();
                }
            }
            tempText.remove();
        });
        tempSvg2.remove();

        const rightmost = Math.max(y1 + 600, maxStatusLabelRight + 600, maxLogTemplateRight + 600);
        const minRootWidth = 400;
        const visibleNodes = root.descendants().length;
        const adjustedWidth = visibleNodes === 1 ? minRootWidth : rightmost;
        const height = x1 - x0 + baseFont * 2;

        const svg = select(svgRef.current);
        svg.selectAll("*").remove();
        svg
            .attr("width", adjustedWidth + 120)
            .attr("height", height)
            .attr("viewBox", `${-80} ${x0 - baseFont} ${adjustedWidth + 120} ${height}`)
            .attr("style", "max-width: 100%; height: auto; font: 10px;")
            .attr("font-family", font);

        svg.append("g")
            .attr("fill", "none")
            .attr("stroke-opacity", 0.4)
            .attr("stroke-width", 1.5)
            .selectAll("path")
            .data(root.links())
            .join("path")
            .attr("d", (d: { source: HierarchyNode<TreeNode>; target: HierarchyNode<TreeNode> }) => {
                const gap = 18;
                const sourceY = typeof d.source.y === "number" ? d.source.y : 0;
                const sourceStubY = sourceY + gap;
                return [
                    `M${sourceY},${d.source.x}`,
                    `H${sourceStubY}`,
                    `V${d.target.x}`,
                    `H${d.target.y}`
                ].join(" ");
            })
            .attr("stroke", linkBorderColor);

        const node = svg.append("g")
            .attr("stroke-linejoin", "round")
            .attr("stroke-width", 3)
            .selectAll("g")
            .data(root.descendants())
            .join("g")
            .attr("transform", (d) => `translate(${d.y},${d.x})`);

        function collectRelatedNodes(d: HierarchyNode<TreeNode>) {
            const related = new Set<HierarchyNode<TreeNode>>();
            related.add(d);
            let ancestor = d.parent;
            while (ancestor) {
                related.add(ancestor);
                ancestor = ancestor.parent;
            }
            d.descendants().forEach(desc => related.add(desc));
            return related;
        }

        function highlightText(this: SVGTextElement, _event: React.MouseEvent<SVGTextElement, MouseEvent>, d: HierarchyNode<TreeNode>) {
            const related = collectRelatedNodes(d);
            svg.selectAll<SVGTextElement, HierarchyNode<TreeNode>>("text")
                .each(function (n) {
                    const isRelated = related.has(n);
                    select(this)
                        .attr("fill", isRelated ? "#003366" : (n.data.isAnomaly ? "#c8102e" : "#222"));
                    select(this.parentNode as Element).select("rect")
                        .attr("fill", isRelated ? "#B3D8FF" : linkFillColor({ source: { depth: n.depth - 1 } }));
                });
            svg.selectAll<SVGPathElement, d3.HierarchyPointLink<TreeNode>>("path")
                .attr("stroke", lnk =>
                    related.has(lnk.source as HierarchyNode<TreeNode>) || related.has(lnk.target as HierarchyNode<TreeNode>)
                        ? "#B3D8FF"
                        : linkBorderColor(lnk)
                )
                .attr("stroke-opacity", lnk =>
                    related.has(lnk.source as HierarchyNode<TreeNode>) || related.has(lnk.target as HierarchyNode<TreeNode>)
                        ? 1
                        : 0.4
                );
        }

        function unhighlightText(this: SVGTextElement) {
            svg.selectAll<SVGTextElement, HierarchyNode<TreeNode>>("text")
                .attr("fill", (d) => d.data.isAnomaly ? "#c8102e" : "#222")
                .attr("font-weight", null);
            svg.selectAll<SVGGElement, HierarchyNode<TreeNode>>("g")
                .select("rect")
                .attr("fill", n => linkFillColor({ source: { depth: n.depth - 1 } }));
            svg.selectAll<SVGPathElement, d3.HierarchyPointLink<TreeNode>>("path")
                .attr("stroke", linkBorderColor)
                .attr("stroke-opacity", 0.4);
        }

        node
            .append("text")
            .attr("class", "node-label")
            .attr("dy", "0.31em")
            .attr("x", (d) => {
                const fontSize = getFontSize(d.depth);
                return (d.children || d.data._children ? -fontSize * 0.2 : fontSize * 0.2);
            })
            .attr("text-anchor", (d) => (d.children || d.data._children ? "end" : "start"))
            .text((d) => d.data.name)
            .attr("fill", (d) => d.data.isAnomaly ? "#c8102e" : "#222")
            .attr("font-size", (d) => getFontSize(d.depth))
            .on("mouseover", function (event, d) {
                highlightText.call(this, event, d);
                if (
                    (d.depth === 1 || d.depth === 2 || d.depth === 3) &&
                    d.data.isAnomaly &&
                    d.data.anomalyReason
                ) {
                    setHoveredAnomaly({
                        explanation: d.data.anomalyReason,
                        x: event.clientX,
                        y: event.clientY,
                    });
                }
            })
            .on("mouseout", function () {
                unhighlightText.call(this);
                setHoveredAnomaly(null);
            })
            .on("click", function (event, d) {
                event.stopPropagation();
                handleNodeClick(d);
            })
            .each(function (this: SVGTextElement, d) {
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
                    .attr("fill", () => linkFillColor({ source: { depth: d.depth - 1 } }))
                    .attr("stroke", () => linkBorderColor({ source: { depth: d.depth - 1 } }))
                    .attr("rx", radius)
                    .attr("ry", radius);

                // Log template text for status nodes, with line numbers as prefix
                if (d.depth === 3) {
                    let eventId = "";
                    const match = /\(([^)]+)\)$/.exec(d.data.name);
                    if (match) eventId = match[1];
                    const logTemplate = eventIdToLogTemplate[eventId] || "";
                    if (logTemplate) {
                        const linePrefix = typeof d.data.lineNumber === "number" ? `${d.data.lineNumber}. ` : "";
                        nodeGroup
                            .append("text")
                            .attr("class", "log-template-text")
                            .attr("x", maxStatusLabelRight + getPadding(fontSize) * 2 + 25)
                            .attr("y", bbox.y + bbox.height / 2 + 2)
                            .attr("alignment-baseline", "middle")
                            .attr("font-size", Math.max(fontSize * 0.8, 14))
                            .attr("fill", d.data.isAnomaly ? "#c8102e" : "#444")
                            .attr("text-anchor", "start")
                            .on("mouseover", function (event) {
                                if (d.data.isAnomaly && d.data.anomalyReason) {
                                    setHoveredAnomaly({
                                        explanation: d.data.anomalyReason,
                                        x: event.clientX,
                                        y: event.clientY,
                                    });
                                }
                            })
                            .on("mouseout", function () {
                                setHoveredAnomaly(null);
                            })
                            .text(linePrefix + logTemplate);
                    }
                }

                // Add warning symbol for anomaly nodes (entity, action, status)
                if (
                    d.data.isAnomaly &&
                    (
                        d.depth === 1 ||
                        d.depth === 2 ||
                        (d.depth === 3 && !d.children && !d.data._children)
                    )
                ) {
                    nodeGroup
                        .append("text")
                        .attr("class", "anomaly-warning")
                        .attr("x", bbox.x + bbox.width + (d.depth === 3 ? padding * 2 : padding * 1.2))
                        .attr("y", d.depth === 3 ? bbox.y + bbox.height / 2 + 2 : bbox.y - padding / 2 + 8)
                        .attr("alignment-baseline", d.depth === 3 ? "middle" : "hanging")
                        .attr("font-size", Math.max(fontSize * 0.8, d.depth === 3 ? 14 : 18))
                        .attr("fill", "#FFD100")
                        .attr("text-anchor", "start")
                        .style("cursor", "pointer")
                        .text("⚠️")
                        .on("mouseover", function (event) {
                            if (d.data.anomalyReason) {
                                setHoveredAnomaly({
                                    explanation: d.data.anomalyReason,
                                    x: event.clientX,
                                    y: event.clientY,
                                });
                            }
                        })
                        .on("mouseout", function () {
                            setHoveredAnomaly(null);
                        });
                }
            });
    }, [treeData, eventIdToLogTemplate]);

    return (
        <div style={{ width: "100%", display: "flex", justifyContent: "center", position: "relative" }}>
            <div className="sequence-tree h-max">
                <h2>Sequence Tree</h2>
                <div style={{ marginBottom: 12, display: "flex", gap: 12, alignItems: "center" }}>
                    <label>
                        Sequence:&nbsp;
                        <select
                            value={kroneDecompData[selectedIndex]?.seq_id ?? ""}
                            onChange={e => {
                                const idx = kroneDecompData.findIndex(row => row.seq_id === e.target.value);
                                if (idx !== -1) setSelectedIndex(idx);
                            }}
                            style={{ minWidth: 120 }}
                        >
                            {kroneDecompData.map((row) => (
                                <option key={row.seq_id} value={row.seq_id}>
                                    {row.seq_id}
                                </option>
                            ))}
                        </select>
                    </label>
                    <button
                        onClick={() => setEntitiesCollapsed(val => !val)}
                        style={{
                            marginLeft: 16,
                            padding: "4px 12px",
                            borderRadius: 6,
                            border: "1px solid #ccc",
                            background: entitiesCollapsed ? "#ffd100" : "#eee",
                            fontWeight: 600,
                            cursor: "pointer"
                        }}
                    >
                        {entitiesCollapsed ? "Expand Entities" : "Collapse Entities"}
                    </button>
                    <button
                        onClick={() => setActionsCollapsed(val => !val)}
                        style={{
                            padding: "4px 12px",
                            borderRadius: 6,
                            border: "1px solid #ccc",
                            background: actionsCollapsed ? "#ffd100" : "#eee",
                            fontWeight: 600,
                            cursor: "pointer"
                        }}
                    >
                        {actionsCollapsed ? "Expand Actions" : "Collapse Actions"}
                    </button>
                </div>
                {loading ? (
                    <div style={{ textAlign: "center", padding: "2rem" }}>
                        <span className="animate-spin inline-block mr-2" style={{ fontSize: 24 }}>⏳</span>
                        Loading sequence tree...
                    </div>
                ) : (
                    <>
                        <svg ref={svgRef} />
                        {hoveredAnomaly && (
                            <div
                                ref={el => {
                                    if (el) {
                                        const { innerWidth, innerHeight } = window;
                                        const rect = el.getBoundingClientRect();
                                        let left = hoveredAnomaly.x + 30;
                                        let top = hoveredAnomaly.y;
                                        if (left + rect.width > innerWidth) {
                                            left = innerWidth - rect.width - 16;
                                        }
                                        if (top + rect.height > innerHeight) {
                                            top = innerHeight - rect.height - 16;
                                        }
                                        el.style.left = `${left}px`;
                                        el.style.top = `${top}px`;
                                    }
                                }}
                                style={{
                                    position: "fixed",
                                    background: "white",
                                    color: "#222",
                                    border: "1px solid #ccc",
                                    borderRadius: 8,
                                    padding: "1rem",
                                    zIndex: 100,
                                    maxWidth: 400,
                                    boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
                                    pointerEvents: "none",
                                }}
                            >
                                <strong>Anomaly Explanation</strong>
                                <div style={{ marginTop: 8 }}>{hoveredAnomaly.explanation}</div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};