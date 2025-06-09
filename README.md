# Project Overview

KRONE is a hierarchically structure-aware log anomaly detection platform designed to help system administrators and security analysts monitor, analyze, and respond to system anomalies in real time. Traditional log anomaly detection tools often treat logs as flat sequences, missing important structural relationships. KRONE addresses this by breaking down logs into structured representations, capturing status, action, and entity, to enable fine-grained and context-aware anomaly detection.

With KRONE, users can:
- Visualize and interact with large log sequences as knowledge graphs.
- Detect both high-level and low-level anomalies with greater accuracy.
- Quickly identify root causes of system failures or security incidents.
- Explore and compare anomaly patterns for deeper insights.

**Key Benefits:**
- **Hierarchical Analysis:** Gain insights into the natural, hierarchical structure of your log sequences. KRONE automatically extracts and organizes log data into status, action, and entity levels, allowing you to see how normal log sequences are structured and how different components relate to each other.
- **Interactive Visualization:** Explore your logs as an interactive knowledge graph. This visualization makes it easy to understand relationships and dependencies within your system. You can click into nodes to drill down into specific log events, and switch to a timeline view to analyze how normal and abnormal patterns evolve over time.
- **Anomaly Analysis:** Precisely identify where anomalies occur within the hierarchy—whether at the status, action, or entity level. KRONE highlights the exact point and context of each anomaly, helping you uncover root causes, recurring patterns, and the broader impact of abnormal events.

# How It Works

KRONE processes logs in four key stages:
1. **Preprocessing**: CSV logs are parsed and normalized.
2. **Structure Extraction**: Logs are converted into hierarchical sequences (status → action → entity).
3. **Model Inference**: Sequences are analyzed using level-decoupled and cross-level detection.
4. **Visualization**: Results are visualized as graphs and anomaly tables for exploration and debugging.


# Features
<!-- (TODO: Add screenshots explaining general flow) -->

KRONE provides an interactive platform for log anomaly detection, offering the following key features:
## 1. Log File Upload & Preview
- **CSV Upload:** Upload raw log sequences in CSV format directly through the web interface.
- **Preview:** Preview CSV file before processing to ensure correct formatting and data selection.

## 2. Hierarchical Log Analysis
- **Structured Extraction:** KRONE automatically extracts hierarchical objects (such as status, action, and entity) from the uploaded log sequences.
- **Knowledge Base Construction:** The system builds a knowledge base representing the typical hierarchical structure of actions and relationships between entities.

## 3. Anomaly Detection
- **Model Inference:** The KRONE model analyzes the structured log data to detect anomalies by identifying log sequences that break the learned hierarchical patterns (entity, action, status). The model classifies each log sequence as normal or abnormal.
- **Prediction Results:** View model predictions for individual log sequences in a tabular format, which highlights the exact rows where the anomaly appears.

## 4. Visualization & Exploration
- **Knowledge Graph:** Explore the learned knowledge base as an interactive graph to understand patterns and relationships.
- **Root Cause Analysis:** Use graph visualizations to quickly identify anomaly patterns and pinpoint root causes of failures or incidents.

KRONE’s intuitive interface optimizes the process of monitoring system health, exploring log data, and responding to anomalies.

# Getting Started

Make sure you have the following installed:
- Node.js
- npm
- Git
- A modern browser


1. **Clone the repository:**
   ```sh
   git clone https://github.com/your-username/KRONE_Demo.git
   cd KRONE_Demo
   ```

2. **Install Vite:**
   ```sh
   npm install -g vite
   ```

3. **Install dependencies:**
   ```sh
   npm install
   ```

4. **Run the development server:**
   ```sh
   npm run dev
   ```

5. **Open the app:**
   Visit [http://localhost:5173](http://localhost:5173) in your browser.

6. **Upload your log CSV:**  
   Use the web interface to upload and analyze your log files.

# Technologies Used
- React
- Typescript
- Vite
- Tailwind CSS
- @xyflow/react
- papaparse
- lucide-react
- shadcn/ui