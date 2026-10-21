"use client";

import { useState, useEffect } from "react";
import { Sparkles, Palette, Image as ImageIcon, Building2, Save, RotateCcw, CheckCircle2, AlertCircle, Loader2, Pipette, Check } from "lucide-react";

export const THEME_PALETTES = [
  { id: "default", name: "Default (Indigo Violet)", primary: "#636ccb", secondary: "#6e8cfb", description: "Standard brand palette" },
  { id: "indigo", name: "Royal Indigo", primary: "#4f46e5", secondary: "#818cf8", description: "Deep indigo with vibrant accents" },
  { id: "blue", name: "Ocean Blue", primary: "#2563eb", secondary: "#60a5fa", description: "Corporate ocean blue tone" },
  { id: "emerald", name: "Emerald Teal", primary: "#059669", secondary: "#34d399", description: "Fresh emerald green & mint" },
  { id: "rose", name: "Crimson Rose", primary: "#e11d48", secondary: "#fb7185", description: "Modern crimson red accent" },
  { id: "amber", name: "Warm Amber", primary: "#d97706", secondary: "#fbbf24", description: "Golden amber & warm orange" },
];

interface BrandingThemeData {
  logo_url?: string;
  favicon_url?: string;
  primary_color?: string;
  secondary_color?: string;
  theme_palette?: string;
  legal_name?: string;
}

interface BrandingThemeSectionProps {
  initialData: BrandingThemeData;
  onSave: (data: Partial<BrandingThemeData>) => Promise<void>;
  onPreviewChange?: (data: Partial<BrandingThemeData>) => void;
}

export function BrandingThemeSection({ initialData, onSave, onPreviewChange }: BrandingThemeSectionProps) {
  const [formData, setFormData] = useState<BrandingThemeData>({
    logo_url: "",
    favicon_url: "",
    primary_color: "#636ccb",
    secondary_color: "#6e8cfb",
    theme_palette: "default",
    ...initialData,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setFormData({
      logo_url: initialData.logo_url || "",
      favicon_url: initialData.favicon_url || "",
      primary_color: initialData.primary_color || "#636ccb",
      secondary_color: initialData.secondary_color || "#6e8cfb",
      theme_palette: initialData.theme_palette || "default",
    });
  }, [initialData]);

  const handleSelectPalette = (preset: typeof THEME_PALETTES[0]) => {
    const next = {
      ...formData,
      theme_palette: preset.id,
      primary_color: preset.primary,
      secondary_color: preset.secondary,
    };
    setFormData(next);
    onPreviewChange?.(next);
  };

  const handleColorChange = (key: "primary_color" | "secondary_color", value: string) => {
    const next = { ...formData, [key]: value, theme_palette: "custom" };
    setFormData(next);
    onPreviewChange?.(next);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: "logo_url" | "favicon_url") => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMsg("Please upload a valid image file");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg("Image file size should be less than 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        const next = { ...formData, [field]: result };
        setFormData(next);
        onPreviewChange?.(next);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleReset = () => {
    const reset = {
      logo_url: initialData.logo_url || "",
      favicon_url: initialData.favicon_url || "",
      primary_color: initialData.primary_color || "#636ccb",
      secondary_color: initialData.secondary_color || "#6e8cfb",
      theme_palette: initialData.theme_palette || "default",
    };
    setFormData(reset);
    onPreviewChange?.(reset);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await onSave({
        logo_url: formData.logo_url || "",
        favicon_url: formData.favicon_url || "",
        primary_color: formData.primary_color || "#636ccb",
        secondary_color: formData.secondary_color || "#6e8cfb",
        theme_palette: formData.theme_palette || "default",
      });
      setSuccessMsg("Branding and theme configuration saved successfully!");
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to save branding settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const isDirty =
    (formData.logo_url || "") !== (initialData.logo_url || "") ||
    (formData.favicon_url || "") !== (initialData.favicon_url || "") ||
    (formData.primary_color || "#636ccb") !== (initialData.primary_color || "#636ccb") ||
    (formData.secondary_color || "#6e8cfb") !== (initialData.secondary_color || "#6e8cfb") ||
    (formData.theme_palette || "default") !== (initialData.theme_palette || "default");

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-6 shadow-sm">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-foreground">Branding & Dynamic Theme Palette</h3>
              {isDirty && (
                <span className="text-3xs font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                  Unsaved Changes
                </span>
              )}
            </div>
            <p className="text-xs text-muted">Customize corporate logo, browser tab favicon, and primary color accents</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={!isDirty || isSaving}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-muted hover:text-foreground hover:bg-surface-muted transition disabled:opacity-40"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Theme
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-primary transition active:scale-95 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Branding & Theme
          </button>
        </div>
      </div>

      {/* Feedback Messages */}
      {successMsg && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs font-semibold text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs font-semibold text-rose-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Media Uploads: Logo & Favicon */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Brand Logo */}
        <div className="rounded-xl border border-border bg-background p-4.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground">Corporate Brand Logo</span>
            {formData.logo_url && (
              <button
                type="button"
                onClick={() => {
                  const next = { ...formData, logo_url: "" };
                  setFormData(next);
                  onPreviewChange?.(next);
                }}
                className="text-3xs text-rose-400 hover:underline"
              >
                Clear Logo
              </button>
            )}
          </div>

          <div className="flex h-20 w-full items-center justify-center rounded-xl border border-dashed border-border bg-card p-3">
            {formData.logo_url ? (
              <img src={formData.logo_url} alt="Brand Logo Preview" className="max-h-16 max-w-full object-contain" />
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted">
                <Building2 className="h-5 w-5 text-muted" />
                <span>Default Brand Icon Active</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <input
              type="text"
              name="logo_url"
              value={formData.logo_url || ""}
              onChange={(e) => {
                const next = { ...formData, logo_url: e.target.value };
                setFormData(next);
                onPreviewChange?.(next);
              }}
              placeholder="Paste Logo Image URL (e.g. https://...)"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
            />

            <label className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-2 px-3 text-xs font-semibold text-foreground hover:bg-surface-muted transition cursor-pointer">
              <ImageIcon className="h-3.5 w-3.5 text-muted" />
              <span>Upload Local Image...</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, "logo_url")} />
            </label>
          </div>
        </div>

        {/* Favicon */}
        <div className="rounded-xl border border-border bg-background p-4.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground">Browser Tab Favicon (1:1)</span>
            {formData.favicon_url && (
              <button
                type="button"
                onClick={() => {
                  const next = { ...formData, favicon_url: "" };
                  setFormData(next);
                  onPreviewChange?.(next);
                }}
                className="text-3xs text-rose-400 hover:underline"
              >
                Clear Favicon
              </button>
            )}
          </div>

          <div className="flex h-20 w-full items-center justify-center rounded-xl border border-dashed border-border bg-card p-3">
            {formData.favicon_url ? (
              <img src={formData.favicon_url} alt="Favicon Preview" className="h-10 w-10 object-contain rounded-lg" />
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted">
                <Sparkles className="h-5 w-5 text-muted" />
                <span>Default Tab Favicon Active</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <input
              type="text"
              name="favicon_url"
              value={formData.favicon_url || ""}
              onChange={(e) => {
                const next = { ...formData, favicon_url: e.target.value };
                setFormData(next);
                onPreviewChange?.(next);
              }}
              placeholder="Paste Favicon URL (e.g. https://...)"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
            />

            <label className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-2 px-3 text-xs font-semibold text-foreground hover:bg-surface-muted transition cursor-pointer">
              <ImageIcon className="h-3.5 w-3.5 text-muted" />
              <span>Upload Favicon Image...</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, "favicon_url")} />
            </label>
          </div>
        </div>
      </div>

      {/* Preset Theme Palettes */}
      <div className="space-y-3 pt-2">
        <label className="text-xs font-bold text-foreground flex items-center gap-2">
          <Palette className="h-4 w-4 text-primary" />
          Choose Pre-Configured Theme Palette
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {THEME_PALETTES.map((palette) => {
            const isSelected =
              formData.theme_palette === palette.id ||
              (formData.primary_color?.toLowerCase() === palette.primary.toLowerCase() &&
                formData.secondary_color?.toLowerCase() === palette.secondary.toLowerCase());
            return (
              <button
                key={palette.id}
                type="button"
                onClick={() => handleSelectPalette(palette)}
                className={`relative flex flex-col items-center p-3 rounded-xl border text-left transition ${
                  isSelected
                    ? "border-primary bg-primary/10 shadow-sm ring-2 ring-primary/40"
                    : "border-border bg-background hover:border-primary/40 hover:bg-surface-muted"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="h-5 w-5 rounded-full shadow-xs border border-white/20" style={{ backgroundColor: palette.primary }} />
                  <div className="h-5 w-5 rounded-full shadow-xs border border-white/20" style={{ backgroundColor: palette.secondary }} />
                </div>
                <span className="text-[11px] font-bold text-foreground text-center line-clamp-1">{palette.name}</span>
                {isSelected && (
                  <div className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-white">
                    <Check className="h-2.5 w-2.5 stroke-[3]" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Color Pickers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        <div className="rounded-xl border border-border bg-background p-3.5 space-y-2">
          <label className="text-xs font-semibold text-foreground flex items-center justify-between">
            <span>Primary Brand Color</span>
            <span className="font-mono text-3xs text-muted">{formData.primary_color}</span>
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={formData.primary_color || "#636ccb"}
              onChange={(e) => handleColorChange("primary_color", e.target.value)}
              className="h-10 w-12 cursor-pointer rounded-lg border border-border bg-card p-1"
            />
            <input
              type="text"
              value={formData.primary_color || "#636ccb"}
              onChange={(e) => handleColorChange("primary_color", e.target.value)}
              className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-xs font-mono text-foreground focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-background p-3.5 space-y-2">
          <label className="text-xs font-semibold text-foreground flex items-center justify-between">
            <span>Secondary Accent Color</span>
            <span className="font-mono text-3xs text-muted">{formData.secondary_color}</span>
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={formData.secondary_color || "#6e8cfb"}
              onChange={(e) => handleColorChange("secondary_color", e.target.value)}
              className="h-10 w-12 cursor-pointer rounded-lg border border-border bg-card p-1"
            />
            <input
              type="text"
              value={formData.secondary_color || "#6e8cfb"}
              onChange={(e) => handleColorChange("secondary_color", e.target.value)}
              className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-xs font-mono text-foreground focus:border-primary focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Live Preview Card */}
      <div className="rounded-xl border border-border bg-background p-4 space-y-2">
        <span className="text-xs font-bold text-foreground flex items-center gap-2">
          <Pipette className="h-3.5 w-3.5 text-primary" />
          Live Application Palette Preview
        </span>
        <div
          className="rounded-xl p-4 text-white shadow-md flex items-center justify-between transition-colors duration-300"
          style={{
            background: `linear-gradient(135deg, ${formData.primary_color || "#636ccb"} 0%, ${formData.secondary_color || "#6e8cfb"} 100%)`,
          }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-xs font-bold text-sm shadow-xs">
              {formData.logo_url ? (
                <img src={formData.logo_url} alt="Logo" className="h-8 w-8 object-contain" />
              ) : (
                <Building2 className="h-5 w-5" />
              )}
            </div>
            <div>
              <p className="font-bold text-sm tracking-tight">{initialData.legal_name || "Enterprise Brand Header"}</p>
              <p className="text-xs text-white/80">OPMS Enterprise Suite Design System</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-3xs font-extrabold uppercase px-2.5 py-1 rounded-lg bg-white/20 border border-white/30 backdrop-blur-xs">
              Live Preview
            </span>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <button
          type="button"
          onClick={handleReset}
          disabled={!isDirty || isSaving}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground disabled:opacity-40 transition"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset Theme
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !isDirty}
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-primary transition active:scale-95 disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save Branding & Theme
        </button>
      </div>
    </div>
  );
}
