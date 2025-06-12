import { Footer } from "@/components/footer";
import { render, screen } from "@testing-library/react";

describe("Footer Component", () => {
  it("renders the footer text", () => {
    render(<Footer />);
    expect(screen.getByText("© 2025 Worcester Polytechnic Institute")).toBeInTheDocument();
  });
});