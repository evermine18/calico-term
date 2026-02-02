import { Check } from 'lucide-react';

interface TabEditInputProps {
  tabId: string;
  title: string;
  onTitleChange: (id: string, title: string) => void;
  onFinishEdit: () => void;
}

export function TabEditInput({
  tabId,
  title,
  onTitleChange,
  onFinishEdit
}: TabEditInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onFinishEdit();
    }
  };

  return (
    <>
      <span
        id={`tab-title-measure-${tabId}`}
        style={{
          position: 'absolute',
          visibility: 'hidden',
          whiteSpace: 'pre',
          fontSize: '1rem',
          fontFamily: 'inherit',
          fontWeight: '500',
          padding: '0'
        }}
      >
        {title || ' '}
      </span>
      <input
        value={title}
        onChange={(e) => onTitleChange(tabId, e.target.value)}
        onKeyDown={handleKeyDown}
        className="bg-slate-900/60 border border-cyan-500/50 rounded px-2 py-0.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500"
        style={{
          width: `calc(${document.getElementById(`tab-title-measure-${tabId}`)?.offsetWidth || 50
            }px + 1ch)`,
          minWidth: '40px',
          maxWidth: '180px'
        }}
        autoFocus
      />
      <button
        onClick={(e) => {
          e.stopPropagation();
          onFinishEdit();
        }}
        className="w-5 h-5 rounded flex items-center justify-center text-gray-500 
                   hover:text-green-400 hover:bg-green-500/15 transition-colors duration-75"
        title="Apply title"
      >
        <Check size={14} />
      </button>
    </>
  );
}
