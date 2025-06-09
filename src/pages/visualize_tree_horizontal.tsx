import { useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import {
  Card,
  CardContent,
  CardTitle,
} from "@/components/ui/card";

// Simple Modal
function Modal({ open, onClose, children }: { open: boolean, onClose: () => void, children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-lg p-6 min-w-[300px] relative">
        <button className="absolute top-2 right-2 text-gray-500 hover:text-black" onClick={onClose}>✕</button>
        {children}
      </div>
    </div>
  );
}

// --- CSV and Tree Types ---
interface CsvRow {
  entity_1: string;
  entity_1_id: string;
  action_1: string;
  action_1_id: string;
  status: string;
  status_id: string;
  // ...other columns if present
}

type StatusNode = {
  id: string;
  name: string;
};
type ActionNode = {
  id: string;
  name: string;
  statuses: StatusNode[];
};
type EntityTree = {
  id: string;
  name: string;
  actions: ActionNode[];
};

function buildEntityTrees(rows: CsvRow[]): EntityTree[] {
  const entityMap: Record<string, EntityTree> = {};
  console.log(rows)

  rows.forEach(row => {
    if (!row.entity_1_id) return;

    // Add entity if not present
    if (!entityMap[row.entity_1_id]) {
      entityMap[row.entity_1_id] = {
        id: row.entity_1_id,
        name: row.entity_1,
        actions: [],
      };
    }
    const entity = entityMap[row.entity_1_id];

    // Find or add action
    let action = entity.actions.find(a => a.id === row.action_1_id);
    if (!action) {
      action = {
        id: row.action_1_id,
        name: row.action_1,
        statuses: [],
      };
      entity.actions.push(action);
    }

    // Find or add status
    if (
      row.status_id &&
      !action.statuses.some(s => s.id === row.status_id)
    ) {
      action.statuses.push({
        id: row.status_id,
        name: row.status,
      });
    }
  });

  return Object.values(entityMap);
}

const ACTIONS_PER_VIEW = 10;

type ModalInfo = {
  id: string;
  level: "entity" | "action" | "status";
  numChildren: number;
};

export default function VisualizeTreeHorizontal() {
  const [entityTrees, setEntityTrees] = useState<EntityTree[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [modalInfo, setModalInfo] = useState<ModalInfo | null>(null);
  const entityRefs = useRef<(HTMLDivElement | null)[]>([]);
  const actionsSectionRef = useRef<HTMLDivElement | null>(null);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const carouselApiRef = useRef<CarouselApi | null>(null);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);


  useEffect(() => {
    fetch("/structured_processes.csv")
      .then(res => res.text())
      .then(csv => {
        Papa.parse<CsvRow>(csv, {
          header: true,
          skipEmptyLines: true,
          complete: results => {
            setEntityTrees(buildEntityTrees(results.data as CsvRow[]));
          },
        });
      });
  }, []);

  useEffect(() => {
    if (!carouselApiRef.current) return;
    const api = carouselApiRef.current;
    const onSelect = () => {
      setCarouselIdx(api.selectedScrollSnap());
    };
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [entityTrees]);

  useEffect(() => {
    if (carouselApiRef.current) {
      carouselApiRef.current.scrollTo(carouselIdx);
    }
  }, [carouselIdx]);

  // Totals
  const totalEntities = entityTrees.length;
  const totalActions = entityTrees.reduce((sum, e) => sum + e.actions.length, 0);
  const totalStatuses = entityTrees.reduce(
    (sum, e) => sum + e.actions.reduce((aSum, a) => aSum + a.statuses.length, 0),
    0
  );

  const selectedTree = entityTrees.find(tree => tree.id === selectedEntity);

  return (
    <div className="flex flex-col min-h-screen items-center relative pt-20">
      <h1 className="text-3xl font-bold text-WPIRed mb-8 mt-2">Entity Action Tree (Horizontal)</h1>
      {/* Totals Row */}
      <div className="flex flex-row gap-8 items-center mt-8 mb-2 text-lg font-semibold">
        <div className="px-4 py-2 bg-white rounded shadow">Entities: {totalEntities}</div>
        <div className="px-4 py-2 bg-white rounded shadow">Actions: {totalActions}</div>
        <div className="px-4 py-2 bg-white rounded shadow">Statuses: {totalStatuses}</div>
      </div>
      {/* Minimap */}
      <div className="w-full flex justify-center mb-4">
        <div
          className="relative flex gap-1 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200 px-2 py-1 rounded bg-gray-100"
          style={{ minHeight: 32, maxWidth: "90vw" }}
        >
          {/* Viewport indicator */}
          <div
            className="absolute top-0 left-0 h-full pointer-events-none transition-all duration-200"
            style={{
              left: `calc(${(carouselIdx / entityTrees.length) * 100}% - 2px)`,
              width: `calc(${(5 / entityTrees.length) * 100}% + 4px)`,
              background: "rgba(172,43,55,0.08)",
              border: "2px solid #AC2B37",
              borderRadius: 6,
              zIndex: 1,
            }}
          />
          {/* Minimap buttons */}
          {entityTrees.map((tree, idx) => (
            <button
              key={tree.id}
              className={`relative z-10 w-6 h-6 rounded-sm border-2 flex items-center justify-center text-[10px] font-bold
                ${carouselIdx <= idx && idx < carouselIdx + 5 ? "border-WPIRed bg-WPIRed/80 text-white" : "border-gray-400 bg-gray-200 text-gray-600"}
                ${selectedEntity === tree.id ? "ring-2 ring-amber-400" : ""}
              `}
              title={tree.name}
              onClick={() => {
                setCarouselIdx(idx);
                carouselApiRef.current?.scrollTo(idx);
                setSelectedEntity(tree.id);
              }}
              style={{ minWidth: 24 }}
            >
              {tree.name.slice(0, 2)}
            </button>
          ))}
        </div>
      </div>
      {/* Main Entity Carousel */}
      <Carousel
        className="w-full max-w-11/12"
        setApi={api => (carouselApiRef.current = api)}
        opts={{ align: "start" }}
      >
        <CarouselContent>
          {entityTrees.map((tree, idx) => (
            <CarouselItem key={tree.id} className="basis-1/5 px-2 py-5">
              <div
                ref={el => { entityRefs.current[idx] = el; }}
                className="flex flex-col items-center"
              >
                <Card
                  className={`mb-4 w-11/12 h-2/6 flex flex-col items-center justify-center bg-WPIRed text-white shadow-lg transition ring-2
                    ${selectedEntity === tree.id ? "border-4 border-black scale-105" : "border-2 border-transparent"}
                  `}
                  onClick={() =>
                    setSelectedEntity(selectedEntity === tree.id ? null : tree.id)
                  }
                  onContextMenu={e => {
                    e.preventDefault();
                    setModalInfo({
                      id: tree.id,
                      level: "entity",
                      numChildren: tree.actions.length,
                    });
                  }}
                  title="Left click to select, right click for details"
                >
                  <CardTitle className="text-lg text-center">{tree.name}</CardTitle>
                  <div className="mt-2 text-xs text-white/90 text-center">
                    <div><span className="font-semibold">ID:</span> {tree.id}</div>
                    <div><span className="font-semibold">Level:</span> entity</div>
                    <div><span className="font-semibold">Number of children:</span> {tree.actions.length}</div>
                  </div>
                </Card>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>

      {/* Actions/Statuses Section */}
      {selectedTree && (
        <div
          ref={actionsSectionRef}
          className="w-full flex flex-col items-center relative mt-12 min-h-[220px] z-10"
        >
          <div className="text-2xl font-semibold mb-4 text-WPIRed">
            Actions for "{selectedTree.name}"
          </div>
          {/* Actions Row - now with carousel */}
          {selectedTree.actions.length > ACTIONS_PER_VIEW ? (
            <Carousel className="w-full max-w-11/12 mb-4">
              <CarouselContent>
                {selectedTree.actions.map((action) => (
                  <CarouselItem key={action.id} className="basis-1/10 px-2 py-5">
                    <div className="flex flex-col items-center">
                      <Card
                        className={`w-32 h-16 flex items-center justify-center bg-amber-200 text-amber-900 shadow cursor-pointer transition ring-2
                          ${selectedActionId === action.id ? "border-2 border-black scale-105" : "border-2 border-transparent"}
                        `}
                        onClick={() =>
                          setSelectedActionId(selectedActionId === action.id ? null : action.id)
                        }
                        onContextMenu={e => {
                          e.preventDefault();
                          setModalInfo({
                            id: action.id,
                            level: "action",
                            numChildren: action.statuses.length,
                          });
                        }}
                        title="Left click to show statuses, right click for details"
                      >
                        <CardContent className="text-xs text-center">{action.name}</CardContent>
                      </Card>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious />
              <CarouselNext />
            </Carousel>
          ) : (
            <div className="flex flex-row gap-4 justify-center mb-4">
              {selectedTree.actions.map((action) => (
                <div key={action.id} className="flex flex-col items-center">
                  <Card
                    className={`w-32 h-16 flex items-center justify-center bg-amber-200 text-amber-900 shadow cursor-pointer transition ring-2 ${
                      selectedActionId === action.id ? "border-2 border-black scale-105" : "ring-transparent"
                    }`}
                    onClick={() =>
                      setSelectedActionId(selectedActionId === action.id ? null : action.id)
                    }
                    onContextMenu={e => {
                      e.preventDefault();
                      setModalInfo({
                        id: action.id,
                        level: "action",
                        numChildren: action.statuses.length,
                      });
                    }}
                    title="Left click to show statuses, right click for details"
                  >
                    <CardContent className="text-xs text-center">{action.name}</CardContent>
                  </Card>
                </div>
              ))}
            </div>
          )}

          {/* Statuses Section */}
          {selectedActionId && (() => {
            const action = selectedTree.actions.find(a => a.id === selectedActionId);
            if (!action) return null;
            return (
              <div className="w-full flex flex-col items-center mt-8">
                <div className="text-lg font-semibold mb-2 text-WPIRed">Statuses for "{action.name}"</div>
                {action.statuses.length > ACTIONS_PER_VIEW ? (
                  <Carousel className="w-full max-w-11/12">
                    <CarouselContent>
                      {action.statuses.map((status) => (
                        <CarouselItem key={status.id} className="basis-1/10 px-2 py-5">
                          <Card
                            className="w-24 h-12 flex items-center justify-center bg-gray-100 text-gray-700 shadow cursor-pointer"
                            onContextMenu={e => {
                              e.preventDefault();
                              setModalInfo({
                                id: status.id,
                                level: "status",
                                numChildren: 0,
                              });
                            }}
                            title="Right click for details"
                          >
                            <CardContent className="text-xs text-center">{status.name}</CardContent>
                          </Card>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    <CarouselPrevious />
                    <CarouselNext />
                  </Carousel>
                ) : (
                  <div className="flex flex-row gap-2 justify-center">
                    {action.statuses.map((status) => (
                      <Card
                        key={status.id}
                        className="w-24 h-12 flex items-center justify-center bg-gray-100 text-gray-700 shadow cursor-pointer"
                        onContextMenu={e => {
                          e.preventDefault();
                          setModalInfo({
                            id: status.id,
                            level: "status",
                            numChildren: 0,
                          });
                        }}
                        title="Right click for details"
                      >
                        <CardContent className="text-xs text-center">{status.name}</CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Modal */}
      <Modal open={!!modalInfo} onClose={() => setModalInfo(null)}>
        {modalInfo && (
          <div className="flex flex-col gap-2">
            <div><span className="font-semibold">ID:</span> {modalInfo.id}</div>
            <div><span className="font-semibold">Level:</span> {modalInfo.level}</div>
            <div><span className="font-semibold">Number of children:</span> {modalInfo.numChildren}</div>
          </div>
        )}
      </Modal>
    </div>
  );
}