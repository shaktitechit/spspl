'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Upload,
  Folder,
  FileText,
  Download,
  Trash2,
  FileSpreadsheet,
  FileCode,
  FileImage,
  Plus,
} from 'lucide-react';
import {
  fetchProjectFiles,
  uploadProjectFile,
  deleteProjectFile,
  getProjectAttachmentPreviewUrl,
  getProjectAttachmentDownloadUrl,
} from '@/lib/projectApi';
import type { ProjectFileItem } from '@/types/project';

interface ProjectFilesTabProps {
  projectId: string;
  token: string | null;
  canEdit: boolean;
}

const FOLDERS = ['All', 'General', 'Deliverables', 'Specs', 'Contracts', 'Briefs'];

export function ProjectFilesTab({ projectId, token, canEdit }: ProjectFilesTabProps) {
  const [files, setFiles] = useState<ProjectFileItem[]>([]);
  const [selectedFolder, setSelectedFolder] = useState('All');
  const [uploadFolder, setUploadFolder] = useState('General');
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = async () => {
    try {
      setIsLoading(true);
      const data = await fetchProjectFiles(token, projectId);
      setFiles(data);
    } catch (err) {
      console.error('Failed to load project files:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, [projectId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const { fileRecord } = await uploadProjectFile(token, projectId, file, uploadFolder);
      setFiles((prev) => [fileRecord, ...prev]);
    } catch (err: any) {
      alert(err.message || 'Failed to upload file');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return;
    try {
      await deleteProjectFile(token, projectId, fileId);
      setFiles((prev) => prev.filter((f) => f._id !== fileId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete file');
    }
  };

  const filteredFiles =
    selectedFolder === 'All'
      ? files
      : files.filter((f) => (f.folder || 'General').toLowerCase() === selectedFolder.toLowerCase());

  const getFileIcon = (mimeType?: string) => {
    if (!mimeType) return FileText;
    if (mimeType.startsWith('image/')) return FileImage;
    if (mimeType.includes('spreadsheet') || mimeType.includes('csv') || mimeType.includes('excel'))
      return FileSpreadsheet;
    if (mimeType.includes('pdf') || mimeType.includes('document')) return FileText;
    return FileCode;
  };

  return (
    <div className="space-y-4">
      {/* Header & Upload Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-foreground">Project Files & Documents Hub</h3>
          <p className="text-xs text-muted">Central document repository with folder grouping and versioning</p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />

          <select
            value={uploadFolder}
            onChange={(e) => setUploadFolder(e.target.value)}
            className="rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground focus:outline-hidden"
          >
            {FOLDERS.filter((f) => f !== 'All').map((f) => (
              <option key={f} value={f}>
                Upload to: {f}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white hover:bg-primary-hover shadow-xs disabled:opacity-50 transition"
          >
            <Upload className="h-4 w-4" />
            {isUploading ? 'Uploading...' : 'Upload File'}
          </button>
        </div>
      </div>

      {/* Folder Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border pb-2">
        {FOLDERS.map((folder) => {
          const isActive = selectedFolder === folder;
          const count =
            folder === 'All'
              ? files.length
              : files.filter((f) => (f.folder || 'General').toLowerCase() === folder.toLowerCase()).length;

          return (
            <button
              key={folder}
              type="button"
              onClick={() => setSelectedFolder(folder)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                isActive
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-muted hover:bg-surface-muted hover:text-foreground'
              }`}
            >
              <Folder className="h-3.5 w-3.5" />
              <span>{folder}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-surface-muted text-muted'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Files Grid / List */}
      {isLoading ? (
        <div className="flex h-40 items-center justify-center text-xs text-muted">
          Loading file repository...
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center bg-card">
          <Folder className="h-8 w-8 text-muted mx-auto mb-2 opacity-40" />
          <p className="text-xs font-semibold text-foreground">No files in folder &ldquo;{selectedFolder}&rdquo;</p>
          <p className="text-[11px] text-muted">Upload contracts, deliverables, or specifications to this folder.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {filteredFiles.map((file) => {
            const Icon = getFileIcon(file.mime_type);
            const isImage = file.mime_type?.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(file.file_name);
            const rawAttId =
              typeof file.attachment_id === 'object'
                ? (file.attachment_id as any)?._id || (file.attachment_id as any)?.url
                : file.attachment_id;
            const previewUrl = getProjectAttachmentPreviewUrl(rawAttId, token);
            const downloadUrl = getProjectAttachmentDownloadUrl(rawAttId, token);

            return (
              <div
                key={file._id}
                className="flex flex-col justify-between rounded-2xl border border-border bg-card p-3.5 shadow-xs hover:border-primary/40 transition space-y-3"
              >
                <div className="flex items-start gap-2.5">
                  {isImage && previewUrl ? (
                    <img
                      src={previewUrl}
                      alt={file.file_name}
                      className="h-9 w-9 shrink-0 rounded-xl object-cover border border-border"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                      <Icon className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-foreground truncate" title={file.file_name}>
                      {file.file_name}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted mt-0.5">
                      <span className="font-semibold uppercase">{file.folder || 'General'}</span>
                      <span>•</span>
                      <span>{file.size_bytes ? `${(file.size_bytes / 1024).toFixed(0)} KB` : 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/60 text-[11px] text-muted">
                  <span>{new Date(file.createdAt).toLocaleDateString()}</span>

                  <div className="flex items-center gap-1">
                    {previewUrl && (
                      <a
                        href={previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg px-2 py-1 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary hover:text-white transition"
                        title="Preview"
                      >
                        Preview
                      </a>
                    )}
                    {downloadUrl && (
                      <a
                        href={downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg p-1.5 text-muted hover:text-primary hover:bg-primary/10 transition"
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleDeleteFile(file._id)}
                        className="rounded-lg p-1.5 text-muted hover:text-rose-500 hover:bg-rose-500/10 transition"
                        title="Delete file"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

