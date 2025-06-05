import React, { useMemo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";

const NODE_WIDTH = 100;
const NODE_HEIGHT = 100;
const MAX_FONT_SIZE = 20;
const MIN_FONT_SIZE = 8;

function getFontSize(text: string, maxWidth: number, maxFontSize: number) {
  if (!text) return maxFontSize;
  const length = text.length;
  if (length < 10) return maxFontSize;
  if (length > 30) return MIN_FONT_SIZE;
  return Math.max(
    MIN_FONT_SIZE,
    maxFontSize - ((length - 10) * (maxFontSize - MIN_FONT_SIZE)) / 20
  );
}

export const CustomNode = ({ data = {} }: NodeProps) => {
  const label = typeof data.label === "string" ? data.label : "";
  const fontSize = useMemo(
    () => getFontSize(label, NODE_WIDTH - 20, MAX_FONT_SIZE),
    [label]
  );

  return (
    <div
      style={{
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        borderRadius: "50%",
        background: "#AC2B37",
        color: "white",
        border: "2px solid black",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: "bold",
        textAlign: "center",
        fontSize,
        padding: 10,
        overflow: "hidden",
        wordBreak: "break-all",
        overflowWrap: "break-word",
        hyphens: "auto",
        lineHeight: 1.1,
        flexDirection: "column"
      }}
    >
      {label}
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
};