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
    <div className="w-full h-20 rounded-md overflow-hidden bg-slate-950 border border-slate-800 relative flex flex-col">
      {/* Mini header bar */}
      <div className="flex items-center gap-1 px-2 py-1.5 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-red-500/70" />
        <div className="w-1.5 h-1.5 rounded-full bg-amber-500/70" />
        <div className="w-1.5 h-1.5 rounded-full bg-green-500/70" />
        <div className="ml-1.5 flex-1 h-1.5 rounded bg-slate-800" />
        <div className="w-4 h-1.5 rounded" style={{ backgroundColor: color500, opacity: 0.5 }} />
      </div>
      {/* Mini terminal content */}
      <div className="flex-1 p-2 flex flex-col justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <span className="text-[7px] font-mono leading-none" style={{ color: color400 }}>
              ❯
            </span>
            <div className="h-1.5 rounded bg-slate-700 w-12" />
            <div className="h-1.5 w-1 rounded" style={{ backgroundColor: color500 }} />
          </div>
          <div className="flex gap-1 pl-3">
            <div className="h-1 rounded w-8" style={{ backgroundColor: color500, opacity: 0.6 }} />
            <div className="h-1 rounded bg-slate-700 w-10" />
          </div>
          <div className="h-1 rounded bg-slate-700 w-16 pl-3 ml-3" />
        </div>
        {/* Status bar hint */}
        <div className="flex items-center gap-1">
          <div
            className="h-1 w-1 rounded-full"
            style={{ backgroundColor: color400, boxShadow: `0 0 3px ${color400}` }}
          />
          <div className="h-1 rounded w-5" style={{ backgroundColor: color300, opacity: 0.4 }} />
        </div>
      </div>
      {/* Accent glow line at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-px" style={{ backgroundColor: color500 }} />
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
            className={`group relative flex flex-col gap-2 p-2 rounded-lg border transition-all duration-150 text-left ${
              isSelected
                ? "bg-slate-800/60 shadow-sm"
                : "border-slate-700/40 bg-slate-800/20 hover:bg-slate-800/40 hover:border-slate-600/60"
            }`}
            style={isSelected ? { borderColor: theme.colors[500] } : {}}
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
              <p className="text-xs font-medium text-gray-200 leading-tight">{theme.name}</p>
              <p className="text-[10px] text-gray-500 leading-tight mt-0.5">{theme.description}</p>
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
