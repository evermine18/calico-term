export function isMacPlatform(): boolean {
  return window.platform?.os === "darwin";
}

export function isPrimaryModifier(event: KeyboardEvent): boolean {
  return isMacPlatform()
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey;
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  if (target.isContentEditable) return true;

  const editable = target.closest(
    'input, textarea, select, [contenteditable="true"], [role="textbox"]',
  );

  return editable !== null;
}
