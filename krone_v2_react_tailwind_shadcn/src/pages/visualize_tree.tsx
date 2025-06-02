import { useFile } from "@/FileContext";

export const VisualizeTree = () => {
    const { file } = useFile();
    return (
        <div className="text-9xl text-amber-900" > 
            This will be the visualize tree page 
            {file ? <div>File: {file.name}</div> : <div>No file uploaded</div>}
        </div>
    )
}