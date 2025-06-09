import { useFile } from "@/FileContext";
import { useState } from "react";
import { Upload } from "lucide-react";
import { Footer } from "@/components/footer";

export const FileUpload = () => {
  const { csvData, setCsvFile, fileName } = useFile();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setCsvFile(file);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <div className="pt-[4.5rem]"></div>
      <div className="flex-grow flex flex-col items-center justify-center gap-8 bg-gradient-to-br from-gray-300 to-gray-400 animate-fade-in-fast">
        <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-5xl flex flex-col items-center gap-6">
          <Upload className="w-12 h-12 text-WPIRed mb-2 animate-bounce" />
          <div className="text-4xl font-bold text-WPIRed">Upload a File</div>
          <label className="cursor-pointer px-8 py-3 text-WPIRed rounded-lg shadow shadow-gray-400 hover:bg-WPIRed hover:text-white transition flex items-center gap-2 text-lg font-medium focus:ring-4 focus:ring-amber-300">
            <Upload className="w-5 h-5" />
            Choose File
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleChange}
              className="hidden"
            />
          </label>
          {fileName && (
            <div className="text-base text-green-700 bg-green-50 rounded p-3 w-full">
              <div><span className="font-semibold">Selected file:</span> {fileName}</div>
              <div><span className="font-semibold">Size:</span> {selectedFile ? (selectedFile.size / 1024).toFixed(2) : "?"} KB</div>
              <div><span className="font-semibold">Last modified:</span> {selectedFile ? new Date(selectedFile.lastModified).toLocaleString() : "?"}</div>
            </div>
          )}
          {csvData && csvData.length > 0 && (
            <div className="overflow-auto max-h-96 w-full">
              <table className="min-w-full border border-gray-300 mt-4 rounded-lg overflow-hidden">
                <thead className="sticky top-0 bg-WPIGrey">
                  <tr>
                    {csvData[0].map((header, idx) => (
                      <th key={idx} className="border px-2 py-1 font-semibold">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvData.slice(1, 101).map((row, rowIdx) => (
                    <tr key={rowIdx} className="even:bg-gray-50 hover:bg-red-100 transition">
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
      </div>
      <Footer />
    </div>
  );
};