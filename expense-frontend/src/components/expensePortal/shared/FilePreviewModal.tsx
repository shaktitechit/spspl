"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { X, Download, ExternalLink, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { resolvePublicAssetUrl } from "@/lib/env";
import { readSessionFromStorage } from "@/utils/authStorage";

export type PreviewFile = {
  name: string;
  url: string;
  mime?: string;
};

export function isPdfPreview(mime: string = "", name: string = ""): boolean {
  const m = (mime || "").toLowerCase();
  const n = (name || "").toLowerCase();
  return m.includes("pdf") || n.endsWith(".pdf") || /\.pdf(\?|$)/i.test(n) || /\.pdf(\?|$)/i.test(m);
}

export function isImagePreview(mime: string = "", name: string = ""): boolean {
  const m = (mime || "").toLowerCase();
  const n = (name || "").toLowerCase();
  if (isPdfPreview(m, n)) return false;
  if (m.includes("sheet") || m.includes("excel") || m.includes("csv") || /\.(xlsx?|csv)(\?|$)/i.test(n)) return false;
  if (m.includes("word") || /\.(docx?|zip|rar|txt)(\?|$)/i.test(n)) return false;
  return (
    m.startsWith("image/") ||
    m.includes("image") ||
    /\.(png|jpe?g|gif|webp|bmp|svg|heic)(\?|$)/i.test(n) ||
    /\.(png|jpe?g|gif|webp|bmp|svg|heic)(\?|$)/i.test(m) ||
    (!m && !/\.(pdf|xlsx?|docx?|csv|zip|rar|txt)(\?|$)/i.test(n))
  );
}

type FilePreviewModalProps = {
  doc: PreviewFile | null;
  blobUrl: string | null;
  loading: boolean;
  onClose: () => void;
  onDownload?: (doc: PreviewFile) => void;
  subtitle?: string;
};

export function FilePreviewModal({
  doc,
  blobUrl,
  loading,
  onClose,
  onDownload,
  subtitle = "Document Preview",
}: FilePreviewModalProps) {
  const sessionToken = useMemo(() => {
    return typeof window !== "undefined" ? readSessionFromStorage()?.token : null;
  }, []);

  if (!doc) return null;

  const rawUrl = doc.url || "";
  let externalUrl = rawUrl;
  if (rawUrl && (rawUrl.startsWith("http") || rawUrl.startsWith("/"))) {
    externalUrl = resolvePublicAssetUrl(rawUrl, sessionToken);
    if (sessionToken && !externalUrl.includes("token=")) {
      externalUrl += (externalUrl.includes("?") ? "&" : "?") + `token=${encodeURIComponent(sessionToken)}`;
    }
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex h-[94vh] sm:h-[min(90vh,820px)] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl sm:rounded-2xl border border-border bg-card shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Preview ${doc.name}`}
      >
        {/* Mobile Drag Indicator */}
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
          <div className="h-1.5 w-12 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-2.5 border-b border-border px-4 sm:px-5 py-3 sm:py-3.5 bg-surface-muted/50">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5 sm:gap-2">
              <FileText className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate">{doc.name}</span>
            </h3>
            <p className="text-[10px] sm:text-xs text-muted truncate">{subtitle}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {externalUrl && externalUrl !== "#" && (
              <a
                href={externalUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-muted active:scale-95 transition"
                title="Open in new tab"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Open Tab</span>
              </a>
            )}
            {blobUrl && onDownload && (
              <button
                type="button"
                onClick={() => onDownload(doc)}
                className="inline-flex items-center gap-1 rounded-xl bg-primary px-2.5 sm:px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary-hover active:scale-95 transition cursor-pointer"
                title="Download document"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Download</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-muted hover:bg-surface-muted hover:text-foreground active:scale-95 transition cursor-pointer"
              aria-label="Close preview"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-auto bg-surface-muted/40 p-4">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-muted">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span>Loading document preview…</span>
            </div>
          )}

          {!loading && blobUrl && isPdfPreview(doc.mime, doc.name) && (
            <iframe
              title={doc.name}
              src={blobUrl}
              className="h-full min-h-[65vh] w-full rounded-lg border border-border bg-card"
            />
          )}

          {!loading && blobUrl && isImagePreview(doc.mime, doc.name) && (
            <div className="flex h-full min-h-[50vh] items-center justify-center p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={blobUrl}
                alt={doc.name}
                className="max-h-full max-w-full rounded-lg object-contain shadow-md"
              />
            </div>
          )}

          {!loading &&
            blobUrl &&
            !isPdfPreview(doc.mime, doc.name) &&
            !isImagePreview(doc.mime, doc.name) && (
              <div className="flex h-full min-h-[40vh] flex-col items-center justify-center gap-3 px-6 text-center">
                <FileText className="h-12 w-12 text-muted" />
                <p className="text-sm font-medium text-foreground">
                  Inline preview is not supported for this file type.
                </p>
                {onDownload && (
                  <button
                    type="button"
                    onClick={() => onDownload(doc)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary-hover cursor-pointer"
                  >
                    <Download className="h-4 w-4" />
                    Download File
                  </button>
                )}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

export function useFilePreview(token?: string | null) {
  const [previewDoc, setPreviewDoc] = useState<PreviewFile | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewBlobRef = useRef<string | null>(null);

  const closePreview = useCallback(() => {
    if (previewBlobRef.current) {
      URL.revokeObjectURL(previewBlobRef.current);
      previewBlobRef.current = null;
    }
    setPreviewBlobUrl(null);
    setPreviewDoc(null);
    setPreviewLoading(false);
  }, []);

  useEffect(() => () => {
    if (previewBlobRef.current) {
      URL.revokeObjectURL(previewBlobRef.current);
    }
  }, []);

  const openPreview = useCallback(
    async (doc: PreviewFile) => {
      const activeMime = doc.mime || "";
      setPreviewDoc(doc);
      setPreviewLoading(true);
      setPreviewBlobUrl(null);

      // Data URLs or already created blob URLs don't need fetching
      if (doc.url?.startsWith("data:") || doc.url?.startsWith("blob:")) {
        setPreviewBlobUrl(doc.url);
        setPreviewLoading(false);
        return;
      }

      const effectiveToken =
        token || (typeof window !== "undefined" ? readSessionFromStorage()?.token : null);

      try {
        let fetchUrl = resolvePublicAssetUrl(doc.url, effectiveToken);
        if (effectiveToken && !fetchUrl.includes("token=")) {
          fetchUrl +=
            (fetchUrl.includes("?") ? "&" : "?") +
            `token=${encodeURIComponent(effectiveToken)}`;
        }

        const headers: Record<string, string> = {};
        if (effectiveToken && !doc.url.includes("token=")) {
          headers.Authorization = `Bearer ${effectiveToken}`;
        }

        const response = await fetch(fetchUrl, { headers });
        if (!response.ok) throw new Error(`Failed to load file: ${response.status}`);
        const contentType = response.headers.get("content-type") || "";
        const blob = await response.blob();
        if (previewBlobRef.current) {
          URL.revokeObjectURL(previewBlobRef.current);
        }
        const blobUrl = URL.createObjectURL(blob);
        previewBlobRef.current = blobUrl;
        setPreviewBlobUrl(blobUrl);
        const resolvedMime = activeMime || blob.type || contentType;
        if (resolvedMime) {
          setPreviewDoc((prev) => (prev ? { ...prev, mime: resolvedMime } : prev));
        }
      } catch (err: unknown) {
        console.warn("Blob fetch failed, falling back to direct URL:", err);
        if (doc.url && doc.url !== "#") {
          let fallbackUrl = resolvePublicAssetUrl(doc.url, effectiveToken);
          if (effectiveToken && !fallbackUrl.includes("token=")) {
            fallbackUrl +=
              (fallbackUrl.includes("?") ? "&" : "?") +
              `token=${encodeURIComponent(effectiveToken)}`;
          }
          setPreviewBlobUrl(fallbackUrl);
        } else {
          toast.error("Failed to load document preview");
          closePreview();
        }
      } finally {
        setPreviewLoading(false);
      }
    },
    [token, closePreview]
  );

  const downloadFile = useCallback((doc: PreviewFile) => {
    const targetUrl = previewBlobRef.current || doc.url;
    if (!targetUrl || targetUrl === "#") return;
    const a = document.createElement("a");
    a.href = targetUrl;
    a.download = doc.name || "document";
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  return {
    previewDoc,
    previewBlobUrl,
    previewLoading,
    openPreview,
    closePreview,
    downloadFile,
  };
}
