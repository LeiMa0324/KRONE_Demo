import React, { useState, useEffect } from "react";
import { X, ChevronDown, Search } from "lucide-react";
import type { EntityDict, ActionDict, EntitySequences, Seq } from "@/pages/knowledge_base_viz";
import { exactSearch, approximateSearch } from "@/pages/knowledge_base_viz";

type SequenceUnitDisplayProps = {
    seq: Seq;
    allSequences: Seq[];
    handleApproximateSearch: (sequences: Seq[], embedding: number[], k: number) => void;
};

function SequenceUnitDisplay({ seq, allSequences, handleApproximateSearch }: SequenceUnitDisplayProps) {
    const [isAnomalyChecked, setIsAnomalyChecked] = useState<boolean>(seq.isAnomaly === true);
    const [isGTChecked, setIsGTChecked] = useState<boolean>(seq.explanation === "GT");
    const [k, setK] = useState<number>(5);
    const [userSelection, setUserSelection] = useState<string | null>(null);

    useEffect(() => {
        setIsAnomalyChecked(seq.isAnomaly === true);
        setIsGTChecked(seq.explanation === "GT");
    }, [seq.isAnomaly, seq.explanation]);

    const getFinalPrediction = (): string => {
        if (userSelection === "Abnormal") return "Abnormal";
        if (userSelection === "Normal") return "Normal";
        return isAnomalyChecked ? "Abnormal" : "Normal";
    };

    return (
        <div className={`flex flex-col ${getFinalPrediction() == "Abnormal" ? "bg-WPIRed/15" : "bg-neutral-100"} p-4 mb-4 rounded-lg shadow-md border border-neutral-300`}>
            <h1 className="font-WPIfont font-bold mb-1.5">{`${seq.seqType} ${getFinalPrediction() == "Abnormal" ? "Anomaly" : ""} Sequence`}</h1>
            <div className="flex">
                <div className="flex flex-col mb-4 flex-1">
                    {seq.arr.map((element, index) => (
                        <div key={index} className="flex flex-col items-center">
                            <span className={`text-neutral-800 p-1 font-medium rounded-sm border-2 w-7/10 break-words whitespace-normal ${
                                seq.seqType === "STATUS" ? "bg-WPIGrey/45 border-WPIGrey" :
                                seq.seqType === "ACTION" ? "bg-WPIGold/45 border-WPIGold" : "bg-WPIRed/45 border-WPIRed"}`}>{element}</span>
                            {index < seq.arr.length - 1 && <ChevronDown className="text-neutral-500" />}
                        </div>
                    ))}
                </div>
                <p className="text-neutral-600 flex-1 italic self-center justify-self-center">
                    {seq.path_summary || "No summary available"}
                </p>
            </div>
            <table className="table-auto w-full border-collapse border border-neutral-300 bg-neutral-100">
                <thead>
                    <tr>
                        <th className="border border-neutral-300 px-4 py-2 bg-neutral-200 font-semibold">Source</th>
                        <th className="border border-neutral-300 px-4 py-2 bg-neutral-200 font-semibold">Prediction</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td className="border px-4 py-2">LLM</td><td className="border px-4 py-2">{isAnomalyChecked ? "Abnormal" : !isGTChecked ? "Normal" : "---"}</td></tr>
                    <tr><td className="border px-4 py-2">Pattern Miner</td><td className="border px-4 py-2">{isGTChecked ? "Normal" : "---"}</td></tr>
                    <tr>
                        <td className="border px-4 py-2">Human</td>
                        <td className="border px-4 py-2">
                            <select
                                className="w-full p-2 bg-neutral-200 border border-neutral-300 rounded-md"
                                defaultValue=""
                                onChange={(e) => setUserSelection(e.target.value)}
                            >
                                <option value="" disabled hidden>Select...</option>
                                <option value="Abnormal">Abnormal</option>
                                <option value="Normal">Normal</option>
                            </select>
                        </td>
                    </tr>
                    <tr><td colSpan={2} className="bg-black h-1"></td></tr>
                    <tr><td className="border px-4 py-2 font-bold">Final Prediction:</td><td className="border px-4 py-2">{getFinalPrediction()}</td></tr>
                    {isGTChecked && <tr><td className="border px-4 py-2 font-bold">Ground Truth:</td><td className="border px-4 py-2"> Normal </td></tr>}
                </tbody>
            </table>
            {seq.explanation && <><h1 className="font-WPIfont font-bold">Final Prediction Explanation</h1><p>{seq.explanation}</p></>}
            <div className="flex flex-col items-center justify-center space-y-4 text-xl font-serif mt-2">
                <div className="flex items-center space-x-4">
                    <span className="font-bold">Find</span>
                    <input
                        type="number"
                        value={k === 0 ? "" : k}
                        onChange={(e) => setK(Number(e.target.value) || 0)}
                        className="w-10 h-10 text-center font-bold bg-neutral-200 rounded-full focus:ring-2 focus:ring-neutral-400"
                        min="1" max="999"
                    />
                    <span className="font-bold">most similar</span>
                    <button
                        onClick={() => handleApproximateSearch(allSequences, seq.embedding, k)}
                        className="hover:scale-110 transition-transform"
                    >
                        <Search className="w-6 h-6 text-neutral-500 hover:text-black" />
                    </button>
                </div>
            </div>
        </div>
    );
}

type SequenceScrollableProps = {
    sequences: Seq[];
    allSequences: Seq[];
    setCurrentDisplay: (sequences: Seq[]) => void;
    handleApproximateSearch: (sequences: Seq[], embedding: number[], k: number) => void;
};

function SequenceScrollable({ sequences, allSequences, handleApproximateSearch }: SequenceScrollableProps) {
    if (!sequences || sequences.length === 0) {
        return (
            <div className="flex justify-center h-full p-4">
                <span className="italic text-neutral-500">No Sequences</span>
            </div>
        );
    }
    return (
        <div className="overflow-y-auto h-[calc(100vh-200px)] p-4">
            {sequences.slice(0, 1000).map((element, index) => (
                <div key={index} className="scroll-mt-4">
                    <SequenceUnitDisplay
                        seq={element}
                        allSequences={allSequences}
                        handleApproximateSearch={handleApproximateSearch}
                    />
                </div>
            ))}
        </div>
    );
}

type KnowledgeBaseSideBarProps = {
    showSidebar: boolean;
    toggleSidebar: () => void;
    trainingData: { entityDict: EntityDict; actionDict: ActionDict; entitySequences: EntitySequences };
    testingData: { entityDict: EntityDict; actionDict: ActionDict; entitySequences: EntitySequences };
    allSequences: Seq[];
    query: string;
};

export const KnowledgeBaseSideBar: React.FC<KnowledgeBaseSideBarProps> = ({
    showSidebar,
    toggleSidebar,
    trainingData,
    testingData,
    allSequences,
    query,
}) => {
    const [selectedTab, setSelectedTab] = useState<"train" | "test" | "approx">("train");
    const [searchLogKey, setSearchLogKey] = useState<string>("");
    const [currentTrainingDisplay, setCurrentTrainingDisplay] = useState<Seq[]>([]);
    const [currentTestingDisplay, setCurrentTestingDisplay] = useState<Seq[]>([]);
    const [approxDisplay, setApproxDisplay] = useState<Seq[]>([]);

    useEffect(() => {
        const getSeq = (data: { entityDict: EntityDict; actionDict: ActionDict; entitySequences: EntitySequences }) => {
            const { entityDict, actionDict, entitySequences } = data;
            if (query === "ROOT") return entitySequences;
            if (entityDict[query]) return entityDict[query];
            if (actionDict[query]) return actionDict[query];
            return [];
        };
        setCurrentTrainingDisplay(getSeq(trainingData));
        setCurrentTestingDisplay(getSeq(testingData));
    }, [trainingData, testingData, query]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchLogKey.trim()) {
            const getSeq = (data: { entityDict: EntityDict; actionDict: ActionDict; entitySequences: EntitySequences }) => {
                const { entityDict, actionDict, entitySequences } = data;
                if (query === "ROOT") return entitySequences;
                if (entityDict[query]) return entityDict[query];
                if (actionDict[query]) return actionDict[query];
                return [];
            };
            if (selectedTab === "train") {
                setCurrentTrainingDisplay(getSeq(trainingData));
            } else {
                setCurrentTestingDisplay(getSeq(testingData));
            }
        } else {
            const keys = searchLogKey.split(",").map((k) => k.trim());
            const results = exactSearch(allSequences, keys);
            if (selectedTab === "train") {
                setCurrentTrainingDisplay(results);
            } else {
                setCurrentTestingDisplay(results);
            }
        }
    };

    const handleApproximateSearch = (sequences: Seq[], embedding: number[], k: number) => {
        if (!embedding || embedding.length === 0) {
            console.error("Invalid embedding for approximate search.");
            return;
        }
        const results = approximateSearch(sequences, embedding, k);
        setApproxDisplay(results.map((r) => r.sequence));
        setSelectedTab("approx");
    };

    if (!showSidebar) return null;

    return (
        <div className="fixed top-0 right-0 h-full w-2/5 bg-white border-l-8 border-l-WPIGrey text-black shadow-lg z-50 animate-slide-in-right-fast">
            <div className="p-4 flex justify-between items-center">
                <h2 className="text-xl font-bold font-WPIfont">Knowledge Base Sequences</h2>
                <button onClick={toggleSidebar} className="text-neutral-400 hover:text-black hover:scale-110">
                    <X />
                </button>
            </div>
            <div className="flex justify-center items-center">
                {["train", "test", "approx"].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setSelectedTab(tab as "train" | "test" | "approx")}
                        className={`text-black px-4 py-2 w-full hover:bg-neutral-300 ${selectedTab === tab ? "bg-WPIGrey/45 underline" : "bg-white"}`}
                    >
                        {tab === "train" ? "Training Data" : tab === "test" ? "Testing Data" : "Approx-Search"}
                    </button>
                ))}
            </div>
            <form className="p-4 flex items-center justify-center" onSubmit={handleSearchSubmit}>
                <div className="relative w-full">
                    <input
                        type="text"
                        placeholder="Search logkey..."
                        value={searchLogKey}
                        onChange={(e) => setSearchLogKey(e.target.value)}
                        className="w-full p-2 pr-10 bg-white border-4 border-WPIGrey rounded-md placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-500"
                    />
                    <button type="submit" className="absolute top-1/2 right-3 transform -translate-y-1/2">
                        <Search className="w-6 h-6 text-neutral-400 hover:text-black hover:scale-110" />
                    </button>
                </div>
            </form>
            {selectedTab === "train" && (
                <SequenceScrollable
                    sequences={currentTrainingDisplay}
                    allSequences={currentTrainingDisplay}
                    setCurrentDisplay={setCurrentTrainingDisplay}
                    handleApproximateSearch={handleApproximateSearch}
                />
            )}
            {selectedTab === "test" && (
                <SequenceScrollable
                    sequences={currentTestingDisplay}
                    allSequences={currentTestingDisplay}
                    setCurrentDisplay={setCurrentTestingDisplay}
                    handleApproximateSearch={handleApproximateSearch}
                />
            )}
            {selectedTab === "approx" && (approxDisplay.length >= 1 ?
                <SequenceScrollable
                    sequences={approxDisplay}
                    allSequences={allSequences}
                    setCurrentDisplay={() => {}}
                    handleApproximateSearch={handleApproximateSearch}
                /> :
                <h1 className="font-WPIfont border-WPIGrey border-2"> No Display Currently Available </h1>
            )}
        </div>
    );
};
