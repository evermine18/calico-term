import { MessageSquare, Search, Trash2, Plus } from "lucide-react";
import { useState } from "react";
import type { Conversation } from "./conversation-types";

interface ConversationListProps {
  conversations: Conversation[];
  currentId: string | null;
  onSelect: (conv: Conversation) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

export default function ConversationList({
  conversations,
  currentId,
  onSelect,
  onDelete,
  onNew,
}: ConversationListProps) {
  const [search, setSearch] = useState("");

  const filtered = conversations.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onDelete(id);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-slate-700/50">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-200">Conversations</h3>
          <button
            onClick={onNew}
            className="p-1.5 hover:bg-accent-500/20 rounded-md transition-colors text-slate-400 hover:text-accent-400"
            title="New conversation"
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full bg-slate-950/50 border border-slate-700/50 rounded-md pl-7 pr-2 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-500/50"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-500">
            {conversations.length === 0
              ? "No saved conversations yet"
              : "No matches found"}
          </div>
        ) : (
          <div className="flex flex-col gap-1 p-2">
            {filtered.map((conv) => (
              <div
                key={conv.id}
                onClick={() => onSelect(conv)}
                className={`group p-2.5 rounded-md cursor-pointer transition-colors hover:bg-slate-800/50 ${
                  currentId === conv.id
                    ? "bg-accent-500/10 border border-accent-500/30"
                    : "border border-transparent"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <MessageSquare size={12} className="text-slate-500 flex-shrink-0" />
                      <p className="text-xs text-slate-300 truncate font-medium">
                        {conv.name}
                      </p>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {new Date(conv.updatedAt).toLocaleDateString()} ·{" "}
                      {conv.messages.length} messages
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, conv.id)}
                    className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded transition-all text-slate-500 hover:text-red-400"
                    title="Delete conversation"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
