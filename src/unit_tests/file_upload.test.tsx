import { FileUpload } from "@/pages/file_upload";
import { render, screen } from "@testing-library/react";
import { FileProvider } from "../FileContext";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";

//Unit testing for FileUpload Component: proper rendering, csv handling, and non-csv rejection
describe("FileUpload Component", () => {
    it("renders the file upload text", () => {
        render(
            <FileProvider>
                <FileUpload />
            </FileProvider>
        );
        expect(screen.getByText("Upload a File")).toBeInTheDocument();
    });

    it("accepts a valid .csv file and displays its info", async () => {
        render(
            <FileProvider>
                <FileUpload />
            </FileProvider>
        );

        const input = screen.getByTestId("file-input") as HTMLInputElement;
        const csvFile = new File(["name,age\nAlice,30"], "data.csv", { type: "text/csv" });

        await userEvent.upload(input, csvFile);

        expect(screen.getByText(/Selected file:/)).toBeInTheDocument();
        expect(screen.getByText(/data.csv/)).toBeInTheDocument();
        expect(screen.getByText(/text\/csv/)).toBeInTheDocument();
    });


    it("rejects non-.csv file types", async () => {
        render(
            <FileProvider>
                <FileUpload />
            </FileProvider>
        );

        const input = screen.getByTestId("file-input") as HTMLInputElement;
        const txtFile = new File(["Hello world"], "note.txt", { type: "text/plain" });

        await userEvent.upload(input, txtFile);

        // Assuming your component does not process or show invalid file types
        // You can test that the CSV data table does NOT appear
        expect(screen.queryByText(/Selected file:/)).not.toBeInTheDocument();
        expect(screen.queryByText(/note.txt/)).not.toBeInTheDocument();
    });
});

