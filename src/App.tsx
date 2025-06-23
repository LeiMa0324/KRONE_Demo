import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { NavBar } from "./components/navbar";
import { Home } from "./pages/home";
import { About } from "./pages/about"; // Create this page
import { FileUpload } from "./pages/file_upload"; // Create this page
import { VisualizeTree } from "./pages/visualize_tree"; // Create this page
import { VisualizeTable } from "./pages/visualize_table"; // Create this page
import { KnowledgeTree } from "./pages/knowledge_tree";
import { ErrorPage } from "./pages/error_page"
import { FileProvider } from './FileContext';
import { KnowledgeBaseViz } from './pages/knowledge_base_viz';

function App() {
  return (
    <FileProvider>
      <Router>
        <NavBar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/file-upload" element={<FileUpload />} />
            <Route path="/visualize-tree" element={<VisualizeTree />} />
            <Route path="/knowledge-base" element={<KnowledgeBaseViz />} />
            <Route path="/log-table" element={<VisualizeTable />} />
            <Route path="/knowledge-tree" element={<KnowledgeTree />} /> {/* Add this line */}

            <Route path="*" element={<ErrorPage />} />
          </Routes>
      </Router>
    </FileProvider>
  );
}

export default App;
