import { Footer } from "@/components/footer";
import Papa from "papaparse";
import { useEffect, useState } from "react";
import { KnowledgeBaseSideBar } from "@/components/KnowledgeBaseSideBar";
import { VizTree } from "@/components/viz_tree_components/viz_tree/viz_tree";
import { buildTree } from "@/tree_utils";
import type { TreeNode } from "@/tree_utils";
import { SmallViewportWarning } from "@/components/smallViewportWarning";

//CONSTANTS
const KNOWLEDGE_BASE_DESC = "Explore the knowledge base by interacting with the visualization below. Click on a node to query its child sequences."
const ROOT_QUERY = "Root";

//TYPES
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

function useQuery() {
  return new URLSearchParams(window.location.search);
}

// --parseListField-- Parse individual string and return it as list
function parseListField(field: string): string[] {
    if (!field || field.trim() === "") return [];
    return field.split(",").map((s) => s.trim()).filter(Boolean);
}

// -- parseEmbeddingField function -- Parses embedding field of csv file and returns them as array of number 
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

// -- buildKnowledgeStructures function -- Takes array of CSVRow's and constructs an Entity Dictionary which takes an
// entity query and returns the list of sequence children, an actionDict that does the same for actions, and a list
// of allSequences and entitySequences
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

// -- parseKnowledgeCSV Function -- Parses knowledge base csv and returns callback with build knowledge structures
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

//Cosine Similarity Calculation Function
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

// Exact search, matches log key sequence to query
export function exactSearch(sequences: Seq[], targetLogkeySeq: string[]): Seq[] {
    return sequences.filter(seq =>
        seq.logkey_seq.length === targetLogkeySeq.length &&
        seq.logkey_seq.every((key, index) => key === targetLogkeySeq[index])
    );
}

// Full Knowlege Base Visualization Component - Includes tree and navbar
export const KnowledgeBaseViz = () => {

    /* -- STATES -- */
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
    const [selectedQuery, setSelectedQuery] = useState<string | null>(null);
    const [searchLogKey, setSearchLogKey] = useState<string>("");

    /* -- LOCAL FUNCTIONS -- */
    const toggleSidebar = () => {
        if (showSidebar) {
            setSearchLogKey("");
            window.history.replaceState({}, document.title, window.location.pathname);
        }
        setShowSidebar(!showSidebar);

    };

    // When a node is clicked it query's the selected node and displays sidebar with that nodes children sequences
    const handleNodeClick = (node: { data: TreeNode }) => {
        if (node.data?.name) {
            setSelectedQuery(node.data.name);
            setShowSidebar(true);
            setSearchLogKey("");
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    };

    const query = useQuery();
    const logkeysParam = query.get("logkeys");
    const tabParam = query.get("tab");
    const [defaultTab, setDefaultTab] = useState<"train" | "test" | "approx">("train");

    useEffect(() => {
        if (logkeysParam && !showSidebar) {
            toggleSidebar();
        }
        if (tabParam) {
            setDefaultTab(tabParam as "train" | "test" | "approx");
        }
        if (logkeysParam) {
            setSearchLogKey(logkeysParam);
        }
    }, [logkeysParam, showSidebar, toggleSidebar]);

    // On component mount fetches the training and testing knowledge and builds their respective knowledge structures
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
            <div className="pt-[4.75rem]"></div>
            <SmallViewportWarning />
            <div className="hidden lg:block">
                {/* HEADER AND TITLE */}
                <div className="text-center my-8">
                    <h1 className="font-WPIfont text-WPIRed text-6xl font-bold">Knowledge Base Visualization</h1>
                    <p className="text-WPIGrey/110 text-lg mt-2">
                        {KNOWLEDGE_BASE_DESC}
                    </p>
                </div>
                
                {/* TREE DISPLAY */}
                <div style={{ width: "100%", margin: "0.5rem auto", display: "flex", justifyContent: "center", alignItems: "center", marginBottom: "2rem" }}>
                    {treeData && (
                        <>
                        <VizTree
                            treeData={treeData}
                            collapseEntities={false}
                            collapseActions={false}
                            collapseStatuses={false}
                            matchedNodeId={null}
                            showAnomalySymbols={false}
                            collapsible={false}
                            disableHoverHighlight={true}
                            onNodeClick={handleNodeClick}
                            clickableNodes={true}
                        />
                        </>
                    )}
                </div>

                {/* SIDEBAR DISPLAY */}
                {knowledgeStructures.trainingData && knowledgeStructures.testingData && (
                    <KnowledgeBaseSideBar
                        showSidebar={showSidebar}
                        toggleSidebar={toggleSidebar}
                        trainingData={knowledgeStructures.trainingData}
                        testingData={knowledgeStructures.testingData}
                        allSequences={knowledgeStructures.allSequences}
                        query={
                            selectedQuery
                                ? selectedQuery === ROOT_QUERY
                                    ? "ROOT"
                                    : selectedQuery
                                : "blk_4"
                        }
                        initialSearchLogKey={searchLogKey}
                        defaultTab={defaultTab}
                        treeData={treeData!}
                    />
                )}
            </div>

            {/* FOOTER */}
            <div className="w-full fixed bottom-0">
                <Footer />
            </div>
        </>
    );
};