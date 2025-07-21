import React, { useState, useEffect } from "react";
import { X, ChevronDown, Search, PanelBottomClose } from "lucide-react";
import type { EntityDict, ActionDict, EntitySequences, Seq } from "@/pages/knowledge_base_viz";
import { exactSearch, approximateSearch } from "@/pages/knowledge_base_viz";

// CONSTANTS
const ABNORMAL = "Abnormal";
const NORMAL = "Normal";
const GROUND_TRUTH = "Ground Truth";
const ROOT_QUERY = "ROOT";
const NO_SUMMARY_MESSAGE = "No summary available";
const NO_SEQUENCES_MESSAGE = "No Sequences Available";
const NO_DISPLAY_MSG = "No Display Currently Available (Try Searching Something)";
const FINAL_PREDICTION_HEADER = "Final Prediction:";
const GROUND_TRUTH_HEADER = "Ground Truth:";
const SELECT_PROMPT = "Select...";
const LOGKEY_SEARCH_PLACEHOLDER = "Search logkey...";
const SEQ_TYPE_COLORS: Record<string, string> = {
    STATUS: "bg-WPIGrey/45 border-WPIGrey",
    ACTION: "bg-WPIGold/45 border-WPIGold",
    DEFAULT: "bg-WPIRed/45 border-WPIRed"
};
const TRAIN_TAB = "train";
const TEST_TAB = "test";
const APPROX_TAB = "approx";

//TYPES
type SequenceUnitDisplayProps = {
    orderNum: number;
    seq: Seq;
    allSequences: Seq[];
    handleApproximateSearch: (sequences: Seq[], embedding: number[], k: number) => void;
    collapsible?: boolean;
};

//Individual display of one sequence : Includes anomaly status, LLM description, prediction table, and approximate search option.
export function SequenceUnitDisplay({ orderNum, seq, allSequences, handleApproximateSearch }: SequenceUnitDisplayProps) {

    const [isAnomalyChecked, setIsAnomalyChecked] = useState<boolean>(seq.isAnomaly === true);
    const [isGTChecked, setIsGTChecked] = useState<boolean>(seq.explanation === GROUND_TRUTH);
    const [k, setK] = useState<number>(5);
    const [userSelection, setUserSelection] = useState<string | null>(null);
    const [isCollapsed, setCollapsibility] = useState<boolean>(false);

    useEffect(() => {
        setIsAnomalyChecked(seq.isAnomaly === true);
        setIsGTChecked(seq.explanation === GROUND_TRUTH);
    }, [seq.isAnomaly, seq.explanation]);

    const getFinalPrediction = (): string => {
        if (userSelection === ABNORMAL) return ABNORMAL;
        if (userSelection === NORMAL) return NORMAL;
        return isAnomalyChecked ? ABNORMAL : NORMAL;
    };

    const showCollapsed = collapsible ? isCollapsed : true;
    const typeStyle = SEQ_TYPE_COLORS[seq.seqType] || SEQ_TYPE_COLORS.DEFAULT;

    return (
        <div className={`flex flex-col ${getFinalPrediction() == ABNORMAL ? "bg-WPIRed/15" : "bg-neutral-100"} p-4 mb-4 rounded-lg shadow-md border border-neutral-300`}>
            {/* Header Section w/ Collapse */}
            <div className="flex items-start justify-center gap-3 mb-1.5 relative">
                {showCollapsed ?
                    <h1 className="font-WPIfont font-bold text-center flex-1">{`${orderNum}. ${seq.seqType} ${getFinalPrediction() == "Abnormal" ? "Anomaly" : ""} Seq\t`}</h1> 
                    :
                    <h1 className="font-WPIfont font-bold text-left flex-1">{`${orderNum}.`}
                        <span className={`text-neutral-800 p-1 ml-3 font-medium rounded-sm border-2 w-7/10 break-words whitespace-normal ${typeStyle}`}>{seq.arr[0]}</span>
                        
                        {seq.arr.length > 1 &&
                            <>
                                {`➡➡`}
                                <span className={`text-neutral-800 p-1 font-medium rounded-sm border-2 w-7/10 break-words whitespace-normal ${typeStyle}`}>{seq.arr[seq.arr.length-1]}</span>
                            </>
                        }
                    </h1> 
                }
                {collapsible && (
                    <PanelBottomClose 
                        onClick={() => {setCollapsibility(!isCollapsed)}} 
                        className="transition-transform hover:scale-110 absolute right-1 top-1/2 transform -translate-y-1/2" 
                    />
                )}
            </div>

            {showCollapsed && <>
                {/* Seq Display */}
                <div className="flex">
                    <div className="flex flex-col mb-4 flex-1">
                        {seq.arr.map((element, index) => (
                            <div key={index} className="flex flex-col items-center">
                                <span className={`text-neutral-800 p-1 font-medium rounded-sm border-2 w-7/10 break-words whitespace-normal ${typeStyle}`}>{element}</span>
                                {index < seq.arr.length - 1 && <ChevronDown className="text-neutral-500" />}
                            </div>
                        ))}
                    </div>
                    <p className="text-neutral-600 flex-1 italic self-center justify-self-center">
                        {seq.path_summary || NO_SUMMARY_MESSAGE}
                    </p>
                </div>

                {/* Table Display */}
                <table className="table-auto w-full border-collapse border border-neutral-300 bg-neutral-100">
                    <thead>
                        <tr>
                            <th className="border border-neutral-300 px-4 py-2 bg-neutral-200 font-semibold">Source</th>
                            <th className="border border-neutral-300 px-4 py-2 bg-neutral-200 font-semibold">Prediction</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td className="border px-4 py-2">LLM</td><td className="border px-4 py-2">{isAnomalyChecked ? ABNORMAL : !isGTChecked ? NORMAL : "---"}</td></tr>
                        <tr><td className="border px-4 py-2">Pattern Miner</td><td className="border px-4 py-2">{isGTChecked ? NORMAL : "---"}</td></tr>
                        <tr>
                            <td className="border px-4 py-2">Human</td>
                            <td className="border px-4 py-2">
                                <select
                                    className="w-full p-2 bg-neutral-200 border border-neutral-300 rounded-md"
                                    defaultValue=""
                                    onChange={(e) => setUserSelection(e.target.value)}
                                >
                                    <option value="" disabled hidden>{SELECT_PROMPT}</option>
                                    <option value={ABNORMAL}>Abnormal</option>
                                    <option value={NORMAL}>Normal</option>
                                </select>
                            </td>
                        </tr>
                        <tr><td colSpan={2} className="bg-black h-1"></td></tr>
                        <tr><td className="border px-4 py-2 font-bold">{FINAL_PREDICTION_HEADER}</td><td className="border px-4 py-2">{getFinalPrediction()}</td></tr>
                        {isGTChecked && <tr><td className="border px-4 py-2 font-bold">{GROUND_TRUTH_HEADER}</td><td className="border px-4 py-2"> Normal </td></tr>}
                    </tbody>
                </table>

                {/* Seq Explanation and Approximate K Search */}
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
            </>}
        </div>
    );
}

type SequenceScrollableProps = {
    sequences: Seq[];
    allSequences: Seq[];
    setCurrentDisplay: (sequences: Seq[]) => void;
    handleApproximateSearch: (sequences: Seq[], embedding: number[], k: number) => void;
};

/* Returns scrollable composed of multiple sequence units */
function SequenceScrollable({ sequences, allSequences, handleApproximateSearch }: SequenceScrollableProps) {
    if (!sequences || sequences.length === 0) {
        return (
            <div className="flex justify-center h-full p-4 border-8 border-WPIGrey/45 border-t-0">
                <span className="italic text-neutral-500">{NO_SEQUENCES_MESSAGE}</span>
            </div>
        );
    }
    return (
        <div className="overflow-y-auto h-[calc(100vh-200px)] p-4 border-8 border-WPIGrey/45 border-t-0">
            {sequences.slice(0, 1000).map((element, index) => (
                <div key={index} className="scroll-mt-4">
                    <SequenceUnitDisplay 
                        orderNum={index+1}
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
    initialSearchLogKey?: string;
};

// -- KnowledgeBaseSideBar Component -- Takes in knowledge structure data, an inital query search, and a togglesidebar function and showsidebar state
// Alternate showSidebar from t/f to hide and display sidebar, change search query for different children
export const KnowledgeBaseSideBar: React.FC<KnowledgeBaseSideBarProps> = ({
    showSidebar,
    toggleSidebar,
    trainingData,
    testingData,
    allSequences,
    query,
    initialSearchLogKey = "",
}) => {
    const [selectedTab, setSelectedTab] = useState<"train" | "test" | "approx">(TRAIN_TAB);
    const [searchLogKey, setSearchLogKey] = useState<string>("");
    const [currentTrainingDisplay, setCurrentTrainingDisplay] = useState<Seq[]>([]);
    const [currentTestingDisplay, setCurrentTestingDisplay] = useState<Seq[]>([]);
    const [approxDisplay, setApproxDisplay] = useState<Seq[]>([]);

    // When the component mounts set the current training and testing displays based off query
    useEffect(() => {
        if (initialSearchLogKey) return; // Don't overwrite if searching by logkeys
        const getSeq = (data: { entityDict: EntityDict; actionDict: ActionDict; entitySequences: EntitySequences }) => {
            const { entityDict, actionDict, entitySequences } = data;
            if (query === ROOT_QUERY) return entitySequences;
            if (entityDict[query]) return entityDict[query];
            if (actionDict[query]) return actionDict[query];
            return [];
        };
        setCurrentTrainingDisplay(getSeq(trainingData));
        setCurrentTestingDisplay(getSeq(testingData));
    }, [trainingData, testingData, query, initialSearchLogKey]);

    useEffect(() => {
        if (showSidebar && initialSearchLogKey) {
            setSearchLogKey(initialSearchLogKey);
            const keys = initialSearchLogKey.split(",").map((k) => k.trim());
            const results = exactSearch(allSequences, keys);
            setCurrentTrainingDisplay(results);
            setSelectedTab(TRAIN_TAB);   
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showSidebar, initialSearchLogKey]);

    // On successful search update the current training and testing display
    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchLogKey.trim()) {
            const getSeq = (data: { entityDict: EntityDict; actionDict: ActionDict; entitySequences: EntitySequences }) => {
                const { entityDict, actionDict, entitySequences } = data;
                if (query === ROOT_QUERY) return entitySequences;
                if (entityDict[query]) return entityDict[query];
                if (actionDict[query]) return actionDict[query];
                return [];
            };
            if (selectedTab === TRAIN_TAB) {
                setCurrentTrainingDisplay(getSeq(trainingData));
            } else {
                setCurrentTestingDisplay(getSeq(testingData));
            }
        } else {
            const keys = searchLogKey.split(",").map((k) => k.trim());
            const results = exactSearch(allSequences, keys);
            if (selectedTab === TRAIN_TAB) {
                setCurrentTrainingDisplay(results);
            } else {
                setCurrentTestingDisplay(results);
            }
        }
    };

    // On approximate serach call approxSearch imported function and update ApproxDisplay tab
    const handleApproximateSearch = (sequences: Seq[], embedding: number[], k: number) => {
        if (!embedding || embedding.length === 0) {
            console.error("Invalid embedding for approximate search.");
            return;
        }
        const results = approximateSearch(sequences, embedding, k);
        setApproxDisplay(results.map((r) => r.sequence));
        setSelectedTab(APPROX_TAB);
    };

    if (!showSidebar) return null;

    return (
        <div className="fixed top-0 right-0 h-full w-2/5 bg-white border-l-8 border-l-WPIGrey text-black shadow-lg z-50 animate-slide-in-right-fast">
            
            { /* -- TITLE DISPLAY W/ CLOSEOUT */}
            <div className="p-4 flex justify-between items-center">
                <h2 className="text-xl font-bold font-WPIfont">Knowledge Base Sequences</h2>
                <button onClick={toggleSidebar} className="text-neutral-400 hover:text-black hover:scale-110">
                    <X />
                </button>
            </div>

            { /* -- TAB SELECTION -- */}
            <div className="flex justify-center items-center">
                {[TRAIN_TAB, TEST_TAB, APPROX_TAB].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setSelectedTab(tab as "train" | "test" | "approx")}
                        className={`text-black px-4 py-2 w-full hover:bg-neutral-300 ${selectedTab === tab ? "bg-WPIGrey/45 underline" : "bg-white"} rounded-t-2xl`}
                    >
                        {tab === TRAIN_TAB ? "Training Data" : tab === TEST_TAB ? "Testing Data" : "Approx-Search"}
                    </button>
                ))}
            </div>

            { /* EXACT LOGKEY SEARCH */}
            <form className="p-4 flex items-center justify-center border-8 border-WPIGrey/45 border-b-0" onSubmit={handleSearchSubmit}>
                <div className="relative w-full">
                    <input
                        type="text"
                        placeholder={LOGKEY_SEARCH_PLACEHOLDER}
                        value={searchLogKey}
                        onChange={(e) => setSearchLogKey(e.target.value)}
                        className="w-full p-2 pr-10 bg-white border-4 border-WPIGrey rounded-md placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-500"
                    />
                    <button type="submit" className="absolute top-1/2 right-3 transform -translate-y-1/2">
                        <Search className="w-6 h-6 text-neutral-400 hover:text-black hover:scale-110" />
                    </button>
                </div>
            </form>

            { /* DISPLAY SELECTED TAB (TRAIN, TEST, or APPROX) */}
            {selectedTab === TRAIN_TAB && (
                <SequenceScrollable
                    sequences={currentTrainingDisplay}
                    allSequences={currentTrainingDisplay}
                    setCurrentDisplay={setCurrentTrainingDisplay}
                    handleApproximateSearch={handleApproximateSearch}
                />
            )}
            {selectedTab === TEST_TAB && (
                <SequenceScrollable
                    sequences={currentTestingDisplay}
                    allSequences={currentTestingDisplay}
                    setCurrentDisplay={setCurrentTestingDisplay}
                    handleApproximateSearch={handleApproximateSearch}
                />
            )}
            {selectedTab === APPROX_TAB && (approxDisplay.length >= 1 ?
                <SequenceScrollable
                    sequences={approxDisplay}
                    allSequences={allSequences}
                    setCurrentDisplay={() => {}}
                    handleApproximateSearch={handleApproximateSearch}
                /> :
                <div className="flex justify-center h-full p-4 border-8 border-WPIGrey/45 border-t-0">
                    <span className="italic text-neutral-500">{NO_DISPLAY_MSG}</span>
                </div>
            )}
        </div>
    );
};
