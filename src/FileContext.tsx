import React, { createContext, useContext, useState } from "react";
import Papa from "papaparse";

type FileContextType = {
  csvData: string[][] | null;
  setCsvFile: (file: File | null) => void;
  fileName: string | null;
};

const FileContext = createContext<FileContextType | undefined>(undefined);

export const FileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [csvData, setCsvData] = useState<string[][] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const setCsvFile = (file: File | null) => {
    if (!file) {
      setCsvData(null);
      setFileName(null);
      return;
    }
    setFileName(file.name);
    Papa.parse(file, {
      complete: (result) => {
        setCsvData(result.data as string[][]);
      },
      skipEmptyLines: true,
    });
  };

  return (
    <FileContext.Provider value={{ csvData, setCsvFile, fileName }}>
      {children}
    </FileContext.Provider>
  );
};

export const useFile = () => {
  const context = useContext(FileContext);
  if (!context) throw new Error("useFile must be used within a FileProvider");
  return context;
};