import React from "react";
import ReactDOM from "react-dom";
import { Command, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export const DropdownSearchBar: React.FC<{
  placeholder: string;
  value: string | null;
  setValue: (v: string | null) => void;
  clearOthers?: () => void;
  dropdownOpen: boolean;
  setDropdownOpen: (v: boolean) => void;
  inputRef: React.RefObject<HTMLDivElement | null>;
  dropdownPos: { left: number; top: number; width: number };
  options: string[];
}> = ({
  placeholder,
  value,
  setValue,
  clearOthers,
  dropdownOpen,
  setDropdownOpen,
  inputRef,
  dropdownPos,
  options,
}) => (
  <div ref={inputRef} style={{ position: "relative", width: "fit-content" }}>
    <Command>
      <CommandInput
        placeholder={placeholder}
        value={value ?? ""}
        onValueChange={v => {
          setValue(v);
          clearOthers?.();
          setDropdownOpen(true);
        }}
        onFocus={() => setDropdownOpen(true)}
        onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
        onKeyDown={e => {
          if (e.key === "Enter") e.preventDefault();
        }}
      />
      {value && (
        <button
          type="button"
          aria-label={`Clear ${placeholder}`}
          onClick={() => {
            setValue(null);
            clearOthers?.();
          }}
          style={{
            position: "absolute",
            right: 10,
            top: 8,
            background: "none",
            border: "none",
            fontSize: "1.1rem",
            cursor: "pointer",
            color: "#888",
            zIndex: 2,
          }}
        >
          ×
        </button>
      )}
      {dropdownOpen && ReactDOM.createPortal(
        <div
          style={{
            position: "absolute",
            left: dropdownPos.left,
            top: dropdownPos.top,
            width: dropdownPos.width,
            zIndex: 9999,
            background: "#fff",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            borderRadius: 6,
            border: "1px solid #e0e0e0",
          }}
        >
          <CommandList>
            {options
              .filter(opt => (value ?? "").length === 0 || opt.toLowerCase().includes((value ?? "").toLowerCase()))
              .map(opt => (
                <CommandItem
                  key={opt}
                  value={opt}
                  onSelect={() => {
                    setValue(opt);
                    clearOthers?.();
                    setDropdownOpen(false);
                  }}
                >
                  {opt}
                </CommandItem>
              ))}
          </CommandList>
        </div>,
        document.body
      )}
    </Command>
  </div>
);