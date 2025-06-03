import { useEffect, useState } from "react";
import Papa from "papaparse";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {Footer} from "@/components/footer"

type CsvRow = {
    id: string;
    "log sequence": string;
    prediction: string;
    anomaly_explanation: string;
    anomaly_range: string;
    anomaly_level: string;
};

export const VisualizeTable = () => {
    const [data, setData] = useState<CsvRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [dropdownOptions, setDropdownOptions] = useState<CsvRow[]>([]);
    const [selectedOption, setSelectedOption] = useState<string>("");
    const [displayedOption, setDisplayedOption] = useState<string>("");
    const [prediction, setPrediction] = useState("None");

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
                        // Set to first row by default if available
                        if (rows.length > 0) {
                            setSelectedOption(rows[0].id);
                            setDisplayedOption(rows[0].id);
                        }
                        setLoading(false);
                    },
                });
            });
    }, []);

    const handleRunOption = () => {
        setDisplayedOption(selectedOption);
        const row = data.find(row => row.id === selectedOption);
        if (!row) {
            setPrediction("Row not found");
            return;
        }
        setPrediction(row.prediction === "1" ? "Abnormal" : "Normal");
    };

    return (
        <div className="flex flex-col min-h-screen">
            <div className="flex-grow p-8">
                <div className="mb-6 flex flex-col gap-2 max-w-md mx-auto items-center mt-16"></div>
                <h1 className="text-3xl font-extrabold text-WPIRed mb-4 text-center">
                    Log Sequence Table
                </h1>
                <div className="mb-6 flex flex-col gap-2 max-w-md mx-auto items-center">
                    <label htmlFor="dropdown-bar" className="font-medium">Choose a row:</label>
                    <div className="flex gap-2 items-center">
                        <select
                            id="dropdown-bar"
                            name="dropdown-bar"
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
                            className="bg-WPIRed text-white px-4 py-1 rounded hover:bg-WPIRed/85 transition"
                            onClick={handleRunOption}
                        >
                            Run Option
                        </button>
                    </div>
                    <div>
                        <b>Prediction:</b>{" "}
                        <span
                            id="prediction"
                            className={
                                prediction === "Abnormal"
                                    ? "px-2 py-1 rounded font-semibold bg-WPIRed/20 text-WPIRed"
                                    : prediction === "Normal"
                                    ? "px-2 py-1 rounded font-semibold bg-green-200 text-green-900"
                                    : ""
                            }
                        >
                            {prediction}
                        </span>
                    </div>
                </div>
                {loading ? (
                    <div>Loading table...</div>
                ) : (
                    <div className="p-4 bg-white rounded-xl shadow-md ring-1 ring-gray-100 mx-auto border border-gray-300">
                        <Table className="w-full">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-center font-bold py-2" >Index</TableHead>
                                    <TableHead className="text-center font-bold py-2" >Log Message</TableHead>
                                    <TableHead className="text-center font-bold py-2" >Anomaly Explanation</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {(() => {
                                    const row = data.find(r => r.id === displayedOption);
                                    if (!row) {
                                        return (
                                            <TableRow>
                                                <TableCell colSpan={3} className="px-4 py-2 text-center">
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
                                        logSeq = row["log sequence"]
                                            .replace(/[[\]\s]/g, "")
                                            .split(",");
                                    }

                                    // Parse anomaly_range as [start, end]
                                    let anomalyRange: number[] = [];
                                    try {
                                        anomalyRange = row.anomaly_range
                                            .replace(/[[\]\s]/g, "")
                                            .split(",")
                                            .filter(x => x !== "")
                                            .map(Number);
                                    } catch {
                                        anomalyRange = row.anomaly_range
                                            .replace(/[[\]\s]/g, "")
                                            .split(",")
                                            .filter(x => x !== "")
                                            .map(Number);
                                    }
                                    const [rangeStart, rangeEnd] = anomalyRange.length === 2 ? anomalyRange : [null, null];
                                    const hasAnomaly = rangeStart !== null && rangeEnd !== null && row.anomaly_explanation;

                                    return logSeq.map((msg, j) => {
                                        // If this is the start of the anomaly range, render the merged cell
                                        if (hasAnomaly && j === rangeStart) {
                                            return (
                                                <TableRow
                                                    key={`${row.id}-${j}`}
                                                    className="bg-WPIRed/20 font-semibold text-WPIRed"
                                                >
                                                    <TableCell>{j}</TableCell>
                                                    <TableCell>{msg}</TableCell>
                                                    <TableCell
                                                        rowSpan={rangeEnd - rangeStart + 1}
                                                        className="align-middle"
                                                    >
                                                        {row.anomaly_explanation}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        }
                                        // If this is within the anomaly range but not the start, skip the anomaly cell
                                        if (hasAnomaly && j > rangeStart && j <= rangeEnd) {
                                            return (
                                                <TableRow
                                                    key={`${row.id}-${j}`}
                                                    className="bg-WPIRed/20 font-semibold text-WPIRed"
                                                >
                                                    <TableCell>{j}</TableCell>
                                                    <TableCell>{msg}</TableCell>
                                                </TableRow>
                                            );
                                        }
                                        // Otherwise, normal row with empty anomaly cell
                                        return (
                                            <TableRow key={`${row.id}-${j}`}>
                                                <TableCell>{j}</TableCell>
                                                <TableCell>{msg}</TableCell>
                                                <TableCell></TableCell>
                                            </TableRow>
                                        );
                                    });
                                })()}
                            </TableBody>
                        </Table>
                    </div>       
                )}
            </div>
            <Footer />
        </div>
    );
};

