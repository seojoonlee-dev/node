import { useRef, useCallback } from 'react';

type TouchHandler = (e: React.TouchEvent) => void;
type LongPressHandlers = Record<string, TouchHandler>;

// Builds touch handlers that fire `onLongPress` after a press-and-hold.
// Touch events only fire from touch input, so this lives alongside the
// existing onContextMenu (mouse right-click) without conflicting.
//
// Pass `capture: true` when an ancestor swallows touch events during the
// bubble phase (e.g. ReactFlow/d3-drag calls stopImmediatePropagation on
// node touchstart) — capture-phase handlers run before that happens.
export function useLongPress(ms = 500) {
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number, y: number } | null>(null);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  return useCallback((onLongPress: (x: number, y: number) => void, capture = false): LongPressHandlers => {
    const onStart: TouchHandler = (e) => {
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY };
      timer.current = window.setTimeout(() => {
        onLongPress(start.current!.x, start.current!.y);
        timer.current = null;
      }, ms);
    };
    // cancel if the finger moves (i.e. the user is scrolling/panning/dragging)
    const onMove: TouchHandler = (e) => {
      if (!start.current) return;
      const t = e.touches[0];
      if (Math.hypot(t.clientX - start.current.x, t.clientY - start.current.y) > 10) {
        clear();
      }
    };

    const suffix = capture ? 'Capture' : '';
    return {
      [`onTouchStart${suffix}`]: onStart,
      [`onTouchMove${suffix}`]: onMove,
      [`onTouchEnd${suffix}`]: clear,
      [`onTouchCancel${suffix}`]: clear,
    };
  }, [ms, clear]);
}
