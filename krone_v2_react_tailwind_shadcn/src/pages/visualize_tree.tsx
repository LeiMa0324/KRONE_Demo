import { ReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Footer } from "@/components/footer";

const nodeStyle = {
    background: '#AC2B37',
    color: 'white',
    border: '2px solid black',
    padding: 10,
    borderRadius: 8,
    fontWeight: 'bold',
    textAlign: 'center' as const,
};

const initialNodes = [
    { id: '1', position: { x: 0, y: 0 }, data: { label: 'Root' }, style: nodeStyle },
    { id: '2', position: { x: 0, y: 100 }, data: { label: 'Entity' }, style: nodeStyle },
    { id: '3', position: { x: 0, y: 200 }, data: { label: 'Action' }, style: nodeStyle },
    { id: '4', position: { x: 0, y: 300 }, data: { label: 'Status' }, style: nodeStyle },
];

const initialEdges = [
    { id: 'e1-2', source: '1', target: '2', type: 'smoothstep', style: { strokeWidth: 2 } },
    { id: 'e2-3', source: '2', target: '3', type: 'smoothstep', style: { strokeWidth: 2 } },
    { id: 'e3-4', source: '3', target: '4', type: 'smoothstep', style: { strokeWidth: 2 } },
];

export const VisualizeTree = () => {
    return (
        <>
            <div className="flex flex-col min-h-screen">
                <div className="pt-[4.5rem]"></div> {/* Account for navbar */}
                <div className="flex-grow bg-white flex justify-center items-center">
                    <div className="bg-white rounded-xl shadow-lg border border-gray-300 w-200 h-160">
                        <ReactFlow
                            nodes={initialNodes}
                            edges={initialEdges}
                            fitView
                            nodesDraggable={false}
                            nodesConnectable={false}
                            elementsSelectable={false}
                            panOnDrag={false}
                            zoomOnScroll={false}
                            zoomOnPinch={false}
                            panOnScroll={false}
                            zoomOnDoubleClick={false}
                            preventScrolling={false}
                        />
                    </div>
                </div>
                <Footer />
            </div>
        </>
    );
};
