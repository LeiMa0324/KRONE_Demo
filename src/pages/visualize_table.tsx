import { useEffect, useState } from "react";
import Papa from "papaparse";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Footer } from "@/components/footer";
import { SequenceTree } from "@/components/sequence_tree";

type CsvRow = {
    id: string;
    "log sequence": string;
    prediction: string;
    anomaly_explanation: string;
    anomaly_range: string;
    anomaly_level: string;
};

type KroneDecompRow = {
    seq_id: string;
    entity_nodes_for_logkeys: string[];
    action_nodes_for_logkeys: string[];
    status_nodes_for_logkeys: string[];
}

type KroneDetectRow = {
    seq_id: string;
    seq: string[];
    anomaly_seg: string[];
    anomaly_level: "entity" | "action" | "status";
    anomaly_reason: string;
}

export const VisualizeTable = () => {
    const [data, setData] = useState<CsvRow[]>([]);
    const [kroneDecompData, setKroneDecompData] = useState<KroneDecompRow[]>([]);
    const [kroneDetectData, setKroneDetectData] = useState<KroneDetectRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [dropdownOptions, setDropdownOptions] = useState<CsvRow[]>([]);
    const [selectedOption, setSelectedOption] = useState<string>("");
    const [displayedOption, setDisplayedOption] = useState<string>("");
    const [prediction, setPrediction] = useState("None");
    const [currentPage, setCurrentPage] = useState(0);
    const rowsPerPage = 50;

    useEffect(() => {
        fetch("/demo_data.csv")
            .then((response) => response.text())
            .then((csvText) => {
                Papa.parse<CsvRow>(csvText, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        const rows = results.data as CsvRow[];
                        setData(rows);
                        setDropdownOptions(rows);
                        if (rows.length > 0) {
                            setSelectedOption(rows[0].id);
                            setDisplayedOption(rows[0].id);
                        }
                        setLoading(false);
                    },
                });
            });
        fetch("/krone_decompose_res.csv")
            .then((response) => response.text())
            .then((csvText) => {
                Papa.parse<KroneDecompRow>(csvText, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        const rows = results.data as KroneDecompRow[];
                        setKroneDecompData(rows);
                        // Process or store the Krone decomposition data if needed
                        console.log("Krone Decomposition Data:", rows);
                    },
                });
            });
        fetch("/krone_detection_res.csv")
            .then((response) => response.text())
            .then((csvText) => {
                Papa.parse<KroneDetectRow>(csvText, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        const rows = results.data as KroneDetectRow[];
                        setKroneDetectData(rows);
                        // Process or store the Krone detection data if needed
                        console.log("Krone Detection Data:", rows);
                    },
                });
            });
    }, []);

    const handleRunOption = () => {
        setDisplayedOption(selectedOption);
        setCurrentPage(0); // Reset pagination when a new row is selected
        const row = data.find(row => row.id === selectedOption);
        if (!row) {
            setPrediction("Row not found");
            return;
        }
        setPrediction(row.prediction === "1" ? "Abnormal" : "Normal");
    };

    return (
        <div className="flex flex-col min-h-screen">
            <div className="flex-grow p-8 animate-fade-in-fast">
                <h1 className="text-3xl font-WPIfont font-extrabold text-WPIRed mb-4 text-center">
                    Log Sequence Table
                </h1>
                <div className="mb-6 flex flex-col gap-2 max-w-md mx-auto items-center">
                    <label htmlFor="dropdown-bar" className="font-WPIfont font-medium">Choose a row:</label>
                    <div className="flex gap-2 items-center">
                        <select
                            id="dropdown-bar"
                            className="border rounded px-2 py-1"
                            value={selectedOption}
                            onChange={e => setSelectedOption(e.target.value)}
                        >
                            {dropdownOptions.map(row => (
                                <option key={row.id} value={row.id}>
                                    Sequence {row.id}
                                </option>
                            ))}
                        </select>
                        <button
                            className="font-WPIfont bg-WPIRed text-white px-4 py-1 rounded hover:bg-WPIRed/85 transition"
                            aria-label="run button"
                            onClick={handleRunOption}
                        >
                            Run Option
                        </button>
                    </div>
                    <div>
                        <b className="font-WPIfont">Prediction:</b>{" "}
                        <span
                            id="prediction"
                            aria-label="prediction"
                            className={
                                prediction === "Abnormal"
                                    ? "px-2 py-1 rounded font-WPIfont font-semibold bg-WPIRed/20 text-WPIRed"
                                    : prediction === "Normal"
                                        ? "px-2 py-1 rounded font-WPIfont font-semibold bg-green-200 text-green-900"
                                        : ""
                            }
                        >
                            {prediction}
                        </span>
                    </div>
                </div>
                {loading ? (
                    <div className="font-WPIfont">Loading table...</div>
                ) : (
                    <div className="p-4 bg-white rounded-xl shadow-md ring-1 ring-gray-100 mx-auto border border-gray-300">
                        <Table className="w-full">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-center font-WPIfont font-bold py-2">Index</TableHead>
                                    <TableHead className="text-center font-WPIfont font-bold py-2">Log Message</TableHead>
                                    <TableHead className="text-center font-WPIfont font-bold py-2">Anomaly Explanation</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {(() => {
                                    const row = data.find(r => r.id === displayedOption);
                                    if (!row) {
                                        return (
                                            <TableRow>
                                                <TableCell colSpan={3} className="px-4 py-2 text-center font-WPIfont">
                                                    Row not found.
                                                </TableCell>
                                            </TableRow>
                                        );
                                    }

                                    let logSeq: string[] = [];
                                    try {
                                        logSeq = row["log sequence"]
                                            .replace(/[[\]\s]/g, "")
                                            .split(",");
                                    } catch {
                                        logSeq = [];
                                    }

                                    let anomalyRange: number[] = [];
                                    try {
                                        anomalyRange = row.anomaly_range
                                            .replace(/[[\]\s]/g, "")
                                            .split(",")
                                            .filter(x => x !== "")
                                            .map(Number);
                                    } catch {
                                        anomalyRange = [];
                                    }

                                    const [rangeStart, rangeEnd] = anomalyRange.length === 2 ? anomalyRange : [null, null];
                                    const hasAnomaly = rangeStart !== null && rangeEnd !== null && row.anomaly_explanation;
                                    const totalPages = Math.ceil(logSeq.length / rowsPerPage);
                                    const startIndex = currentPage * rowsPerPage;
                                    const paginatedLogSeq = logSeq.slice(startIndex, startIndex + rowsPerPage);

                                    return (
                                        <>
                                            {paginatedLogSeq.map((msg, jOffset) => {
                                                const j = startIndex + jOffset;
                                                const inAnomalyRange = hasAnomaly && j >= rangeStart && j <= rangeEnd;
                                                const isFirstAnomalyRowThisPage = hasAnomaly && j === Math.max(rangeStart, startIndex);

                                                if (inAnomalyRange) {
                                                    return (
                                                        <TableRow key={`${row.id}-${j}`} className="bg-WPIRed/20 font-semibold text-WPIRed">
                                                            <TableCell>{j}</TableCell>
                                                            <TableCell>{msg}</TableCell>
                                                            {isFirstAnomalyRowThisPage ? (
                                                                <TableCell
                                                                    rowSpan={Math.min(rangeEnd, startIndex + rowsPerPage - 1) - j + 1}
                                                                    className="align-middle"
                                                                >
                                                                    {row.anomaly_explanation}
                                                                </TableCell>
                                                            ) : (
                                                                <></> // no additional <td>, since rowSpan covers this
                                                            )}
                                                        </TableRow>
                                                    );
                                                }

                                                // Normal non-anomaly row
                                                return (
                                                    <TableRow key={`${row.id}-${j}`}>
                                                        <TableCell>{j}</TableCell>
                                                        <TableCell>{msg}</TableCell>
                                                        <TableCell></TableCell>
                                                    </TableRow>
                                                );
                                            })}

                                            <TableRow>
                                                <TableCell colSpan={3}>
                                                    <div className="mt-4 flex justify-center items-center gap-4">
                                                        <button
                                                            className="px-4 py-1 font-WPIfont rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
                                                            disabled={currentPage === 0}
                                                            onClick={() => setCurrentPage(prev => prev - 1)}
                                                        >
                                                            Previous
                                                        </button>
                                                        <span className="font-WPIfont">
                                                            Page {currentPage + 1} of {totalPages}
                                                        </span>
                                                        <button
                                                            className="px-4 py-1 font-WPIfont rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
                                                            disabled={currentPage >= totalPages - 1}
                                                            onClick={() => setCurrentPage(prev => prev + 1)}
                                                        >
                                                            Next
                                                        </button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        </>
                                    );
                                })()}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>
            <SequenceTree />
            <Footer />
        </div>
    );
};
