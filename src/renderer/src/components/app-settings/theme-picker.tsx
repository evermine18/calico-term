import { themes } from "@renderer/themes";
import type { ThemeId } from "@renderer/themes";
import { Check } from "lucide-react";

interface ThemePickerProps {
  value: ThemeId;
  onChange: (id: ThemeId) => void;
}

function ThemePreview({
  color500,
  color400,
  color300,
}: {
  color500: string;
  color400: string;
  color300: string;
}) {
  return (
    <div className="w-full h-20 rounded-md overflow-hidden bg-[#0a0a0b] border border-[#27272a] relative flex flex-col">
      {/* Mini header bar */}
      <div className="flex items-center gap-1 px-2 py-1.5 bg-[#111113] border-b border-[#27272a] shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-[#f43f5e]/80" />
        <div className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]/80" />
        <div className="w-1.5 h-1.5 rounded-full bg-[#10b981]/80" />
        <div className="ml-1.5 flex-1 h-1.5 rounded bg-[#18181b]" />
        <div
          className="w-4 h-1.5 rounded"
          style={{ background: `linear-gradient(135deg, ${color400}, ${color500})` }}
        />
      </div>
      {/* Mini terminal content */}
      <div className="flex-1 p-2 flex flex-col justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <span className="text-[7px] font-mono leading-none" style={{ color: color400 }}>
              ❯
            </span>
            <div className="h-1.5 rounded bg-[#3f3f46] w-12" />
            <div className="h-1.5 w-1 rounded" style={{ backgroundColor: color500 }} />
          </div>
          <div className="flex gap-1 pl-3">
            <div className="h-1 rounded w-8" style={{ backgroundColor: color500, opacity: 0.7 }} />
            <div className="h-1 rounded bg-[#3f3f46] w-10" />
          </div>
          <div className="h-1 rounded bg-[#3f3f46] w-16 pl-3 ml-3" />
        </div>
        {/* Status bar hint */}
        <div className="flex items-center gap-1">
          <div
            className="h-1 w-1 rounded-full"
            style={{ backgroundColor: color400, boxShadow: `0 0 5px ${color400}` }}
          />
          <div className="h-1 rounded w-5" style={{ backgroundColor: color300, opacity: 0.5 }} />
        </div>
      </div>
      {/* Accent gradient line at bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${color500}, transparent)` }}
      />
    </div>
  );
}

export function ThemePicker({ value, onChange }: ThemePickerProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {themes.map((theme) => {
        const isSelected = theme.id === value;
        return (
          <button
            key={theme.id}
            onClick={() => onChange(theme.id)}
            className={`group relative flex flex-col gap-2 p-2 rounded-lg border transition-[background-color,border-color,box-shadow] duration-150 ease-out text-left cursor-pointer ${
              isSelected
                ? "bg-card shadow-sm"
                : "border-border bg-card/40 hover:bg-card/70 hover:border-border/80"
            }`}
            style={
              isSelected
                ? {
                    borderColor: theme.colors[500],
                    boxShadow: `0 0 0 1px ${theme.colors[500]}, 0 6px 16px -8px rgba(${theme.colors.rgb}, 0.45)`,
                  }
                : {}
            }
          >
            {/* Selected checkmark */}
            {isSelected && (
              <div
                className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center z-10"
                style={{ backgroundColor: theme.colors[500] }}
              >
                <Check size={9} className="text-white stroke-[3]" />
              </div>
            )}

            <ThemePreview
              color500={theme.colors[500]}
              color400={theme.colors[400]}
              color300={theme.colors[300]}
            />

            <div>
              <p className="text-xs font-medium text-foreground leading-tight">{theme.name}</p>
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{theme.description}</p>
            </div>

            {/* Color swatch strip */}
            <div
              className="h-0.5 w-full rounded-full opacity-60"
              style={{ backgroundColor: theme.colors[500] }}
            />
          </button>
        );
      })}
    </div>
  );
}
