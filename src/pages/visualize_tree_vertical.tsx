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


// --- CSV and Tree Types ---
interface CsvRow {
  entity_1: string;
  entity_1_id: string;
  action_1: string;
  action_1_id: string;
  status: string;
  status_id: string;
  is_anomaly?: string;
  is_anomaly_reason?: string;
  // ...other columns if present
}

type StatusNode = {
  id: string;
  name: string;
  isAnomaly?: boolean;
  anomalyReasons?: string[];
};
type ActionNode = {
  id: string;
  name: string;
  statuses: StatusNode[];
  isAnomaly?: boolean;
  anomalyReasons?: string[];
};
type EntityTree = {
  id: string;
  name: string;
  actions: ActionNode[];
  isAnomaly?: boolean;
  anomalyReasons?: string[];
};

function buildEntityTrees(rows: CsvRow[]): EntityTree[] {
  const entityMap: Record<string, EntityTree> = {};
  const entityAnomalySet = new Set<string>();

  rows.forEach(row => {
    if (!row.entity_1_id) return;
    const isAnomaly = row.is_anomaly === "True";
    const reason = row.is_anomaly_reason?.trim() || "Unknown anomaly";

    // Add entity if not present
    if (!entityMap[row.entity_1_id]) {
      entityMap[row.entity_1_id] = {
        id: row.entity_1_id,
        name: row.entity_1,
        actions: [],
        isAnomaly: false,
        anomalyReasons: [],
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
        isAnomaly: false,
        anomalyReasons: [],
      };
      entity.actions.push(action);
    }

    // Find or add status
    let status = action.statuses.find(s => s.id === row.status_id);
    if (!status && row.status_id) {
      status = {
        id: row.status_id,
        name: row.status,
        isAnomaly: false,
        anomalyReasons: [],
      };
      action.statuses.push(status);
    }

    // Mark anomaly if present and collect reasons
    if (isAnomaly) {
      entity.isAnomaly = true;
      action.isAnomaly = true;
      if (status) status.isAnomaly = true;
      entityAnomalySet.add(entity.id);

      if (reason) {
        if (!entity.anomalyReasons!.includes(reason)) entity.anomalyReasons!.push(reason);
        if (!action.anomalyReasons!.includes(reason)) action.anomalyReasons!.push(reason);
        if (status && !status.anomalyReasons!.includes(reason)) status.anomalyReasons!.push(reason);
      }
    }
  });

  // Attach anomaly info for minimap
  Object.values(entityMap).forEach(entity => {
    if (entityAnomalySet.has(entity.id)) {
      entity.isAnomaly = true;
    }
  });

  return Object.values(entityMap);
}

const ACTIONS_PER_VIEW = 10;


export default function VisualizeTreeVertical() {
  const [entityTrees, setEntityTrees] = useState<EntityTree[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const entityRefs = useRef<(HTMLDivElement | null)[]>([]);
  const actionsSectionRef = useRef<HTMLDivElement | null>(null);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const carouselApiRef = useRef<CarouselApi | null>(null);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [selectedStatusId, setSelectedStatusId] = useState<string | null>(null);
  const [anomalyPopover, setAnomalyPopover] = useState<{
    reasons: string[];
    anchor: HTMLElement | null;
  } | null>(null);

  const [hoverInfo, setHoverInfo] = useState<{
    type: "entity" | "action" | "status";
    id: string;
    anchor: HTMLElement | null;
    info: { id: string; level: string; numChildren: number };
  } | null>(null);

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

  // Calculate the width and left position for the viewport indicator
  const viewportSize = 5; // or whatever your visible count is
  const clampedIdx = Math.min(carouselIdx, Math.max(0, entityTrees.length - viewportSize));
  const leftPercent = (clampedIdx / entityTrees.length) * 100;
  const widthPercent = (Math.min(viewportSize, entityTrees.length) / entityTrees.length) * 100;

    const selectedTree = entityTrees.find(tree => tree.id === selectedEntity);

  // Exclamation SVG (anomaly popover logic removed)
  const Exclamation = (reasons: string[] = []) => (
    <span
      className="absolute top-1 right-1 text-red-600 text-lg cursor-pointer z-20"
      title={reasons.join("; ")}
      onClick={e => {
        e.stopPropagation();
        setAnomalyPopover({ reasons, anchor: e.currentTarget as HTMLElement });
      }}
    >
      <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
        <circle cx="10" cy="10" r="9" fill="white" />
        <text x="10" y="15" textAnchor="middle" fontSize="16" fontWeight="bold" fill="red">!</text>
      </svg>
    </span>
  );

  // Tooltip component
  const Tooltip = hoverInfo && hoverInfo.anchor ? (() => {
    const anchorRect = hoverInfo.anchor.getBoundingClientRect();
    const popoverWidth = 260;
    const popoverHeight = 120;
    let left = anchorRect.left + window.scrollX + anchorRect.width / 2 - popoverWidth / 2;
    let top = anchorRect.top + window.scrollY - popoverHeight - 8;

    // Prevent right overflow
    if (left + popoverWidth > window.innerWidth - 8) {
      left = window.innerWidth - popoverWidth - 8;
    }
    // Prevent left overflow
    if (left < 8) left = 8;
    // Prevent top overflow
    if (top < 8) top = anchorRect.bottom + window.scrollY + 8;

    return (
      <div
        className="fixed z-50 bg-white border border-gray-400 rounded shadow-lg p-4 text-xs"
        style={{
          left,
          top,
          minWidth: 180,
          maxWidth: popoverWidth,
          maxHeight: popoverHeight,
          overflowY: "auto",
          wordBreak: "break-word",
        }}
        onMouseLeave={() => setHoverInfo(null)}
      >
        <div><span className="font-semibold">ID:</span> {hoverInfo.info.id}</div>
        <div><span className="font-semibold">Level:</span> {hoverInfo.info.level}</div>
        <div><span className="font-semibold">Number of children:</span> {hoverInfo.info.numChildren}</div>
      </div>
    );
  })() : null;

  return (
    <div className="flex flex-col min-h-screen items-center relative pt-20">
      <h1 className="text-3xl font-bold text-WPIRed mb-8 mt-2">Entity Action Tree (Horizontal)</h1>
      {/* Totals Row */}
      <div className="flex flex-row gap-8 items-center mt-8 mb-2 text-lg font-semibold">
        <div className="px-4 py-2 bg-white rounded shadow">Entities: {entityTrees.length}</div>
        <div className="px-4 py-2 bg-white rounded shadow">Actions: {entityTrees.reduce((sum, e) => sum + e.actions.length, 0)}</div>
        <div className="px-4 py-2 bg-white rounded shadow">Statuses: {entityTrees.reduce((sum, e) => sum + e.actions.reduce((aSum, a) => aSum + a.statuses.length, 0), 0)}</div>
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
                left: `calc(${leftPercent}% - 2px)`,
                width: `calc(${widthPercent}% + 4px)`,
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
              className={`relative z-10 w-6 h-6 rounded-sm border-2 flex items-center justify-center text-[10px] font-bold border-gray-400 bg-gray-200
                ${selectedEntity === tree.id ? "ring-2 ring-amber-400" : ""}
                ${tree.isAnomaly ? "text-red-600" : "text-gray-600"}
              `}
              title={tree.name}
              onClick={() => {
                const viewportSize = 5;
                let targetIdx = idx;
                if (entityTrees.length > viewportSize) {
                  const half = Math.floor(viewportSize / 2);
                  if (idx > half && idx < entityTrees.length - half) {
                    targetIdx = idx - half;
                  } else if (idx >= entityTrees.length - half) {
                    targetIdx = entityTrees.length - viewportSize;
                  } else {
                    targetIdx = 0;
                  }
                }
                setCarouselIdx(targetIdx);
                carouselApiRef.current?.scrollTo(targetIdx);
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
        <CarouselContent className="">
          {entityTrees.map((tree, idx) => (
            <CarouselItem key={tree.id} className="basis-1/5 px-2 py-5">
              <div
                ref={el => { entityRefs.current[idx] = el; }}
                className="flex flex-col items-center"
              >
                <div className="relative w-full">
                  <Card
                    className={`relative mb-4 w-11/12 h-2/6 flex flex-col items-center justify-center bg-WPIRed text-white shadow-lg transition ring-2
                      ${selectedEntity === tree.id ? "border-4 border-black scale-105" : "border-2 border-transparent"}
                    `}
                    onClick={() =>
                      setSelectedEntity(selectedEntity === tree.id ? null : tree.id)
                    }
                    onMouseEnter={e => setHoverInfo({
                      type: "entity",
                      id: tree.id,
                      anchor: e.currentTarget,
                      info: {
                        id: tree.id,
                        level: "entity",
                        numChildren: tree.actions.length,
                      }
                    })}
                    onMouseLeave={() => setHoverInfo(null)}
                    title="Left click to select, hover for details"
                  >
                    <CardTitle className="text-lg text-center">{tree.name}</CardTitle>
                    <div className="mt-2 text-xs text-white/90 text-center">
                      <div><span className="font-semibold">ID:</span> {tree.id}</div>
                      <div><span className="font-semibold">Level:</span> entity</div>
                      <div><span className="font-semibold">Number of children:</span> {tree.actions.length}</div>
                    </div>
                    {tree.isAnomaly && Exclamation(tree.anomalyReasons)}
                  </Card>
                </div>
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
                      <div className="relative w-full">
                        <Card
                          className={`relative w-32 h-16 flex items-center justify-center bg-amber-200 text-amber-900 shadow cursor-pointer transition ring-2
                            ${selectedActionId === action.id ? "border-4 border-black scale-105" : "border-2 border-transparent"}
                          `}
                          onClick={() =>
                            setSelectedActionId(selectedActionId === action.id ? null : action.id)
                          }
                          onMouseEnter={e => setHoverInfo({
                            type: "action",
                            id: action.id,
                            anchor: e.currentTarget,
                            info: {
                              id: action.id,
                              level: "action",
                              numChildren: action.statuses.length,
                            }
                          })}
                          onMouseLeave={() => setHoverInfo(null)}
                          title="Left click to show statuses, hover for details"
                        >
                          <CardContent className="text-xs text-center">{action.name}</CardContent>
                          {action.isAnomaly && Exclamation(action.anomalyReasons)}
                        </Card>
                      </div>
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
                  <div className="relative w-full">
                    <Card
                      className={`relative w-32 h-16 flex items-center justify-center bg-amber-200 text-amber-900 shadow cursor-pointer transition ring-2 ${
                        selectedActionId === action.id ? "border-4 border-black scale-105" : "border-2 border-transparent"
                      }`}
                      onClick={() =>
                        setSelectedActionId(selectedActionId === action.id ? null : action.id)
                      }
                      onMouseEnter={e => setHoverInfo({
                        type: "action",
                        id: action.id,
                        anchor: e.currentTarget,
                        info: {
                          id: action.id,
                          level: "action",
                          numChildren: action.statuses.length,
                        }
                      })}
                      onMouseLeave={() => setHoverInfo(null)}
                      title="Left click to show statuses, hover for details"
                    >
                      <CardContent className="text-xs text-center">{action.name}</CardContent>
                      {action.isAnomaly && Exclamation(action.anomalyReasons)}
                    </Card>
                  </div>
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
                          <div className="relative w-full">
                            <Card
                              className={`relative w-24 h-12 flex items-center justify-center bg-gray-100 text-gray-700 shadow cursor-pointer
                                ${selectedStatusId === status.id ? "border-4 border-black" : "border-2 border-transparent"}
                              `}
                              onClick={() => setSelectedStatusId(selectedStatusId === status.id ? null : status.id)}
                              onMouseEnter={e => setHoverInfo({
                                type: "status",
                                id: status.id,
                                anchor: e.currentTarget,
                                info: {
                                  id: status.id,
                                  level: "status",
                                  numChildren: 0,
                                }
                              })}
                              onMouseLeave={() => setHoverInfo(null)}
                              title="Hover for details"
                            >
                              <CardContent className="text-xs text-center">{status.name}</CardContent>
                              {status.isAnomaly && Exclamation(status.anomalyReasons)}
                            </Card>
                          </div>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    <CarouselPrevious />
                    <CarouselNext />
                  </Carousel>
                ) : (
                  <div className="flex flex-row gap-2 justify-center">
                    {action.statuses.map((status) => (
                      <div key={status.id} className="relative w-full">
                        <Card
                          className={`relative w-24 h-12 flex items-center justify-center bg-gray-100 text-gray-700 shadow cursor-pointer
                            ${selectedStatusId === status.id ? "border-4 border-black" : "border-2 border-transparent"}
                          `}
                          onClick={() => setSelectedStatusId(selectedStatusId === status.id ? null : status.id)}
                          onMouseEnter={e => setHoverInfo({
                            type: "status",
                            id: status.id,
                            anchor: e.currentTarget,
                            info: {
                              id: status.id,
                              level: "status",
                              numChildren: 0,
                            }
                          })}
                          onMouseLeave={() => setHoverInfo(null)}
                          title="Hover for details"
                        >
                          <CardContent className="text-xs text-center">{status.name}</CardContent>
                          {status.isAnomaly && Exclamation(status.anomalyReasons)}
                        </Card>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
      {anomalyPopover && (() => {
        const anchorRect = anomalyPopover.anchor?.getBoundingClientRect();
        const popoverWidth = 320;
        const popoverHeight = 300;
        let left = anchorRect ? anchorRect.left + window.scrollX : 100;
        let top = anchorRect ? anchorRect.bottom + window.scrollY + 8 : 100;

        // Prevent right overflow
        if (left + popoverWidth > window.innerWidth - 8) {
          left = window.innerWidth - popoverWidth - 8;
        }
        // Prevent left overflow
        if (left < 8) left = 8;
        // Prevent bottom overflow
        if (top + popoverHeight > window.innerHeight + window.scrollY - 8) {
          top = window.innerHeight + window.scrollY - popoverHeight - 8;
        }
        // Prevent top overflow
        if (top < 8) top = 8;

        return (
          <div
            className="fixed z-50 bg-white border border-red-400 rounded shadow-lg p-4"
            style={{
              left,
              top,
              minWidth: 240,
              maxWidth: popoverWidth,
              maxHeight: popoverHeight,
              overflowY: "auto",
              wordBreak: "break-word",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="font-bold text-red-700 mb-2">
              Anomaly Reason{anomalyPopover.reasons.length > 1 ? "s" : ""}:
            </div>
            <ul className="list-disc pl-5 text-sm text-gray-800">
              {anomalyPopover.reasons.map((reason, idx) => (
                <li key={idx}>{reason}</li>
              ))}
            </ul>
            <button
              className="mt-3 px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
              onClick={() => setAnomalyPopover(null)}
            >
              Close
            </button>
          </div>
        );
      })()}

      {/* Info Tooltip */}
      {Tooltip}
    </div>
  );
}