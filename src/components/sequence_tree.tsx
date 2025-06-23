import React, { useRef, useEffect, useState } from 'react';
import type { KroneDecompRow, KroneDetectRow } from '@/pages/visualize_table';
import { hierarchy, tree } from 'd3-hierarchy';
import type { HierarchyNode, HierarchyLink } from 'd3-hierarchy';
import { select } from 'd3-selection';
import Papa from 'papaparse';

/**
 * Props for the SequenceTree component.
 * - kroneDecompData: Array of decomposed sequence rows (tree structure).
 * - kroneDetectData: Array of detected anomaly rows.
 */
type SequenceTreeProps = {
    kroneDecompData: KroneDecompRow[];
    kroneDetectData: KroneDetectRow[];
};

/**
 * TreeNode represents a node in the sequence tree.
 * - name: Display name for the node.
 * - children: Expanded children nodes.
 * - _children: Collapsed children nodes.
 * - isAnomaly: Whether this node is anomalous.
 * - anomalyReason: Explanation for anomaly.
 * - indexPath: Path to this node in the tree (for toggling).
 * - lineNumber: Optional line number for log template display.
 */
type TreeNode = {
    name: string;
    children?: TreeNode[];
    _children?: TreeNode[];
    isAnomaly?: boolean;
    anomalyReason?: string;
    indexPath?: number[];
    lineNumber?: number;
    isRelatedToAnomaly?: boolean;
};

/**
 * Recursively adds an indexPath array to each node, representing its path from the root.
 * Used for toggling expand/collapse.
 */
function addIndexPath(node: TreeNode, path: number[] = []): void {
    node.indexPath = path;
    (node.children || []).forEach((c, i) => addIndexPath(c, [...path, i]));
    (node._children || []).forEach((c, i) => addIndexPath(c, [...path, i]));
}

/**
 * Recursively toggles (expand/collapse) a node at the given indexPath.
 * Returns a new tree with the toggled node.
 */
function toggleNodeByIndexPath(node: TreeNode, path: number[]): TreeNode {
    if (path.length === 0) return node;
    const [currentIndex, ...remainingPath] = path;
    const childArray = node.children ?? node._children;
    if (!childArray || !childArray[currentIndex]) return node;
    const updatedChildren = [...childArray];
    if (remainingPath.length === 0) {
        const targetNode = updatedChildren[currentIndex];
        const isExpanded = !!targetNode.children;
        updatedChildren[currentIndex] = {
            ...targetNode,
            children: isExpanded ? undefined : targetNode._children,
            _children: isExpanded ? targetNode.children : undefined,
        };
    } else {
        updatedChildren[currentIndex] = toggleNodeByIndexPath(updatedChildren[currentIndex], remainingPath);
    }
    return {
        ...node,
        children: node.children ? updatedChildren : undefined,
        _children: node._children ? updatedChildren : undefined,
    };
}
function arraysEqual<T>(a: T[], b: T[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}
/**
 * Converts a KroneDecompRow into a nested TreeNode structure.
 * Groups by entity, then action, then status.
 */
function toTreeNode(data: KroneDecompRow, anomalies: KroneDetectRow[]): TreeNode {
    const entities: TreeNode[] = [];
    const { entity_nodes_for_logkeys: e, action_nodes_for_logkeys: a, status_nodes_for_logkeys: s, seq } = data;

    // Create uncollapsed entities and actions
    for (let i = 0; i < e.length; i++) {
        const actions: TreeNode[] = [];
        const statuses: TreeNode[] = [];
        statuses.push({name: `${s[i]} (${seq[i]})`, lineNumber: i});
        actions.push({ name: a[i], children: statuses });
        entities.push({ name: e[i], children: actions });
    }

    // Anomaly detection and annotation
    let hasAnomalies = false;
    let foundAnomaly = null as KroneDetectRow | null;
    anomalies.forEach(anomaly => {
        if (anomaly.seq_id === data.seq_id) {
            hasAnomalies = true;
            foundAnomaly = anomaly;
        }
    })

    if (hasAnomalies && foundAnomaly!) {
        const anomalyLength = foundAnomaly.anomaly_seg.length;
        for (let i = 0; i <= e.length - anomalyLength; i++) {
            if (arraysEqual(seq.slice(i, i + anomalyLength), foundAnomaly.anomaly_seg)) {
                for (let j = i; j < i + anomalyLength; j++) {
                    // Mark the status as anomalous
                    if (foundAnomaly.anomaly_level === "status") {
                        entities[j].children![0].children![0].isAnomaly = true;
                        entities[j].children![0].children![0].anomalyReason = foundAnomaly.anomaly_reason;
                        entities[j].children![0].isRelatedToAnomaly = true; // Mark action as related to anomaly
                        entities[j].isRelatedToAnomaly = true; // Mark entity as related to anomaly
                    }
                    if (foundAnomaly.anomaly_level === "action") { 
                        entities[j].children![0].isAnomaly = true;
                        entities[j].children![0].anomalyReason = foundAnomaly.anomaly_reason;
                        entities[j].isRelatedToAnomaly = true; // Mark entity as related to anomaly
                        entities[j].children![0].children!.forEach(stat => {
                            stat.isRelatedToAnomaly = true; // Mark all statuses as related to anomaly
                        })
                    }
                    if (foundAnomaly.anomaly_level === "entity") {
                        entities[j].isAnomaly = true;
                        entities[j].anomalyReason = foundAnomaly.anomaly_reason;
                        entities[j].children!.forEach(act => {
                            act.isRelatedToAnomaly = true; // Mark all actions as related to anomaly
                            act.children!.forEach(stat => {
                                stat.isRelatedToAnomaly = true; // Mark all statuses as related to anomaly
                            });
                        });
                    }
                }
            }
        }
    }

    // Collapse same siblings
    let i = 0;
    while (i < entities.length - 1) { 
        if (entities[i].name === entities[i+1].name) {
            console.log("Merging entities", e[i], e[i + 1]);
            entities[i].children = (entities[i].children ?? []).concat(entities[i + 1].children ?? []);
            // Remove the next entity since it's merged
            entities.splice(i + 1, 1);
        }
        else {
            i++;
        }
    }

    for (let j = 0; j < entities.length; j++) {
        let k = 0
        while (k < entities[j].children!.length - 1) {
            if (entities[j].children![k].name === entities[j].children![k + 1].name) {
                console.log("Merging actions", a[k], a[k + 1]);
                entities[j].children![k].children = (entities[j].children![k].children ?? []).concat(entities[j].children![k + 1].children ?? []);
                // Remove the next action since it's merged
                entities[j].children!.splice(k + 1, 1);
            }
            else {
                k++;
            }
        }
    }

    return { name: "Root", children: entities };
}

/**
 * Recursively collapses or expands nodes at a given depth.
 * Used for "Collapse Entities" and "Collapse Actions" buttons.
 */
function setCollapseAtDepth(node: TreeNode, depth: number, collapse: boolean, cur = 0) {
    if (!node.children && !node._children) return;
    if (cur === depth) {
        if (collapse && node.children) {
            node._children = node.children;
            node.children = undefined;
        } else if (!collapse && node._children) {
            node.children = node._children;
            node._children = undefined;
        }
    } else (node.children || node._children || []).forEach(c => setCollapseAtDepth(c, depth, collapse, cur + 1));
}

/**
 * SequenceTree component renders the sequence tree and controls.
 * Handles loading, toggling, anomaly tooltips, and SVG rendering (to be replaced with HTML tree).
 */
export const SequenceTree: React.FC<SequenceTreeProps> = ({ kroneDecompData, kroneDetectData }) => {
    // Ref for SVG (legacy, can be removed if switching to HTML tree)
    const svgRef = useRef<SVGSVGElement | null>(null);

    // State for the tree data structure
    const [treeData, setTreeData] = useState<TreeNode | null>(null);

    // State for hovered anomaly tooltip
    const [hoveredAnomaly, setHoveredAnomaly] = useState<{ explanation: string; x: number; y: number } | null>(null);

    // State for which sequence is selected
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Mapping from event_id to log template (loaded from CSV)
    const [eventIdToLogTemplate, setEventIdToLogTemplate] = useState<Record<string, string>>({});

    // Loading state for async data
    const [loading, setLoading] = useState(true);

    // Collapse toggles for entity and action levels
    const [entitiesCollapsed, setEntitiesCollapsed] = useState(false);
    const [actionsCollapsed, setActionsCollapsed] = useState(false);
    const [showTree, setShowTree] = useState(false);

    /**
     * Loads the event_id to log_template mapping from CSV on mount.
     */
    useEffect(() => {
        fetch("/structured_processes.csv")
            .then(res => res.text())
            .then(csvText => {
                Papa.parse(csvText, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        const mapping: Record<string, string> = {};
                        for (const row of results.data as Record<string, string>[]) {
                            if (row.event_id && row.log_template) mapping[String(row.event_id)] = String(row.log_template);
                        }
                        setEventIdToLogTemplate(mapping);
                    }
                });
            });
    }, []);

    /**
     * When the selected sequence changes, build the tree and annotate anomalies.
     */
    useEffect(() => {
        if (kroneDecompData.length && selectedIndex >= 0 && selectedIndex < kroneDecompData.length) {
            setLoading(true);
            const decomp = kroneDecompData[selectedIndex];
            const treeNode = toTreeNode(decomp, kroneDetectData);
            addIndexPath(treeNode);
            setTreeData(treeNode);
            setLoading(false);
        }
    }, [kroneDecompData, kroneDetectData, selectedIndex]);

    /**
     * When collapse toggles change, update the tree accordingly.
     */
    useEffect(() => {
        if (!treeData) return;
        const cloned = JSON.parse(JSON.stringify(treeData)) as TreeNode;
        setCollapseAtDepth(cloned, 1, entitiesCollapsed);
        setCollapseAtDepth(cloned, 2, actionsCollapsed);
        addIndexPath(cloned);
        setTreeData(cloned);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entitiesCollapsed, actionsCollapsed]);

    /**
     * Handles SVG rendering and D3 layout.
     * 
     * This effect is responsible for:
     * - Measuring the width of each label at each tree depth to determine column spacing.
     * - Laying out the tree nodes using d3-hierarchy's tree layout.
     * - Calculating the positions for each node and link.
     * - Drawing the tree structure (nodes, links, labels, anomaly icons, and log templates) in SVG.
     * - Handling mouse events for highlighting and tooltips.

     */
    useEffect(() => {
        if (!showTree) return; // <-- Only draw SVG if tree is shown
        if (!treeData || !svgRef.current) return;

        // Ensure each node has an indexPath for toggling
        addIndexPath(treeData);

        // Build a d3 hierarchy from the tree data
        const root = hierarchy<TreeNode>(treeData, d => d.children);

        // --- Layout and style constants ---
        const baseFont = 28, minFont = 15, fontStep = 5, basePadding = 0.25, baseRadius = 0.25, depthSpacing = 14, siblingSpacing = 13;
        const getFontSize = (d: number) => Math.max(baseFont - d * fontStep, minFont);
        const getPadding = (f: number) => f * basePadding;
        const getRadius = (f: number) => f * baseRadius;
        const getCssVar = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
        const wpired = getCssVar('--color-WPIRed') || "#c8102e";
        const wpigold = getCssVar('--color-WPIGold') || "#ffd100";
        const wpigrey = getCssVar('--color-WPIGrey') || "#888";
        const font = getCssVar('--font-WPIfont') || "sans-serif";
        const redBG = "#fde2e5", yellowBG = "#fff8e8", greyBG = "#ededed";
        const linkBorderColor = (d: { source: { depth: number } }) => [wpired, wpigold, wpigrey, "#000"][d.source.depth] || "#000";
        const linkFillColor = (d: { source: { depth: number } }) => [redBG, yellowBG, greyBG, "#fff"][d.source.depth] || "#fff";

        // --- Measure label widths to determine column spacing ---
        let widestEntity = 0, widestAction = 0;
        const tempSvg = select(document.body).append("svg").attr("style", "position: absolute; visibility: hidden;").attr("font-family", font);
        root.descendants().forEach(node => {
            const fontSize = getFontSize(node.depth);
            const tempText = tempSvg.append("text").attr("font-size", fontSize).attr("font-family", font).text(node.data.name);
            const bbox = (tempText.node() as SVGTextElement).getBBox();
            const labelWidth = bbox.width + getPadding(fontSize) * 2;
            if (node.depth === 1 && labelWidth > widestEntity) widestEntity = labelWidth;
            if (node.depth === 2 && labelWidth > widestAction) widestAction = labelWidth;
            tempText.remove();
        });
        tempSvg.remove();

        // --- Layout the tree using d3.tree() ---
        const dy = Math.max(widestEntity + 20, widestAction + 40);
        tree<TreeNode>().nodeSize([siblingSpacing + 4, dy]).separation((a, b) => (Math.max(getFontSize(a.depth), getFontSize(b.depth)) + 8) / depthSpacing)(root);

        // --- Offset status nodes (depth 3) to the right for log template display ---
        const statusDy = 150;
        root.each(node => { if (node.depth === 3 && node.parent && typeof node.parent.y === "number") node.y = node.parent.y + statusDy; });

        // --- Calculate SVG bounds for viewBox and sizing ---
        let x0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        root.each(d => {
            if ((d.x ?? 0) > x1) x1 = d.x ?? 0;
            if ((d.x ?? 0) < x0) x0 = d.x ?? 0;
            if ((d.y ?? 0) > y1) y1 = d.y ?? 0;
        });

        // --- Measure rightmost edge for status and log template columns ---
        let maxStatusLabelRight = 0, maxLogTemplateRight = 0;
        const tempSvg2 = select(document.body).append("svg").attr("style", "position: absolute; visibility: hidden;").attr("font-family", font);
        root.descendants().forEach(node => {
            const fontSize = getFontSize(node.depth);
            const tempText = tempSvg2.append("text").attr("font-size", fontSize).attr("font-family", font).text(node.data.name);
            const bbox = (tempText.node() as SVGTextElement).getBBox();
            if (node.depth === 3) {
                const rightEdge = bbox.x + bbox.width + getPadding(fontSize);
                if (rightEdge > maxStatusLabelRight) maxStatusLabelRight = rightEdge;
                const eventId = /\(([^)]+)\)$/.exec(node.data.name)?.[1] || "";
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

        // --- Set SVG size and viewBox based on calculated bounds ---
        const rightmost = Math.max(y1 + 600, maxStatusLabelRight + 600, maxLogTemplateRight + 600);
        const minRootWidth = 400;
        const visibleNodes = root.descendants().length;
        const adjustedWidth = visibleNodes === 1 ? minRootWidth : rightmost;
        const height = x1 - x0 + baseFont * 2;

        // --- Prepare SVG for drawing ---
        const svg = select(svgRef.current);
        svg.selectAll("*").remove();
        svg
            .attr("width", adjustedWidth + 120)
            .attr("height", height + 120)
            .attr("viewBox", `${-80} ${x0 - baseFont} ${adjustedWidth + 120} ${height}`)
            .attr("style", "max-width: 100%; height: auto; font: 10px;")
            .attr("font-family", font);
        
        // --- Add header text ---
        svg.append("text")
            .attr("x", 75)
            .attr("y", x0 - baseFont)
            .attr("font-size", 30)
            .attr("font-weight", "bold")
            .attr("fill", wpired)
            .style("pointer-events", "none")
            .text("Entity");

        if (!entitiesCollapsed) {
            svg.append("text")
                .attr("x", 260)
                .attr("y", x0 - baseFont)
                .attr("font-size", 30)
                .attr("font-weight", "bold")
                .attr("fill", wpigold)
                .style("pointer-events", "none")
                .text("Action");
            
            if (!actionsCollapsed) {
                svg.append("text")
                    .attr("x", 500)
                    .attr("y", x0 - baseFont)
                    .attr("font-size", 30)
                    .attr("font-weight", "bold")
                    .attr("fill", wpigrey)
                    .style("pointer-events", "none")
                    .text("Status");
                
                svg.append("text")
                    .attr("x", 700)
                    .attr("y", x0 - baseFont)
                    .attr("font-size", 30)
                    .attr("font-weight", "bold")
                    .attr("fill", "#000")
                    .style("pointer-events", "none")
                    .text("Log Template");
            }
        }


        // --- Draw tree links (edges) ---
        svg.append("g")
            .attr("fill", "none")
            .attr("stroke-opacity", 0.4)
            .attr("stroke-width", 1.5)
            .selectAll("path")
            .data(root.links())
            .join("path")
            .attr("d", (d: HierarchyLink<TreeNode>) => {
                // Draws an elbow connector from parent to child
                const gap = 18, sourceY = d.source.y ?? 0, sourceStubY = sourceY + gap;
                return [`M${sourceY},${d.source.x}`, `H${sourceStubY}`, `V${d.target.x}`, `H${d.target.y}`].join(" ");
            })
            .attr("stroke", linkBorderColor);

            

        // --- Draw tree nodes (labels, rectangles, anomaly icons, log templates) ---
        const node = svg.append("g")
            .attr("stroke-linejoin", "round")
            .attr("stroke-width", 2)
            .selectAll("g")
            .data(root.descendants())
            .join("g")
            .attr("transform", d => `translate(${d.y},${d.x})`);

        // --- Highlighting logic for mouseover/mouseout on nodes ---
        function highlightText(this: SVGTextElement, _event: unknown, d: HierarchyNode<TreeNode>) {
            // Highlight ancestors and descendants (like visualize_tree.tsx)
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
                const treeNode = node.data as TreeNode;
                if (treeNode._children) {
                    treeNode._children.forEach((child, i) => {
                        const childNode = node as HierarchyNode<TreeNode>;
                        if (childNode && childNode.children) {
                            collectDescendants(childNode.children[i]);
                        }
                    });
                }
            }
            collectDescendants(d);

            // Color related nodes and links
            svg.selectAll<SVGTextElement, HierarchyNode<TreeNode>>("text.node-label")
                .each(function(n) {
                    const isRelated = ancestorNodes.has(n) || descendantNodes.has(n);
                    // If this node is related and is an anomaly, keep it red
                    const isRelatedAnomaly = isRelated && (n.data.isAnomaly || n.data.isRelatedToAnomaly);
                    select(this)
                        .attr("fill",
                            isRelatedAnomaly
                                ? "#c8102e"
                                : (isRelated ? "#003366" : (n.data.isAnomaly || n.data.isRelatedToAnomaly? "#c8102e" : "#222"))
                        );
                    select(this.parentNode as Element).select("rect")
                        .attr("fill", isRelated ? "#B3D8FF" : linkFillColor({ source: { depth: n.depth - 1 } }))
                        .attr("stroke-width", isRelated ? 5 : 2);
                });

            svg.selectAll<SVGPathElement, HierarchyLink<TreeNode>>("path")
                .attr("stroke", lnk => {
                    const isAncestorPath =
                        ancestorNodes.has(lnk.source as HierarchyNode<TreeNode>) &&
                        ancestorNodes.has(lnk.target as HierarchyNode<TreeNode>);
                    const isDescendantPath =
                        descendantNodes.has(lnk.source as HierarchyNode<TreeNode>) &&
                        descendantNodes.has(lnk.target as HierarchyNode<TreeNode>);
                    return (isAncestorPath || isDescendantPath) ? "#B3D8FF" : linkBorderColor(lnk);
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

        // --- Reset highlighting on mouseout ---
        function unhighlightText(this: SVGTextElement) {
            svg.selectAll<SVGTextElement, HierarchyNode<TreeNode>>("text.node-label")
                .each(function(n) {
                    select(this)
                        .attr("fill", n.data.isAnomaly || n.data.isRelatedToAnomaly ? "#c8102e" : "#222");
                    select(this.parentNode as Element).select("rect")
                        .attr("fill", linkFillColor({ source: { depth: n.depth - 1 } }))
                        .attr("stroke-width", 2);
                });
            svg.selectAll<SVGPathElement, HierarchyLink<TreeNode>>("path")
                .attr("stroke", linkBorderColor)
                .attr("stroke-width", 1.5);
        }

        // --- Draw node labels, rectangles, anomaly icons, and log templates ---
        node.append("text")
            .attr("class", "node-label")
            .attr("dy", "0.31em")
            .attr("x", d => {
                const fontSize = getFontSize(d.depth);
                return (d.children || d.data._children ? -fontSize * 0.2 : fontSize * 0.2);
            })
            .attr("text-anchor", d => (d.children || d.data._children ? "end" : "start"))
            .text(d => d.data.name)
            .attr("fill", d => d.data.isAnomaly || d.data.isRelatedToAnomaly ? "#c8102e" : "#222")
            .attr("font-size", d => getFontSize(d.depth))
            .on("mouseover", function (event, d) {
                highlightText.call(this, event, d);
                if ((d.depth === 1 || d.depth === 2 || d.depth === 3) && d.data.isAnomaly && d.data.anomalyReason) {
                    setHoveredAnomaly({ explanation: d.data.anomalyReason, x: event.clientX, y: event.clientY });
                }
            })
            .on("mouseout", function () {
                unhighlightText.call(this);
                setHoveredAnomaly(null);
            })
            .on("click", function (event, d) {
                // Toggle expand/collapse on click
                event.stopPropagation();
                const idx = d.data.indexPath;
                if (!idx) return;
                setTreeData(prev => {
                    if (!prev) return null;
                    const updated = toggleNodeByIndexPath(prev, idx);
                    addIndexPath(updated);
                    return updated;
                });
            })
            .each(function (this: SVGTextElement, d) {
                // Draw background rectangle behind label
                const fontSize = getFontSize(d.depth), padding = getPadding(fontSize), radius = getRadius(fontSize);
                const nodeGroup = select(this.parentNode as Element);
                const bbox = this.getBBox();
                nodeGroup.insert("rect", "text")
                    .attr("x", bbox.x - padding)
                    .attr("y", bbox.y - padding / 2)
                    .attr("width", bbox.width + 2 * padding)
                    .attr("height", bbox.height + padding)
                    .attr("fill", () => linkFillColor({ source: { depth: d.depth - 1 } }))
                    .attr("stroke", () => linkBorderColor({ source: { depth: d.depth - 1 } }))
                    .attr("rx", radius)
                    .attr("ry", radius);

                // Draw log template for status nodes
                if (d.depth === 3) {
                    const eventId = /\(([^)]+)\)$/.exec(d.data.name)?.[1] || "";
                    const logTemplate = eventIdToLogTemplate[eventId] || "";
                    if (logTemplate) {
                        const linePrefix = typeof d.data.lineNumber === "number" ? `${d.data.lineNumber}. ` : "";
                        nodeGroup.append("text")
                            .attr("class", "log-template-text")
                            .attr("x", maxStatusLabelRight + getPadding(fontSize) * 2 + 25)
                            .attr("y", bbox.y + bbox.height / 2 + 2)
                            .attr("alignment-baseline", "middle")
                            .attr("font-size", Math.max(fontSize * 0.8, 14))
                            .attr("fill", d.data.isAnomaly || d.data.isRelatedToAnomaly ? "#c8102e" : "#444")
                            .attr("text-anchor", "start")
                            .on("mouseover", function (event) {
                                if (d.data.isAnomaly && d.data.anomalyReason) setHoveredAnomaly({ explanation: d.data.anomalyReason, x: event.clientX, y: event.clientY });
                            })
                            .on("mouseout", function () { setHoveredAnomaly(null); })
                            .text(linePrefix + logTemplate);
                    }
                }
                // Draw anomaly warning icon for anomalous nodes
                if (
                    d.data.isAnomaly &&
                    (
                        d.depth === 1 ||
                        d.depth === 2 ||
                        (d.depth === 3 && !d.children && !d.data._children)
                    )
                ) {
                    nodeGroup.append("text")
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
                            if (d.data.anomalyReason) setHoveredAnomaly({ explanation: d.data.anomalyReason, x: event.clientX, y: event.clientY });
                        })
                        .on("mouseout", function () { setHoveredAnomaly(null); });
                }
            });

    }, [treeData, eventIdToLogTemplate, showTree]); // <-- add showTree as dependency

    // --- Determine anomaly level for the selected sequence ---
    const selectedSeqId = kroneDecompData[selectedIndex]?.seq_id;
    const anomalyRow = kroneDetectData.find(row => row.seq_id === selectedSeqId);
    let anomalyLevel = "Normal";
    if (anomalyRow && anomalyRow.anomaly_level) {
        // You may need to adjust the mapping below to match your data
        if (anomalyRow.anomaly_level === "entity") anomalyLevel = "Entity-level Anomaly";
        else if (anomalyRow.anomaly_level === "action") anomalyLevel = "Action-level Anomaly";
        else if (anomalyRow.anomaly_level === "status") anomalyLevel = "Status-level Anomaly";
        else anomalyLevel = String(anomalyRow.anomaly_level);
    }

    // --- Gather log templates for the selected sequence ---
    let logTemplates: { lineNumber?: number; eventId: string; logTemplate: string }[] = [];
    if (kroneDecompData[selectedIndex]) {
        const decomp = kroneDecompData[selectedIndex];
        const { seq } = decomp;
        logTemplates = seq.map((eventId: string, i: number) => ({
            lineNumber: i + 1,
            eventId,
            logTemplate: eventIdToLogTemplate[eventId] || "",
        }));
    }

    // --- Render UI ---
    return (
        <div style={{ width: "100%", position: "relative" }}>
            <div className="sequence-tree h-max">
                <h2>Sequence Tree</h2>
                {/* Controls for sequence selection and collapse toggles */}
                <div style={{ marginBottom: 12, marginLeft: 20, gap: 12, alignItems: "center" }}>
                    <label>
                        Sequence:&nbsp;
                        <select
                            value={kroneDecompData[selectedIndex]?.seq_id ?? ""}
                            onChange={e => {
                                const idx = kroneDecompData.findIndex(row => row.seq_id === e.target.value);
                                if (idx !== -1) setSelectedIndex(idx);
                                setShowTree(false); // Reset to log templates when sequence changes
                            }}
                            style={{ minWidth: 120 }}
                        >
                            {kroneDecompData.map(row => (
                                <option key={row.seq_id} value={row.seq_id}>{row.seq_id}</option>
                            ))}
                        </select>
                    </label>
                    <button
                        onClick={() => setEntitiesCollapsed(v => !v)}
                        style={{
                            marginLeft: 16,
                            padding: "4px 12px",
                            borderRadius: 6,
                            border: "1px solid #ccc",
                            background: entitiesCollapsed ? "#ffd100" : "#eee",
                            fontWeight: 600,
                            cursor: "pointer"
                        }}
                        disabled={!showTree}
                    >
                        {entitiesCollapsed ? "Expand Entities" : "Collapse Entities"}
                    </button>
                    <button
                        onClick={() => setActionsCollapsed(v => !v)}
                        style={{
                            padding: "4px 12px",
                            borderRadius: 6,
                            border: "1px solid #ccc",
                            background: actionsCollapsed ? "#ffd100" : "#eee",
                            fontWeight: 600,
                            cursor: "pointer"
                        }}
                        disabled={!showTree}
                    >
                        {actionsCollapsed ? "Expand Actions" : "Collapse Actions"}
                    </button>
                </div>
                {/* Loading spinner */}
                {loading ? (
                    <div style={{ textAlign: "center", padding: "2rem" }}>
                        <span className="animate-spin inline-block mr-2" style={{ fontSize: 24 }}>⏳</span>
                        Loading sequence tree...
                    </div>
                ) : (
                    <>
                        {/* --- Anomaly Level Heading --- */}
                        <h3 style={{ marginBottom: 8, color: anomalyLevel === "Normal" ? "#222" : "#c8102e" }}>
                            {anomalyLevel}
                        </h3>
                        {/* --- Show log templates if tree is hidden --- */}
                        {!showTree ? (
                            <div style={{ margin: "2rem 2rem", textAlign: "left" }}>
                                <h4>Log Templates</h4>
                                <ol>
                                    {logTemplates.map(({ lineNumber, eventId, logTemplate }) => (
                                        <li key={eventId + lineNumber} style={{ marginBottom: 8 }}>
                                            <span style={{ fontWeight: 600 }}>
                                                {lineNumber}.
                                            </span>{" "}
                                            <span style={{ marginLeft: 8 }}>
                                                {logTemplate}
                                            </span>{" "}
                                            <span style={{ color: "#888" }}>
                                                ({eventId})
                                            </span>
                                        </li>
                                    ))}
                                </ol>
                                <button
                                    onClick={() => setShowTree(true)}
                                    style={{
                                        marginTop: 24,
                                        padding: "8px 24px",
                                        borderRadius: 8,
                                        border: "1px solid #c8102e",
                                        background: "#fff",
                                        color: "#c8102e",
                                        fontWeight: 700,
                                        fontSize: 18,
                                        cursor: "pointer",
                                    }}
                                >
                                    Decompose
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* SVG tree visualization */}
                                <svg ref={svgRef} />
                                {/* Tooltip for anomaly explanation */}
                                {hoveredAnomaly && (
                                    <div
                                        ref={el => {
                                            if (el) {
                                                const { innerWidth, innerHeight } = window;
                                                const rect = el.getBoundingClientRect();
                                                let left = hoveredAnomaly.x + 30, top = hoveredAnomaly.y;
                                                if (left + rect.width > innerWidth) left = innerWidth - rect.width - 16;
                                                if (top + rect.height > innerHeight) top = innerHeight - rect.height - 16;
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
                    </>
                )}
            </div>
        </div>
    );
};