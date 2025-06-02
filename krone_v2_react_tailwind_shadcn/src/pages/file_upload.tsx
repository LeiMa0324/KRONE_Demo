import { useFile } from "@/FileContext";

export const FileUpload = () => {
    const { file, setFile } = useFile();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    return (
        <div className="flex flex-col items-center gap-4">
            <div className="text-4xl text-amber-900">Upload a file</div>
            <input type="file" onChange={handleChange} />
            {file && (
                <div className="text-lg text-green-700">
                    Selected file: {file.name}
                </div>
            )}
        </div>
    );
};