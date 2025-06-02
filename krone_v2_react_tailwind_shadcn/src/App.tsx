import './App.css'
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { NavBar } from "./components/navbar";
import { Home } from "./pages/home";
import { About } from "./pages/about"; // Create this page
import { FileUpload } from "./pages/file_upload"; // Create this page
import { VisualizeTree } from "./pages/visualize_tree"; // Create this page
import { VisualizeTable } from "./pages/visualize_table"; // Create this page
import { ErrorPage } from "./pages/error_page"

function App() {
  return (
    <Router>
      <NavBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/file-upload" element={<FileUpload />} />
        <Route path="/visualize-tree" element={<VisualizeTree />} />
        <Route path="/log-table" element={<VisualizeTable />} />
        <Route path="*" element={<ErrorPage />} />
      </Routes>
    </Router>
  );
}

export default App;
