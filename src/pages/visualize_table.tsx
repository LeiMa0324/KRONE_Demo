import { useEffect, useState } from "react";
import Papa from "papaparse";
import { Footer } from "@/components/footer";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

// CsvRow type for new output data
type CsvRow = {
    row_num: number;
    seq_id: string;
    seq: string[];
    anomaly_seg: string[];
    anomaly_level: string;
    anomaly_reason: string;
};

// Create a dictionary for each event/template id and its corresponding log template
async function createTemplateDict(filePath: string) {
    const templateDict: Record<string, string> = {};

    const response = await fetch(filePath);
    if (!response.ok) {
        console.error("Fetch Failed");
        return templateDict;
    }

    const csvText = await response.text();

    const papaData = Papa.parse(csvText, {
        header: false,
    });

    const data = papaData.data as string[][];

    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (row.length >= 2) {
            templateDict[row[0]] = row[1];
        }
    }

    return templateDict;
}

// Parse anomaly data and convert `seq` and `anomaly_seg` to arrays of strings
async function createAnomalyData(filePath: string) {
    const anomCSV: CsvRow[] = [];

    const response = await fetch(filePath);
    if (!response.ok) {
        console.error("Fetch Failed");
        return anomCSV;
    }

    const csvText = await response.text();

    const papaData = Papa.parse(csvText, {
        header: false,
    });

    const realData = papaData.data as string[][];

    for (let i = 1; i < realData.length; i++) {
        const row = realData[i];

        if (row.length >= 6) {
            const preprocess = (field: string) =>
                field.replace(/'/g, '"'); // Replace single quotes with double quotes

            const csvRow: CsvRow = {
                row_num: Number(row[0]),
                seq_id: row[1],
                seq: JSON.parse(preprocess(row[2])),
                anomaly_seg: JSON.parse(preprocess(row[3])),
                anomaly_level: row[4],
                anomaly_reason: row[5],
            };

            anomCSV.push(csvRow);
        }
    }

    return anomCSV;
}

// Function to find all starting indexes of an exact match of `pattern` in `array`
const findPatternIndexes = (array: string[], pattern: string[]): number[] => {
    const indexes: number[] = [];
    const patternLength = pattern.length;

    for (let i = 0; i <= array.length - patternLength; i++) {
        if (array.slice(i, i + patternLength).join(",") === pattern.join(",")) {
            indexes.push(i);
        }
    }

    return indexes;
};

// Component for choosing a row
const RowSelector = ({
    dropdownOptions,
    selectedOption,
    setSelectedOption,
    handleRunOption,
    prediction,
}: {
    dropdownOptions: CsvRow[];
    selectedOption: string;
    setSelectedOption: (value: string) => void;
    handleRunOption: () => void;
    prediction: string;
}) => {
    return (
        <div className="mb-6 flex flex-col gap-2 max-w-md mx-auto items-center">
            <label htmlFor="dropdown-bar" className="font-WPIfont font-medium">
                Choose a row:
            </label>
            <div className="flex gap-2 items-center">
                <select
                    id="dropdown-bar"
                    className="border rounded px-2 py-1"
                    value={selectedOption}
                    onChange={(e) => setSelectedOption(e.target.value)}
                >
                    {dropdownOptions.map((row) => (
                        <option key={row.seq_id} value={row.seq_id}>
                            Sequence {row.seq_id}
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
    );
};

// Component for displaying the table
const LogSequenceTable = ({
    row,
    templateDict,
}: {
    row: CsvRow | undefined;
    templateDict: Record<string, string>;
}) => {
    if (!row) {
        return <div className="font-WPIfont">Please Select A Sequence</div>;
    }

    return (
        <div className="p-4 bg-white rounded-xl shadow-md ring-1 ring-gray-100 mx-auto border border-gray-300">
            <Table className="w-full">
                <TableHeader>
                    <TableRow>
                        <TableHead className="text-center font-WPIfont font-bold py-2">
                            Index
                        </TableHead>
                        <TableHead className="text-center font-WPIfont font-bold py-2">
                            Log Key #
                        </TableHead>
                        <TableHead className="text-center font-WPIfont font-bold py-2">
                            Log Template
                        </TableHead>
                        <TableHead className="text-center font-WPIfont font-bold py-2">
                            Anomaly Explanation
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {row.seq.map((logKey, index) => {
                        const anomalyIndexes = findPatternIndexes(
                            row.seq,
                            row.anomaly_seg
                        );
                        const isAnomalous = anomalyIndexes.some(
                            (startIndex) =>
                                index >= startIndex &&
                                index < startIndex + row.anomaly_seg.length
                        );

                        const isFirstAnomalousRow = anomalyIndexes.some(
                            (startIndex) => index === startIndex
                        );

                        const rowSpan = isFirstAnomalousRow
                            ? row.anomaly_seg.length
                            : undefined;

                        return (
                            <TableRow
                                key={index}
                                className={isAnomalous ? "bg-WPIRed/30" : ""}
                            >
                                <TableCell className="whitespace-normal break-words">
                                    {index}
                                </TableCell>
                                <TableCell className="whitespace-normal break-words">
                                    {logKey}
                                </TableCell>
                                <TableCell className="whitespace-normal break-words">
                                    {templateDict[logKey] || "Unknown Template"}
                                </TableCell>
                                {isFirstAnomalousRow ? (
                                    <TableCell
                                        rowSpan={rowSpan}
                                        className="whitespace-normal break-words"
                                    >
                                        {row.anomaly_reason}
                                    </TableCell>
                                ) : null}
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
};

// Main Component
export const VisualizeTable = () => {
    const [templateDict, setTemplateDict] = useState<Record<string, string>>({});
    const [data, setData] = useState<CsvRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [dropdownOptions, setDropdownOptions] = useState<CsvRow[]>([]);
    const [selectedOption, setSelectedOption] = useState<string>("");
    const [displayedOption, setDisplayedOption] = useState<string>("");
    const [prediction, setPrediction] = useState<string>("None");

    useEffect(() => {
        createTemplateDict("/Krone_Tree.csv").then((dict) => {
            setTemplateDict(dict);
        });
    }, []);

    useEffect(() => {
        createAnomalyData("/krone_detection_res.csv").then((anomData) => {
            const rows = anomData as CsvRow[];
            setData(rows);
            setDropdownOptions(rows);
            setSelectedOption(rows[0].seq_id);
            setLoading(false);
        });
    }, []);

    const handleRunOption = () => {
        setDisplayedOption(selectedOption);
        const row = data.find((row) => row.seq_id === selectedOption);
        if (!row) {
            setPrediction("Row not found");
            return;
        }
        setPrediction("Abnormal");
    };

    const row = data.find((row) => row.seq_id === displayedOption);

    return (
        <div className="flex flex-col min-h-screen">
            <div className="flex-grow p-8 animate-fade-in-fast">
                <div className="mb-6 flex flex-col gap-2 max-w-md mx-auto items-center mt-16"></div>
                <h1 className="text-3xl font-WPIfont font-extrabold text-WPIRed mb-4 text-center">
                    Log Sequence Table
                </h1>
                <RowSelector
                    dropdownOptions={dropdownOptions}
                    selectedOption={selectedOption}
                    setSelectedOption={setSelectedOption}
                    handleRunOption={handleRunOption}
                    prediction={prediction}
                />
                {loading ? (
                    <div className="font-WPIfont">Loading table...</div>
                ) : (
                    <LogSequenceTable row={row} templateDict={templateDict} />
                )}
            </div>
            <Footer />
        </div>
    );
};