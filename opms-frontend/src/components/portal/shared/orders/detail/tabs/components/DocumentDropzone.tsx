"use client";

import { useCallback, useState, useRef } from "react";
import { UploadCloud, FileUp } from "lucide-react";
import { toast } from "@/lib/toast";

export type DocumentDropzoneProps = {
  onFilesSelected: (files: File[]) => void;
  multiple?: boolean;
  accept?: string;
  disabled?: boolean;
  label?: string;
  description?: string;
  maxSizeMB?: number;
  className?: string;
};

export function DocumentDropzone({
  onFilesSelected,
  multiple = false,
  accept = ".pdf,image/*,.png,.jpg,.jpeg,.webp",
  disabled = false,
  label = "Upload Document",
  description = "Drag & drop file here or click to browse (PDF, PNG, JPG up to 25MB)",
  maxSizeMB = 25,
  className = "",
}: DocumentDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0 || disabled) return;
      const validFiles: File[] = [];
      const maxBytes = maxSizeMB * 1024 * 1024;

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        if (file.size > maxBytes) {
          toast.error(`"${file.name}" exceeds the ${maxSizeMB}MB file size limit.`);
          continue;
        }
        validFiles.push(file);
        if (!multiple) break;
      }

      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
    },
    [disabled, maxSizeMB, multiple, onFilesSelected]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      processFiles(e.dataTransfer.files);
    },
    [processFiles]
  );

  const handleClick = () => {
    if (!disabled && inputRef.current) {
      inputRef.current.click();
    }
  };

  return (
    <div
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all duration-200 ${
        disabled
          ? "cursor-not-allowed opacity-50 border-slate-200 bg-slate-50 dark:border-white/5 dark:bg-white/[0.02]"
          : isDragOver
          ? "border-blue-500 bg-blue-50/60 shadow-inner dark:border-blue-400 dark:bg-blue-950/30"
          : "border-slate-250 bg-slate-50/40 hover:border-blue-400 hover:bg-blue-50/20 dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-blue-500/50 dark:hover:bg-blue-950/20"
      } ${className}`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        disabled={disabled}
        onChange={(e) => {
          processFiles(e.target.files);
          if (e.target) e.target.value = "";
        }}
        className="hidden"
      />

      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition-transform group-hover:scale-110 dark:bg-blue-950/50 dark:text-blue-400">
        {isDragOver ? (
          <FileUp className="h-6 w-6 animate-bounce" />
        ) : (
          <UploadCloud className="h-6 w-6" />
        )}
      </div>

      <div className="mt-3 space-y-1">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          {label}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
      </div>

      <span className="mt-3 inline-flex items-center rounded-lg border border-slate-200/90 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm transition group-hover:border-blue-300 group-hover:text-blue-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:group-hover:border-blue-500">
        Browse Files
      </span>
    </div>
  );
}
