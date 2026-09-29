import React, { useEffect, useRef } from "react";
import { Clock } from "lucide-react";

interface ExamTimerProps {
  remainingSeconds: number;
  isActive: boolean;
  onTick: () => void;
  onExpire?: () => void;
  className?: string;
}

export function ExamTimer({ remainingSeconds, isActive, onTick, onExpire, className = "" }: ExamTimerProps) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTickRef = useRef(onTick);
  const onExpireRef = useRef(onExpire);
  const remainingRef = useRef(remainingSeconds);

  onTickRef.current = onTick;
  onExpireRef.current = onExpire;
  remainingRef.current = remainingSeconds;

  useEffect(() => {
    if (!isActive) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      if (remainingRef.current <= 1) {
        clearInterval(intervalRef.current!);
        onTickRef.current();
        onExpireRef.current?.();
      } else {
        onTickRef.current();
      }
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isActive]);

  const h = Math.floor(remainingSeconds / 3600);
  const m = Math.floor((remainingSeconds % 3600) / 60);
  const s = remainingSeconds % 60;
  const isLow = remainingSeconds <= 300; // 5 min warning
  const isCritical = remainingSeconds <= 60;

  const fmt = (n: number) => String(n).padStart(2, "0");
  const display = h > 0 ? `${fmt(h)}:${fmt(m)}:${fmt(s)}` : `${fmt(m)}:${fmt(s)}`;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${isCritical ? "border-red-400 bg-red-50 dark:bg-red-950/30 animate-pulse" : isLow ? "border-amber-400 bg-amber-50 dark:bg-amber-950/30" : "border-border bg-background"} ${className}`}>
      <Clock className={`w-4 h-4 ${isCritical ? "text-red-500" : isLow ? "text-amber-500" : "text-muted-foreground"}`} />
      <span className={`font-mono text-sm font-semibold tabular-nums ${isCritical ? "text-red-600" : isLow ? "text-amber-600" : "text-foreground"}`}>
        {display}
      </span>
    </div>
  );
}
