"use client";

import React, { useEffect, useState } from "react";
import { X, Sparkles } from "lucide-react";

const STORAGE_KEY = "opms_diwali_seen_2026";
const AUTO_CLOSE_MS = 12000;

/**
 * Traditional Indian Brass Diya with animated flickering flame.
 */
function DiyaSvg({ className = "w-16 h-16", size = 64 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 100 90"
      className={className}
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        {/* Diya Bowl Metallic Gradient */}
        <linearGradient id="diyaBowl" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="35%" stopColor="#d97706" />
          <stop offset="70%" stopColor="#b45309" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>

        {/* Diya Rim Highlight */}
        <linearGradient id="diyaRim" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#fef08a" />
        </linearGradient>

        {/* Outer Flame Gradient */}
        <radialGradient id="flameOuter" cx="50%" cy="80%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="25%" stopColor="#fef08a" />
          <stop offset="55%" stopColor="#f59e0b" />
          <stop offset="85%" stopColor="#ea580c" />
          <stop offset="100%" stopColor="#dc2626" />
        </radialGradient>

        {/* Inner Flame Core Gradient */}
        <linearGradient id="flameInner" x1="50%" y1="100%" x2="50%" y2="0%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="60%" stopColor="#fef08a" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>

        {/* Flame Ambient Glow Filter */}
        <filter id="diyaGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Animated Flame */}
      <g className="diwali-flame" filter="url(#diyaGlow)">
        {/* Outer Flame Teardrop */}
        <path
          d="M 50 10 C 44 26 36 38 42 50 C 46 56 54 56 58 50 C 64 38 56 26 50 10 Z"
          fill="url(#flameOuter)"
        />
        {/* Inner Flame Core */}
        <path
          d="M 50 22 C 47 32 44 40 47 48 C 49 52 51 52 53 48 C 56 40 53 32 50 22 Z"
          fill="url(#flameInner)"
        />
      </g>

      {/* Wick */}
      <path
        d="M 49 48 Q 50 44 51 40"
        stroke="#451a03"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Diya Bowl (Traditional Clay/Brass Pot) */}
      <path
        d="M 12 52 C 18 78 82 78 88 52 C 78 58 22 58 12 52 Z"
        fill="url(#diyaBowl)"
        stroke="#78350f"
        strokeWidth="1.2"
      />

      {/* Decorative Rim */}
      <path
        d="M 10 52 Q 50 60 90 52 Q 50 56 10 52 Z"
        fill="url(#diyaRim)"
      />

      {/* Diya Base Stand */}
      <path
        d="M 38 74 Q 50 78 62 74 Q 58 82 42 82 Z"
        fill="#92400e"
        stroke="#78350f"
        strokeWidth="1"
      />

      {/* Embossed Carving Dots */}
      <circle cx="30" cy="62" r="1.5" fill="#fef08a" opacity="0.8" />
      <circle cx="40" cy="65" r="1.5" fill="#fef08a" opacity="0.8" />
      <circle cx="50" cy="66" r="1.8" fill="#fef08a" />
      <circle cx="60" cy="65" r="1.5" fill="#fef08a" opacity="0.8" />
      <circle cx="70" cy="62" r="1.5" fill="#fef08a" opacity="0.8" />
    </svg>
  );
}

/**
 * Mandala / Rangoli decorative circular background.
 */
function MandalaBg() {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10 overflow-hidden"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 400 400"
        className="w-[480px] h-[480px] text-amber-300 diwali-mandala"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      >
        <circle cx="200" cy="200" r="180" strokeDasharray="4 6" />
        <circle cx="200" cy="200" r="140" />
        <circle cx="200" cy="200" r="100" strokeDasharray="3 3" />
        <circle cx="200" cy="200" r="60" />
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
          <g key={deg} transform={`rotate(${deg} 200 200)`}>
            <path d="M 200 60 Q 215 100 200 140 Q 185 100 200 60 Z" />
            <circle cx="200" cy="40" r="4" fill="currentColor" />
          </g>
        ))}
      </svg>
    </div>
  );
}

export function DiwaliCelebration() {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check if the user has already seen or closed the popup in this session
    try {
      const seen = sessionStorage.getItem(STORAGE_KEY);
      if (!seen) {
        // Small delay so the page loads smoothly before popup opens
        const openTimer = setTimeout(() => {
          setIsOpen(true);
        }, 500);
        return () => clearTimeout(openTimer);
      }
    } catch {
      // sessionStorage might be restricted in some privacy modes
    }
  }, []);

  // Handle auto-close timer when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      handleClose();
    }, AUTO_CLOSE_MS);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleClose = () => {
    setIsOpen(false);
    try {
      sessionStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // Ignore storage errors
    }
  };

  const handleReopen = () => {
    setIsOpen(true);
  };

  if (!mounted) return null;

  return (
    <>
      {/* 1. Festive Toran / Light Garland Bar across top of portal */}
      <div className="diwali-toran-bar" aria-hidden="true" />

      {/* 2. Floating Diya Corner Badge (always available to view wishes) */}
      {!isOpen && (
        <button
          type="button"
          onClick={handleReopen}
          className="fixed bottom-5 right-5 z-[999990] group flex items-center gap-2.5 px-3.5 py-2.5 rounded-full bg-gradient-to-r from-amber-950/90 to-amber-900/90 border border-amber-500/60 shadow-lg diwali-corner-badge backdrop-blur-md transition-all duration-300 hover:scale-105 hover:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
          title="Happy Diwali Greetings! Click to view 🪔"
          aria-label="Open Diwali Festive Greetings"
        >
          <div className="relative w-8 h-8 flex items-center justify-center -my-1">
            <DiyaSvg size={36} className="w-8 h-8 drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
          </div>
          <span className="text-xs font-semibold text-amber-200 tracking-wide pr-1 group-hover:text-amber-100 hidden sm:inline">
            Happy Diwali ✨
          </span>
        </button>
      )}

      {/* 3. Festive Greeting Modal */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="diwali-title"
          className="fixed inset-0 z-[999998] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md transition-opacity duration-300"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-gradient-to-b from-[#1f1035] via-[#140b24] to-[#0c0617] border border-amber-500/40 p-6 sm:p-8 text-center text-white shadow-[0_0_60px_rgba(245,158,11,0.3)] diwali-modal-animate">
            {/* Background Rangoli Mandala */}
            <MandalaBg />

            {/* Sparkles / Firecracker particle accents */}
            <div
              className="diwali-sparkle text-amber-300 top-4 left-6 text-lg"
              style={{ animationDelay: "0.2s" }}
              aria-hidden="true"
            >
              ✨
            </div>
            <div
              className="diwali-sparkle text-amber-200 top-8 right-12 text-sm"
              style={{ animationDelay: "1.1s" }}
              aria-hidden="true"
            >
              ✦
            </div>
            <div
              className="diwali-sparkle text-orange-400 bottom-16 left-8 text-base"
              style={{ animationDelay: "0.7s" }}
              aria-hidden="true"
            >
              🎆
            </div>
            <div
              className="diwali-sparkle text-yellow-300 bottom-12 right-8 text-lg"
              style={{ animationDelay: "1.5s" }}
              aria-hidden="true"
            >
              ✨
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={handleClose}
              className="absolute top-4 right-4 z-10 rounded-full p-1.5 text-amber-300/70 hover:text-amber-100 hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
              aria-label="Close Diwali Greeting"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Sub-header badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-400/30 text-[11px] font-semibold tracking-wider text-amber-300 uppercase mb-4">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>शुभ दीपावली • Festival of Lights</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            </div>

            {/* Central Animated Diyas & Sacred Flame */}
            <div className="relative flex items-center justify-center gap-3 my-2">
              <DiyaSvg size={60} className="w-14 h-14 transform -scale-x-100 opacity-80" />
              <div className="relative -mt-2">
                <DiyaSvg size={84} className="w-20 h-20 drop-shadow-[0_0_24px_rgba(245,158,11,0.9)]" />
              </div>
              <DiyaSvg size={60} className="w-14 h-14 opacity-80" />
            </div>

            {/* Title */}
            <h2
              id="diwali-title"
              className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight diwali-gold-text"
            >
              Happy Diwali!
            </h2>

            {/* Heartfelt Wish Message */}
            <p className="mt-3 text-sm sm:text-base text-amber-100/90 leading-relaxed max-w-md mx-auto">
              May the divine light of Deepawali illuminate your path, dispel every darkness,
              and shower your life and organization with abundance, good health, and prosperous success!
            </p>

            {/* Portal Signature */}
            <div className="mt-5 pt-4 border-t border-amber-500/20 flex flex-col items-center">
              <span className="text-xs uppercase tracking-widest text-amber-400/80 font-medium">
                Warm Festive Wishes
              </span>
              <span className="text-sm font-semibold text-amber-200 mt-0.5">
                From SPSPL & Medica Operations Team
              </span>
            </div>

            {/* Action Button */}
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="w-full sm:w-auto px-8 py-2.5 rounded-full font-medium text-sm text-amber-950 bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 shadow-[0_0_20px_rgba(245,158,11,0.5)] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-amber-300"
              >
                Continue to Portal 🪔
              </button>
            </div>

            {/* Subtle auto-dismiss progress bar at bottom of card */}
            <div
              className="absolute bottom-0 left-0 right-0 h-1 bg-amber-950/60 overflow-hidden"
              title="Auto-closing soon"
            >
              <div className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 diwali-progress-bar" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
export default DiwaliCelebration;
