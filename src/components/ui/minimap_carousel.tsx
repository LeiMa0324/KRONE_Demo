import React, { useRef, useEffect, useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";

type MinimapCarouselProps = {
  items: { id: string; name: string; isAnomaly?: boolean; anomalyReasons?: string[] }[];
  selectedId: string | null;
  setSelectedId: (id: string) => void;
  visibleCount: number;
  children: (item: any, idx: number) => React.ReactNode;
  minimapColor?: string;
  minimapBorder?: string;
  minimapTextColor?: string;
  className?: string;
};

export function MinimapCarousel({
  items,
  selectedId,
  setSelectedId,
  visibleCount,
  children,
  minimapColor = "rgba(172,43,55,0.08)",
  minimapBorder = "#AC2B37",
  minimapTextColor = "text-gray-600",
  className = "",
}: MinimapCarouselProps) {
  const [carouselIdx, setCarouselIdx] = useState(0);
  const carouselApiRef = useRef<CarouselApi | null>(null);

  // Tooltip state for minimap hover
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [hoverAnchor, setHoverAnchor] = useState<HTMLElement | null>(null);

  // Minimap viewport calculation
  const clampedIdx = Math.min(carouselIdx, Math.max(0, items.length - visibleCount));
  const leftPercent = (clampedIdx / items.length) * 100;
  const widthPercent = (Math.min(visibleCount, items.length) / items.length) * 100;

  // Sync carouselIdx with carousel API
  useEffect(() => {
    if (!carouselApiRef.current) return;
    const api = carouselApiRef.current;
    const onSelect = () => setCarouselIdx(api.selectedScrollSnap());
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [items]);

  // Scroll carousel when carouselIdx changes
  useEffect(() => {
    if (carouselApiRef.current) {
      carouselApiRef.current.scrollTo(carouselIdx);
    }
  }, [carouselIdx]);

  // Calculate width for each CarouselItem so that visibleCount items fill the width
  const itemWidthPercent = 100 / visibleCount;

  return (
    <div className={`w-full flex flex-col items-center ${className}`}>
      {/* Minimap */}
      <div className="w-full flex justify-center mb-2">
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
              background: minimapColor,
              border: `2px solid ${minimapBorder}`,
              borderRadius: 6,
              zIndex: 1,
            }}
          />
          {/* Minimap buttons */}
          {items.map((item, idx) => (
            <button
              key={item.id}
              className={`relative z-10 w-6 h-6 rounded-sm border-2 flex items-center justify-center text-[10px] font-bold border-gray-400 bg-gray-200
                ${selectedId === item.id ? "ring-2 ring-amber-400" : ""}
                ${item.isAnomaly ? "text-red-600" : minimapTextColor}
              `}
              title={item.name}
              onClick={() => {
                let targetIdx = idx;
                if (items.length > visibleCount) {
                  const half = Math.floor(visibleCount / 2);
                  if (idx > half && idx < items.length - half) {
                    targetIdx = idx - half;
                  } else if (idx >= items.length - half) {
                    targetIdx = items.length - visibleCount;
                  } else {
                    targetIdx = 0;
                  }
                }
                setCarouselIdx(targetIdx);
                carouselApiRef.current?.scrollTo(targetIdx);
                setSelectedId(item.id);
              }}
              style={{ minWidth: 24 }}
              onMouseEnter={e => {
                setHoveredIdx(idx);
                setHoverAnchor(e.currentTarget);
              }}
              onMouseLeave={() => {
                setHoveredIdx(null);
                setHoverAnchor(null);
              }}
            >
              {item.name.slice(0, 2)}
            </button>
          ))}
          {/* Tooltip for minimap */}
          {hoveredIdx !== null && hoverAnchor && (
            (() => {
              const rect = hoverAnchor.getBoundingClientRect();
              const tooltipWidth = 200;
              let left = rect.left + window.scrollX + rect.width / 2 - tooltipWidth / 2;
              let top = rect.top + window.scrollY - 36;
              if (left < 8) left = 8;
              if (left + tooltipWidth > window.innerWidth - 8) left = window.innerWidth - tooltipWidth - 8;
              if (top < 8) top = rect.bottom + window.scrollY + 8;
              return (
                <div
                  className="fixed z-50 px-3 py-1 bg-black text-white text-xs rounded shadow"
                  style={{
                    left,
                    top,
                    minWidth: 80,
                    maxWidth: tooltipWidth,
                    pointerEvents: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  {items[hoveredIdx].name}
                </div>
              );
            })()
          )}
        </div>
      </div>
      {/* Main Carousel */}
      <Carousel
        className="w-full max-w-11/12"
        setApi={api => (carouselApiRef.current = api)}
        opts={{ align: "start" }}
      >
        <CarouselContent className="flex">
          {items.map((item, idx) => (
            <CarouselItem
              key={item.id}
              // Use inline style to ensure exactly visibleCount items fit in one row
              style={{
                flex: `0 0 ${itemWidthPercent}%`,
                maxWidth: `${itemWidthPercent}%`,
                minWidth: `${itemWidthPercent}%`,
              }}
              className="px-2 py-5"
            >
              <div className="flex flex-col items-center w-full">
                {children(item, idx)}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  );
}