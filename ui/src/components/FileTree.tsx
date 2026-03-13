import { useState } from "react";
import {
  Folder,
  FolderOpen,
  File,
  FileText,
  FileCode,
  FileImage,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { cn } from "../lib/utils";
import type { WorkspaceEntry } from "../api/agents";

const CODE_EXTS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs",
  "py", "rb", "go", "rs", "java", "c", "cpp", "h", "hpp",
  "sh", "bash", "zsh", "fish",
  "json", "yaml", "yml", "toml", "xml", "env",
  "css", "scss", "sass", "less",
  "sql",
]);

const IMAGE_EXTS = new Set([
  "png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp",
]);

const TEXT_EXTS = new Set([
  "md", "txt", "log", "csv", "lock",
]);

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (IMAGE_EXTS.has(ext)) return FileImage;
  if (CODE_EXTS.has(ext)) return FileCode;
  if (TEXT_EXTS.has(ext)) return FileText;
  return File;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FileTreeNodeProps {
  entry: WorkspaceEntry;
  depth: number;
  defaultOpen?: boolean;
}

function FileTreeNode({ entry, depth, defaultOpen = false }: FileTreeNodeProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (entry.type === "directory") {
    const FolderIcon = open ? FolderOpen : Folder;
    const ChevronIcon = open ? ChevronDown : ChevronRight;

    return (
      <div>
        <button
          className={cn(
            "flex items-center gap-1.5 w-full text-left px-2 py-1 rounded hover:bg-accent/50 transition-colors text-sm min-h-[36px]",
          )}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
          onClick={() => setOpen((v) => !v)}
        >
          <ChevronIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <FolderIcon className="h-4 w-4 text-amber-400 shrink-0" />
          <span className="truncate font-medium">{entry.name}</span>
        </button>
        {open && entry.children && entry.children.length > 0 && (
          <div>
            {entry.children.map((child) => (
              <FileTreeNode key={child.path} entry={child} depth={depth + 1} />
            ))}
          </div>
        )}
        {open && entry.children && entry.children.length === 0 && (
          <div
            className="px-2 py-1 text-xs text-muted-foreground"
            style={{ paddingLeft: `${8 + (depth + 1) * 16 + 22}px` }}
          >
            Empty directory
          </div>
        )}
      </div>
    );
  }

  const FileIcon = getFileIcon(entry.name);

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 text-sm text-muted-foreground min-h-[36px]"
      style={{ paddingLeft: `${8 + depth * 16 + 20}px` }}
    >
      <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground/70" />
      <span className="truncate flex-1">{entry.name}</span>
      {entry.size !== undefined && (
        <span className="text-xs text-muted-foreground/60 shrink-0 ml-2">
          {formatSize(entry.size)}
        </span>
      )}
    </div>
  );
}

interface FileTreeProps {
  entries: WorkspaceEntry[];
  className?: string;
}

export function FileTree({ entries, className }: FileTreeProps) {
  return (
    <div className={cn("font-mono text-sm", className)}>
      {entries.map((entry) => (
        <FileTreeNode key={entry.path} entry={entry} depth={0} defaultOpen={false} />
      ))}
    </div>
  );
}
