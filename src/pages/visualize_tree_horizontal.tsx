import { useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  Card,
  CardContent,
  CardTitle,
} from "@/components/ui/card";

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

export default function VisualizeTreeHorizontal() {
  const [entityTrees, setEntityTrees] = useState<EntityTree[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const entityRefs = useRef<(HTMLDivElement | null)[]>([]);
  const actionsSectionRef = useRef<HTMLDivElement | null>(null);

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

  const selectedTree = entityTrees.find(tree => tree.entity === selectedEntity);

  return (
    <div className="flex flex-col min-h-screen items-center bg-gradient-to-b from-amber-50 to-white relative">
      <h1 className="text-3xl font-bold text-WPIRed mb-8 mt-8">Entity Action Tree (Horizontal)</h1>
      {/* Main Entity Carousel */}
      <Carousel className="w-full max-w-11/12">
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
                >
                  <CardTitle className="text-lg text-center">{tree.entity}</CardTitle>
                  <p className="text-xs">{idx}</p>
                  <p className="text-xs">Actions: {tree.actions.length}</p>
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
                        <Card className="w-32 h-16 flex items-center justify-center bg-amber-200 text-amber-900 shadow">
                        <CardContent className="text-xs text-center">{action.action}</CardContent>
                        </Card>
                        {/* Targets */}
                        <div className="flex flex-row gap-1 mt-1">
                        {action.targets.map((target, tIdx) => (
                            <Card key={tIdx} className="w-20 h-10 flex items-center justify-center bg-gray-100 text-gray-700 shadow">
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
                  <Card className="w-32 h-16 flex items-center justify-center bg-amber-200 text-amber-900 shadow">
                    <CardContent className="text-xs text-center">{action.action}</CardContent>
                  </Card>
                  {/* Targets */}
                  <div className="flex flex-row gap-1 mt-1">
                    {action.targets.map((target, tIdx) => (
                      <Card key={tIdx} className="w-20 h-10 flex items-center justify-center bg-gray-100 text-gray-700 shadow">
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
    </div>
  );
}