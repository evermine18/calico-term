import { User, Pencil, Check, X } from "lucide-react";
import { useState } from "react";

interface UserMessageProps {
  message: string;
  timestamp: string;
  onEdit?: (newMessage: string) => void;
}

export default function UserMessage({ message, timestamp, onEdit }: UserMessageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message);

  const handleSave = () => {
    if (editText.trim() && onEdit) {
      onEdit(editText.trim());
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditText(message);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  return (
    <div className="flex justify-end animate-fade-in selectable-section">
      <div className="flex items-start space-x-2 max-w-[85%]">
        <div className="bg-accent-500/15 backdrop-blur-sm border border-accent-500/30 text-gray-100 rounded-2xl rounded-br-sm px-4 py-3 relative group">
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-slate-900/50 border border-slate-700/50 rounded px-2 py-1 text-sm text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-accent-500/30"
                rows={3}
                autoFocus
              />
              <div className="flex items-center justify-end gap-1">
                <button
                  onClick={handleCancel}
                  className="p-1 hover:bg-slate-800 rounded transition-colors text-slate-400 hover:text-slate-200"
                  title="Cancel"
                >
                  <X size={14} />
                </button>
                <button
                  onClick={handleSave}
                  className="p-1 hover:bg-accent-500/20 rounded transition-colors text-accent-400 hover:text-accent-300"
                  title="Save"
                >
                  <Check size={14} />
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{message}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-gray-500 mt-1 block">
                  {timestamp}
                </span>
                {onEdit && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-gray-600 hover:text-accent-400 transition-colors opacity-0 group-hover:opacity-100"
                    title="Edit message"
                  >
                    <Pencil size={12} />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
        <div className="flex-shrink-0 w-8 h-8 bg-slate-700/60 border border-slate-600/50 rounded-lg flex items-center justify-center">
          <User size={14} className="text-gray-400" />
        </div>
      </div>
    </div>
  );
}
