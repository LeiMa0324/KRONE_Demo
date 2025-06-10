import { Footer } from "@/components/footer";
import { render, screen } from "@testing-library/react";

//Unit testing for Footer Component, should load text correctly
describe("Footer Component", () => {
  it("renders the footer text", () => {
    render(<Footer />);
    expect(screen.getByText("© 2025 Worcester Polytechnic Institute")).toBeInTheDocument();
  });
});