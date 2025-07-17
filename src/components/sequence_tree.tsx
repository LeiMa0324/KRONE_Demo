import React, { useRef, useEffect, useState } from "react";
import type { KroneDecompRow, KroneDetectRow } from "@/pages/visualize_table";
import { hierarchy, tree } from "d3-hierarchy";
import type { HierarchyNode, HierarchyLink } from "d3-hierarchy";
import { select } from "d3-selection";
import Papa from "papaparse";
import {
    addIndexPath,
    toggleNodeByIndexPath,
    setCollapseAtDepth,
    isNodeHidden,
    arraysEqual,
    getFirstAnomalyReason,
    ENTITY_BORDER,
    ENTITY_FILL,
    ACTION_BORDER,
    STATUS_BORDER,
    BASE_FONT,
    DEPTH_SPACING,
    getFontSize,
    getPadding,
    getRadius,
    getCssVar,
    linkBorderColor,
    linkFillColor,
    getWidestByDepth,
    svgInit, 
    svgLines,
    svgNodes
} from "../tree_utils";

import type { TreeNode } from "../tree_utils";

type SequenceTreeProps = {
    kroneDecompData: KroneDecompRow[];
    kroneDetectData: KroneDetectRow[];
    setHoveredNode?: (node: HierarchyNode<TreeNode> | null) => void;
    setMultiLineAnomaly: (isMultiLineAnomaly: boolean) => void;
    multiLineAnomaly: boolean
};

function findSubsequenceIndices(sequence: string[], subsequence: string[]): [number, number] | null {
    const len = subsequence.length;
    for (let i = 0; i <= sequence.length - len; i++) {
        let match = true;
        for (let j = 0; j < len; j++) {
            if (sequence[i + j] !== subsequence[j]) {
                match = false;
                break;
            }
        }
        if (match) {
            return [i, i + len - 1];
        }
    }
    return null;
}

// Example usage:
// const seq = ['9', '10', '8', '7', '6'];
// const target = ['10', '8'];
// findSubsequenceIndices(seq, target); // returns [1, 2]

function toTreeNode(data: KroneDecompRow, anomalies: KroneDetectRow[], eventIdToLogTemplate: Record<string, string>): TreeNode {
    const entities: TreeNode[] = [];
    const { entity_nodes_for_logkeys: e, action_nodes_for_logkeys: a, status_nodes_for_logkeys: s, seq } = data;

    for (let i = 0; i < e.length; i++) {
        const actions: TreeNode[] = [];
        const statuses: TreeNode[] = [];
        statuses.push({
            name: `${s[i]} (${seq[i]})`,
            lineNumber: i,
            event_id: seq[i], // log key
            log_template: eventIdToLogTemplate?.[seq[i]] || "", // log template if available
            isAnomaly: false, // will be set later if needed
            anomalyReason: "", // will be set later if needed
        });
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
    propagateRelatedToAnomaly({ name: "Root", children: entities });

    return { name: "Root", children: entities };
}

export const SequenceTree: React.FC<SequenceTreeProps> = ({ kroneDecompData, kroneDetectData, setHoveredNode, setMultiLineAnomaly, multiLineAnomaly }) => {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const [treeData, setTreeData] = useState<TreeNode | null>(null);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [eventIdToLogTemplate, setEventIdToLogTemplate] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [entitiesCollapsed, setEntitiesCollapsed] = useState(true);
    const [actionsCollapsed, setActionsCollapsed] = useState(false);
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
            const treeNode = toTreeNode(decomp, kroneDetectData, eventIdToLogTemplate);
            const anomalyRow = kroneDetectData.find(row => row.seq_id === decomp.seq_id);

            
            // If anomaly exists, expand only the parent nodes of the anomaly
            if (anomalyRow) {
                const ids = findSubsequenceIndices(decomp.seq, anomalyRow.anomaly_seg);


                // Expand the entity and action parents of the anomaly
                setCollapseAtDepth(treeNode, 1, true); // collapse all entities
                setCollapseAtDepth(treeNode, 2, true); // collapse all actions
                // Expand only the relevant entity and action nodes

                for (let i = 0; i < treeNode.children!.length; i++){
                    for (let j = 0; j < treeNode.children![i].children!.length; j++) {
                        for (let k = 0; k < treeNode.children![i].children![j].children!.length; k++) {
                            const currLineNumber = treeNode.children![i].children![j].children![k].lineNumber!;
                            if (currLineNumber >= ids![0] && currLineNumber <= ids![1]) {
                                // Expand the entity and action parents of the anomaly
                                treeNode.children![i].collapsed = false; // Expand entity
                                treeNode.children![i].children![j].collapsed = false; // Expand action
                                if (setHoveredNode) {
                                    // Find the corresponding HierarchyNode<TreeNode> for the status node
                                    const hierarchyRoot = hierarchy<TreeNode>(treeNode, d => d.children);
                                    const targetLineNumber = currLineNumber;
                                    const targetNode = hierarchyRoot
                                        .descendants()
                                        .find(
                                            node =>
                                                node.depth === 3 &&
                                                node.data.lineNumber === targetLineNumber
                                        );
                                    setHoveredNode(targetNode ?? null);
                                }
                            }
                        }
                    }

                }
                
            } else {
                // No anomaly, collapse everything
                setCollapseAtDepth(treeNode, 1, entitiesCollapsed);
                setCollapseAtDepth(treeNode, 2, actionsCollapsed);
            }

            addIndexPath(treeNode);
            setTreeData(treeNode);

            if (anomalyRow && anomalyRow.anomaly_seg.length > 1) {
                setMultiLineAnomaly(true);
                setAnomalyLevelMulti(anomalyRow.anomaly_level || "Normal");
            } else {
                setMultiLineAnomaly(false);
            }
            setLoading(false);
        }
    }, [kroneDecompData, kroneDetectData, selectedIndex, actionsCollapsed, entitiesCollapsed, eventIdToLogTemplate]);

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

        const root = hierarchy<TreeNode>(treeData, d => d.children);

        const font = getCssVar('--font-WPIfont') || "sans-serif";
        const widestByDepth = getWidestByDepth(treeData, font);

        const entitySpacing = 22;
        const dy = Math.max(widestByDepth[1] + 40, widestByDepth[2] + 50);
        tree<TreeNode>().nodeSize([entitySpacing, dy]).separation((a, b) => (Math.max(getFontSize(a.depth), getFontSize(b.depth)) + 8) / DEPTH_SPACING)(root);

        function topAlign(node: HierarchyNode<TreeNode>) {
            if (node.children && node.children.length > 0) {
                node.children.forEach(topAlign);
                node.x = node.children[0].x;
            }
        }
        topAlign(root);
        const minEntityGap = 50;
        const entityNodes = root.children || [];
        for (let i = 1; i < entityNodes.length; i++) {
            const prev = entityNodes[i - 1];
            const curr = entityNodes[i];
            if (curr.x! - prev.x! < minEntityGap) {
                const offset = minEntityGap - (curr.x! - prev.x!);
                function offsetSubtree(node: HierarchyNode<TreeNode>, delta: number) {
                    node.x! += delta;
                    if (node.children) node.children.forEach(child => offsetSubtree(child, delta));
                }
                offsetSubtree(curr, offset);
                for (let j = i + 1; j < entityNodes.length; j++) {
                    offsetSubtree(entityNodes[j], offset);
                }
            }
        }

        const extraColSpacing = [0, 80, 60, 60];
        const colOffsets = [0];
        for (let i = 1; i < widestByDepth.length; i++) {
            colOffsets[i] = (colOffsets[i - 1] || 0) + widestByDepth[i - 1] + extraColSpacing[i];
        }

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
        const height = x1 - x0 + BASE_FONT * 2;

        let svg = svgInit(svgRef, adjustedWidth + 120, height + 120, font, -40, x0 - 40);
        let hasVisibleAction = false;
        let hasVisibleStatus = false;
        root.each(node => {
            if (node.depth === 2 && !isNodeHidden(node)) hasVisibleAction = true;
            if (node.depth === 3 && !isNodeHidden(node)) hasVisibleStatus = true;
        });


        svg.append("text")
            .attr("x", 175)
            .attr("y", x0 - BASE_FONT)
            .attr("font-size", 30)
            .attr("font-weight", "bold")
            .attr("fill", ENTITY_BORDER)
            .style("pointer-events", "none")
            .text("Entity");
        svg.append("text")
            .attr("x", 775)
            .attr("y", x0 - BASE_FONT)
            .attr("font-size", 30)
            .attr("font-weight", "bold")
            .attr("fill", "#000")
            .style("pointer-events", "none")
            .text("Log Template");

        if (hasVisibleAction) {
            svg.append("text")
                .attr("x", 375)
                .attr("y", x0 - BASE_FONT)
                .attr("font-size", 30)
                .attr("font-weight", "bold")
                .attr("fill", ACTION_BORDER)
                .style("pointer-events", "none")
                .text("Action");
        }
        if (hasVisibleStatus) {
            svg.append("text")
                .attr("x", 575)
                .attr("y", x0 - BASE_FONT)
                .attr("font-size", 30)
                .attr("font-weight", "bold")
                .attr("fill", STATUS_BORDER)
                .style("pointer-events", "none")
                .text("Status");
        }

        svg = svgLines(svg, root, widestByDepth);
        
        const node = svgNodes(
            svg,
            root,
            // mouseover
            function (this: SVGElement, event, d) {
                highlightText.call(this, event, d);
            },
            // mouseout
            function (this: SVGElement) {
                unhighlightText.call(this);
            },
            // click
            function (this: SVGElement, event, d) {
                event.stopPropagation();
                setHoveredNode?.(d);
            }
        );
        node.on("dblclick", function (event: MouseEvent, d) {
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
                                ? "#F00"
                                : (isRelated ? "#003366" : (n.data.isAnomaly || n.data.isRelatedToAnomaly ? "#F00" : "#222"))
                        );
                    const rects = select(this.parentNode as Element).selectAll("rect").nodes();
                    if (rects.length > 0) {
                        select(rects[0])
                            .attr("fill", isRelated ? "#B3D8FF" : linkFillColor({ source: { depth: n.depth - 1 } }))
                            .attr("stroke-width", isRelated ? 5 : 2);
                    }
                });

                if (d.depth === 3 && typeof d.data.lineNumber === "number") {
                    svg.selectAll<SVGTextElement, TreeNode>("text.log-template-text")
                        .each(function () {
                            const isCurrent = +select(this).attr("data-line-number") === d.data.lineNumber;
                            select(this)
                                //.attr("fill", n.isAnomaly || n.isRelatedToAnomaly ? ENTITY_BORDER : (isCurrent ? "#000" : "#888"))
                                .attr("font-weight", isCurrent ? "bold" : "normal")
                        });
                } else if (d.depth === 2 || d.depth === 1) {
                    const lineNumbers: number[] = [];
                    d.descendants().forEach(n => {
                        if (n.depth === 3 && typeof n.data.lineNumber === "number") {
                            lineNumbers.push(n.data.lineNumber);
                        }
                    });
                    svg.selectAll<SVGTextElement, TreeNode>("text.log-template-text")
                        .each(function (n) {
                            const isRelated = lineNumbers.includes(+select(this).attr("data-line-number"));
                            select(this)
                                .attr("fill", n.isAnomaly || n.isRelatedToAnomaly ? "#F00" : (isRelated ? "#000" : "#888"))
                        });
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

        function unhighlightText(this: SVGElement) {
            svg.selectAll<SVGTextElement, HierarchyNode<TreeNode>>("text.node-label")
                .each(function (n) {
                    select(this)
                        .attr("fill", n.data.isAnomaly || n.data.isRelatedToAnomaly ? "#F00" : "#000");
                    // Only update the first rect (the node label background), not all rects in the group
                    const rects = select(this.parentNode as Element).selectAll("rect").nodes();
                    if (rects.length > 0) {
                        select(rects[0])
                            .attr("fill", linkFillColor({ source: { depth: n.depth - 1 } }))
                            .attr("stroke-width", 2);
                    }
                });
            svg.selectAll<SVGTextElement, TreeNode>("text.log-template-text")
                .attr("fill", d => d.isAnomaly || d.isRelatedToAnomaly ? "#F00" : "#000")
                .attr("font-weight", "normal");
            svg.selectAll<SVGPathElement, HierarchyLink<TreeNode>>("path")
                .attr("stroke", linkBorderColor)
                .attr("stroke-width", 1.5);
        }

        let anomalyStartY = Infinity;
        let anomalyEndY = -Infinity;

        node.append("text")
            .attr("class", "node-label")
            .attr("dy", "0.31em")
            .attr("x", (d: HierarchyNode<TreeNode>) => {
                const fontSize = getFontSize(d.depth);
                return (d.children ? -fontSize * 0.2 : fontSize * 0.2);
            })
            .attr("opacity", (d: HierarchyNode<TreeNode>) => isNodeHidden(d) ? 0 : 1)
            .attr("pointer-events", (d: HierarchyNode<TreeNode>) => isNodeHidden(d) ? "none" : "auto")
            .attr("text-anchor", "start")
            .text((d: HierarchyNode<TreeNode>) => d.data.name)
            .attr("fill", (d: HierarchyNode<TreeNode>) => d.data.isAnomaly || d.data.isRelatedToAnomaly ? "#F00" : "#222")
            .attr("font-size", (d: HierarchyNode<TreeNode>) => getFontSize(d.depth))
            .each(function (this: SVGTextElement, d: HierarchyNode<TreeNode>) {
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
                if (d.children && d.children.length > 0 && !d.parent?.data.collapsed) {
                    // If node is collapsed, show ▶ (expand)
                    if (d.data.collapsed) {
                        nodeGroup.insert("text", "text")
                            .attr("class", "collapse-indicator")
                            .attr("x", (bbox.x - padding) + widestByDepth[d.depth] + padding * 1.5)
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
                    } else if (!(d.data.name === "Root")) {
                        // If node is expanded, show ▼ (collapse)
                        nodeGroup.insert("text", "text")
                            .attr("class", "collapse-indicator")
                            .attr("x", (bbox.x - padding) + widestByDepth[d.depth] + padding * 1.5)
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
                            .text("◀");
                    }
                }

                // ...inside node.append("text").each(function (this: SVGTextElement, d: HierarchyNode<TreeNode>) { ... })...
                if (d.depth === 3) {
                    const eventId = /\(([^)]+)\)$/.exec(d.data.name)?.[1] || "";
                    const logTemplate = eventIdToLogTemplate[eventId] || "";
                    if (logTemplate) {
                        const linePrefix = typeof d.data.lineNumber === "number" ? `${d.data.lineNumber}. ` : "";
                        const x = maxStatusLabelRight + getPadding(fontSize) * 2 + 15;
                        const y = bbox.y + bbox.height / 2 + 2;
                        const fontSizeLog = Math.max(fontSize * 0.8, 14);

                        // Render the log template with a lighter line number prefix
                        const logText = nodeGroup.append("text")
                            .attr("class", "log-template-text")
                            .attr("data-event-id", eventId)
                            .attr("data-line-number", d.data.lineNumber || "")
                            .attr("x", x)
                            .attr("y", y)
                            .attr("alignment-baseline", "middle")
                            .attr("font-size", fontSizeLog)
                            .attr("fill", d.data.isAnomaly || d.data.isRelatedToAnomaly ? "#F00" : "#000")
                            .attr("text-anchor", "start")
                            .style("cursor", d.parent?.data.collapsed ? "pointer" : "default")
                            .on("click", function (event) {
                                // Only uncollapse if parent is collapsed
                                console.log(d)
                                if (d.parent?.data.collapsed) {
                                    event.stopPropagation();
                                    // Toggle the collapsed state of the parent node
                                    const idx = d.parent.data.indexPath;
                                    if (!idx) return;
                                    setTreeData(prev => {
                                        if (!prev) return null;
                                        const updated = toggleNodeByIndexPath(prev, idx);
                                        addIndexPath(updated);
                                        return updated;
                                    });
                                }
                                if (d.parent?.parent?.data.collapsed) {
                                    event.stopPropagation();
                                    // Toggle the collapsed state of the grandparent node
                                    const idx = d.parent.parent.data.indexPath;
                                    if (!idx) return;
                                    setTreeData(prev => {
                                        if (!prev) return null;
                                        const updated = toggleNodeByIndexPath(prev, idx);
                                        addIndexPath(updated);
                                        return updated;
                                    });
                                }
                            })
                            .datum({
                                ...d.data
                            });

                        if (linePrefix) {
                            logText.append("tspan")
                                .attr("fill", "#999") // Lighter color for the number
                                .text(linePrefix);
                        }
                        logText.append("tspan")
                            .attr("fill", d.data.isAnomaly || d.data.isRelatedToAnomaly ? "#F00" : "#000")
                            .text(logTemplate);
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
                            .attr("font-weight", "bold")
                            .attr("text-anchor", "start")
                            .style("cursor", "pointer")
                            .text("⚠️")
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
                        .text(!reason ? "" : multiLineAnomaly ? "🚨" : "⚠️")
                }
            });

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
                const anomalyEntityNodes = root.descendants().filter(
                    node =>
                        node.depth === 1 &&
                        (node.data.isAnomaly || node.data.isRelatedToAnomaly)
                ).sort((a, b) => a.x! - b.x!);

                if (anomalyEntityNodes.length > 0) {
                    highlightYStart = anomalyEntityNodes[0].x!;
                    const lastEntityNode = anomalyEntityNodes[anomalyEntityNodes.length - 1];
                    if (lastEntityNode.data.collapsed) {
                        const fontSize = getFontSize(1);
                        const nodeHeight = fontSize + getPadding(fontSize);
                        highlightYEnd = lastEntityNode.x! + nodeHeight;
                    } else {
                        const lastActionNodes = (lastEntityNode.children || []);
                        if (lastActionNodes.length > 0) {
                            const lastActionNode = lastActionNodes[lastActionNodes.length - 1];
                            if (lastActionNode.data.collapsed) {
                                const fontSize = getFontSize(2);
                                const nodeHeight = fontSize + getPadding(fontSize);
                                highlightYEnd = lastActionNode.x! + nodeHeight;
                            } else {
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
                                    const fontSize = getFontSize(2);
                                    const nodeHeight = fontSize + getPadding(fontSize);
                                    highlightYEnd = lastActionNode.x! + nodeHeight;
                                }
                            }
                        } else {
                            const fontSize = getFontSize(1);
                            const nodeHeight = fontSize + getPadding(fontSize);
                            highlightYEnd = lastEntityNode.x! + nodeHeight;
                        }
                    }
                }
            }

            if (anomalyLevelMulti === "action") {
                const anomalyActionNodes = root.descendants().filter(
                    node =>
                        node.depth === 2 &&
                        (node.data.isAnomaly || node.data.isRelatedToAnomaly)
                ).sort((a, b) => a.x! - b.x!);

                if (anomalyActionNodes.length > 0) {
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

            let leftX: number, rightX: number;
            if (anomalyLevelMulti === "entity") {
                leftX = colOffsets[1];
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
                highlightYEnd += 15
            }

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
        node.each(function (d: HierarchyNode<TreeNode>) {
            if (!this) return;
            const hidden: boolean = isNodeHidden(d);
            select(this).selectAll<SVGRectElement, unknown>("rect")
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

    const numAnomalousSequences = kroneDecompData.filter(row =>
        kroneDetectData.find(r => r.seq_id === row.seq_id)
    ).length;

    return (
        <div style={{ width: "100%", position: "relative" }}>
            <div className="sequence-tree h-max">
                {/* Nav Panel */ }
                <div 
                    style={{
                        position: "sticky",
                        top: 0,
                        background: "#fff",
                        zIndex: 10,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                        paddingBottom: 8,
                        marginBottom: 12,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                    }}
                >
                    <h2 className="text-3xl mb-2">Sequence Tree</h2>
                    <h1 className="mt-0"> Select a log sequence and click on individual nodes to view detailed information about each log entry </h1>
                    <div 
                        style={{ 
                            marginBottom: 12, 
                            marginLeft: 20, 
                            gap: 12, 
                            alignItems: "center",
                        }}>
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
                                    <option key={row.seq_id} value={row.seq_id}
                                        style={{color: kroneDetectData.find(r => r.seq_id === row.seq_id) ? "#F00" : "#000"}}
                                    >
                                        {row.seq_id}
                                    </option>
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
                                background: "#eee", // Always the same color
                                fontWeight: 600,
                                cursor: "pointer",
                                minWidth: 200,      // Fixed width for consistency
                                boxSizing: "border-box",
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
                                background: "#eee", // Always the same color
                                fontWeight: 600,
                                cursor: "pointer",
                                minWidth: 200,      // Fixed width for consistency
                                boxSizing: "border-box",
                            }}
                        >
                            {actionsCollapsed ? "Expand Actions" : "Collapse Actions"}
                        </button>
                        <h3 className="text-xl mt-4 mb-2">
                            Total Anomalous Sequences: &nbsp;
                            <span className="text-[#F00] font-semibold">
                                {numAnomalousSequences}
                            </span>
                            &nbsp;&nbsp;
                            Total Normal Sequences: &nbsp;
                            <span className="text-[#4caf50] font-semibold">
                                {kroneDecompData.length - numAnomalousSequences}
                            </span>
                        </h3>
                        <div>
                            <h3 className="inline text-2xl">Prediction:  </h3>
                            <h3
                                className='text-2xl'
                                style={{
                                    marginBottom: 8,
                                    color: anomalyLevel === "Normal" ? "#222" : "#F00",
                                    background: anomalyLevel === "Normal" ? "#e6fbe6" : ENTITY_FILL,
                                    borderRadius: 8,
                                    padding: "8px 16px",
                                    display: "inline-block"
                                }}
                            >
                                {anomalyLevel}
                            </h3>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div style={{ textAlign: "center", padding: "2rem" }}>
                        <span className="animate-spin inline-block mr-2" style={{ fontSize: 24 }}>⏳</span>
                        Loading sequence tree...
                    </div>
                ) : (
                    <>
                        <svg ref={svgRef} />
                    </>
                )}
            </div>
        </div>
    );
};