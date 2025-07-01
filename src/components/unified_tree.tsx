import React, { useRef, useEffect, useState } from 'react';
import { hierarchy, tree } from 'd3-hierarchy';
import type { HierarchyNode, HierarchyLink } from 'd3-hierarchy';
import { select } from 'd3-selection';
import Papa from 'papaparse';

// --- Types ---
export type UnifiedTreeType = "sequence" | "hierarchy";

export type UnifiedTreeNode = {
    name: string;
    children?: UnifiedTreeNode[];
    isAnomaly?: boolean;
    anomalyReason?: string;
    indexPath?: number[];
    lineNumber?: number;
    isRelatedToAnomaly?: boolean;
    collapsed?: boolean;
    event_id?: string;
    // Add more fields as needed for hierarchy tree
};

type UnifiedTreeProps = {
    treeData: UnifiedTreeNode | null;
    eventIdToLogTemplate?: Record<string, string>;
    loading?: boolean;
    entitiesCollapsed?: boolean;
    actionsCollapsed?: boolean;
    // For sequence tree
    multiLineAnomaly?: boolean;
    anomalyLevelMulti?: string;
    kroneDetectData?: any[];
    selectedSeqId?: string;
    // For hierarchy tree
    matchedNodeId?: string | null;
    setHoveredNode?: (node: HierarchyNode<UnifiedTreeNode> | null) => void;
    // Main param
    treeType: UnifiedTreeType;
};

function allEntitiesCollapsed(treeData: UnifiedTreeNode | null): boolean {
    if (!treeData?.children) return false;
    return treeData.children.every(entity => entity.collapsed);
}
function allActionsCollapsed(treeData: UnifiedTreeNode | null): boolean {
    if (!treeData?.children) return false;
    return treeData.children.every(entity =>
        entity.children?.every(action => action.collapsed) ?? false
    );
}
function anyAnomalyEntityCollapsed(treeData: UnifiedTreeNode | null, anomalyLevel: string, anomalySeg: string[]): boolean {
    if (!treeData?.children) return false;
    if (anomalyLevel === "entity") {
        return treeData.children.some(entity =>
            entity.collapsed &&
            entity.children?.some(action =>
                action.children?.some(status =>
                    anomalySeg.includes((status.name.match(/\(([^)]+)\)$/) || [])[1])
                )
            )
        );
    }
    return false;
}
function anyAnomalyActionCollapsed(treeData: UnifiedTreeNode | null, anomalySeg: string[]): boolean {
    if (!treeData?.children) return false;
    return treeData.children.some(entity =>
        entity.children?.some(action =>
            action.collapsed &&
            action.children?.some(status =>
                anomalySeg.includes((status.name.match(/\(([^)]+)\)$/) || [])[1])
            )
        )
    );
}

// --- Utility Functions (mostly copied from sequence_tree.tsx) ---
function addIndexPath(node: UnifiedTreeNode, path: number[] = []): void {
    node.indexPath = path;
    (node.children || []).forEach((c, i) => addIndexPath(c, [...path, i]));
}

function getFirstAnomalyReason(node: HierarchyNode<UnifiedTreeNode>): string | undefined {
    if (node.children) {
        for (const child of node.children) {
            if (child.data.isAnomaly && child.data.anomalyReason) {
                return child.data.anomalyReason;
            }
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

function toggleNodeByIndexPath(node: UnifiedTreeNode, path: number[]): UnifiedTreeNode {
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

function isNodeHidden(node: HierarchyNode<UnifiedTreeNode>): boolean {
    let current = node.parent;
    while (current) {
        if (current.data.collapsed) return true;
        current = current.parent;
    }
    return false;
}

// --- Main Component ---
export const UnifiedTree: React.FC<UnifiedTreeProps> = ({
    treeData,
    eventIdToLogTemplate = {},
    loading = false,
    entitiesCollapsed = false,
    actionsCollapsed = false,
    multiLineAnomaly = false,
    anomalyLevelMulti = "Normal",
    kroneDetectData = [],
    selectedSeqId,
    matchedNodeId,
    setHoveredNode,
    treeType,
}) => {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const [hoveredAnomaly, setHoveredAnomaly] = useState<{ explanation: string; x: number; y: number } | null>(null);
    const [localTreeData, setLocalTreeData] = useState<UnifiedTreeNode | null>(null);

    // Clone and apply collapse state on prop change
    useEffect(() => {
        if (!treeData) return;
        const cloned = JSON.parse(JSON.stringify(treeData)) as UnifiedTreeNode;
        function setCollapseAtDepth(node: UnifiedTreeNode, depth: number, collapse: boolean, cur = 1) {
            if (!node.children) return;
            if (cur === depth) {
                node.children.forEach(child => {
                    child.collapsed = collapse;
                });
            } else {
                node.children.forEach(c => setCollapseAtDepth(c, depth, collapse, cur + 1));
            }
        }
        setCollapseAtDepth(cloned, 1, entitiesCollapsed);
        setCollapseAtDepth(cloned, 2, actionsCollapsed);
        addIndexPath(cloned);
        setLocalTreeData(cloned);
    }, [treeData, entitiesCollapsed, actionsCollapsed]);

    // --- D3 Rendering ---
    useEffect(() => {
        if (!localTreeData || !svgRef.current) return;

        addIndexPath(localTreeData);

        const root = hierarchy<UnifiedTreeNode>(localTreeData, d => d.children);

        // --- Styling constants (copied from sequence_tree.tsx) ---
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

        // --- Layout calculations (copied from sequence_tree.tsx) ---
        const widestByDepth = [75, 0, 0, 0];
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
        tree<UnifiedTreeNode>().nodeSize([entitySpacing, dy]).separation((a, b) => (Math.max(getFontSize(a.depth), getFontSize(b.depth)) + 8) / depthSpacing)(root);

        function topAlign(node: HierarchyNode<UnifiedTreeNode>) {
            if (node.children && node.children.length > 0) {
                node.children.forEach(topAlign);
                node.x = node.children[0].x;
            }
        }
        topAlign(root);

        // --- Manual y adjustment ---
        const minEntityGap = 50;
        const entityNodes = root.children || [];
        for (let i = 1; i < entityNodes.length; i++) {
            const prev = entityNodes[i - 1];
            const curr = entityNodes[i];
            if (curr.x! - prev.x! < minEntityGap) {
                const offset = minEntityGap - (curr.x! - prev.x!);
                function offsetSubtree(node: HierarchyNode<UnifiedTreeNode>, delta: number) {
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
                const eventId = /\(([^)]+)\)$/.exec(node.data.name)?.[1] || node.data.event_id || "";
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

        // --- Column headers ---
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

        // --- Draw tree links (edges) ---
        svg.append("g")
            .attr("fill", "none")
            .attr("stroke-opacity", 0.4)
            .attr("stroke-width", 1.5)
            .selectAll("path")
            .data(root.links())
            .join("path")
            .attr("d", (d: HierarchyLink<UnifiedTreeNode>) => {
                const sourceWidth = widestByDepth[d.source.depth];
                const sourceY = (d.source.y ?? 0) + sourceWidth - 20;
                const sourceX = d.source.x;
                const targetY = d.target.y ?? 0;
                const targetX = d.target.x;
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

        // --- Draw tree nodes (labels, rectangles, anomaly icons, log templates) ---
        const node = svg.append("g")
            .attr("stroke-linejoin", "round")
            .attr("stroke-width", 2)
            .selectAll("g")
            .data(root.descendants())
            .join("g")
            .attr("transform", d => `translate(${d.y},${d.x})`)
            .on("mouseover", function (event, d) {
                if (!(this instanceof SVGElement)) return;
                // --- Hover logic: depends on treeType ---
                if (treeType === "sequence") {
                    highlightText.call(this, event, d);
                    if ((d.depth === 1 || d.depth === 2 || d.depth === 3) && d.data.isAnomaly && d.data.anomalyReason) {
                        setHoveredAnomaly({ explanation: d.data.anomalyReason, x: event.clientX, y: event.clientY });
                    }
                    if (setHoveredNode) setHoveredNode(d);
                } else if (treeType === "hierarchy") {
                    highlightText.call(this, event, d);
                    if (setHoveredNode) setHoveredNode(d);
                }
            })
            .on("mouseout", function () {
                if (!(this instanceof SVGElement)) return;
                unhighlightText.call(this);
                setHoveredAnomaly(null);
                if (setHoveredNode) setHoveredNode(null);
            })
            .on("click", function (event, d) {
                event.stopPropagation();
                // --- Click logic: depends on treeType ---
                if (treeType === "sequence") {
                    const idx = d.data.indexPath;
                    if (!idx) return;
                    setLocalTreeData(prev => {
                        if (!prev) return null;
                        const updated = toggleNodeByIndexPath(prev, idx);
                        addIndexPath(updated);
                        return updated;
                    });
                } else if (treeType === "hierarchy") {
                    // For hierarchy, you may want to expand/collapse nodes on click
                    // (Optional: implement collapse/expand logic here if desired)
                }
            });

        // --- Highlight/Unhighlight logic (copied from sequence_tree.tsx) ---
        function highlightText(this: SVGElement, _event: unknown, d: HierarchyNode<UnifiedTreeNode>) {
            const ancestorNodes = new Set<HierarchyNode<UnifiedTreeNode>>();
            let current: HierarchyNode<UnifiedTreeNode> | null = d;
            while (current) {
                ancestorNodes.add(current);
                current = current.parent;
            }
            const descendantNodes = new Set<HierarchyNode<UnifiedTreeNode>>();
            function collectDescendants(node: HierarchyNode<UnifiedTreeNode>) {
                descendantNodes.add(node);
                if (node.children) node.children.forEach(collectDescendants);
            }
            collectDescendants(d);

            svg.selectAll<SVGTextElement, HierarchyNode<UnifiedTreeNode>>("text.node-label")
                .each(function (n) {
                    const isRelated = ancestorNodes.has(n) || descendantNodes.has(n);
                    const isRelatedAnomaly = isRelated && (n.data.isAnomaly || n.data.isRelatedToAnomaly);
                    select(this)
                        .attr("fill",
                            isRelatedAnomaly
                                ? "#c8102e"
                                : (isRelated ? "#003366" : (n.data.isAnomaly || n.data.isRelatedToAnomaly ? "#c8102e" : "#222"))
                        )
                        .attr("font-weight", isRelated ? "bold" : null);
                    select(this.parentNode as Element).selectAll("rect")
                        .attr("fill", isRelated ? "#B3D8FF" : linkFillColor({ source: { depth: n.depth - 1 } }))
                        .attr("stroke-width", isRelated ? 5 : 2);
                });

            // --- Highlight associated log template(s) ---
            svg.selectAll<SVGTextElement, any>("text.log-template-text")
                .attr("font-weight", null); // reset all first

            if (d.depth === 3 && typeof d.data.lineNumber === "number") {
                svg.selectAll<SVGTextElement, any>("text.log-template-text")
                    .filter(function () {
                        return +select(this).attr("data-line-number") === d.data.lineNumber;
                    })
                    .attr("fill", d.data.isAnomaly || d.data.isRelatedToAnomaly ? "#c8102e" : "#003366")
                    .attr("font-weight", "bold");
            } else if (d.depth === 2 || d.depth === 1) {
                const lineNumbers: number[] = [];
                d.descendants().forEach(n => {
                    if (n.depth === 3 && typeof n.data.lineNumber === "number") {
                        lineNumbers.push(n.data.lineNumber);
                    }
                });
                svg.selectAll<SVGTextElement, any>("text.log-template-text")
                    .filter(function () {
                        return lineNumbers.includes(+select(this).attr("data-line-number"));
                    })
                    .attr("fill", function (d: any) {
                        return d.isAnomaly || d.isRelatedToAnomaly ? "#c8102e" : "#003366";
                    })
                    .attr("font-weight", "bold");
            }

            // --- Highlight connecting lines ---
            svg.selectAll<SVGPathElement, HierarchyLink<UnifiedTreeNode>>("path")
                .attr("stroke", lnk => {
                    const isAncestorPath =
                        ancestorNodes.has(lnk.source as HierarchyNode<UnifiedTreeNode>) &&
                        ancestorNodes.has(lnk.target as HierarchyNode<UnifiedTreeNode>);
                    const isDescendantPath =
                        descendantNodes.has(lnk.source as HierarchyNode<UnifiedTreeNode>) &&
                        descendantNodes.has(lnk.target as HierarchyNode<UnifiedTreeNode>);
                    return (isAncestorPath || isDescendantPath) ? "#B3D8FF" : linkBorderColor(lnk);
                })
                .attr("stroke-width", lnk => {
                    const isAncestorPath =
                        ancestorNodes.has(lnk.source as HierarchyNode<UnifiedTreeNode>) &&
                        ancestorNodes.has(lnk.target as HierarchyNode<UnifiedTreeNode>);
                    const isDescendantPath =
                        descendantNodes.has(lnk.source as HierarchyNode<UnifiedTreeNode>) &&
                        descendantNodes.has(lnk.target as HierarchyNode<UnifiedTreeNode>);
                    return (isAncestorPath || isDescendantPath) ? 5 : 1.5;
                });
        }

        function unhighlightText(this: SVGElement) {
            svg.selectAll<SVGTextElement, HierarchyNode<UnifiedTreeNode>>("text.node-label")
                .each(function (n) {
                    select(this)
                        .attr("fill", n.data.isAnomaly || n.data.isRelatedToAnomaly ? "#c8102e" : "#222")
                        .attr("font-weight", null);
                    select(this.parentNode as Element).selectAll("rect")
                        .attr("fill", linkFillColor({ source: { depth: n.depth - 1 } }))
                        .attr("stroke-width", 2);
                });

            svg.selectAll<SVGTextElement, any>("text.log-template-text")
                .attr("fill", (d: any) => d.isAnomaly || d.isRelatedToAnomaly ? "#c8102e" : "#444")
                .attr("font-weight", null);

            svg.selectAll<SVGPathElement, HierarchyLink<UnifiedTreeNode>>("path")
                .attr("stroke", linkBorderColor)
                .attr("stroke-width", 1.5);
        }

        // --- Draw node labels, rectangles, log templates, anomaly icons ---
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
                    .attr("ry", radius)
                    .attr("opacity", isNodeHidden(d) ? 0 : 1)
                    .attr("pointer-events", isNodeHidden(d) ? "none" : "auto");
                
                    if (
                        d.children && d.children.length > 0 &&
                        d.data.collapsed &&
                        !d.parent?.data.collapsed
                    ) {
                        nodeGroup.insert("text", "text") // insert before label
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
                                setLocalTreeData(prev => {
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

                // Log template for status nodes
                if (d.depth === 3) {
                    const eventId = d.data.event_id || (/\(([^)]+)\)$/.exec(d.data.name)?.[1] ?? "");
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
                if (
                    d.data.isAnomaly &&
                    !d.parent?.data.collapsed &&
                    !d.parent?.parent?.data.collapsed
                ) {
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
                } else if (
                    d.data.isRelatedToAnomaly &&
                    d.data.collapsed &&
                    !d.parent?.data.collapsed
                ) {
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
                        .on("mouseover", function (event) {
                            if (reason) setHoveredAnomaly({ explanation: reason, x: event.clientX, y: event.clientY });
                        })
                        .on("mouseout", function () { setHoveredAnomaly(null); });
                }
            });

        // --- Optionally, highlight matched node for hierarchy tree ---
        if (treeType === "hierarchy" && matchedNodeId) {
            const matched = root.descendants().find(
                d => d.depth === 3 && d.data.event_id === matchedNodeId
            );
            if (matched) {
                const ancestorNodes = new Set<HierarchyNode<UnifiedTreeNode>>();
                let current: HierarchyNode<UnifiedTreeNode> | null = matched;
                while (current) {
                    ancestorNodes.add(current);
                    current = current.parent;
                }
                const descendantNodes = new Set<HierarchyNode<UnifiedTreeNode>>();
                function collectDescendants(node: HierarchyNode<UnifiedTreeNode>) {
                    descendantNodes.add(node);
                    if (node.children) node.children.forEach(collectDescendants);
                }
                collectDescendants(matched);

                svg.selectAll<SVGTextElement, HierarchyNode<UnifiedTreeNode>>("text.node-label")
                    .each(function(n) {
                        const isRelated = ancestorNodes.has(n) || descendantNodes.has(n);
                        select(this)
                            .attr("fill", isRelated ? "#003366" : "#222");
                        select(this.parentNode as Element).select("rect")
                            .attr("fill", isRelated ? "#B3D8FF" : linkFillColor({ source: { depth: n.depth - 1 } }))
                            .attr("stroke-width", isRelated ? 5 : 2);
                    });

                svg.selectAll<SVGPathElement, HierarchyLink<UnifiedTreeNode>>("path")
                    .attr("stroke", lnk => {
                        const isAncestorPath =
                            ancestorNodes.has(lnk.source as HierarchyNode<UnifiedTreeNode>) &&
                            ancestorNodes.has(lnk.target as HierarchyNode<UnifiedTreeNode>);
                        const isDescendantPath =
                            descendantNodes.has(lnk.source as HierarchyNode<UnifiedTreeNode>) &&
                            descendantNodes.has(lnk.target as HierarchyNode<UnifiedTreeNode>);
                        return (isAncestorPath || isDescendantPath) ? "#B3D8FF" : linkBorderColor(lnk);
                    })
                    .attr("stroke-width", lnk => {
                        const isAncestorPath =
                            ancestorNodes.has(lnk.source as HierarchyNode<UnifiedTreeNode>) &&
                            ancestorNodes.has(lnk.target as HierarchyNode<UnifiedTreeNode>);
                        const isDescendantPath =
                            descendantNodes.has(lnk.source as HierarchyNode<UnifiedTreeNode>) &&
                            descendantNodes.has(lnk.target as HierarchyNode<UnifiedTreeNode>);
                        return (isAncestorPath || isDescendantPath) ? 5 : 1.5;
                    });
            }
        }

        if (
            treeType === "sequence" &&
            multiLineAnomaly &&
            kroneDetectData &&
            selectedSeqId
        ) {
            const anomalyRow = kroneDetectData.find(row => row.seq_id === selectedSeqId);
            const anomalySeg = anomalyRow?.anomaly_seg || [];
            const anomalyLevel = anomalyLevelMulti;

            // Only show rectangle if appropriate
            let showRectangle = false;
            if (anomalyLevel === "entity") {
                showRectangle = true;
            } else if (anomalyLevel === "action") {
                showRectangle = !allEntitiesCollapsed(localTreeData) && !anyAnomalyEntityCollapsed(localTreeData, "entity", anomalySeg);
            } else if (anomalyLevel === "status") {
                showRectangle = !allEntitiesCollapsed(localTreeData) && !allActionsCollapsed(localTreeData) &&
                    !anyAnomalyEntityCollapsed(localTreeData, "entity", anomalySeg) && !anyAnomalyActionCollapsed(localTreeData, anomalySeg);
            }

            if (showRectangle) {
                let minY = Infinity, maxY = -Infinity, leftX = 0, rightX = 0;

                if (anomalyLevel === "entity") {
                    // Find all visible anomalous entity nodes
                    const anomalyEntityNodes = root.descendants().filter(
                        d => d.depth === 1 && (d.data.isAnomaly || d.data.isRelatedToAnomaly) && !isNodeHidden(d)
                    );
                    if (anomalyEntityNodes.length > 0) {
                        minY = Math.min(...anomalyEntityNodes.map(d => d.x!));
                        maxY = Math.max(...anomalyEntityNodes.map(d => {
                            // If collapsed, just use entity node
                            if (d.data.collapsed) {
                                const fontSize = getFontSize(1);
                                return d.x! + fontSize + getPadding(fontSize);
                            }
                            // If expanded, find the last visible status node under this entity
                            let lastStatusY = d.x!;
                            d.descendants().forEach(desc => {
                                if (desc.depth === 3 && !isNodeHidden(desc)) {
                                    const fontSize = getFontSize(3);
                                    lastStatusY = Math.max(lastStatusY, desc.x! + fontSize + getPadding(fontSize));
                                }
                            });
                            return lastStatusY;
                        }));
                        leftX = colOffsets[1];
                        // Right edge: depends on collapse state of last entity's last action
                        const lastEntity = anomalyEntityNodes[anomalyEntityNodes.length - 1];
                        if (lastEntity.data.collapsed) {
                            rightX = colOffsets[1] + widestByDepth[1];
                        } else {
                            // Find last visible action under last entity
                            const lastActionNodes = (lastEntity.children || []).filter(a => !isNodeHidden(a));
                            if (lastActionNodes.length > 0) {
                                const lastAction = lastActionNodes[lastActionNodes.length - 1];
                                if (lastAction.data.collapsed) {
                                    rightX = colOffsets[2] + widestByDepth[2];
                                } else {
                                    rightX = colOffsets[3] + widestByDepth[3];
                                }
                            } else {
                                rightX = colOffsets[1] + widestByDepth[1];
                            }
                        }
                    }
                } else if (anomalyLevel === "action") {
                    // Find all visible anomalous action nodes
                    const anomalyActionNodes = root.descendants().filter(
                        d => d.depth === 2 && (d.data.isAnomaly || d.data.isRelatedToAnomaly) && !isNodeHidden(d)
                    );
                    if (anomalyActionNodes.length > 0) {
                        minY = Math.min(...anomalyActionNodes.map(d => d.x!));
                        maxY = Math.max(...anomalyActionNodes.map(d => {
                            if (d.data.collapsed) {
                                const fontSize = getFontSize(2);
                                return d.x! + fontSize + getPadding(fontSize);
                            }
                            // If expanded, find the last visible status node under this action
                            let lastStatusY = d.x!;
                            d.descendants().forEach(desc => {
                                if (desc.depth === 3 && !isNodeHidden(desc)) {
                                    const fontSize = getFontSize(3);
                                    lastStatusY = Math.max(lastStatusY, desc.x! + fontSize + getPadding(fontSize));
                                }
                            });
                            return lastStatusY;
                        }));
                        leftX = colOffsets[2];
                        // Right edge: depends on collapse state of last action
                        const lastAction = anomalyActionNodes[anomalyActionNodes.length - 1];
                        if (lastAction.data.collapsed) {
                            rightX = colOffsets[2] + widestByDepth[2];
                        } else {
                            rightX = colOffsets[3] + widestByDepth[3];
                        }
                    }
                } else if (anomalyLevel === "status") {
                    // Find all visible anomalous status nodes
                    const anomalyStatusNodes = root.descendants().filter(
                        d => d.depth === 3 && (d.data.isAnomaly || d.data.isRelatedToAnomaly) && !isNodeHidden(d)
                    );
                    if (anomalyStatusNodes.length > 0) {
                        minY = Math.min(...anomalyStatusNodes.map(d => d.x!));
                        maxY = Math.max(...anomalyStatusNodes.map(d => {
                            const fontSize = getFontSize(3);
                            return d.x! + fontSize + getPadding(fontSize);
                        }));
                        leftX = colOffsets[3];
                        rightX = colOffsets[3] + widestByDepth[3];
                    }
                }

                if (minY !== Infinity && maxY !== -Infinity) {
                    svg.append("rect")
                        .attr("x", leftX - 20)
                        .attr("y", minY - 20)
                        .attr("width", rightX - leftX + 25)
                        .attr("height", maxY - minY + 20)
                        .attr("fill", "#FFCCCC")
                        .attr("stroke", "#FF0000")
                        .attr("fill-opacity", 0.2)
                        .attr("pointer-events", "none")
                        .lower();
                }
            }
        }

    }, [localTreeData, eventIdToLogTemplate, entitiesCollapsed, actionsCollapsed, treeType, matchedNodeId, setHoveredNode]);

    // --- Render ---
    return (
        <div style={{ width: "100%", position: "relative", height: "100%" }}>
            <div className="sequence-tree h-max"
             style={{ 
                overflowX: "auto",
                overflowY: "hidden",
                height: "100%",

            }}>

                {loading ? (
                    <div style={{ textAlign: "center", padding: "2rem" }}>
                        <span className="animate-spin inline-block mr-2" style={{ fontSize: 24 }}>⏳</span>
                        Loading tree...
                    </div>
                ) : (
                    <>
                        <svg ref={svgRef} style={{display: "block"}}/>
                    </>
                )}
            </div>
        </div>
    );
};