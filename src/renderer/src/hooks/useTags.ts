import { useState, useEffect } from "react";
import { CustomTag } from "../types/tabs";

const TAGS_STORAGE_KEY = "calico-term-tags";

export function useTags() {
  const [customTags, setCustomTags] = useState<CustomTag[]>([]);

  useEffect(() => {
    const loadTags = () => {
      const storedTags = localStorage.getItem(TAGS_STORAGE_KEY);
      if (storedTags) {
        setCustomTags(JSON.parse(storedTags));
      }
    };

    loadTags();

    const handleTagsUpdate = () => loadTags();
    window.addEventListener("tags-updated", handleTagsUpdate);

    return () => window.removeEventListener("tags-updated", handleTagsUpdate);
  }, []);

  return customTags;
}
