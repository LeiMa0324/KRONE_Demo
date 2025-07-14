import React from "react";
import { Switch } from "@/components/ui/switch";
import type { CollapseState } from "../../types";

export const CollapseControls: React.FC<{ collapse: CollapseState }> = ({ collapse }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", alignItems: "center" }}>
    <div style={{ alignItems: "flex-start", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <Switch checked={collapse.entities} onCheckedChange={collapse.setEntities} />
        Collapse Entities
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <Switch checked={collapse.actions} onCheckedChange={collapse.setActions} />
        Collapse Actions
      </label>
    </div>
  </div>
);