import { useState } from "react";
import { useFile } from "@/FileContext";
import Papa from "papaparse";
import { Upload } from "lucide-react";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

// Dataset options
const datasets = [
    { value: "HDFS", label: "HDFS", path: "/demo_data_hdfs.csv" },
    { value: "BGL", label: "BGL", path: "/demo_data_bgl.csv" },
    { value: "ThunderBird", label: "ThunderBird", path: "/demo_data_thunderbird.csv" },
    { value: "IaaS", label: "IaaS (Industry)", path: "/demo_data_iaas.csv" },
];

// Selection component
function SelectDemo({ onSelect }: { onSelect: (value: string) => void }) {
    return (
        <Select onValueChange={onSelect}>
            <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select a Dataset" />
            </SelectTrigger>
            <SelectContent>
                <SelectGroup>
                    <SelectLabel>DataSet</SelectLabel>
                    {datasets.map(({ value, label }) => (
                        <SelectItem key={value} value={value}>
                            {label}
                        </SelectItem>
                    ))}
                </SelectGroup>
            </SelectContent>
        </Select>
    );
}

export const FileUpload = () => {
    const { file, setFile } = useFile();
    const [csvData, setCsvData] = useState<string[][] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedDataset, setSelectedDataset] = useState<string>("");

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            const isCSV = selectedFile.type === "text/csv" || selectedFile.name.toLowerCase().endsWith(".csv");

            if (!isCSV) {
                setError("Only .csv files are allowed.");
                setFile(null);
                setCsvData(null);
                return;
            }

            setError(null);
            setFile(selectedFile);

            Papa.parse(selectedFile, {
                complete: (result) => {
                    setCsvData(result.data as string[][]);
                },
                skipEmptyLines: true,
            });
        }
    };

    const handleDemoSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const dataset = datasets.find(d => d.value === selectedDataset);
        if (!dataset) {
            setError("Please select a valid dataset.");
            return;
        }

        try {
            const response = await fetch(dataset.path);
            if (!response.ok) throw new Error("Failed to fetch dataset");
            const csvText = await response.text();

            const demoFile = new File([csvText], `${dataset.value}.csv`, { type: "text/csv" });
            setFile(demoFile);

            Papa.parse(csvText, {
                complete: (result) => {
                    setCsvData(result.data as string[][]);
                },
                skipEmptyLines: true,
            });
        } catch {
            setError("Could not load the selected dataset.");
            setFile(null);
            setCsvData(null);
        }
    };

    return (
        <div className="flex flex-col min-h-screen">
            <div className="pt-[4.5rem]"></div>
            <div className="flex-grow flex flex-col items-center justify-center gap-8 bg-gradient-to-br from-gray-300 to-gray-400 animate-fade-in-fast">
                <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-5xl flex flex-col md:flex-row gap-8">
                    <div className="flex flex-col items-center gap-6 flex-1">
                        <Upload className="w-12 h-12 text-WPIRed mb-2 animate-bounce" />
                        <div className="text-4xl font-WPIfont font-bold text-WPIRed">Upload a File</div>
                        <label className="cursor-pointer px-8 py-3 text-WPIRed rounded-lg shadow shadow-gray-400 hover:bg-WPIRed hover:text-white transition flex items-center gap-2 text-lg font-medium focus:ring-4 focus:ring-amber-300">
                            <Upload className="w-5 h-5 font-WPIfont" />
                            Choose File
                            <input
                                type="file"
                                accept=".csv,text/csv"
                                onChange={handleChange}
                                className="hidden"
                                data-testid="file-input"
                            />
                        </label>
                    </div>

                    <div className="flex flex-col items-center justify-center gap-8 flex-1">
                        <div className="text-4xl font-WPIfont font-bold text-WPIRed px-8"> Or Choose From One Of Ours </div>
                        <form onSubmit={handleDemoSubmit} className="flex gap-8">
                            <SelectDemo onSelect={setSelectedDataset} />
                            <Button type="submit">Load Dataset</Button>
                        </form>
                    </div>
                </div>

                {(file || csvData || error) && (
                    <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-5xl flex flex-col gap-8">
                        {error && (
                            <div className="text-base text-red-700 bg-red-50 rounded p-3 w-full">
                                <span className="font-WPIfont font-semibold">Error:</span> {error}
                            </div>
                        )}

                        {file && (
                            <div className="text-base text-green-700 bg-green-50 rounded p-3 w-full">
                                <div><span className="font-WPIfont font-semibold">Selected file:</span> {file.name}</div>
                                <div><span className="font-WPIfont font-semibold">Type:</span> {file.type || "Unknown"}</div>
                                <div><span className="font-WPIfont font-semibold">Size:</span> {(file.size / 1024).toFixed(2)} KB</div>
                                <div><span className="font-WPIfont font-semibold">Last modified:</span> {new Date(file.lastModified).toLocaleString()}</div>
                            </div>
                        )}

                        {csvData && csvData.length > 0 && (
                            <div className="overflow-auto max-h-96 w-full">
                                <table className="min-w-full border border-gray-300 mt-4 rounded-lg overflow-hidden">
                                    <thead className="sticky top-0 bg-WPIGrey">
                                        <tr>
                                            {csvData[0].map((header, idx) => (
                                                <th key={idx} className="border px-2 py-1 font-WPIfont font-semibold">{header}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {csvData.slice(1, 101).map((row, rowIdx) => (
                                            <tr key={rowIdx} className="font-WPIfont even:bg-gray-50 hover:bg-red-100 transition">
                                                {row.map((cell, cellIdx) => (
                                                    <td key={cellIdx} className="font-WPIfont border px-2 py-1">{cell}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
            <Footer />
        </div>
    );
};
