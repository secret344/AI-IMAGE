/**
 * 可缩放图片预览
 * 职责：展示图片预览并支持拖拽缩放，写入图片属性缓存
 * 特点：按 imageHash 读取/保存缩放属性
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@ui/card';
import { Button } from '@ui/button';
import { getImageAttributes, saveImageAttributes } from '@/modules/storage/imageAttributes';

const MIN_SCALE = 0.25;
const MAX_SCALE = 3;
const SCALE_STEP = 200;
const WHEEL_STEP = 0.0015;
const EDGE_HIT_SIZE = 12;

export interface ResizableImagePreviewProps {
  /** 图片 base64 数据 */
  src: string;
  /** 图片显示文案 */
  alt: string;
  /** 图片哈希用于持久化 */
  imageHash: string | null;
}

/**
 * Resizable image preview component
 * @param {ResizableImagePreviewProps} props - Component properties
 * @return {JSX.Element} Image preview element
 */
export function ResizableImagePreview({ src, alt, imageHash }: ResizableImagePreviewProps) {
  const { t } = useTranslation();
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [isEdgeHover, setIsEdgeHover] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const stateRef = useRef({ scale: 1, offset: { x: 0, y: 0 } });
  const isEdgeHoverRef = useRef(false);
  const gestureRef = useRef<{
    mode: 'none' | 'pan' | 'scale';
    pointerId: number | null;
    startX: number;
    startY: number;
    startScale: number;
    startOffset: { x: number; y: number };
  }>({
    mode: 'none',
    pointerId: null,
    startX: 0,
    startY: 0,
    startScale: 1,
    startOffset: { x: 0, y: 0 }
  });
  const pinchRef = useRef<{
    active: boolean;
    startDistance: number;
    startScale: number;
    startOffset: { x: number; y: number };
    centerX: number;
    centerY: number;
  }>({
    active: false,
    startDistance: 0,
    startScale: 1,
    startOffset: { x: 0, y: 0 },
    centerX: 0,
    centerY: 0
  });
  const persistTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingViewRef = useRef<{ scale: number; offset: { x: number; y: number } } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const clampedScale = useMemo(() => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale)), [scale]);

  // 同步 stateRef
  useEffect(() => {
    stateRef.current = { scale: clampedScale, offset };
  }, [clampedScale, offset]);

  const getPanBounds = useCallback(
    (nextScale: number) => {
      if (
        !containerSize.width ||
        !containerSize.height ||
        !naturalSize.width ||
        !naturalSize.height
      ) {
        return { maxX: 0, maxY: 0 };
      }

      const naturalAspect = naturalSize.width / naturalSize.height;
      const containerAspect = containerSize.width / containerSize.height;
      const fittedWidth =
        naturalAspect > containerAspect
          ? containerSize.width
          : containerSize.height * naturalAspect;
      const fittedHeight =
        naturalAspect > containerAspect
          ? containerSize.width / naturalAspect
          : containerSize.height;

      const scaledWidth = fittedWidth * nextScale;
      const scaledHeight = fittedHeight * nextScale;

      return {
        maxX: Math.abs(scaledWidth - containerSize.width) / 2,
        maxY: Math.abs(scaledHeight - containerSize.height) / 2
      };
    },
    [containerSize, naturalSize]
  );

  const clampOffset = useCallback(
    (nextScale: number, nextOffset: { x: number; y: number }) => {
      const { maxX, maxY } = getPanBounds(nextScale);
      return {
        x: Math.min(maxX, Math.max(-maxX, nextOffset.x)),
        y: Math.min(maxY, Math.max(-maxY, nextOffset.y))
      };
    },
    [getPanBounds]
  );

  const applyView = useCallback(
    (nextScale: number, nextOffset: { x: number; y: number }) => {
      const clampedNextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
      const clampedNextOffset = clampOffset(clampedNextScale, nextOffset);
      stateRef.current = { scale: clampedNextScale, offset: clampedNextOffset };
      setScale(clampedNextScale);
      setOffset(clampedNextOffset);
      return { scale: clampedNextScale, offset: clampedNextOffset };
    },
    [clampOffset]
  );

  const queueView = useCallback(
    (nextScale: number, nextOffset: { x: number; y: number }) => {
      pendingViewRef.current = { scale: nextScale, offset: nextOffset };
      if (rafRef.current) {
        return;
      }
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        const pending = pendingViewRef.current;
        if (!pending) {
          return;
        }
        pendingViewRef.current = null;
        applyView(pending.scale, pending.offset);
      });
    },
    [applyView]
  );

  const persistAttributes = useCallback(
    async (nextScale: number, nextOffset: { x: number; y: number }) => {
      if (!imageHash) {
        return;
      }
      await saveImageAttributes({
        imageHash,
        scale: nextScale,
        offsetX: nextOffset.x,
        offsetY: nextOffset.y,
        rotation: 0
      });
    },
    [imageHash]
  );

  const schedulePersist = useCallback(
    (nextScale: number, nextOffset: { x: number; y: number }) => {
      const clampedOffset = clampOffset(nextScale, nextOffset);
      if (persistTimerRef.current) {
        window.clearTimeout(persistTimerRef.current);
      }
      persistTimerRef.current = window.setTimeout(() => {
        void persistAttributes(nextScale, clampedOffset);
      }, 300);
    },
    [clampOffset, persistAttributes]
  );

  const beginScaleGesture = useCallback((pointerId: number, clientX: number, clientY: number) => {
    gestureRef.current = {
      mode: 'scale',
      pointerId,
      startX: clientX,
      startY: clientY,
      startScale: stateRef.current.scale,
      startOffset: stateRef.current.offset
    };
    setIsPanning(false);
  }, []);

  const beginPanGesture = useCallback((pointerId: number, clientX: number, clientY: number) => {
    gestureRef.current = {
      mode: 'pan',
      pointerId,
      startX: clientX,
      startY: clientY,
      startScale: stateRef.current.scale,
      startOffset: stateRef.current.offset
    };
    setIsPanning(true);
  }, []);

  const clearGesture = useCallback(() => {
    gestureRef.current = {
      mode: 'none',
      pointerId: null,
      startX: 0,
      startY: 0,
      startScale: stateRef.current.scale,
      startOffset: stateRef.current.offset
    };
    setIsPanning(false);
  }, []);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      beginScaleGesture(event.pointerId, event.clientX, event.clientY);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [beginScaleGesture]
  );

  const handlePanStart = useCallback(
    (event: React.PointerEvent<HTMLImageElement>) => {
      event.preventDefault();
      const bounds = imageRef.current?.getBoundingClientRect();
      if (bounds && isEdgeHit(event.clientX, event.clientY, bounds)) {
        beginScaleGesture(event.pointerId, event.clientX, event.clientY);
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
      beginPanGesture(event.pointerId, event.clientX, event.clientY);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [beginPanGesture, beginScaleGesture]
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (pinchRef.current.active) {
        return;
      }
      const gesture = gestureRef.current;
      if (gesture.mode === 'none' || gesture.pointerId !== event.pointerId) {
        return;
      }

      if (gesture.mode === 'scale') {
        const dx = event.clientX - gesture.startX;
        const dy = event.clientY - gesture.startY;
        const delta = (dx + dy) / SCALE_STEP;
        const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, gesture.startScale + delta));
        const nextOffset = clampOffset(nextScale, gesture.startOffset);
        queueView(nextScale, nextOffset);
        return;
      }

      const dx = event.clientX - gesture.startX;
      const dy = event.clientY - gesture.startY;
      const nextOffset = clampOffset(gesture.startScale, {
        x: gesture.startOffset.x + dx,
        y: gesture.startOffset.y + dy
      });
      queueView(gesture.startScale, nextOffset);
    },
    [clampOffset, queueView]
  );

  const handlePointerUp = useCallback(
    async (event: PointerEvent) => {
      if (gestureRef.current.mode === 'none') {
        return;
      }
      if (
        gestureRef.current.pointerId !== null &&
        gestureRef.current.pointerId !== event.pointerId
      ) {
        return;
      }
      clearGesture();
      await persistAttributes(
        stateRef.current.scale,
        clampOffset(stateRef.current.scale, stateRef.current.offset)
      );
    },
    [clampOffset, clearGesture, persistAttributes]
  );

  const handleContainerPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      handlePointerMove(event.nativeEvent);
    },
    [handlePointerMove]
  );

  const handleContainerPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      void handlePointerUp(event.nativeEvent);
    },
    [handlePointerUp]
  );

  const handleReset = useCallback(async () => {
    applyView(1, { x: 0, y: 0 });
    await persistAttributes(1, { x: 0, y: 0 });
  }, [applyView, persistAttributes]);

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const bounds = containerRef.current?.getBoundingClientRect();
      const baseScale = stateRef.current.scale;
      const rawScale = baseScale - event.deltaY * WHEEL_STEP;
      const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, rawScale));
      if (bounds) {
        const cursorX = event.clientX - bounds.left - bounds.width / 2;
        const cursorY = event.clientY - bounds.top - bounds.height / 2;
        const ratio = nextScale / baseScale;
        const nextOffset = clampOffset(nextScale, {
          x: stateRef.current.offset.x - cursorX * (ratio - 1),
          y: stateRef.current.offset.y - cursorY * (ratio - 1)
        });
        queueView(nextScale, nextOffset);
        schedulePersist(nextScale, nextOffset);
        return;
      }
      queueView(nextScale, stateRef.current.offset);
      schedulePersist(nextScale, stateRef.current.offset);
    },
    [clampOffset, queueView, schedulePersist]
  );

  const handleTouchStart = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (event.touches.length === 2) {
        event.preventDefault();
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        const dist = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
        const bounds = containerRef.current?.getBoundingClientRect();
        pinchRef.current = {
          active: true,
          startDistance: dist,
          startScale: stateRef.current.scale,
          startOffset: stateRef.current.offset,
          centerX: bounds
            ? (touch1.clientX + touch2.clientX) / 2 - bounds.left - bounds.width / 2
            : 0,
          centerY: bounds
            ? (touch1.clientY + touch2.clientY) / 2 - bounds.top - bounds.height / 2
            : 0
        };
        clearGesture();
      }
    },
    [clearGesture]
  );

  const handleTouchMove = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (event.touches.length === 2 && pinchRef.current.active) {
        event.preventDefault();
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        const currentDist = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
        if (pinchRef.current.startDistance <= 0) {
          return;
        }

        const ratio = currentDist / pinchRef.current.startDistance;
        const nextScale = Math.min(
          MAX_SCALE,
          Math.max(MIN_SCALE, pinchRef.current.startScale * ratio)
        );
        const scaleRatio = nextScale / pinchRef.current.startScale;
        const nextOffset = clampOffset(nextScale, {
          x: pinchRef.current.startOffset.x - pinchRef.current.centerX * (scaleRatio - 1),
          y: pinchRef.current.startOffset.y - pinchRef.current.centerY * (scaleRatio - 1)
        });
        queueView(nextScale, nextOffset);
        schedulePersist(nextScale, nextOffset);
      }
    },
    [clampOffset, queueView, schedulePersist]
  );

  const handleTouchEnd = useCallback(() => {
    pinchRef.current.active = false;
    schedulePersist(stateRef.current.scale, stateRef.current.offset);
  }, [schedulePersist]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const isModifier = event.metaKey || event.ctrlKey;
      if (!isModifier) {
        return;
      }
      if (event.key === '0') {
        event.preventDefault();
        void handleReset();
        return;
      }
      if (event.key === '=' || event.key === '+') {
        event.preventDefault();
        const nextScale = Math.min(MAX_SCALE, stateRef.current.scale + 0.1);
        const nextOffset = clampOffset(nextScale, stateRef.current.offset);
        applyView(nextScale, nextOffset);
        schedulePersist(nextScale, nextOffset);
        return;
      }
      if (event.key === '-') {
        event.preventDefault();
        const nextScale = Math.max(MIN_SCALE, stateRef.current.scale - 0.1);
        const nextOffset = clampOffset(nextScale, stateRef.current.offset);
        applyView(nextScale, nextOffset);
        schedulePersist(nextScale, nextOffset);
      }
    },
    [applyView, clampOffset, handleReset, schedulePersist]
  );

  useEffect(() => {
    if (!imageHash) {
      applyView(1, { x: 0, y: 0 });
      return;
    }
    let isMounted = true;
    void (async () => {
      const record = await getImageAttributes(imageHash);
      if (isMounted && record) {
        const nextScale = record.scale || 1;
        const nextOffset = clampOffset(nextScale, { x: record.offsetX, y: record.offsetY });
        applyView(nextScale, nextOffset);
      }
    })();
    return () => {
      isMounted = false;
      if (persistTimerRef.current) {
        window.clearTimeout(persistTimerRef.current);
      }
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, [applyView, clampOffset, imageHash]);

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setOffset((current) => clampOffset(clampedScale, current));
  }, [clampedScale, clampOffset, containerSize, naturalSize]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <Card className="border-border/60 bg-card/40 w-full min-h-72 sm:min-h-96 flex flex-col">
      <CardContent
        className="flex-1 p-2 flex items-center justify-center relative overflow-hidden"
        onWheel={handleWheel}
        onWheelCapture={(event) => event.stopPropagation()}
        onPointerMove={handleContainerPointerMove}
        onPointerUp={handleContainerPointerUp}
        onPointerCancel={handleContainerPointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: 'none' }}
        ref={containerRef}
      >
        <img
          src={src}
          alt={alt}
          className={`max-w-full max-h-full h-full w-full rounded-md border border-border/50 object-contain ${
            isEdgeHover ? 'ring-2 ring-primary/60 cursor-nwse-resize' : ''
          } ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${clampedScale})`,
            transformOrigin: 'center'
          }}
          onPointerDown={handlePanStart}
          onPointerMove={(event) => {
            const bounds = imageRef.current?.getBoundingClientRect();
            if (!bounds) {
              return;
            }
            const nextEdgeHover = isEdgeHit(event.clientX, event.clientY, bounds);
            if (nextEdgeHover !== isEdgeHoverRef.current) {
              isEdgeHoverRef.current = nextEdgeHover;
              setIsEdgeHover(nextEdgeHover);
            }
          }}
          onPointerLeave={() => {
            setIsEdgeHover(false);
            isEdgeHoverRef.current = false;
          }}
          onLoad={(event) => {
            const target = event.currentTarget;
            setNaturalSize({ width: target.naturalWidth, height: target.naturalHeight });
            imageRef.current = target;
          }}
          ref={imageRef}
        />
      </CardContent>
      <div className="px-2 pb-2 flex gap-2 justify-end">
        <Button size="sm" variant="outline" onClick={handleReset} disabled={clampedScale === 1}>
          {t('upload.resetPreview')}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onPointerDown={handlePointerDown}
          aria-label={t('upload.resizePreview')}
        >
          {t('upload.resizePreview')}
        </Button>
      </div>
    </Card>
  );
}

function isEdgeHit(x: number, y: number, rect: DOMRect): boolean {
  const withinX = x >= rect.left && x <= rect.right;
  const withinY = y >= rect.top && y <= rect.bottom;
  if (!withinX || !withinY) {
    return false;
  }
  const nearLeft = x - rect.left <= EDGE_HIT_SIZE;
  const nearRight = rect.right - x <= EDGE_HIT_SIZE;
  const nearTop = y - rect.top <= EDGE_HIT_SIZE;
  const nearBottom = rect.bottom - y <= EDGE_HIT_SIZE;
  return nearLeft || nearRight || nearTop || nearBottom;
}
