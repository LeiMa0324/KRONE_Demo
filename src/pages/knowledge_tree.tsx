import React, { useEffect, useState } from "react";
import Papa from "papaparse";

export type Seq = {
    arr: string[];
    explanation: string;
    seqType: string;
    isAnomaly: boolean;
    logkey_seq: string[];
};

export type EntityDict = Record<string, Seq[]>;
export type ActionDict = Record<string, Seq[]>;
export type EntitySequences = Seq[];

function parseListField(field: string): string[] {
    if (!field || field.trim() === "") return [];
    return field.split(",").map(s => s.trim()).filter(Boolean);
}

export function buildKnowledgeStructures(rows: any[]): {
    entityDict: EntityDict;
    actionDict: ActionDict;
    entitySequences: EntitySequences;
} {
    const entityDict: EntityDict = {};
    const actionDict: ActionDict = {};
    const entitySequences: EntitySequences = [];

    for (const row of rows) {
        const path_layer = row["path_layer"]?.trim().toUpperCase();
        const entity_id = row["entity_identifier"]?.trim();
        const action_id = row["action_identifier"]?.trim();
        const status_id = row["status_identifier"]?.trim();
        const logkey_seq = parseListField(row["logkey_seq"] || "");
        const explanation = row["path_reason"] || "";
        const seqType = path_layer || "";
        const isAnomaly = false;

        if (path_layer === "STATUS") {
            const statusSeq = parseListField(status_id || "");
            const seq: Seq = { arr: statusSeq, explanation, seqType, isAnomaly, logkey_seq };
            if (action_id) {
                if (!actionDict[action_id]) actionDict[action_id] = [];
                actionDict[action_id].push(seq);
            }
        } else if (path_layer === "ACTION") {
            const actionSeq = parseListField(action_id || "");
            const seq: Seq = { arr: actionSeq, explanation, seqType, isAnomaly, logkey_seq };
            if (entity_id) {
                if (!entityDict[entity_id]) entityDict[entity_id] = [];
                entityDict[entity_id].push(seq);
            }
        } else if (path_layer === "ENTITY") {
            const entitySeq = parseListField(entity_id || "");
            const seq: Seq = { arr: entitySeq, explanation, seqType, isAnomaly, logkey_seq };
            entitySequences.push(seq);
        }
    }

    return { entityDict, actionDict, entitySequences };
}

export function parseKnowledgeCSV(
    csvText: string,
    callback: (structures: { entityDict: EntityDict; actionDict: ActionDict; entitySequences: EntitySequences }) => void
) {
    Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
            const structures = buildKnowledgeStructures(results.data as any[]);
            callback(structures);
        },
    });
}

export const KnowledgeTree = () => {
    
}
