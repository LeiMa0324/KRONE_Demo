import React from "react";
import { Button } from "@/components/ui/button";

export const UnifiedClearButton: React.FC<{
  show: boolean;
  handleClear: () => void;
}> = ({ show, handleClear }) => (
  show ? (
    <Button
      type="button"
      onClick={handleClear}
      style={{ marginTop: 16, alignSelf: "flex-end" }}
      variant="secondary"
    >
      Clear All
    </Button>
  ) : null
);