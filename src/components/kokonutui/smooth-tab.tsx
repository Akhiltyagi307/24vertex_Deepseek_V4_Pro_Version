"use client";

/**
 * @author: @dorianbaffier
 * @description: Smooth Tab
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import type { LucideIcon } from "lucide-react";
import type { Transition, Variants } from "motion/react";
import { AnimatePresence, motion } from "motion/react";
import * as React from "react";
import { cardSurfaceFrameClassName } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface TabItem {
  id: string;
  title: string;
  icon?: LucideIcon;
  content?: React.ReactNode;
  cardContent?: React.ReactNode;
  color: string;
}

interface SmoothTabProps {
  items: TabItem[];
  defaultTabId?: string;
  className?: string;
  activeColor?: string;
  onChange?: (tabId: string) => void;
  /** When true, tab panels stay mounted (required for native forms). Uses simple show/hide; hero `cardContent` mode still animates. */
  persistContentPanels?: boolean;
  /** Keep these panels unmounted until first activation, then persist them like normal content panels. */
  deferUntilActivatedTabIds?: string[];
  /** Optional class for the scrollable panel wrapper (e.g. min-height). */
  panelClassName?: string;
  /** Tab bar above or below the panel. Default keeps the KokonutUI bottom toolbar layout. */
  tabListPosition?: "top" | "bottom";
  /** Bump `token` to programmatically switch to `tabId` when it exists in `items`. */
  activateTabRequest?: { token: number; tabId: string } | null;
}

const slideVariants: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "100%" : "-100%",
    opacity: 0,
    filter: "blur(8px)",
    scale: 0.95,
    position: "absolute" as const,
  }),
  center: {
    x: 0,
    opacity: 1,
    filter: "blur(0px)",
    scale: 1,
    position: "absolute" as const,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? "100%" : "-100%",
    opacity: 0,
    filter: "blur(8px)",
    scale: 0.95,
    position: "absolute" as const,
  }),
};

const transition: Transition = {
  duration: 0.4,
  ease: [0.32, 0.72, 0, 1],
};

const GRID_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
};

export default function SmoothTab({
  items,
  defaultTabId = items[0].id,
  className,
  activeColor = "bg-[#1F9CFE]",
  onChange,
  persistContentPanels = false,
  deferUntilActivatedTabIds = [],
  panelClassName,
  tabListPosition = "bottom",
  activateTabRequest = null,
}: SmoothTabProps) {
  const [selected, setSelected] = React.useState<string>(defaultTabId);
  const [direction, setDirection] = React.useState(0);
  const [dimensions, setDimensions] = React.useState({ width: 0, left: 0 });
  const deferredTabIdsKey = deferUntilActivatedTabIds.join("\u0000");
  const deferredTabIds = React.useMemo(
    () => new Set(deferUntilActivatedTabIds),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callers often pass small inline arrays.
    [deferredTabIdsKey]
  );
  const [activatedDeferredTabIds, setActivatedDeferredTabIds] = React.useState(
    () => new Set<string>(deferredTabIds.has(defaultTabId) ? [defaultTabId] : [])
  );

  // Reference for the selected button
  const buttonRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map());
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!activateTabRequest) return;
    const tabId = activateTabRequest.tabId;
    const idx = items.findIndex((item) => item.id === tabId);
    if (idx === -1) return;
    setDirection(1);
    if (deferredTabIds.has(tabId)) {
      setActivatedDeferredTabIds((prev) => new Set(prev).add(tabId));
    }
    setSelected(tabId);
    onChange?.(tabId);
  }, [activateTabRequest, deferredTabIds, items, onChange]);

  // Update dimensions whenever selected tab changes or on mount
  React.useLayoutEffect(() => {
    const updateDimensions = () => {
      const selectedButton = buttonRefs.current.get(selected);
      const container = containerRef.current;

      if (selectedButton && container) {
        const rect = selectedButton.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        setDimensions({
          width: rect.width,
          left: rect.left - containerRect.left,
        });
      }
    };

    // Initial update
    requestAnimationFrame(() => {
      updateDimensions();
    });

    // Update on resize
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, [selected]);

  const handleTabClick = (tabId: string) => {
    const currentIndex = items.findIndex((item) => item.id === selected);
    const newIndex = items.findIndex((item) => item.id === tabId);
    setDirection(newIndex > currentIndex ? 1 : -1);
    if (deferredTabIds.has(tabId)) {
      setActivatedDeferredTabIds((prev) => new Set(prev).add(tabId));
    }
    setSelected(tabId);
    onChange?.(tabId);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    tabId: string
  ) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleTabClick(tabId);
    }
  };

  const selectedItem = items.find((item) => item.id === selected);
  const gridColsClass = GRID_COLS[items.length] ?? "grid-cols-4";
  const usePersistentPanels =
    persistContentPanels || items.some((item) => item.content != null);

  const panelBlock = (
    <div
      className={cn(
        "relative flex-1",
        tabListPosition === "bottom" && "mb-4"
      )}
    >
      {usePersistentPanels ? (
        <div
          className={cn(
            cardSurfaceFrameClassName,
            "relative w-full overflow-hidden rounded-lg",
            panelClassName
          )}
        >
          {items.map((item) => {
            const isSelected = selected === item.id;
            const shouldRenderPanel =
              !deferredTabIds.has(item.id) ||
              activatedDeferredTabIds.has(item.id) ||
              isSelected;
            return (
              <div
                aria-labelledby={`tab-${item.id}`}
                className={cn(!isSelected && "hidden")}
                hidden={!isSelected}
                id={`panel-${item.id}`}
                key={item.id}
                role="tabpanel"
              >
                {shouldRenderPanel ? (item.content ?? item.cardContent) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div
          className={cn(
            cardSurfaceFrameClassName,
            "relative h-[200px] w-full rounded-lg"
          )}
        >
          <div className="absolute inset-0 overflow-hidden rounded-lg">
            <AnimatePresence
              custom={direction}
              initial={false}
              mode="popLayout"
            >
              <motion.div
                animate="center"
                className="absolute inset-0 h-full w-full bg-card will-change-transform"
                custom={direction}
                exit="exit"
                initial="enter"
                key={`card-${selected}`}
                style={{
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                }}
                transition={transition}
                variants={slideVariants}
              >
                {selectedItem?.cardContent}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );

  const tabListBlock = (
    <div
      aria-label="Smooth tabs"
      className={cn(
        "relative flex items-center justify-between gap-1 py-1",
        "w-full bg-background",
        "rounded-xl border border-border ring-1 ring-foreground/10 transition-colors hover:border-border/80",
        "transition-all duration-200",
        tabListPosition === "bottom" ? "mt-auto" : "mb-4",
        className
      )}
      ref={containerRef}
      role="tablist"
    >
      <motion.div
        animate={{
          width: dimensions.width - 8,
          x: dimensions.left + 4,
          opacity: 1,
        }}
        className={cn(
          "absolute z-[1] rounded-lg",
          selectedItem?.color || activeColor
        )}
        initial={false}
        style={{ height: "calc(100% - 8px)", top: "4px" }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 30,
        }}
      />

      <div className={cn("relative z-[2] grid w-full gap-1", gridColsClass)}>
        {items.map((item) => {
          const isSelected = selected === item.id;
          const Icon = item.icon;
          return (
            <motion.button
              aria-controls={`panel-${item.id}`}
              aria-selected={isSelected}
              className={cn(
                "relative flex min-h-9 items-center justify-center gap-1 rounded-lg px-2 py-2",
                "font-medium text-sm transition-all duration-300",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "truncate",
                isSelected
                  ? "text-white"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
              id={`tab-${item.id}`}
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              onKeyDown={(e) => handleKeyDown(e, item.id)}
              ref={(el) => {
                if (el) buttonRefs.current.set(item.id, el);
                else buttonRefs.current.delete(item.id);
              }}
              role="tab"
              tabIndex={isSelected ? 0 : -1}
              type="button"
            >
              {Icon ? (
                <Icon
                  aria-hidden
                  className="hidden size-4 shrink-0 medium:block"
                />
              ) : null}
              <span className="truncate">{item.title}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      {tabListPosition === "top" ? (
        <>
          {tabListBlock}
          {panelBlock}
        </>
      ) : (
        <>
          {panelBlock}
          {tabListBlock}
        </>
      )}
    </div>
  );
}
