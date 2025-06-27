import React, { useState, useEffect } from "react";
import { X, ChevronDown, Search } from "lucide-react";
import type { EntityDict, ActionDict, EntitySequences, Seq } from "@/pages/knowledge_base_viz";
import { exactSearch, approximateSearch } from "@/pages/knowledge_base_viz";

function handleApproximateSearch(
    sequences: Seq[],
    targetEmbedding: number[],
    k: number,
    setCurrentDisplay: (sequences: Seq[]) => void
) {
    const newDisplaySequences = approximateSearch(sequences, targetEmbedding, k);
    setCurrentDisplay(newDisplaySequences.map(item => item.sequence));
}

const SequenceUnitDisplay: React.FC<{
    seq: Seq;
    allSequences: Seq[];
    setCurrentDisplay: (sequences: Seq[]) => void;
}> = ({ seq, allSequences, setCurrentDisplay }) => {
    /* State Handlers for displaying checkboxes */
    const [isAnomalyChecked, setIsAnomalyChecked] = useState(seq.isAnomaly === true);
    const [isGTChecked, setIsGTChecked] = useState(seq.explanation == "GT");
    const [k, setK] = useState(5); // State for the 'k' parameter
    const [userSelection, setUserSelection] = useState<string | null>(null); // State for dropdown selection

    useEffect(() => {
        setIsAnomalyChecked(seq.isAnomaly === true);
        setIsGTChecked(seq.explanation == "GT");
    }, [seq.isAnomaly, seq.explanation]);

    const getFinalPrediction = () => {
        if (userSelection === "Abnormal") {
            return "⚠️";
        } else if (userSelection === "Normal") {
            return "✔️";
        } else {
            return isAnomalyChecked ? "⚠️" : "✔️"; // Default to LLM prediction
        }
    };

    return (
        <div className="flex flex-col bg-neutral-100 p-4 mb-4 rounded-lg shadow-md border border-neutral-300">
            {/* Anom Title */}
            <h1 className="font-WPIfont font-bold mb-1.5"> {`${seq.seqType} Sequence`}</h1>

            {/* Sequence array display */}
            <div className="flex">
                <div className="flex flex-col mb-4 flex-1">
                    {seq.arr.map((element, index) => (
                        <div key={index} className="flex flex-col items-center">
                            <span
                                className={`text-neutral-800 p-1 font-medium rounded-sm border-2 ${
                                    seq.seqType === "STATUS"
                                        ? "bg-WPIGrey/45 border-WPIGrey"
                                        : seq.seqType === "ACTION"
                                        ? "bg-WPIGold/45 border-WPIGold"
                                        : "bg-WPIRed/45 border-WPIRed"
                                }`}
                            >
                                {element}
                            </span>
                            {/* Show ChevronDown only if it's not the last element */}
                            {index < seq.arr.length - 1 && (
                                <ChevronDown className="text-neutral-500" />
                            )}
                        </div>
                    ))}
                </div>
                <p className="text-neutral-600 flex-1 italic self-center justify-self-center">
                    {seq.path_summary || "No summary available"}
                </p>
            </div>

            {/* Table with human, LLM, and ground truth toggles */}
            <table className="table-auto w-full border-collapse border border-neutral-300">
                <thead>
                    <tr>
                        <th className="border border-neutral-300 px-4 py-2 text-left bg-neutral-200 font-semibold">
                            Source
                        </th>
                        <th className="border border-neutral-300 px-4 py-2 text-left bg-neutral-200 font-semibold">
                            Prediction
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td className="border border-neutral-300 px-4 py-2">LLM</td>
                        <td className="border border-neutral-300 px-4 py-2">
                            {isAnomalyChecked ? "⚠️" : "✔️"}
                        </td>
                    </tr>
                    <tr>
                        <td className="border border-neutral-300 px-4 py-2"> Pattern Miner </td>
                        <td className="border border-neutral-300 px-4 py-2 accent-WPIRed">
                            {isGTChecked ? "✔️" : "⚠️"}
                        </td>
                    </tr>
                    <tr>
                        <td className="border border-neutral-300 px-4 py-2">Human</td>
                        <td className="border border-neutral-300 px-4 py-2">
                            <select
                                className="w-full p-2 bg-neutral-200 border border-neutral-300 rounded-md text-black focus:outline-none focus:ring-2 focus:ring-neutral-400"
                                defaultValue=""
                                onChange={(e) => setUserSelection(e.target.value)}
                            >
                                <option value="" disabled hidden>Select...</option>
                                <option value="Abnormal">Abnormal</option>
                                <option value="Normal">Normal</option>
                            </select>
                        </td>
                    </tr>
                    {/* Black separator */}
                    <tr>
                        <td colSpan={2} className="bg-black h-1"></td>
                    </tr>
                    <tr>
                        <td className="border border-neutral-300 px-4 py-2 font-bold">Final Prediction: </td>
                        <td className="border border-neutral-300 px-4 py-2" id="anomaly-status">
                            {getFinalPrediction()}
                        </td>
                    </tr>
                    <tr>
                        <td className="border border-neutral-300 px-4 py-2 font-bold"> Ground Truth: </td>
                        <td className="border border-neutral-300 px-4 py-2" id="anomaly-status">
                            {isAnomalyChecked ? "⚠️" : "✔️"}
                        </td>
                    </tr>
                </tbody>
            </table>
            
            {/* Anomaly Explanation if it exists */}
            {isAnomalyChecked ? (
                <>
                    <h1 className="font-WPIfont font-bold"> Anomaly Explanation </h1>
                    <p> {seq.explanation}</p>
                </>
            ) : (
                ""
            )}

            {/* Proximity vector database search for most similar */}
            <div className="flex flex-col items-center justify-center space-y-4 text-xl font-serif mt-2">
                <div className="flex items-center space-x-4">
                    <span className="font-bold">Find</span>
                    <div className="relative">
                        <input
                            type="number"
                            value={k}
                            onChange={(e) => setK(Number(e.target.value))}
                            className="w-10 h-10 text-center font-bold bg-neutral-200 rounded-full appearance-none outline-none focus:ring-2 focus:ring-neutral-400"
                            min="1"
                            max="50"
                        />
                    </div>
                    <span className="font-bold">most similar</span>
                    <button
                        onClick={() => handleApproximateSearch(allSequences, seq.embedding, k, setCurrentDisplay)}
                        className="hover:scale-110 transition-transform flex items-center justify-center"
                    >
                        <Search className="w-6 h-6 text-neutral-500 hover:text-black" />
                    </button>
                </div>
            </div>
        </div>
    );
};

const SequenceScrollable: React.FC<{ sequences: Seq[],
    allSequences: Seq[],
    setCurrentDisplay: (sequences: Seq[]) => void}> = ({ sequences, allSequences, setCurrentDisplay }) => {
    return (
        <div className="overflow-y-auto h-[calc(100vh-200px)] p-4">
            {sequences.slice(0, 1000).map((element, index) => (
                <div key={index} id={`sequence-${index}`} className="scroll-mt-4">
                    <SequenceUnitDisplay seq={element} allSequences={allSequences} setCurrentDisplay={setCurrentDisplay}/>
                </div>
            ))}
        </div>
    );
};

//select sequences to visualize
function sequenceVizSelector(entityDict: EntityDict, actionDict: ActionDict, query: string, entitySequences: EntitySequences) {
    if (query == "ROOT") {
        return entitySequences;
    }
    else if (query in entityDict) {
        return entityDict[query];
    }
    else if (query in actionDict) {
        return actionDict[query];
    }
    else {
        return [];
    }
}

// Define a new type to encapsulate entityDict, actionDict, and entitySequences
export type KnowledgeBaseData = {
    entityDict: EntityDict;
    actionDict: ActionDict;
    entitySequences: EntitySequences;
};

type KnowledgeBaseSideBarProps = {
    showSidebar: boolean;
    toggleSidebar: () => void;
    trainingData: KnowledgeBaseData; // Grouped training data
    testingData: KnowledgeBaseData; // Grouped testing data
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
    const [TrainTestVisibility, setTrainTestVisibility] = useState(true);
    const [currentTrainingDisplay, setCurrentTrainingDisplay] = useState<Seq[]>([]);
    const [currentTestingDisplay, setCurrentTestingDisplay] = useState<Seq[]>([]);
    const [searchLogKey, setSearchLogKey] = useState(""); // State for search input

    // Update currentTrainingDisplay and currentTestingDisplay when props change
    useEffect(() => {
        const selectedTrainingSequences = sequenceVizSelector(
            trainingData.entityDict,
            trainingData.actionDict,
            query,
            trainingData.entitySequences
        );
        setCurrentTrainingDisplay(selectedTrainingSequences);

        const selectedTestingSequences = sequenceVizSelector(
            testingData.entityDict,
            testingData.actionDict,
            query,
            testingData.entitySequences
        );
        setCurrentTestingDisplay(selectedTestingSequences);
    }, [trainingData, testingData, query]);

    const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (searchLogKey.trim() === "") {
            // Reset to original state if search is empty
            const selectedSequences = sequenceVizSelector(
                TrainTestVisibility ? trainingData.entityDict : testingData.entityDict,
                TrainTestVisibility ? trainingData.actionDict : testingData.actionDict,
                query,
                TrainTestVisibility ? trainingData.entitySequences : testingData.entitySequences
            );
            if (TrainTestVisibility) {
                setCurrentTrainingDisplay(selectedSequences);
            } else {
                setCurrentTestingDisplay(selectedSequences);
            }
        } else if (allSequences.length > 0) {
            const targetLogKeySeq = searchLogKey.split(",").map((key) => key.trim());
            const results = exactSearch(allSequences, targetLogKeySeq);
            if (TrainTestVisibility) {
                setCurrentTrainingDisplay(results); // Update currentTrainingDisplay with search results
            } else {
                setCurrentTestingDisplay(results); // Update currentTestingDisplay with search results
            }
        }
    };

    if (!showSidebar) return null;

    return (
        <div className="fixed top-0 right-0 h-full w-112 bg-white border-l-8 border-l-WPIGrey text-black shadow-lg z-50 animate-slide-in-right-fast">
            {/* Sidebar Header */}
            <div className="p-4 flex justify-between items-center">
                <h2 className="text-xl font-bold font-WPIfont">Knowledge Base Sequences</h2>
                <button
                    onClick={toggleSidebar}
                    className="text-neutral-400 hover:text-black hover:scale-110"
                >
                    <X />
                </button>
            </div>

            {/* Train / Test Toggle */}
            <div className="flex justify-center items-center">
                <button
                    onClick={() => setTrainTestVisibility(true)}
                    className={`text-black px-4 py-2 w-full hover:bg-neutral-300 ${TrainTestVisibility ? "bg-WPIGrey/45 underline" : "bg-white"}`}
                >
                    Training Data
                </button>
                <button
                    onClick={() => setTrainTestVisibility(false)}
                    className={`text-black px-4 py-2 w-full hover:bg-neutral-300 ${!TrainTestVisibility ? "bg-WPIGrey/45 underline" : "bg-white"}`}
                >
                    Testing Data
                </button>
            </div>

            {/* Search Box */}
            <form className="p-4 flex items-center justify-center" onSubmit={handleSearchSubmit}>
                <div className="relative w-full">
                    <input
                        type="text"
                        placeholder="Search logkey..."
                        value={searchLogKey}
                        onChange={(e) => setSearchLogKey(e.target.value)}
                        className="w-full p-2 pr-10 bg-white border-4 border-WPIGrey rounded-md text-black placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-500"
                    />
                    <button type="submit" className="absolute top-1/2 right-3 transform -translate-y-1/2">
                        <Search className="w-6 h-6 text-neutral-400 hover:text-black hover:scale-110" />
                    </button>
                </div>
            </form>
            
            {/* Scrollable Train or Testing Data */}
            {TrainTestVisibility ? (
                <SequenceScrollable sequences={currentTrainingDisplay} allSequences={allSequences} setCurrentDisplay={setCurrentTrainingDisplay}/>
            ) : (
                <SequenceScrollable sequences={currentTestingDisplay} allSequences={allSequences} setCurrentDisplay={setCurrentTestingDisplay}/>
            )}
        </div>
    );
};