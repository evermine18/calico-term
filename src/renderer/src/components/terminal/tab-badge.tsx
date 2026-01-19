import { CustomTag } from '../../types/tabs';

interface TabBadgeProps {
  badge: string | null;
  customTags: CustomTag[];
  isActive: boolean;
}

export function TabBadge({ badge, customTags, isActive }: TabBadgeProps) {
  if (!badge) return null;

  const tagData = customTags.find((t) => t.id === badge);
  if (!tagData) return null;

  return (
    <span
      className={`absolute -top-2.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 text-[9px] font-bold rounded
                  border shadow-md z-20 transition-opacity duration-100
                  ${isActive ? 'opacity-100' : 'opacity-60'}`}
      style={{
        backgroundColor: `${tagData.color}33`,
        color: tagData.color,
        borderColor: `${tagData.color}80`
      }}
    >
      {tagData.name}
    </span>
  );
}
