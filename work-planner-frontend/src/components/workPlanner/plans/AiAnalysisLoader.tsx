"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Loader2,
  MapPin,
  CheckSquare,
  Compass,
  ShieldCheck,
  Brain,
} from "lucide-react";

interface AiAnalysisLoaderProps {
  title?: string;
  subtitle?: string;
  className?: string;
}

const AI_PHASES = [
  {
    icon: Compass,
    title: "Harvesting Operational Records",
    desc: "Ingesting daily work plans, location logs, and pre-planning manager discussions…",
  },
  {
    icon: MapPin,
    title: "Auditing Field Visits & Commercial Drive",
    desc: "Evaluating client hunting vs farming, GPS check-in accuracy, and meeting outcome depth…",
  },
  {
    icon: CheckSquare,
    title: "Analyzing Task Heads & Execution Velocity",
    desc: "Scrutinizing task titles, completion remarks, and diagnosing multi-day rollover bottlenecks…",
  },
  {
    icon: ShieldCheck,
    title: "Reviewing Senior Authority Directives",
    desc: "Evaluating executive coachability, senior remark history, and day-end reporting integrity…",
  },
  {
    icon: Brain,
    title: "Synthesizing 360° Caliber Diagnosis with OpenAI",
    desc: "Constructing executive scorecards, 6-dimension ratings, and manager coaching playbooks…",
  },
];

export function AiAnalysisLoader({
  title = "Synthesizing 360° AI Caliber Assessment…",
  subtitle = "Evaluating complete work plan integrity, client meeting depth, task velocity, and senior directives with OpenAI intelligence.",
  className = "",
}: AiAnalysisLoaderProps) {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [progress, setProgress] = useState(15);

  useEffect(() => {
    const phaseTimer = setInterval(() => {
      setPhaseIndex((prev) => (prev + 1) % AI_PHASES.length);
    }, 2800);

    const progressTimer = setInterval(() => {
      setProgress((prev) => (prev >= 92 ? 92 : prev + Math.floor(Math.random() * 6) + 3));
    }, 500);

    return () => {
      clearInterval(phaseTimer);
      clearInterval(progressTimer);
    };
  }, []);

  const currentPhase = AI_PHASES[phaseIndex];
  const IconComponent = currentPhase.icon;

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-b from-card via-card to-primary/5 p-8 sm:p-12 shadow-lg text-center ${className}`}>
      {/* Background Ambient Glow */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-48 rounded-full bg-gradient-to-tr from-purple-600/20 via-primary/25 to-pink-500/20 blur-3xl pointer-events-none" />

      <div className="relative flex flex-col items-center max-w-lg mx-auto space-y-6">
        {/* Animated Glow Pulsing Ring */}
        <div className="relative flex items-center justify-center">
          <div className="absolute h-20 w-20 rounded-full bg-gradient-to-r from-primary via-purple-500 to-pink-500 opacity-30 blur-md animate-pulse" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 text-white shadow-xl ring-4 ring-primary/20 animate-bounce">
            <Sparkles className="h-8 w-8" />
          </div>
        </div>

        {/* Title & Subtitle */}
        <div className="space-y-1.5">
          <h3 className="text-base sm:text-lg font-extrabold text-foreground tracking-tight">
            {title}
          </h3>
          <p className="text-xs text-muted leading-relaxed">
            {subtitle}
          </p>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="w-full space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-muted">
            <span className="flex items-center gap-1.5 text-primary">
              <Loader2 className="h-3 w-3 animate-spin" />
              AI Intelligence Pipeline Active
            </span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-surface-muted overflow-hidden border border-border">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Rotating Phase Pill Card */}
        <div className="w-full rounded-xl border border-border/80 bg-surface-muted/60 p-3.5 text-left transition-all duration-300 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
              <IconComponent className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">
                  {currentPhase.title}
                </span>
                <span className="text-[10px] text-muted font-medium">
                  Step {phaseIndex + 1} of {AI_PHASES.length}
                </span>
              </div>
              <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                {currentPhase.desc}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
