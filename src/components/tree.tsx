import React, { useRef, useEffect } from "react";
import { hierarchy, tree as d3tree } from "d3-hierarchy";
import { select } from "d3-selection";

export type GenericTreeNode = {
  name: string;
  children?: GenericTreeNode[];
  collapsed?: boolean;
  [key: string]: any;
};

type TreeProps<T extends GenericTreeNode> = {
  data: T;
  width?: number;
  height?: number;
  renderNode: (d: any, nodeGroup: any, extra: { toggle: () => void }) => void;
  onToggle?: (path: number[]) => void;
};

export function Tree<T extends GenericTreeNode>({
  data,
  width = 800,
  height = 600,
  renderNode,
  onToggle,
}: TreeProps<T>) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!data || !svgRef.current) return;
    const root = hierarchy(data, d => (d.collapsed ? null : d.children));
    d3tree<T>().size([height, width])(root);

    const svg = select(svgRef.current);
    svg.selectAll("*").remove();

    // Draw links
    svg.append("g")
      .selectAll("line")
      .data(root.links())
      .join("line")
      .attr("x1", d => d.source.y)
      .attr("y1", d => d.source.x)
      .attr("x2", d => d.target.y)
      .attr("y2", d => d.target.x)
      .attr("stroke", "#aaa");

    // Draw nodes
    const nodeGroup = svg.append("g")
      .selectAll("g")
      .data(root.descendants())
      .join("g")
      .attr("transform", d => `translate(${d.y},${d.x})`);

    nodeGroup.each(function (d) {
      renderNode(d, select(this), {
        toggle: () => {
          if (onToggle) onToggle(d.data.indexPath);
        }
      });
    });
  }, [data, width, height, renderNode, onToggle]);

  return <svg ref={svgRef} width={width} height={height} />;
}