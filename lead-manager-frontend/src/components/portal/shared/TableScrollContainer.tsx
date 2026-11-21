"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type TableScrollContainerProps = {
  children: React.ReactNode;
  className?: string;
  scrollStep?: number;
};

/**
 * Reusable table scroll wrapper that provides horizontal sliding controls
 * (left/right slider buttons) visible on table hover.
 */
export function TableScrollContainer({
  children,
  className = "",
  scrollStep = 350,
}: TableScrollContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);

  const checkScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);

    const resizeObserver = new ResizeObserver(() => {
      checkScroll();
    });
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
      resizeObserver.disconnect();
    };
  }, [checkScroll]);

  const stopHoldScroll = () => {
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const handleScrollLeft = () => {
    containerRef.current?.scrollBy({ left: -scrollStep, behavior: "smooth" });
  };

  const handleScrollRight = () => {
    containerRef.current?.scrollBy({ left: scrollStep, behavior: "smooth" });
  };

  const handleMouseDown = (direction: "left" | "right") => {
    stopHoldScroll();
    holdTimerRef.current = setInterval(() => {
      containerRef.current?.scrollBy({
        left: direction === "left" ? -150 : 150,
        behavior: "smooth",
      });
    }, 120);
  };

  return (
    <div className="relative group/table">
      {/* Sticky Left / Right Slider overlay controls */}
      <div className="pointer-events-none absolute inset-0 z-20">
        <div className="sticky top-1/2 -translate-y-1/2 flex items-center justify-between px-3 w-full">
          {/* Left Slider Button */}
          {canScrollLeft ? (
            <button
              type="button"
              onClick={handleScrollLeft}
              onMouseDown={() => handleMouseDown("left")}
              onMouseUp={stopHoldScroll}
              onMouseLeave={stopHoldScroll}
              className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-card/95 text-foreground shadow-xl border border-border backdrop-blur-md opacity-0 group-hover/table:opacity-100 transition-all duration-200 hover:scale-110 hover:bg-card active:scale-95 cursor-pointer"
              title="Slide left"
              aria-label="Slide table left"
            >
              <ChevronLeft className="h-5 w-5 text-foreground" />
            </button>
          ) : (
            <div className="h-10 w-10" />
          )}

          {/* Right Slider Button */}
          {canScrollRight ? (
            <button
              type="button"
              onClick={handleScrollRight}
              onMouseDown={() => handleMouseDown("right")}
              onMouseUp={stopHoldScroll}
              onMouseLeave={stopHoldScroll}
              className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-card/95 text-foreground shadow-xl border border-border backdrop-blur-md opacity-0 group-hover/table:opacity-100 transition-all duration-200 hover:scale-110 hover:bg-card active:scale-95 cursor-pointer"
              title="Slide right"
              aria-label="Slide table right"
            >
              <ChevronRight className="h-5 w-5 text-foreground" />
            </button>
          ) : (
            <div className="h-10 w-10" />
          )}
        </div>
      </div>

      {/* Horizontal Scrollable Table Container */}
      <div
        ref={containerRef}
        className={`overflow-x-auto scroll-smooth ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
