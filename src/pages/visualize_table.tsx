import { useEffect, useState } from "react";
import Papa from "papaparse";
import { Footer } from "@/components/footer";
//import { SequenceTreeNew } from "@/components/sequence_tree_new";
import { SequenceTree } from "@/components/sequence_tree";
import { TreeInfoPanel } from "@/components/tree_info_panel";
import type { HierarchyNode } from "d3-hierarchy";
import type { TreeNode } from "@/tree_utils";


// Data type for visualizing new tree
export type KroneDecompRow = {
    seq_id: string;
    seq: string[];
    entity_nodes_for_logkeys: string[];
    action_nodes_for_logkeys: string[];
    status_nodes_for_logkeys: string[];
};

export type KroneDetectRow = {
    seq_id: string;
    seq: string[];
    anomaly_seg: string[];
    anomaly_level: "entity" | "action" | "status";
    anomaly_reason: string;
};

// Utility function to parse arrays from CSV strings
const parseArray = (str: string): string[] => {
    if (!str) return [];
    try {
        return str
            .replace(/[[\]'""]/g, "") // Remove brackets and quotes
            .split(",") // Split by commas
            .map((s) => s.trim()) // Trim whitespace
            .filter(Boolean); // Remove empty strings
    } catch {
        return [];
    }
};

// Utility function to fetch and parse Krone Decompose data
const fetchKroneDecompData = async (filePath: string): Promise<KroneDecompRow[]> => {
    const response = await fetch(filePath);
    if (!response.ok) {
        console.error("Failed to fetch Krone Decompose data");
        return [];
    }

    const csvText = await response.text();
    const parsedData: KroneDecompRow[] = [];

    Papa.parse<KroneDecompRow>(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
            const rows: KroneDecompRow[] = results.data.map((row: unknown) => {
                const r = row as Record<string, unknown>;
                return {
                    seq_id: String(r.seq_id ?? ""),
                    seq: parseArray(String(r.seq ?? "")),
                    entity_nodes_for_logkeys: parseArray(String(r.entity_nodes_for_logkeys ?? "")),
                    action_nodes_for_logkeys: parseArray(String(r.action_nodes_for_logkeys ?? "")),
                    status_nodes_for_logkeys: parseArray(String(r.status_nodes_for_logkeys ?? "")),
                };
            });
            parsedData.push(...rows.slice(0,1000));
        },
    });

    return parsedData;
};

// Utility function to fetch and parse Krone Detection data
const fetchKroneDetectData = async (filePath: string): Promise<KroneDetectRow[]> => {
    const response = await fetch(filePath);
    if (!response.ok) {
        console.error("Failed to fetch Krone Detection data");
        return [];
    }

    const csvText = await response.text();
    const parsedData: KroneDetectRow[] = [];

    Papa.parse<KroneDetectRow>(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
            const rows: KroneDetectRow[] = results.data.map((row: unknown) => {
                const r = row as Record<string, unknown>;
                return {
                    seq_id: String(r.seq_id ?? ""),
                    seq: parseArray(String(r.seq ?? "")),
                    anomaly_seg: parseArray(String(r.anomaly_seg ?? "")),
                    anomaly_level: r.anomaly_level as "entity" | "action" | "status",
                    anomaly_reason: String(r.anomaly_reason ?? ""),
                };
            });
            parsedData.push(...rows);
        },
    });

    return parsedData;
};

// Main Component
export const VisualizeTable = () => {
    const [kroneDecompData, setKroneDecompData] = useState<KroneDecompRow[]>([]);
    const [kroneDetectData, setKroneDetectData] = useState<KroneDetectRow[]>([]);
    const [hoveredNode, setHoveredNode] = useState<HierarchyNode<TreeNode> | null>(null);
    const [multiLineAnomaly, setMultiLineAnomaly] = useState(false);


    useEffect(() => {
        fetchKroneDecompData("/krone_decompose_res.csv").then((data) => {
            setKroneDecompData(data);
        });

        fetchKroneDetectData("/krone_detection_res.csv").then((data) => {
            setKroneDetectData(data);
        });
    }, []);

    return (
        <div
            style={{
                minHeight: "100vh",
                height: "100vh",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
            }}
        >
            <div
                style={{
                    flex: "1 1 auto",
                    display: "flex",
                    alignItems: "flex-start",
                    paddingTop: "80px",
                    paddingLeft: "20px",
                    paddingRight: "20px",
                    boxSizing: "border-box",
                    position: "relative", // <-- key for absolute positioning
                    overflow: "hidden",
                }}
            >
                {/* Tree scroll area */}
                <div
                    style={{
                        width: "100%",
                        height: "calc(100% - 24px)",
                        overflowX: "scroll",
                        overflowY: "auto",
                        marginTop: 24,
                        boxSizing: "border-box",
                        position: "relative", // for absolute positioning of info panel
                    }}
                >
                    <div style={{ minWidth: 1600 }}>
                        <SequenceTree
                            kroneDecompData={kroneDecompData}
                            kroneDetectData={kroneDetectData}
                            setHoveredNode={setHoveredNode}
                            setMultiLineAnomaly={setMultiLineAnomaly}
                            multiLineAnomaly={multiLineAnomaly}
                        />
                    </div>
                </div>
                {/* Info panel, absolutely positioned */}
                <div style={{
                    flex: "0 0 25%",
                    width: "25%",
                    minWidth: 180,
                    maxWidth: "30%",
                    height: "100%",
                    overflowY: "auto"
                }}>
                    <TreeInfoPanel node={hoveredNode} multiLineAnomaly={multiLineAnomaly} />
                </div>
            </div>
            <div style={{ flex: "0 0 auto" }}>
                <Footer />
            </div>
        </div>
    );
};