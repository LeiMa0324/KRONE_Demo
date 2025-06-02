import { useState } from "react";
import { useFile } from "@/FileContext";
import Papa from "papaparse";

export const FileUpload = () => {
    const { file, setFile } = useFile();
    const [csvData, setCsvData] = useState<string[][] | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);

            Papa.parse(selectedFile, {
                complete: (result) => {
                    setCsvData(result.data as string[][]);
                },
                skipEmptyLines: true,
            });
        }
    };

    return (
        <div className="flex flex-col items-center justify-center gap-4 min-h-[calc(100vh-theme(spacing.20))]">
            <div className="text-4xl text-amber-900">Upload a file</div>
            <label className="cursor-pointer px-6 py-2 bg-amber-700 text-white rounded shadow hover:bg-amber-800 transition">
                Choose File
                <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleChange}
                    className="hidden"
                />
            </label>
            {file && (
                <div className="text-lg text-green-700">
                    <div>Selected file: {file.name}</div>
                    <div>Type: {file.type || "Unknown"}</div>
                    <div>Size: {(file.size / 1024).toFixed(2)} KB</div>
                    <div>Last modified: {new Date(file.lastModified).toLocaleString()}</div>
                </div>
            )}
            {csvData && csvData.length > 0 && (
                <div className="overflow-auto max-h-96 w-full">
                    <table className="min-w-full border border-gray-300 mt-4">
                        <thead>
                            <tr>
                                {csvData[0].map((header, idx) => (
                                    <th key={idx} className="border px-2 py-1 bg-gray-100">{header}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {csvData.slice(1).map((row, rowIdx) => (
                                <tr key={rowIdx}>
                                    {row.map((cell, cellIdx) => (
                                        <td key={cellIdx} className="border px-2 py-1">{cell}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};