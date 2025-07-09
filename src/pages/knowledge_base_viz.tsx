import { Footer } from "@/components/footer";
import Papa from "papaparse";
import { useEffect, useState } from "react";
import { KnowledgeBaseSideBar } from "@/components/KnowledgeBaseSideBar";
import { VizTree } from "@/components/viz_tree";
import { buildTree } from "@/tree_utils";
import type { TreeNode } from "@/tree_utils";

export type KnowledgeBaseData = {
    entityDict: EntityDict;
    actionDict: ActionDict;
    entitySequences: EntitySequences;
};

export type Seq = {
    arr: string[];
    explanation: string;
    seqType: string;
    isAnomaly: boolean;
    logkey_seq: string[];
    embedding: number[];
    path_summary?: string; // Added path_summary field
};

export type EntityDict = Record<string, Seq[]>;
export type ActionDict = Record<string, Seq[]>;
export type EntitySequences = Seq[];

export type CSVRow = {
    path_layer?: string;
    entity_identifier?: string;
    action_identifier?: string;
    status_identifier?: string;
    logkey_seq?: string;
    path_reason?: string;
    pattern_embedding?: string;
    path_summary?: string; // Added path_summary field
    path_pred?: string; // Added path_pred field for isAnomaly
};

function parseListField(field: string): string[] {
    if (!field || field.trim() === "") return [];
    return field.split(",").map((s) => s.trim()).filter(Boolean);
}

function parseEmbeddingField(field: string): number[] {
    if (!field || field.trim() === "") return [];

    try {
        const parsed = JSON.parse(field);

        // Flatten in case it's [[...]] instead of [...]
        if (Array.isArray(parsed) && Array.isArray(parsed[0])) {
            return parsed.flat(); // or parsed[0] if it's always one row
        }

        return parsed.map((n: number) => n); // assume flat
    } catch {
        console.error("Failed to parse embedding field:", field);
        return [];
    }
}


function buildKnowledgeStructures(rows: CSVRow[]): {
    entityDict: EntityDict;
    actionDict: ActionDict;
    entitySequences: EntitySequences;
    allSequences: Seq[];
} {
    const entityDict: EntityDict = {};
    const actionDict: ActionDict = {};
    const entitySequences: EntitySequences = [];
    const allSequences: Seq[] = [];

    for (const row of rows) {
        const path_layer = row.path_layer?.trim().toUpperCase();
        const entity_id = row.entity_identifier?.trim();
        const action_id = row.action_identifier?.trim();
        const status_id = row.status_identifier?.trim();
        const logkey_seq = parseListField(row.logkey_seq || "");
        const explanation = row.path_reason || "";
        const seqType = path_layer || "";

        // Parse path_pred column as isAnomaly
        const isAnomaly = row.path_pred !== undefined ? row.path_pred === "1" : false;

        //Find embedding from test_embedding_all_csv
        const embedding = parseEmbeddingField(row.pattern_embedding || "");

        const path_summary = row.path_summary || ""; // Extract path_summary

        const seq: Seq = { arr: [], explanation, seqType, isAnomaly, logkey_seq, embedding, path_summary };

        if (path_layer === "STATUS") {
            const statusSeq = parseListField(status_id || "");
            seq.arr = statusSeq;
            allSequences.push(seq);
            if (action_id) {
                if (!actionDict[action_id]) actionDict[action_id] = [];
                actionDict[action_id].push(seq);
            }
        } else if (path_layer === "ACTION") {
            const actionSeq = parseListField(action_id || "");
            seq.arr = actionSeq;
            allSequences.push(seq);
            if (entity_id) {
                if (!entityDict[entity_id]) entityDict[entity_id] = [];
                entityDict[entity_id].push(seq);
            }
        } else if (path_layer === "ENTITY") {
            const entitySeq = parseListField(entity_id || "");
            seq.arr = entitySeq;
            entitySequences.push(seq);
            allSequences.push(seq);
        }
    }

    return { entityDict, actionDict, entitySequences, allSequences };
}

function parseKnowledgeCSV(
    csvText: string,
    callback: (structures: { entityDict: EntityDict; actionDict: ActionDict; entitySequences: EntitySequences; allSequences: Seq[] }) => void
) {
    Papa.parse<CSVRow>(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
            try {
                const structures = buildKnowledgeStructures(results.data);
                callback(structures);
            } catch (error) {
                console.error("Error building knowledge structures:", error);
            }
        },
    });
}

//Cosine Similarity calculation function
function cosineSimilarity(a: number[], b: number[]): number {
    const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dot / (normA * normB);
}

// Approximate search for top k closest sequences using cosine similarity
export function approximateSearch(sequences: Seq[], targetEmbedding: number[], k: number): { sequence: Seq, similarity: number }[] {
    if (targetEmbedding.length === 0) {
        console.error("Target embedding is empty. Approximate search cannot proceed.");
        return [];
    }

    const similarities = sequences.map(seq => {
        if (seq.embedding.length !== targetEmbedding.length) {
            console.error("Embedding dimensionality mismatch.");
            console.log(targetEmbedding);
            console.log(seq.embedding);
            console.log(targetEmbedding.length);
            console.log(seq.embedding.length);
            return { sequence: seq, similarity: NaN };
        }
        return {
            sequence: seq,
            similarity: cosineSimilarity(seq.embedding, targetEmbedding),
        };
    });

    // Filter out invalid results (e.g., NaN similarities)
    const validSimilarities = similarities.filter(item => !isNaN(item.similarity));

    // Sort by similarity descending
    validSimilarities.sort((a, b) => b.similarity - a.similarity);

    // Return top k closest sequences
    return validSimilarities.slice(0, k);
}

// Exact search for sequences with a matching logkey_seq
export function exactSearch(sequences: Seq[], targetLogkeySeq: string[]): Seq[] {
    return sequences.filter(seq =>
        seq.logkey_seq.length === targetLogkeySeq.length &&
        seq.logkey_seq.every((key, index) => key === targetLogkeySeq[index])
    );
}

export const KnowledgeBaseViz = () => {
    const [knowledgeStructures, setKnowledgeStructures] = useState<{
        trainingData: KnowledgeBaseData | null;
        testingData: KnowledgeBaseData | null;
        allSequences: Seq[];
    }>({
        trainingData: null,
        testingData: null,
        allSequences: [],
    });

    const [showSidebar, setShowSidebar] = useState(false);

    const [treeData, setTreeData] = useState<TreeNode | null>(null);
    const [hoveredNode, setHoveredNode] = useState<any>(null);

    const [selectedQuery, setSelectedQuery] = useState<string | null>(null);

    const toggleSidebar = () => {
        setShowSidebar(!showSidebar);
    };

    const handleNodeClick = (node: any) => {
        if (node.data?.name) {
            setSelectedQuery(node.data.name);
            setShowSidebar(true);
        }
    };

    useEffect(() => {
        Promise.all([
            fetch("/train_knowledge_all.csv").then(res => res.text()),
            fetch("/test_knowledge_all_fixed.csv").then(res => res.text()),
        ])
            .then(([trainCSV, testCSV]) => {
                let trainStructures: ReturnType<typeof buildKnowledgeStructures>;
                let testStructures: ReturnType<typeof buildKnowledgeStructures>;

                parseKnowledgeCSV(trainCSV, (train) => {
                    trainStructures = train;
                    parseKnowledgeCSV(testCSV, (test) => {
                        testStructures = test;

                        // Build training and testing data
                        const trainingData = {
                            entityDict: trainStructures.entityDict,
                            actionDict: trainStructures.actionDict,
                            entitySequences: trainStructures.entitySequences,
                        };

                        const testingData = {
                            entityDict: testStructures.entityDict,
                            actionDict: testStructures.actionDict,
                            entitySequences: testStructures.entitySequences,
                        };

                        // Combine both sets of sequences
                        const allSequences = [
                            ...trainStructures.allSequences,
                            ...testStructures.allSequences,
                        ];

                        // Set all knowledge structures in one go
                        setKnowledgeStructures({
                            trainingData,
                            testingData,
                            allSequences,
                        });
                    });
                });
            })
            .catch((error) => console.error("Error loading CSV files:", error));
    }, []);

    useEffect(() => {
        fetch("/Krone_Tree.csv")
            .then(res => res.text())
            .then(csvText => {
                setTreeData(buildTree(Papa.parse(csvText, { header: true }).data as CSVRow[]));
            });
    }, []);

    return (
        <>
            <div className="pt-[4.5rem]"></div>
            <button onClick={toggleSidebar} className="bg-WPIRed text-white px-4 py-2 rounded">
                Toggle Sidebar
            </button>
            <div style={{ width: "100%", margin: "2rem auto", display: "flex", justifyContent: "center", alignItems: "center" }}>
                {treeData && (
                    <VizTree
                        treeData={treeData}
                        collapseEntities={false}
                        collapseActions={false}
                        collapseStatuses={false}
                        matchedNodeId={null}
                        setHoveredNode={setHoveredNode}
                        showAnomalySymbols={false}
                        collapsible={false}
                        disableHoverHighlight={true}
                        onNodeClick={handleNodeClick}
                        clickableNodes={true}
                    />
                )}
            </div>
            {knowledgeStructures.trainingData && knowledgeStructures.testingData && (
                <KnowledgeBaseSideBar
                    showSidebar={showSidebar}
                    toggleSidebar={toggleSidebar}
                    trainingData={knowledgeStructures.trainingData}
                    testingData={knowledgeStructures.testingData}
                    allSequences={knowledgeStructures.allSequences}
                    query={
                        selectedQuery
                            ? selectedQuery === "Root"
                                ? "ROOT"
                                : selectedQuery
                            : "blk_4"
                    }
                />
            )}
            <h1>Knowledge Base Visualization</h1>
            <Footer />
        </>
    );
};