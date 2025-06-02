import { useFile } from "@/FileContext";

export const FileUpload = () => {
    const { file, setFile } = useFile();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center gap-4 min-h-[calc(100vh-theme(spacing.20))]">
            <div className="text-4xl text-amber-900">Upload a file</div>
            <label className="cursor-pointer px-6 py-2 bg-amber-700 text-white rounded shadow hover:bg-amber-800 transition">
                Choose File
                <input
                    type="file"
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
        </div>
    );
};