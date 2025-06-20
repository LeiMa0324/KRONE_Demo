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
    _children?: TreeNode[];
    isAnomaly?: boolean;
    anomalyReason?: string;
    indexPath?: number[];
    lineNumber?: number;
};

function addIndexPath(node: TreeNode, path: number[] = []): void {
    node.indexPath = path;
    (node.children || []).forEach((c, i) => addIndexPath(c, [...path, i]));
    (node._children || []).forEach((c, i) => addIndexPath(c, [...path, i]));
}

function toggleNodeByIndexPath(node: TreeNode, path: number[]): TreeNode {
    if (!path.length) return node;
    const [h, ...r] = path, arr = node.children ?? node._children;
    if (!arr || !arr[h]) return node;
    const n = [...arr];
    if (!r.length) {
        const t = n[h], exp = !!t.children;
        n[h] = { ...t, children: exp ? undefined : t._children, _children: exp ? t.children : undefined };
    } else n[h] = toggleNodeByIndexPath(n[h], r);
    return { ...node, children: node.children ? n : undefined, _children: node._children ? n : undefined };
}

function toTreeNode(data: KroneDecompRow): TreeNode {
    let i = 0, line = 1;
    const ents: TreeNode[] = [];
    const { entity_nodes_for_logkeys: e, action_nodes_for_logkeys: a, status_nodes_for_logkeys: s, seq } = data;
    while (i < e.length) {
        const en = e[i], acts: TreeNode[] = [];
        let j = i;
        while (j < e.length && e[j] === en) {
            const an = a[j], stats: TreeNode[] = [];
            let k = j;
            while (k < e.length && e[k] === en && a[k] === an) {
                stats.push({ name: `${s[k]} (${seq[k]})`, lineNumber: line++ });
                k++;
            }
            acts.push({ name: an, children: stats });
            j = k;
        }
        ents.push({ name: en, children: acts });
        i = j;
    }
    return { name: "Root", children: ents };
}

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

function annotateAnomalies(tree: TreeNode, decomp: KroneDecompRow, detect: KroneDetectRow[]) {
    const anomalies = detect.filter(d => d.seq_id === decomp.seq_id);
    for (const anomaly of anomalies) {
        const seg = anomaly.anomaly_seg, lvl = anomaly.anomaly_level, reason = anomaly.anomaly_reason;
        if (!seg?.length) continue;
        if (lvl === "status") {
            tree.children?.forEach(ent =>
                ent.children?.forEach(act =>
                    act.children?.forEach(stat => {
                        if (seg.includes(stat.name.split('(')[1]?.replace(')', '') || "")) {
                            stat.isAnomaly = true; stat.anomalyReason = reason;
                            act.isAnomaly = true; act.anomalyReason = reason;
                            ent.isAnomaly = true; ent.anomalyReason = reason;
                        }
                    })
                )
            );
        } else if (lvl === "action" || lvl === "entity") {
            const allStats: TreeNode[] = [];
            tree.children?.forEach(ent =>
                ent.children?.forEach(act =>
                    act.children?.forEach(stat => allStats.push(stat))
                )
            );
            for (let i = 0; i <= allStats.length - seg.length; i++) {
                if (seg.every((v, j) => allStats[i + j].name.split('(')[1]?.replace(')', '') === v)) {
                    for (let j = 0; j < seg.length; j++) {
                        allStats[i + j].isAnomaly = true;
                        allStats[i + j].anomalyReason = reason;
                    }
                }
            }
            tree.children?.forEach(ent => {
                let entAnom = false;
                ent.children?.forEach(act => {
                    let actAnom = false;
                    act.children?.forEach(stat => { if (stat.isAnomaly) actAnom = true; });
                    if (actAnom) { act.isAnomaly = true; act.anomalyReason = reason; entAnom = true; }
                });
                if (entAnom) { ent.isAnomaly = true; ent.anomalyReason = reason; }
            });
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
            const treeNode = toTreeNode(decomp);
            annotateAnomalies(treeNode, decomp, kroneDetectData);
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entitiesCollapsed, actionsCollapsed]);

    useEffect(() => {
        if (!treeData || !svgRef.current) return;
        addIndexPath(treeData);
        const root = hierarchy<TreeNode>(treeData, d => d.children);
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

        const dy = Math.max(widestEntity + 20, widestAction + 40);
        tree<TreeNode>().nodeSize([siblingSpacing + 4, dy]).separation((a, b) => (Math.max(getFontSize(a.depth), getFontSize(b.depth)) + 8) / depthSpacing)(root);

        const statusDy = 150;
        root.each(node => { if (node.depth === 3 && node.parent && typeof node.parent.y === "number") node.y = node.parent.y + statusDy; });

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
            .attr("d", (d: HierarchyLink<TreeNode>) => {
                const gap = 18, sourceY = d.source.y ?? 0, sourceStubY = sourceY + gap;
                return [`M${sourceY},${d.source.x}`, `H${sourceStubY}`, `V${d.target.x}`, `H${d.target.y}`].join(" ");
            })
            .attr("stroke", linkBorderColor);

        const node = svg.append("g")
            .attr("stroke-linejoin", "round")
            .attr("stroke-width", 2)
            .selectAll("g")
            .data(root.descendants())
            .join("g")
            .attr("transform", d => `translate(${d.y},${d.x})`);

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

            svg.selectAll<SVGTextElement, HierarchyNode<TreeNode>>("text")
                .each(function(n) {
                    const isRelated = ancestorNodes.has(n) || descendantNodes.has(n);
                    select(this)
                        .attr("fill", isRelated ? "#003366" : (n.data.isAnomaly ? "#c8102e" : "#222"));
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

        function unhighlightText(this: SVGTextElement) {
            svg.selectAll<SVGTextElement, HierarchyNode<TreeNode>>("text")
                .each(function(n) {
                    select(this)
                        .attr("fill", n.data.isAnomaly ? "#c8102e" : "#222");
                    select(this.parentNode as Element).select("rect")
                        .attr("fill", linkFillColor({ source: { depth: n.depth - 1 } }))
                        .attr("stroke-width", 2);
                });
            svg.selectAll<SVGPathElement, HierarchyLink<TreeNode>>("path")
                .attr("stroke", linkBorderColor)
                .attr("stroke-width", 1.5);
        }

        node.append("text")
            .attr("class", "node-label")
            .attr("dy", "0.31em")
            .attr("x", d => {
                const fontSize = getFontSize(d.depth);
                return (d.children || d.data._children ? -fontSize * 0.2 : fontSize * 0.2);
            })
            .attr("text-anchor", d => (d.children || d.data._children ? "end" : "start"))
            .text(d => d.data.name)
            .attr("fill", d => d.data.isAnomaly ? "#c8102e" : "#222")
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
                            .attr("fill", d.data.isAnomaly ? "#c8102e" : "#444")
                            .attr("text-anchor", "start")
                            .on("mouseover", function (event) {
                                if (d.data.isAnomaly && d.data.anomalyReason) setHoveredAnomaly({ explanation: d.data.anomalyReason, x: event.clientX, y: event.clientY });
                            })
                            .on("mouseout", function () { setHoveredAnomaly(null); })
                            .text(linePrefix + logTemplate);
                    }
                }
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
            </div>
        </div>
    );
};