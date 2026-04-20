import { Terminal } from "@xterm/xterm";
import { PaneLeaf, PaneSplit, SplitNode } from "@renderer/types/terminal";

export function createLeaf(opts?: {
  initialCommand?: string;
  isSSH?: boolean;
}): PaneLeaf {
  return {
    type: "leaf",
    paneId: crypto.randomUUID(),
    terminal: new Terminal(),
    initialCommand: opts?.initialCommand,
    isSSH: opts?.isSSH,
  };
}

export function splitLeaf(
  leaf: PaneLeaf,
  direction: "horizontal" | "vertical",
): PaneSplit {
  return {
    type: "split",
    direction,
    ratio: 0.5,
    first: leaf,
    second: createLeaf(),
  };
}

export function mapLeaf(
  root: SplitNode,
  paneId: string,
  transform: (leaf: PaneLeaf) => SplitNode,
): SplitNode {
  if (root.type === "leaf") {
    return root.paneId === paneId ? transform(root) : root;
  }
  return {
    ...root,
    first: mapLeaf(root.first, paneId, transform),
    second: mapLeaf(root.second, paneId, transform),
  };
}

export function removeLeaf(
  root: SplitNode,
  paneId: string,
): [SplitNode | null, PaneLeaf | null] {
  if (root.type === "leaf") {
    return root.paneId === paneId ? [null, root] : [root, null];
  }

  const [newFirst, removedFirst] = removeLeaf(root.first, paneId);
  if (removedFirst !== null) {
    return [newFirst === null ? root.second : ({ ...root, first: newFirst } as PaneSplit), removedFirst];
  }

  const [newSecond, removedSecond] = removeLeaf(root.second, paneId);
  if (removedSecond !== null) {
    return [newSecond === null ? root.first : ({ ...root, second: newSecond } as PaneSplit), removedSecond];
  }

  return [root, null];
}

export function collectLeafIds(root: SplitNode): string[] {
  if (root.type === "leaf") return [root.paneId];
  return [...collectLeafIds(root.first), ...collectLeafIds(root.second)];
}

export function updateRatio(
  root: SplitNode,
  targetPaneId: string,
  newRatio: number,
): SplitNode {
  if (root.type === "leaf") return root;
  if (
    root.type === "split" &&
    root.first.type === "leaf" &&
    root.first.paneId === targetPaneId
  ) {
    return { ...root, ratio: newRatio };
  }
  return {
    ...root,
    first: updateRatio(root.first, targetPaneId, newRatio),
    second: updateRatio(root.second, targetPaneId, newRatio),
  };
}
