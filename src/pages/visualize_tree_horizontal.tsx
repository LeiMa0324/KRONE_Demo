import { useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

import type { CarouselApi } from "@/components/ui/carousel";
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

interface CsvRow {
  source_entity: string;
  target_entity: string;
  action?: string;
  summary?: string;
  status?: string;
}

type EntityTree = {
  entity: string;
  actions: {
    action: string;
    targets: string[];
  }[];
};

function buildEntityTrees(rows: CsvRow[]): EntityTree[] {
  const entityMap: Record<string, EntityTree> = {};
  rows.forEach(row => {
    if (!row.source_entity) return;
    if (!entityMap[row.source_entity]) {
      entityMap[row.source_entity] = { entity: row.source_entity, actions: [] };
    }
    const actionLabel = row.action || row.summary || "(no action)";
    let actionObj = entityMap[row.source_entity].actions.find(a => a.action === actionLabel);
    if (!actionObj) {
      actionObj = { action: actionLabel, targets: [] };
      entityMap[row.source_entity].actions.push(actionObj);
    }
    if (row.target_entity && !actionObj.targets.includes(row.target_entity)) {
      actionObj.targets.push(row.target_entity);
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
    (sum, e) => sum + e.actions.reduce((aSum, a) => aSum + a.targets.length, 0),
    0
  );

  const selectedTree = entityTrees.find(tree => tree.entity === selectedEntity);

  return (
    <div className="flex flex-col min-h-screen items-center relative pt-20">
      <h1 className="text-3xl font-bold text-WPIRed mb-8 mt-2">Entity Action Tree (Horizontal)</h1>
      {/* Totals Row */}
      <div className="flex flex-row gap-8 items-center mt-8 mb-2 text-lg font-semibold">
        <div className="px-4 py-2 bg-white rounded shadow">Entities: {totalEntities}</div>
        <div className="px-4 py-2 bg-white rounded shadow">Actions: {totalActions}</div>
        <div className="px-4 py-2 bg-white rounded shadow">Statuses: {totalStatuses}</div>
      </div>
      <div className="w-full flex justify-center mb-4">
        <div
          className="relative flex gap-1 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200 px-2 py-1 rounded bg-gray-100"
          style={{ minHeight: 32, maxWidth: "90vw" }}
        >
          {/* Viewport indicator */}
          <div
            className="absolute top-0 left-0 h-full pointer-events-none transition-all duration-200"
            style={{
              // Show the viewport for the 5 visible entities in the carousel
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
              key={tree.entity}
              className={`relative z-10 w-6 h-6 rounded-sm border-2 flex items-center justify-center text-[10px] font-bold
                ${carouselIdx <= idx && idx < carouselIdx + 5 ? "border-WPIRed bg-WPIRed/80 text-white" : "border-gray-400 bg-gray-200 text-gray-600"}
                ${selectedEntity === tree.entity ? "ring-2 ring-amber-400" : ""}
              `}
              title={tree.entity}
              onClick={() => {
                setCarouselIdx(idx);
                carouselApiRef.current?.scrollTo(idx);
                setSelectedEntity(tree.entity);
              }}
              style={{ minWidth: 24 }}
            >
              {tree.entity.slice(0, 2)}
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
            <CarouselItem key={tree.entity} className="basis-1/5 px-2">
              <div
                ref={el => { entityRefs.current[idx] = el; }}
                className="flex flex-col items-center"
              >
                <Card
                  className={`mb-4 w-11/12 h-2/6 flex items-center justify-center bg-WPIRed text-white shadow-lg cursor-pointer transition ring-2 ${selectedEntity === tree.entity ? "ring-amber-400 scale-105" : "ring-transparent"}`}
                  onClick={() =>
                    setSelectedEntity(selectedEntity === tree.entity ? null : tree.entity)
                  }
                  title="Click to select, double-click for details"
                >
                  <CardTitle className="text-lg text-center">{tree.entity}</CardTitle>
                  <div className="mt-2 text-xs text-white/90 text-center">
                    <div><span className="font-semibold">ID:</span> {tree.entity}</div>
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
          {/* Actions Carousel if too many */}
          {selectedTree.actions.length > ACTIONS_PER_VIEW ? (
            <Carousel className="w-full max-w-11/12">
                <CarouselContent>
                {selectedTree.actions.map((action, aIdx) => (
                    <CarouselItem key={aIdx} className="basis-1/10 px-2">
                    <div className="flex flex-col items-center">
                        <Card
                          className="w-32 h-16 flex items-center justify-center bg-amber-200 text-amber-900 shadow cursor-pointer"
                          onClick={() =>
                            setModalInfo({
                              id: action.action,
                              level: "action",
                              numChildren: action.targets.length,
                            })
                          }
                          title="Click for details"
                        >
                        <CardContent className="text-xs text-center">{action.action}</CardContent>
                        </Card>
                        {/* Targets */}
                        <div className="flex flex-row gap-1 mt-1">
                        {action.targets.map((target, tIdx) => (
                            <Card
                              key={tIdx}
                              className="w-20 h-10 flex items-center justify-center bg-gray-100 text-gray-700 shadow cursor-pointer"
                              onClick={() =>
                                setModalInfo({
                                  id: target,
                                  level: "status",
                                  numChildren: 0,
                                })
                              }
                              title="Click for details"
                            >
                            <CardContent className="text-xs text-center">{target}</CardContent>
                            </Card>
                        ))}
                        </div>
                    </div>
                    </CarouselItem>
                ))}
                </CarouselContent>
                <CarouselPrevious />
                <CarouselNext />
            </Carousel>
          ) : (
            // If not too many actions, just show them all centered
            <div className="flex flex-row gap-4 justify-center">
              {selectedTree.actions.map((action, aIdx) => (
                <div key={aIdx} className="flex flex-col items-center">
                  <Card
                    className="w-32 h-16 flex items-center justify-center bg-amber-200 text-amber-900 shadow cursor-pointer"
                    onClick={() =>
                      setModalInfo({
                        id: action.action,
                        level: "action",
                        numChildren: action.targets.length,
                      })
                    }
                    title="Click for details"
                  >
                    <CardContent className="text-xs text-center">{action.action}</CardContent>
                  </Card>
                  {/* Targets */}
                  <div className="flex flex-row gap-1 mt-1">
                    {action.targets.map((target, tIdx) => (
                      <Card
                        key={tIdx}
                        className="w-20 h-10 flex items-center justify-center bg-gray-100 text-gray-700 shadow cursor-pointer"
                        onClick={() =>
                          setModalInfo({
                            id: target,
                            level: "status",
                            numChildren: 0,
                          })
                        }
                        title="Click for details"
                      >
                        <CardContent className="text-xs text-center">{target}</CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
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