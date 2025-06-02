import React, { createContext, useContext, useState } from "react";

type FileContextType = {
  file: File | null;
  setFile: (file: File | null) => void;
};

const FileContext = createContext<FileContextType | undefined>(undefined);

export const FileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [file, setFile] = useState<File | null>(null);
  return (
    <FileContext.Provider value={{ file, setFile }}>
      {children}
    </FileContext.Provider>
  );
};

export const useFile = () => {
  const context = useContext(FileContext);
  if (!context) throw new Error("useFile must be used within a FileProvider");
  return context;
};