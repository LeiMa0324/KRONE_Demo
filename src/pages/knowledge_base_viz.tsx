import { Footer } from "@/components/footer";
import Papa from "papaparse";
import { useEffect, useState } from "react";

export type Seq = {
    arr: string[];
    explanation: string;
    seqType: string;
    isAnomaly: boolean;
    logkey_seq: string[];
    embedding: number[]; // Added embedding member
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
    pattern_embedding?: string; // Embedding field as a JSON array string
};

function parseListField(field: string): string[] {
    if (!field || field.trim() === "") return [];
    return field.split(",").map(s => s.trim()).filter(Boolean);
}

function parseEmbeddingField(field: string): number[] {
    if (!field || field.trim() === "") return [];
    try {
        return JSON.parse(field).map((n: number) => n);
    } catch {
        return [];
    }
}

function buildKnowledgeStructures(rows: CSVRow[]): {
    entityDict: EntityDict;
    actionDict: ActionDict;
    entitySequences: EntitySequences;
    allSequences: Seq[]; // Added AllSequences
} {
    const entityDict: EntityDict = {};
    const actionDict: ActionDict = {};
    const entitySequences: EntitySequences = [];
    const allSequences: Seq[] = []; // Initialize AllSequences

    for (const row of rows) {
        const path_layer = row.path_layer?.trim().toUpperCase();
        const entity_id = row.entity_identifier?.trim();
        const action_id = row.action_identifier?.trim();
        const status_id = row.status_identifier?.trim();
        const logkey_seq = parseListField(row.logkey_seq || "");
        const explanation = row.path_reason || "";
        const seqType = path_layer || "";
        const isAnomaly = false;
        const embedding = parseEmbeddingField(row.pattern_embedding || ""); // Parse embedding field

        const seq: Seq = { arr: [], explanation, seqType, isAnomaly, logkey_seq, embedding };

        if (path_layer === "STATUS") {
            const statusSeq = parseListField(status_id || "");
            seq.arr = statusSeq;
            allSequences.push(seq); // Add to AllSequences
            if (action_id) {
                if (!actionDict[action_id]) actionDict[action_id] = [];
                actionDict[action_id].push(seq);
            }
        } else if (path_layer === "ACTION") {
            const actionSeq = parseListField(action_id || "");
            seq.arr = actionSeq;
            allSequences.push(seq); // Add to AllSequences
            if (entity_id) {
                if (!entityDict[entity_id]) entityDict[entity_id] = [];
                entityDict[entity_id].push(seq);
            }
        } else if (path_layer === "ENTITY") {
            const entitySeq = parseListField(entity_id || "");
            seq.arr = entitySeq;
            entitySequences.push(seq);
            allSequences.push(seq); // Add to AllSequences
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
            const structures = buildKnowledgeStructures(results.data);
            callback(structures);
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
function approximateSearch(sequences: Seq[], targetEmbedding: number[], k: number): { sequence: Seq, similarity: number }[] {
    const similarities = sequences.map(seq => ({
        sequence: seq,
        similarity: cosineSimilarity(seq.embedding, targetEmbedding),
    }));

    // Sort by similarity descending
    similarities.sort((a, b) => b.similarity - a.similarity);

    // Return top k closest sequences
    return similarities.slice(1, k+1); //ignore the first as it's just the same one
}

// Exact search for sequences with a matching logkey_seq
function exactSearch(sequences: Seq[], targetLogkeySeq: string[]): Seq[] {
    return sequences.filter(seq =>
        seq.logkey_seq.length === targetLogkeySeq.length &&
        seq.logkey_seq.every((key, index) => key === targetLogkeySeq[index])
    );
}

export const KnowledgeBaseViz = () => {
    const [knowledgeStructures, setKnowledgeStructures] = useState<{
        entityDict: EntityDict;
        actionDict: ActionDict;
        entitySequences: EntitySequences;
        allSequences: Seq[];
    } | null>(null);

    useEffect(() => {
        // Load train_knowledge_all.csv
        fetch("/train_knowledge_all.csv")
            .then(response => response.text())
            .then(csvText => {
                parseKnowledgeCSV(csvText, (structures) => {
                    setKnowledgeStructures(structures);
                });
            })
            .catch(error => console.error("Error loading CSV:", error));
    }, []);

    //Example usage of approximateSearch
    useEffect(() => {
        if (knowledgeStructures?.allSequences) {
            const targetEmbedding = knowledgeStructures.allSequences[1].embedding; // Example target embedding
            const topK = approximateSearch(knowledgeStructures.allSequences, targetEmbedding, 5);
            console.log("Target Embedding: ", knowledgeStructures.allSequences[1]);
            console.log("Top 5 closest sequences from AllSequences:", topK);
        }
    }, [knowledgeStructures]);

    return (
        <>
            <h1>Knowledge Base Visualization</h1>
            <Footer />
        </>
    );
};