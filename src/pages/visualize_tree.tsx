import { useEffect, useState } from "react";
import { ReactFlow } from "@xyflow/react";
import type { Node, Edge, NodeMouseHandler } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Footer } from "@/components/footer";
import papa from "papaparse";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Define types for CSV rows and nodes/edges
interface CsvRow {
  source_entity: string;
  target_entity: string;
  action?: string;
  summary?: string;
  status?: string;
}

interface CustomNode extends Node {
  data: {
    label: string;
  };
}

interface CustomEdge extends Edge {
  style?: {
    strokeWidth?: number;
    stroke?: string;
    strokeDasharray?: string;
  };
  labelStyle?: {
    fill?: string;
  };
}

// Define styles
const nodeStyle: React.CSSProperties = {
  background: "#AC2B37",
  color: "white",
  border: "2px solid black",
  padding: 10,
  borderRadius: "50%",
  fontWeight: "bold",
  textAlign: "center",
};

const largeNodeStyle: React.CSSProperties = {
  ...nodeStyle,
  fontSize: 20,
  padding: 22,
};

const treeNodeStyle: React.CSSProperties = {
  background: "#AC2B37",
  color: "white",
  border: "2px solid black",
  padding: 10,
  borderRadius: 8,
  fontWeight: "bold",
  textAlign: "center",
};

// Constants for radial layout
const centerX = 400;
const centerY = 300;
const radius = 200;

// Generate radial nodes and edges
const generateRadialNodes = (
  entities: string[],
  centerX: number,
  centerY: number,
  baseRadius: number
): { nodes: CustomNode[]; edges: CustomEdge[] } => {
  const nodeSize = 100;
  const n = entities.length;
  const radiusX =
    n > 1
      ? Math.max(baseRadius, nodeSize / (2 * Math.sin(Math.PI / n))) * 1.5
      : baseRadius;
  const radiusY = radiusX * 0.8;

  const nodes: CustomNode[] = [
    {
      id: "root",
      type: "autoFont",
      data: { label: "Root" },
      position: { x: centerX, y: centerY },
      style: largeNodeStyle,
    },
  ];
  const edges: CustomEdge[] = [];

  entities.forEach((entity, i) => {
    const angle = (2 * Math.PI * i) / n;
    const x = centerX + radiusX * Math.cos(angle);
    const y = centerY + radiusY * Math.sin(angle);
    const nodeId = `entity-${i}`;
    nodes.push({
      id: nodeId,
      type: "autoFont",
      data: { label: entity || "(empty)" },
      position: { x, y },
      style: largeNodeStyle,
    });
    edges.push({
      id: `root-${nodeId}`,
      source: "root",
      target: nodeId,
      type: "straight",
      style: { strokeWidth: 2 },
    });
  });
  return { nodes, edges };
};

export const VisualizeTree = () => {
  const [nodes, setNodes] = useState<CustomNode[]>([]);
  const [edges, setEdges] = useState<CustomEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<CustomNode | null>(null);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);

  useEffect(() => {
    fetch("/structured_processes.csv")
      .then((res) => res.text())
      .then((csv) => {
        papa.parse<CsvRow>(csv, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const entities = Array.from(
              new Set(
                results.data
                  .flatMap((row) => [row.source_entity, row.target_entity])
                  .filter(Boolean)
              )
            );
            const { nodes, edges } = generateRadialNodes(
              entities,
              centerX,
              centerY,
              radius
            );

            const entityNodeIds: Record<string, string> = {};
            entities.forEach((entity, i) => {
              entityNodeIds[entity] = `entity-${i}`;
            });

            const entityEdges = results.data
              .filter(
                (row) =>
                  row.source_entity &&
                  row.target_entity &&
                  entityNodeIds[row.source_entity] &&
                  entityNodeIds[row.target_entity]
              )
              .map((row, idx) => ({
                id: `entity-edge-${idx}`,
                source: entityNodeIds[row.source_entity],
                target: entityNodeIds[row.target_entity],
                type: "straight",
                style: { strokeWidth: 2, stroke: "#FFB81C", strokeDasharray: "5" },
                label: row.action || "",
                labelStyle: { fill: "#FFB81C" },
              }));

            setNodes(nodes);
            setEdges([...edges, ...entityEdges]);
            setCsvRows(results.data);
          },
        });
      });
  }, []);

  const handleNodeClick: NodeMouseHandler = (_, node) => {
    if (node.id !== "root") {
      setSelectedNode(node as CustomNode);
    }
  };

  const handleCloseDialog = () => setSelectedNode(null);

  const getDialogSubgraph = () => {
    if (!selectedNode) return { nodes: [], edges: [] };

    const entityLabel = selectedNode.data?.label;

    const seen = new Set<string>();
    const actions = csvRows
      .filter((row) => row.source_entity === entityLabel)
      .map((row) => row.action || row.summary || "(no action)")
      .filter((label) => {
        if (seen.has(label)) return false;
        seen.add(label);
        return true;
      })
      .map((label, idx) => ({
        id: `action-${idx}`,
        label,
      }));

    const actionCount = actions.length;
    const containerWidth = 800;
    const actionSpacing = actionCount > 1 ? containerWidth / (actionCount + 1) : 0;

    const rootNode: CustomNode = {
      id: "entity-root",
      data: { label: entityLabel },
      position: { x: containerWidth / 2, y: 100 },
      style: treeNodeStyle,
    };

    const actionNodes: CustomNode[] = actions.map((action, i) => ({
      id: action.id,
      data: { label: action.label },
      position: { x: actionSpacing * (i + 1), y: 250 },
      style: {
        ...treeNodeStyle,
        background: "#FFB81C",
      },
    }));

    const edges: CustomEdge[] = actions.map((action) => ({
      id: `edge-entity-${action.id}`,
      source: "entity-root",
      target: action.id,
      type: "smoothstep",
      style: { strokeWidth: 2 },
    }));

    const statusNodes: CustomNode[] = [];
    const statusEdges: CustomEdge[] = [];
    actions.forEach((action, i) => {
      const matchingRows = csvRows.filter(
        (row) =>
          row.source_entity === entityLabel &&
          (row.action || row.summary || "(no action)") === action.label
      );
      const statusCount = matchingRows.length;
      const statusSpacing = statusCount > 1 ? 100 : 0;
      matchingRows.forEach((row, j) => {
        const statusId = `status-${i}-${j}`;
        statusNodes.push({
          id: statusId,
          data: { label: row.status || "(no status)" },
          position: {
            x:
              actionSpacing * (i + 1) +
              (j - (statusCount - 1) / 2) * statusSpacing,
            y: 370 + (j % 2) * 40, // vertical stagger
          },
          style: {
            ...treeNodeStyle,
            background: "#A7A8AA",
            fontWeight: "normal",
          },
        });
        statusEdges.push({
          id: `edge-${action.id}-${statusId}`,
          source: action.id,
          target: statusId,
          type: "smoothstep",
          style: { strokeWidth: 1.5, stroke: "#A7A8AA" },
        });
      });
    });

    return {
      nodes: [rootNode, ...actionNodes, ...statusNodes],
      edges: [...edges, ...statusEdges],
    };
  };

  const dialogSubgraph = getDialogSubgraph();

  return (
    <>
      <div className="flex flex-col min-h-screen items-center">
        <div className="pt-[4.5rem]"></div>
        <div className="items-center">
          <div className="w-[1000px] h-[1000px] animate-fade-in-slow">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              fitView
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={true}
              panOnDrag={false}
              zoomOnScroll={false}
              zoomOnPinch={false}
              panOnScroll={false}
              zoomOnDoubleClick={false}
              preventScrolling={false}
              onNodeClick={handleNodeClick}
            />
          </div>
        </div>
        <Dialog open={!!selectedNode} onOpenChange={handleCloseDialog}>
          <DialogContent className="sm:max-w-[900px] overflow-hidden items-center">
            <DialogHeader>
              <DialogTitle>{selectedNode?.data?.label}</DialogTitle>
            </DialogHeader>
            <div className="my-4 border rounded bg-gray-50 w-[850px] h-[600px] overflow-hidden">
              <ReactFlow
                nodes={dialogSubgraph.nodes}
                edges={dialogSubgraph.edges}
                fitView
                nodesDraggable={true}
                nodesConnectable={false}
                elementsSelectable={true}
                panOnDrag={false}
                zoomOnScroll={true}
                zoomOnPinch={true}
                panOnScroll={true}
                zoomOnDoubleClick={true}
                preventScrolling={false}
                style={{ background: "#f9fafb" }}
              />
            </div>
          </DialogContent>
        </Dialog>
        <Footer />
      </div>
    </>
  );
};