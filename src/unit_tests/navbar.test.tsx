import { render, screen} from "@testing-library/react";
import { NavBar } from "@/components/navbar";
import { BrowserRouter } from "react-router-dom";

describe("Navbar Component", () => {
  it("renders navbar with logo and links", () => {
    render(
      <BrowserRouter>
        <NavBar />
      </BrowserRouter>
    );

    expect(screen.getByText("KRONE")).toBeInTheDocument();
    expect(screen.getByText("File Upload")).toBeInTheDocument();
    expect(screen.getByText("Visualize Tree")).toBeInTheDocument();
    expect(screen.getByText("Log Table")).toBeInTheDocument();
    expect(screen.getByText("About")).toBeInTheDocument();
  });
});