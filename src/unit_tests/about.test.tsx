import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { About } from "@/pages/about"; // update this path as needed
import React from "react";

// Mock the carousel UI components with proper types
vi.mock("@/components/ui/carousel", () => ({
    Carousel: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="carousel">{children}</div>
    ),
    CarouselContent: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
    ),
    CarouselItem: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
    ),
    CarouselNext: () => <button>Next</button>,
    CarouselPrevious: () => <button>Previous</button>,
}));

describe("About Component", () => {
    it("renders all team members in the carousel", () => {
        render(<About />);

        const names = [
            "Lei Ma",
            "Elke Rundensteiner",
            "Peter VanNostrand",
            "Suhani Chaudhary",
            "Ethan Shanbaum",
            "Athanasios Tassiadamis",
        ];

        names.forEach((name) => {
            expect(screen.getByText(name)).toBeInTheDocument();
        });

        expect(screen.getByTestId("carousel")).toBeInTheDocument();
        expect(screen.getByText("Next")).toBeInTheDocument();
        expect(screen.getByText("Previous")).toBeInTheDocument();

        const images = screen.getAllByRole("img");
        expect(images.length).toBe(names.length);
    });
});
