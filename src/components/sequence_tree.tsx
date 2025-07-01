import React, { useRef, useEffect, useState } from 'react';
import type { KroneDecompRow, KroneDetectRow } from '@/pages/visualize_table';
import { hierarchy, tree } from 'd3-hierarchy';
import type { HierarchyNode, HierarchyLink } from 'd3-hierarchy';
import { select } from 'd3-selection';
import Papa from 'papaparse';

type SequenceTreeProps = {
    kroneDecompData: KroneDecompRow[];
    kroneDetectData: KroneDetectRow[];
};

type TreeNode = {
    name: string;
    children?: TreeNode[];
    isAnomaly?: boolean;
    anomalyReason?: string;
    indexPath?: number[];
    lineNumber?: number;
    isRelatedToAnomaly?: boolean;
    collapsed?: boolean;
};

function addIndexPath(node: TreeNode, path: number[] = []): void {
    node.indexPath = path;
    (node.children || []).forEach((c, i) => addIndexPath(c, [...path, i]));
}

function getFirstAnomalyReason(node: HierarchyNode<TreeNode>): string | undefined {
    // Check direct children
    if (node.children) {
        for (const child of node.children) {
            if (child.data.isAnomaly && child.data.anomalyReason) {
                return child.data.anomalyReason;
            }
            // Check grandchildren
            if (child.children) {
                for (const grandchild of child.children) {
                    if (grandchild.data.isAnomaly && grandchild.data.anomalyReason) {
                        return grandchild.data.anomalyReason;
                    }
                }
            }
        }
    }
    return undefined;
}

function toggleNodeByIndexPath(node: TreeNode, path: number[]): TreeNode {
    if (path.length === 0) return node;
    const [currentIndex, ...remainingPath] = path;
    if (!node.children || !node.children[currentIndex]) return node;
    const updatedChildren = [...node.children];
    if (remainingPath.length === 0) {
        updatedChildren[currentIndex] = {
            ...updatedChildren[currentIndex],
            collapsed: !updatedChildren[currentIndex].collapsed,
        };
    } else {
        updatedChildren[currentIndex] = toggleNodeByIndexPath(updatedChildren[currentIndex], remainingPath);
    }
    return {
        ...node,
        children: updatedChildren,
    };
}

function arraysEqual<T>(a: T[], b: T[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

function toTreeNode(data: KroneDecompRow, anomalies: KroneDetectRow[]): TreeNode {
    const entities: TreeNode[] = [];
    const { entity_nodes_for_logkeys: e, action_nodes_for_logkeys: a, status_nodes_for_logkeys: s, seq } = data;

    for (let i = 0; i < e.length; i++) {
        const actions: TreeNode[] = [];
        const statuses: TreeNode[] = [];
        statuses.push({ name: `${s[i]} (${seq[i]})`, lineNumber: i });
        actions.push({ name: a[i], children: statuses });
        entities.push({ name: e[i], children: actions });
    }

    let hasAnomalies = false;
    let foundAnomaly = null as KroneDetectRow | null;
    anomalies.forEach(anomaly => {
        if (anomaly.seq_id === data.seq_id) {
            hasAnomalies = true;
            foundAnomaly = anomaly;
        }
    });

    if (hasAnomalies && foundAnomaly!) {
        const anomalyLength = foundAnomaly.anomaly_seg.length;
        for (let i = 0; i <= e.length - anomalyLength; i++) {
            if (arraysEqual(seq.slice(i, i + anomalyLength), foundAnomaly.anomaly_seg)) {
                for (let j = i; j < i + anomalyLength; j++) {
                    if (foundAnomaly.anomaly_level === "status") {
                        
                        entities[j].children![0].children![0].isAnomaly = true;
                        entities[j].children![0].children![0].anomalyReason = foundAnomaly.anomaly_reason;
                        entities[j].children![0].isRelatedToAnomaly = true;
                        entities[j].isRelatedToAnomaly = true;
                    }
                    if (foundAnomaly.anomaly_level === "action") {
                        entities[j].children![0].isAnomaly = true;
                        entities[j].children![0].anomalyReason = foundAnomaly.anomaly_reason;
                        entities[j].isRelatedToAnomaly = true;
                        entities[j].children![0].children!.forEach(stat => {
                            stat.isRelatedToAnomaly = true;
                        });
                    }
                    if (foundAnomaly.anomaly_level === "entity") {
                        entities[j].isAnomaly = true;
                        entities[j].anomalyReason = foundAnomaly.anomaly_reason;
                        entities[j].children!.forEach(act => {
                            act.isRelatedToAnomaly = true;
                            act.children!.forEach(stat => {
                                stat.isRelatedToAnomaly = true;
                            });
                        });
                    }
                }
            }
        }
    }

    let i = 0;
    while (i < entities.length - 1) {
        if (entities[i].name === entities[i + 1].name) {
            entities[i].children = (entities[i].children ?? []).concat(entities[i + 1].children ?? []);
            entities.splice(i + 1, 1);
        } else {
            i++;
        }
    }

    for (let j = 0; j < entities.length; j++) {
        let k = 0;
        while (k < entities[j].children!.length - 1) {
            if (entities[j].children![k].name === entities[j].children![k + 1].name) {
                entities[j].children![k].children = (entities[j].children![k].children ?? []).concat(entities[j].children![k + 1].children ?? []);
                entities[j].children!.splice(k + 1, 1);
            } else {
                k++;
            }
        }
    }
    function propagateRelatedToAnomaly(node: TreeNode) {
        if (!node.children) return false;
        let anyChildRelated = false;
        for (const child of node.children) {
            const childRelated = propagateRelatedToAnomaly(child);
            if (child.isRelatedToAnomaly || childRelated) {
                anyChildRelated = true;
            }
        }
        if (anyChildRelated) {
            node.isRelatedToAnomaly = true;
        }
        return node.isRelatedToAnomaly;
    }

    // ...after merging logic, before return:
    propagateRelatedToAnomaly({ name: "Root", children: entities });

    return { name: "Root", children: entities };
}

// Helper: is this node or any ancestor collapsed?
function isNodeHidden(node: HierarchyNode<TreeNode>): boolean {
    let current = node.parent;
    while (current) {
        if (current.data.collapsed) return true;
        current = current.parent;
    }
    return false;
}

export const SequenceTree: React.FC<SequenceTreeProps> = ({ kroneDecompData, kroneDetectData }) => {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const [treeData, setTreeData] = useState<TreeNode | null>(null);
    const [hoveredAnomaly, setHoveredAnomaly] = useState<{ explanation: string; x: number; y: number } | null>(null);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [eventIdToLogTemplate, setEventIdToLogTemplate] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [entitiesCollapsed, setEntitiesCollapsed] = useState(true);
    const [actionsCollapsed, setActionsCollapsed] = useState(false);
    const [multiLineAnomaly, setMultiLineAnomaly] = useState(false);
    const [anomalyLevelMulti, setAnomalyLevelMulti] = useState("Normal");

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

    useEffect(() => {
        if (kroneDecompData.length && selectedIndex >= 0 && selectedIndex < kroneDecompData.length) {
            setLoading(true);
            const decomp = kroneDecompData[selectedIndex];
            const treeNode = toTreeNode(decomp, kroneDetectData);
            if (kroneDetectData.filter(row => row.seq_id === decomp.seq_id).length > 0 &&
                kroneDetectData.filter(row => row.seq_id === decomp.seq_id)[0].anomaly_seg.length > 1) {
                setMultiLineAnomaly(true);
                setAnomalyLevelMulti(kroneDetectData.filter(row => row.seq_id === decomp.seq_id)[0].anomaly_level || "Normal");
            } else {
                setMultiLineAnomaly(false);
            }
            // Apply initial collapse state
            setCollapseAtDepth(treeNode, 1, entitiesCollapsed);
            setCollapseAtDepth(treeNode, 2, actionsCollapsed);
            addIndexPath(treeNode);
            setTreeData(treeNode);
            setLoading(false);
        }
    }, [kroneDecompData, kroneDetectData, selectedIndex, actionsCollapsed, entitiesCollapsed]);

    // Collapse/expand all entities or actions by toggling their collapsed property
    function setCollapseAtDepth(node: TreeNode, depth: number, collapse: boolean, cur = 1) {
        if (!node.children) return;
        if (cur === depth) {
            node.children.forEach(child => {
                child.collapsed = collapse;
            });
        } else {
            node.children.forEach(c => setCollapseAtDepth(c, depth, collapse, cur + 1));
        }
    }

    useEffect(() => {
        if (!treeData) return;
        const cloned = JSON.parse(JSON.stringify(treeData)) as TreeNode;
        setCollapseAtDepth(cloned, 1, entitiesCollapsed);
        setCollapseAtDepth(cloned, 2, actionsCollapsed);
        addIndexPath(cloned);
        setTreeData(cloned);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entitiesCollapsed, actionsCollapsed]);

    useEffect(() => {
        if (!treeData || !svgRef.current) return;

        addIndexPath(treeData);

        // Always use all children, never prune for collapse
        const root = hierarchy<TreeNode>(treeData, d => d.children);

        const baseFont = 28, minFont = 15, fontStep = 5, basePadding = 0.35, baseRadius = 0.25, depthSpacing = 14;
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

        const widestByDepth = [75, 0, 0, 0]
        const tempSvg = select(document.body).append("svg").attr("style", "position: absolute; visibility: hidden;").attr("font-family", font);

        
        root.descendants().forEach(node => {
            const fontSize = getFontSize(node.depth);
            const tempText = tempSvg.append("text").attr("font-size", fontSize).attr("font-family", font).text(node.data.name);
            const bbox = (tempText.node() as SVGTextElement).getBBox();
            const labelWidth = bbox.width + getPadding(fontSize) * 2;
            for (let i = 1; i < widestByDepth.length; i++) {
                if (node.depth === i && labelWidth > widestByDepth[i]) {
                    widestByDepth[i] = labelWidth;
                }
            }
            tempText.remove();
        });
        tempSvg.remove();

        const entitySpacing = 22;
        const dy = Math.max(widestByDepth[1] + 40, widestByDepth[2] + 50);
        tree<TreeNode>().nodeSize([entitySpacing, dy]).separation((a, b) => (Math.max(getFontSize(a.depth), getFontSize(b.depth)) + 8) / depthSpacing)(root);

        function topAlign(node: HierarchyNode<TreeNode>) {
            if (node.children && node.children.length > 0) {
                node.children.forEach(topAlign);
                node.x = node.children[0].x;
            }
        }
        topAlign(root);
        const minEntityGap = 50; // Adjust as needed
        const entityNodes = root.children || [];
        for (let i = 1; i < entityNodes.length; i++) {
            const prev = entityNodes[i - 1];
            const curr = entityNodes[i];
            // If the gap is too small, push this entity and its subtree down
            if (curr.x! - prev.x! < minEntityGap) {
                const offset = minEntityGap - (curr.x! - prev.x!);
                function offsetSubtree(node: HierarchyNode<TreeNode>, delta: number) {
                    node.x! += delta;
                    if (node.children) node.children.forEach(child => offsetSubtree(child, delta));
                }
                offsetSubtree(curr, offset);
                // Also update all subsequent entities
                for (let j = i + 1; j < entityNodes.length; j++) {
                    offsetSubtree(entityNodes[j], offset);
                }
            }
        }

        const extraColSpacing = [0, 80, 60, 60]; // [root, entity, action, status] - adjust as needed

        // Calculate cumulative x-offsets for each depth
        const colOffsets = [0];
        for (let i = 1; i < widestByDepth.length; i++) {
            colOffsets[i] = (colOffsets[i - 1] || 0) + widestByDepth[i - 1] + extraColSpacing[i];
        }

        // Now, after tree layout, manually adjust y for each node:
        root.each(node => {
            node.y = colOffsets[node.depth];
        });
        let x0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        root.each(d => {
            if ((d.x ?? 0) > x1) x1 = d.x ?? 0;
            if ((d.x ?? 0) < x0) x0 = d.x ?? 0;
            if ((d.y ?? 0) > y1) y1 = d.y ?? 0;
        });

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

        const rightmost = Math.max(y1 + 600, maxStatusLabelRight + 600, maxLogTemplateRight + 600);
        const minRootWidth = 400;
        const visibleNodes = root.descendants().length;
        const adjustedWidth = visibleNodes === 1 ? minRootWidth : rightmost;
        const height = x1 - x0 + baseFont * 2;

        const svg = select(svgRef.current);
        svg.selectAll("*").remove();
        svg
            .attr("width", adjustedWidth + 120)
            .attr("height", height + 120)
            .attr("viewBox", `${-80} ${x0 - baseFont} ${adjustedWidth + 120} ${height}`)
            .attr("style", "max-width: 100%; height: auto; font: 10px;")
            .attr("font-family", font);

        svg.append("text")
            .attr("x", 175)
            .attr("y", x0 - baseFont)
            .attr("font-size", 30)
            .attr("font-weight", "bold")
            .attr("fill", wpired)
            .style("pointer-events", "none")
            .text("Entity");
        svg.append("text")
            .attr("x", 775)
            .attr("y", x0 - baseFont)
            .attr("font-size", 30)
            .attr("font-weight", "bold")
            .attr("fill", "#000")
            .style("pointer-events", "none")
            .text("Log Template");

        if (!entitiesCollapsed) {
            svg.append("text")
                .attr("x", 375)
                .attr("y", x0 - baseFont)
                .attr("font-size", 30)
                .attr("font-weight", "bold")
                .attr("fill", wpigold)
                .style("pointer-events", "none")
                .text("Action");

            if (!actionsCollapsed) {
                svg.append("text")
                    .attr("x", 575)
                    .attr("y", x0 - baseFont)
                    .attr("font-size", 30)
                    .attr("font-weight", "bold")
                    .attr("fill", wpigrey)
                    .style("pointer-events", "none")
                    .text("Status");
            }
        }

        // Draw tree links (edges)
        svg.append("g")
            .attr("fill", "none")
            .attr("stroke-opacity", 0.4)
            .attr("stroke-width", 1.5)
            .selectAll("path")
            .data(root.links())
            .join("path")
            .attr("d", (d: HierarchyLink<TreeNode>) => {
                // Always exit from the right edge of the source node and enter the left edge of the target node
                const sourceWidth = widestByDepth[d.source.depth];
                const sourceY = (d.source.y ?? 0) + sourceWidth - 20; // right edge of source
                const sourceX = d.source.x;
                const targetY = d.target.y ?? 0; // left edge of target
                const targetX = d.target.x;
                // Horizontal-vertical-horizontal elbow
                const midY = (sourceY + targetY) / 2;
                return [
                    `M${sourceY},${sourceX}`,
                    `H${midY}`,
                    `V${targetX}`,
                    `H${targetY}`
                ].join(" ");
            })
            .attr("stroke", linkBorderColor)
            .attr("opacity", d => (isNodeHidden(d.source) || isNodeHidden(d.target)) ? 0 : 1);

        // Draw tree nodes (labels, rectangles, anomaly icons, log templates)
        const node = svg.append("g")
            .attr("stroke-linejoin", "round")
            .attr("stroke-width", 2)
            .selectAll("g")
            .data(root.descendants())
            .join("g")
            .attr("transform", d => `translate(${d.y},${d.x})`)
            .on("mouseover", function (event, d) {
                if (!(this instanceof SVGElement)) return;
                highlightText.call(this, event, d);
                if ((d.depth === 1 || d.depth === 2 || d.depth === 3) && d.data.isAnomaly && d.data.anomalyReason) {
                    setHoveredAnomaly({ explanation: d.data.anomalyReason, x: event.clientX, y: event.clientY });
                }
            })
            .on("mouseout", function () {
                if (!(this instanceof SVGElement)) return;
                unhighlightText.call(this);
                setHoveredAnomaly(null);
            })
            .on("click", function (event, d) {
                event.stopPropagation();
                const idx = d.data.indexPath;
                if (!idx) return;
                setTreeData(prev => {
                    if (!prev) return null;
                    const updated = toggleNodeByIndexPath(prev, idx);
                    addIndexPath(updated);
                    return updated;
                });
            });
        



    function highlightText(this: SVGElement, _event: unknown, d: HierarchyNode<TreeNode>) {
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
        }
        collectDescendants(d);

        svg.selectAll<SVGTextElement, HierarchyNode<TreeNode>>("text.node-label")
            .each(function (n) {
                const isRelated = ancestorNodes.has(n) || descendantNodes.has(n);
                const isRelatedAnomaly = isRelated && (n.data.isAnomaly || n.data.isRelatedToAnomaly);
                select(this)
                    .attr("fill",
                        isRelatedAnomaly
                            ? "#c8102e"
                            : (isRelated ? "#003366" : (n.data.isAnomaly || n.data.isRelatedToAnomaly ? "#c8102e" : "#222"))
                    );
                select(this.parentNode as Element).selectAll("rect")
                    .attr("fill", isRelated ? "#B3D8FF" : linkFillColor({ source: { depth: n.depth - 1 } }))
                    .attr("stroke-width", isRelated ? 5 : 2);
            });

        // Highlight associated log template(s)
        if (d.depth === 3 && typeof d.data.lineNumber === "number") {
            // Status node: highlight by lineNumber
            svg.selectAll<SVGTextElement, TreeNode>("text.log-template-text")
                .filter(function() {
                    return +select(this).attr("data-line-number") === d.data.lineNumber;
                })
                .attr("fill", d.data.isAnomaly || d.data.isRelatedToAnomaly ? "#c8102e" : "#003366")
                .attr("font-weight", "bold");
        } else if (d.depth === 2 || d.depth === 1) {
            // Action or Entity: highlight all descendant status log templates
            const lineNumbers: number[] = [];
            d.descendants().forEach(n => {
                if (n.depth === 3 && typeof n.data.lineNumber === "number") {
                    lineNumbers.push(n.data.lineNumber);
                }
            });
            svg.selectAll<SVGTextElement, TreeNode>("text.log-template-text")
                .filter(function() {
                    return lineNumbers.includes(+select(this).attr("data-line-number"));
                })
                .attr("fill", function(d) {
                    // Only highlight red if this log template/status is actually anomalous or related
                    return d.isAnomaly || d.isRelatedToAnomaly ? "#c8102e" : "#003366";
                })
                .attr("font-weight", "bold");
        }

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

        // In unhighlightText, reset log template highlights:
        function unhighlightText(this: SVGElement) {
            svg.selectAll<SVGTextElement, HierarchyNode<TreeNode>>("text.node-label")
                .each(function (n) {
                    select(this)
                        .attr("fill", n.data.isAnomaly || n.data.isRelatedToAnomaly ? "#c8102e" : "#222");
                    select(this.parentNode as Element).selectAll("rect")
                        .attr("fill", linkFillColor({ source: { depth: n.depth - 1 } }))
                        .attr("stroke-width", 2);
                });
            svg.selectAll<SVGTextElement, TreeNode>("text.log-template-text")
                .attr("fill", d => d.isAnomaly || d.isRelatedToAnomaly ? "#c8102e" : "#444")
                .attr("font-weight", null);
            svg.selectAll<SVGPathElement, HierarchyLink<TreeNode>>("path")
                .attr("stroke", linkBorderColor)
                .attr("stroke-width", 1.5);
        }

        let anomalyStartY = Infinity;
        let anomalyEndY = -Infinity;

        node.append("text")
            .attr("class", "node-label")
            .attr("dy", "0.31em")
            .attr("x", d => {
                const fontSize = getFontSize(d.depth);
                return (d.children ? -fontSize * 0.2 : fontSize * 0.2);
            })
            .attr("opacity", d => isNodeHidden(d) ? 0 : 1)
            .attr("pointer-events", d => isNodeHidden(d) ? "none" : "auto")
            .attr("text-anchor", "start")
            .text(d => d.data.name)
            .attr("fill", d => d.data.isAnomaly || d.data.isRelatedToAnomaly ? "#c8102e" : "#222")
            .attr("font-size", d => getFontSize(d.depth))
            .each(function (this: SVGTextElement, d) {
                const fontSize = getFontSize(d.depth), padding = getPadding(fontSize), radius = getRadius(fontSize);
                const nodeGroup = select(this.parentNode as Element);
                const bbox = this.getBBox();
                nodeGroup.insert("rect", "text")
                    .attr("x", bbox.x - padding)
                    .attr("y", bbox.y - padding / 2)
                    .attr("width", widestByDepth[d.depth])
                    .attr("height", bbox.height + padding)
                    .attr("fill", () => linkFillColor({ source: { depth: d.depth - 1 } }))
                    .attr("stroke", () => linkBorderColor({ source: { depth: d.depth - 1 } }))
                    .attr("rx", radius)
                    .attr("ry", radius);
                if (d.children && d.children.length > 0 && d.data.collapsed && !d.parent?.data.collapsed) {
                    nodeGroup.insert("text", "text") // insert before label
                        .attr("class", "collapse-indicator")
                        .attr("x", (bbox.x - padding) + widestByDepth[d.depth] + padding * 1.5) // node start + node width + some padding
                        .attr("y", bbox.y + bbox.height / 2 + 2)
                        .attr("alignment-baseline", "middle")
                        .attr("font-size", Math.max(fontSize * 0.8, 16))
                        .attr("fill", "#888")
                        .on("click", function (event: MouseEvent) {
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
                        .attr("text-anchor", "start")
                        .style("cursor", "pointer")
                        .text("▶");
                }
                nodeGroup.insert("rect", "text")
                    .attr("x", bbox.x - padding)
                    .attr("y", bbox.y - padding / 2)
                    .attr("width", widestByDepth[d.depth])
                    .attr("height", bbox.height + padding)
                    .attr("fill", () => linkFillColor({ source: { depth: d.depth - 1 } }))
                    .attr("stroke", () => linkBorderColor({ source: { depth: d.depth - 1 } }))
                    .attr("rx", radius)
                    .attr("ry", radius);

                if (d.depth === 3) {
                    const eventId = /\(([^)]+)\)$/.exec(d.data.name)?.[1] || "";
                    const logTemplate = eventIdToLogTemplate[eventId] || "";
                    if (logTemplate) {
                        const linePrefix = typeof d.data.lineNumber === "number" ? `${d.data.lineNumber}. ` : "";
                        nodeGroup.append("text")
                            .attr("class", "log-template-text")
                            .attr("data-event-id", eventId)
                            .attr("data-line-number", d.data.lineNumber || "")
                            .attr("x", maxStatusLabelRight + getPadding(fontSize) * 2 + 15)
                            .attr("y", bbox.y + bbox.height / 2 + 2)
                            .attr("alignment-baseline", "middle")
                            .attr("font-size", Math.max(fontSize * 0.8, 14))
                            .attr("fill", d.data.isAnomaly || d.data.isRelatedToAnomaly ? "#c8102e" : "#444")
                            .attr("text-anchor", "start")
                            .datum({
                                ...d.data
                            })
                            .on("mouseover", function (event) {
                                if (d.data.isAnomaly && d.data.anomalyReason) setHoveredAnomaly({ explanation: d.data.anomalyReason, x: event.clientX, y: event.clientY });
                            })
                            .on("mouseout", function () { setHoveredAnomaly(null); })
                            .text(linePrefix + logTemplate);
                    }
                }
                if (d.data.isAnomaly) {
                    const g = this.parentNode as SVGGElement;
                    const transform = g.getAttribute("transform");
                    if (transform) {
                        const match = /translate\(([^,]+),([^)]+)\)/.exec(transform);
                        if (match) {
                            const y = parseFloat(match[2]);
                            if (y < anomalyStartY) anomalyStartY = y;
                            if (y > anomalyEndY) anomalyEndY = y;
                        }
                    }
                }
                if (d.data.isAnomaly && !d.parent?.data.collapsed && !d.parent?.parent?.data.collapsed) {
                    if (!multiLineAnomaly) {
                        nodeGroup.append("text")
                            .attr("class", "anomaly-warning")
                            .attr("x", bbox.x - padding * 2.5 - 15)
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
                }
                else if (d.data.isRelatedToAnomaly && d.data.collapsed && !d.parent?.data.collapsed) {
                    const reason = getFirstAnomalyReason(d);
                    nodeGroup.append("text")
                        .attr("class", "anomaly-warning")
                        .attr("x", bbox.x - padding * 2.5 - 15)
                        .attr("y", d.depth === 3 ? bbox.y + bbox.height / 2 + 2 : bbox.y - padding / 2 + 8)
                        .attr("alignment-baseline", d.depth === 3 ? "middle" : "hanging")
                        .attr("font-size", Math.max(fontSize * 0.8, d.depth === 3 ? 14 : 18))
                        .attr("fill", "#FFD100")
                        .attr("text-anchor", "start")
                        .style("cursor", "pointer")
                        .text(!reason? "" : multiLineAnomaly ? "🚨" : "⚠️")
                        .on("mouseover", function (event) {
                            if (reason) setHoveredAnomaly({ explanation: reason, x: event.clientX, y: event.clientY });
                        })
                        .on("mouseout", function () { setHoveredAnomaly(null); });
                }
            });
        const anomalyRow = kroneDetectData.find(row => row.seq_id === selectedSeqId);
        const anomalySeg = anomalyRow?.anomaly_seg || [];
        const anyVisibleAnomalyNode = root.descendants().some(
            node => (node.data.isAnomaly) && !isNodeHidden(node)
        );
        
        if (
            multiLineAnomaly &&
            anomalyStartY !== Infinity &&
            anomalyEndY !== -Infinity &&
            anyVisibleAnomalyNode
        ) {
            let highlightYStart = anomalyStartY;
            let highlightYEnd = anomalyEndY;

            // --- Special logic for entity-level multi-line anomalies ---
            if (anomalyLevelMulti === "entity") {
                // Find all entity nodes in the anomaly segment, sorted by their x (vertical) position
                const anomalyEntityNodes = root.descendants().filter(
                    node =>
                        node.depth === 1 &&
                        (node.data.isAnomaly || node.data.isRelatedToAnomaly)
                ).sort((a, b) => a.x! - b.x!);

                if (anomalyEntityNodes.length > 0) {
                    // Start at the first entity
                    highlightYStart = anomalyEntityNodes[0].x!;

                    // Find the last entity node
                    const lastEntityNode = anomalyEntityNodes[anomalyEntityNodes.length - 1];

                    // If the last entity is collapsed, box ends at the last entity node
                    if (lastEntityNode.data.collapsed) {
                        const fontSize = getFontSize(1);
                        const nodeHeight = fontSize + getPadding(fontSize);
                        highlightYEnd = lastEntityNode.x! + nodeHeight;
                    } else {
                        // Find the last action of the last entity
                        const lastActionNodes = (lastEntityNode.children || []);
                        if (lastActionNodes.length > 0) {
                            const lastActionNode = lastActionNodes[lastActionNodes.length - 1];
                            if (lastActionNode.data.collapsed) {
                                // If last action is collapsed, box ends at last action node
                                const fontSize = getFontSize(2);
                                const nodeHeight = fontSize + getPadding(fontSize);
                                highlightYEnd = lastActionNode.x! + nodeHeight;
                            } else {
                                // Otherwise, box ends at the last status node under the last action
                                let lastStatusNode: HierarchyNode<TreeNode> | null = null;
                                (lastActionNode.children || []).forEach((statusNode: HierarchyNode<TreeNode>) => {
                                    if (!isNodeHidden(statusNode)) {
                                        if (!lastStatusNode || statusNode.x! > (lastStatusNode as HierarchyNode<TreeNode>).x!) {
                                            lastStatusNode = statusNode;
                                        }
                                    }
                                });
                                if (lastStatusNode) {
                                    const fontSize = getFontSize(3);
                                    const nodeHeight = fontSize + getPadding(fontSize);
                                    highlightYEnd = (lastStatusNode as HierarchyNode<TreeNode>).x! + nodeHeight;
                                } else {
                                    // Fallback to last action node if no status nodes
                                    const fontSize = getFontSize(2);
                                    const nodeHeight = fontSize + getPadding(fontSize);
                                    highlightYEnd = lastActionNode.x! + nodeHeight;
                                }
                            }
                        } else {
                            // Fallback to last entity node if no actions
                            const fontSize = getFontSize(1);
                            const nodeHeight = fontSize + getPadding(fontSize);
                            highlightYEnd = lastEntityNode.x! + nodeHeight;
                        }
                    }
                }
            }

            // --- Special logic for action-level multi-line anomalies (unchanged) ---
            if (anomalyLevelMulti === "action") {
                const anomalyActionNodes = root.descendants().filter(
                    node =>
                        node.depth === 2 &&
                        (node.data.isAnomaly || node.data.isRelatedToAnomaly)
                ).sort((a, b) => a.x! - b.x!);

                if (anomalyActionNodes.length > 0) {
                    console.log(anomalyActionNodes);
                    const lastActionNode = anomalyActionNodes[anomalyActionNodes.length - 1];
                    highlightYStart = anomalyActionNodes[0].x!;
                    if (lastActionNode.data.collapsed) {
                        const fontSize = getFontSize(2);
                        const nodeHeight = fontSize + getPadding(fontSize);
                        
                        highlightYEnd = lastActionNode.x! + nodeHeight;
                    } else {
                        let minY = Infinity, maxY = -Infinity;
                        let maxNode: HierarchyNode<TreeNode> | null = null;
                        anomalyActionNodes.forEach(actionNode => {
                            actionNode.descendants().forEach(desc => {
                                if (desc.depth === 3 && !isNodeHidden(desc)) {
                                    if (desc.x! < minY) minY = desc.x!;
                                    if (desc.x! > maxY) {
                                        maxY = desc.x!;
                                        maxNode = desc;
                                    }
                                }
                            });
                        });
                        if (minY !== Infinity && maxY !== -Infinity && maxNode) {
                            const fontSize = getFontSize(3);
                            const nodeHeight = fontSize + getPadding(fontSize);
                            highlightYEnd = maxY + nodeHeight;
                        }
                    }
                }
            }

            // Calculate left and right edges to cover the correct columns
            let leftX: number, rightX: number;
            if (anomalyLevelMulti === "entity") {
                leftX = colOffsets[1];
                // Define anomalyEntityNodes in this scope
                const anomalyEntityNodes = root.descendants().filter(
                    node =>
                        node.depth === 1 &&
                        (node.data.isAnomaly || node.data.isRelatedToAnomaly)
                ).sort((a, b) => a.x! - b.x!);

                if (anomalyEntityNodes && anomalyEntityNodes.length > 0) {
                    const lastEntityNode = anomalyEntityNodes[anomalyEntityNodes.length - 1];
                    if (lastEntityNode.data.collapsed) {
                        rightX = colOffsets[1] + widestByDepth[1];
                    } else {
                        // Check last action of last entity
                        const lastActionNodes = (lastEntityNode.children || []);
                        if (lastActionNodes.length > 0) {
                            const lastActionNode = lastActionNodes[lastActionNodes.length - 1];
                            if (lastActionNode.data.collapsed) {
                                rightX = colOffsets[2] + widestByDepth[2];
                            } else {
                                rightX = colOffsets[3] + widestByDepth[3];
                            }
                        } else {
                            rightX = colOffsets[1] + widestByDepth[1];
                        }
                    }
                } else {
                    rightX = colOffsets[1] + widestByDepth[1];
                }
            } else if (anomalyLevelMulti === "action") {
                leftX = colOffsets[2];
                const anomalyActionNodes = root.descendants().filter(
                    node =>
                        node.depth === 2 &&
                        (node.data.isAnomaly || node.data.isRelatedToAnomaly)
                ).sort((a, b) => a.x! - b.x!);
                const lastActionNode = anomalyActionNodes[anomalyActionNodes.length - 1];
                rightX = (lastActionNode && lastActionNode.data.collapsed)
                    ? colOffsets[2] + widestByDepth[2]
                    : colOffsets[3] + widestByDepth[3];
            } else {
                leftX = colOffsets[3];
                rightX = colOffsets[3] + widestByDepth[3];
            }
            const rectWidth = rightX - leftX;

            if (anomalyLevelMulti === "status") {
                highlightYEnd += 15 }

            svg.append("rect")
                .attr("x", leftX - 20)
                .attr("y", highlightYStart - 20)
                .attr("width", rectWidth + 25)
                .attr("height", highlightYEnd - highlightYStart + 20)
                .attr("fill", "#FFCCCC")
                .attr("stroke", "#FF0000")
                .attr("fill-opacity", 0.2)
                .attr("pointer-events", "none")
                .lower();
        }
        node.each(function(d) {
            const hidden = isNodeHidden(d);
            select(this).selectAll("rect")
                .attr("opacity", hidden ? 0 : 1)
                .attr("pointer-events", hidden ? "none" : "auto");
        });

    }, [treeData, eventIdToLogTemplate, entitiesCollapsed, actionsCollapsed, multiLineAnomaly]);

    const selectedSeqId = kroneDecompData[selectedIndex]?.seq_id;
    const anomalyRow = kroneDetectData.find(row => row.seq_id === selectedSeqId);
    let anomalyLevel = "Normal";
    if (anomalyRow && anomalyRow.anomaly_level) {
        if (anomalyRow.anomaly_level === "entity") anomalyLevel = "Entity-level Anomaly";
        else if (anomalyRow.anomaly_level === "action") anomalyLevel = "Action-level Anomaly";
        else if (anomalyRow.anomaly_level === "status") anomalyLevel = "Status-level Anomaly";
        else anomalyLevel = String(anomalyRow.anomaly_level);
    }

    return (
        <div style={{ width: "100%", position: "relative" }}>
            <div className="sequence-tree h-max">
                <h2>Sequence Tree</h2>
                <div style={{ marginBottom: 12, marginLeft: 20, gap: 12, alignItems: "center" }}>
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
                            {kroneDecompData.map(row => (
                                <option key={row.seq_id} value={row.seq_id}>{row.seq_id}</option>
                            ))}
                        </select>
                    </label>
                    <button
                        onClick={() => {
                            setEntitiesCollapsed(v => !v);
                        }}
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
                        onClick={() => {
                            setActionsCollapsed(v => !v);
                        }}
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
                        <h3
                            className='text-2xl'
                            style={{
                                marginBottom: 8,
                                color: anomalyLevel === "Normal" ? "#222" : "#c8102e",
                                background: anomalyLevel === "Normal" ? "#e6fbe6" : "#fde2e5",
                                borderRadius: 8,
                                padding: "8px 16px",
                                display: "inline-block"
                            }}
                        >
                            {anomalyLevel}
                        </h3>
                        <>
                            <svg ref={svgRef} />
                            {hoveredAnomaly && (
                                <div
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
                                        left: (() => {
                                            const { innerWidth } = window;
                                            let left = hoveredAnomaly.x + 30;
                                            const width = 300;
                                            if (left + width > innerWidth) left = innerWidth - width - 16;
                                            return left;
                                        })(),
                                        top: (() => {
                                            const { innerHeight } = window;
                                            let top = hoveredAnomaly.y;
                                            const height = 100;
                                            if (top + height > innerHeight) top = innerHeight - height - 16;
                                            return top;
                                        })(),
                                    }}
                                >
                                    <strong>Anomaly Explanation</strong>
                                    <div style={{ marginTop: 8 }}>{hoveredAnomaly.explanation}</div>
                                </div>
                            )}
                        </>
                    </>
                )}
            </div>
        </div>
    );
};