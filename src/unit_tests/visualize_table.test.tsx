import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VisualizeTable } from "@/pages/visualize_table";
import { BrowserRouter } from "react-router-dom";
import csvText from "@/assets/demo_data.csv?raw";
import {vi} from 'vitest';

// Mock fetch with correct typing
beforeAll(() => {
    global.fetch = vi.fn(() =>
        Promise.resolve({
            text: () => Promise.resolve(csvText),
        })
    ) as unknown as typeof fetch;
});

describe("VisualizeTable Component", () => {
    it("Correctly updates display on Run Option button press", async () => {
        const user = userEvent.setup();

        render(
            <BrowserRouter>
                <VisualizeTable />
            </BrowserRouter>
        );

        const button = await screen.findByRole("button", { name: "run button" });

        await user.click(button);

        const prediction = await screen.findByLabelText("prediction");
        expect(["Abnormal", "Normal"]).toContain(prediction.textContent);
    });
});
