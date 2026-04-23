export type SFTPFileEntry = {
  filename: string;
  attrs: {
    size: number;
    uid: number;
    gid: number;
    mode: number;
    atime: number;
    mtime: number;
  };
  isDirectory: boolean;
  isSymlink: boolean;
};

export type SFTPTransfer = {
  id: string;
  sessionId: string;
  type: "upload" | "download";
  filename: string;
  bytes: number;
  total: number;
  status: "pending" | "transferring" | "done" | "error";
  error?: string;
};
