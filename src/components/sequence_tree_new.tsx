import React, { useEffect, useState } from "react";
import Papa from "papaparse";
import { UnifiedTree } from "./unified_tree";
import type { KroneDecompRow, KroneDetectRow } from "@/pages/visualize_table";
import type { UnifiedTreeNode } from "./unified_tree";
import type { HierarchyNode } from "d3-hierarchy";

// Utility: Convert KroneDecompRow + KroneDetectRow[] to UnifiedTreeNode (copied/adapted from sequence_tree.tsx)
function arraysEqual<T>(a: T[], b: T[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

function toUnifiedTreeNode(
    data: KroneDecompRow,
    anomalies: KroneDetectRow[]
): UnifiedTreeNode {
    const entities: UnifiedTreeNode[] = [];
    const { entity_nodes_for_logkeys: e, action_nodes_for_logkeys: a, status_nodes_for_logkeys: s, seq } = data;

    for (let i = 0; i < e.length; i++) {
        const statuses: UnifiedTreeNode[] = [];
        statuses.push({
            name: `${s[i]} (${seq[i]})`,
            lineNumber: i,
            event_id: seq[i],
        });
        const actions: UnifiedTreeNode[] = [{
            name: a[i],
            children: statuses,
        }];
        entities.push({
            name: e[i],
            children: actions,
        });
    }

    let hasAnomalies = false;
    let foundAnomaly: KroneDetectRow | null = null;
    anomalies.forEach(anomaly => {
        if (anomaly.seq_id === data.seq_id) {
            hasAnomalies = true;
            foundAnomaly = anomaly;
        }
    });

    if (hasAnomalies && foundAnomaly) {
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

    // Merge consecutive entities/actions with same name (as in sequence_tree.tsx)
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
    function propagateRelatedToAnomaly(node: UnifiedTreeNode) {
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

type SequenceTreeNewProps = {
    kroneDecompData: KroneDecompRow[];
    kroneDetectData: KroneDetectRow[];
    setHoveredNode?: (node: HierarchyNode<UnifiedTreeNode> | null) => void;
};

export const SequenceTreeNew: React.FC<SequenceTreeNewProps> = ({
    kroneDecompData,
    kroneDetectData,
    setHoveredNode
}) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [treeData, setTreeData] = useState<UnifiedTreeNode | null>(null);
    const [eventIdToLogTemplate, setEventIdToLogTemplate] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [entitiesCollapsed, setEntitiesCollapsed] = useState(true);
    const [actionsCollapsed, setActionsCollapsed] = useState(false);
    const [multiLineAnomaly, setMultiLineAnomaly] = useState(false);
    const [anomalyLevelMulti, setAnomalyLevelMulti] = useState("Normal");

    // Load log template mapping
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

    // Build tree data on selection or collapse state change
    useEffect(() => {
        if (kroneDecompData.length && selectedIndex >= 0 && selectedIndex < kroneDecompData.length) {
            setLoading(true);
            const decomp = kroneDecompData[selectedIndex];
            const treeNode = toUnifiedTreeNode(decomp, kroneDetectData);
            const anomalyRow = kroneDetectData.find(row => row.seq_id === decomp.seq_id);
            if (anomalyRow && anomalyRow.anomaly_seg.length > 1) {
                setMultiLineAnomaly(true);
                setAnomalyLevelMulti(anomalyRow.anomaly_level || "Normal");
            } else {
                setMultiLineAnomaly(false);
            }
            setTreeData(treeNode);
            setLoading(false);
        }
    }, [kroneDecompData, kroneDetectData, selectedIndex, actionsCollapsed, entitiesCollapsed]);

    // Collapse/expand all entities or actions by toggling their collapsed property
    // (Handled inside UnifiedTree via props)

    // Get anomaly level label for display
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
                {/* ...controls... */}
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                    <label htmlFor="seq-select" style={{ fontWeight: 500 }}>Select Sequence:</label>
                    <select
                        id="seq-select"
                        value={selectedIndex}
                        onChange={e => setSelectedIndex(Number(e.target.value))}
                        style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid #ccc" }}
                    >
                        {kroneDecompData.map((row, idx) => (
                            <option key={row.seq_id} value={idx}>
                                Sequence {row.seq_id}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={() => setEntitiesCollapsed(e => !e)}
                        style={{
                            padding: "4px 12px",
                            borderRadius: 4,
                            border: "1px solid #ccc",
                            background: entitiesCollapsed ? "#eee" : "#fff",
                            fontWeight: 500
                        }}
                    >
                        {entitiesCollapsed ? "Expand Entities" : "Collapse Entities"}
                    </button>
                    <button
                        onClick={() => setActionsCollapsed(a => !a)}
                        style={{
                            padding: "4px 12px",
                            borderRadius: 4,
                            border: "1px solid #ccc",
                            background: actionsCollapsed ? "#eee" : "#fff",
                            fontWeight: 500
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
                        
                        <UnifiedTree
                            treeData={treeData}
                            eventIdToLogTemplate={eventIdToLogTemplate}
                            loading={loading}
                            entitiesCollapsed={entitiesCollapsed}
                            actionsCollapsed={actionsCollapsed}
                            multiLineAnomaly={multiLineAnomaly}
                            anomalyLevelMulti={anomalyLevelMulti}
                            kroneDetectData={kroneDetectData}
                            selectedSeqId={selectedSeqId}
                            treeType="sequence"
                            setHoveredNode={setHoveredNode}
                        />
                    </>
                )}
            </div>
        </div>
    );
};