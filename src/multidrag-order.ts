export interface MultiDragCommitPhases {
    setSuspended: (value: boolean) => void;
    syncMovedCards?: () => Promise<void> | void;
    playInsertion?: () => Promise<void> | void;
    rewriteTargetOrder?: () => Promise<void> | void;
    rewriteSourceOrder?: () => Promise<void> | void;
    persistSettings?: () => Promise<void> | void;
}

export type MultiDragPhase = 'extracting' | 'dragging' | 'inserting';

export interface RectSnapshot {
    left: number;
    top: number;
    width: number;
    height: number;
}

export interface MultiDragInsertionTimingProfile {
    durationMs: number;
    startDelayMs: number;
    slotDurationMs: number;
    previewShrinkThreshold: number;
}

export interface MultiDragInsertionDistanceProfile {
    stackOffsetX: number;
    stackOffsetY: number;
    startScale: number;
    pathDistance: number;
    distanceRatio: number;
    settleLift: number;
}

export interface MultiDragInsertionFrameState {
    movingTargetRect: RectSnapshot;
    travelProgress: number;
    easedProgress: number;
    hasClearedStack: boolean;
    currentRect: RectSnapshot;
    currentScale: number;
    lift: number;
    landingGap: number;
}

export const MAX_MULTIDRAG_VISIBLE_LAYERS = 5;

export const MULTIDRAG_EXTRACTION_STEP_MS = 140;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const interpolateNumber = (from: number, to: number, progress: number): number => from + (to - from) * progress;

const measureRectCenterDistance = (startRect: RectSnapshot, endRect: RectSnapshot): number => {
    const startCenterX = startRect.left + startRect.width / 2;
    const startCenterY = startRect.top + startRect.height / 2;
    const endCenterX = endRect.left + endRect.width / 2;
    const endCenterY = endRect.top + endRect.height / 2;
    return Math.hypot(endCenterX - startCenterX, endCenterY - startCenterY);
};

const getRectGap = (a: RectSnapshot, b: RectSnapshot): number => {
    const ax = a.left + a.width / 2;
    const ay = a.top + a.height / 2;
    const bx = b.left + b.width / 2;
    const by = b.top + b.height / 2;
    return Math.hypot(bx - ax, by - ay);
};

export const getMultiDragPreviewIds = (orderedIds: string[]): string[] => {
    if (orderedIds.length <= MAX_MULTIDRAG_VISIBLE_LAYERS) return [...orderedIds];
    return orderedIds.slice(-MAX_MULTIDRAG_VISIBLE_LAYERS);
};

export const getMultiDragAnchoredPreviewIds = (orderedIds: string[], draggedId: string): string[] => {
    if (!draggedId || !orderedIds.includes(draggedId)) return getMultiDragPreviewIds(orderedIds);
    const trailingIds = orderedIds.filter((id) => id !== draggedId);
    const visibleTrailingIds = trailingIds.slice(-(MAX_MULTIDRAG_VISIBLE_LAYERS - 1));
    return [...visibleTrailingIds, draggedId];
};

export const getMultiDragExtractionPreviewIds = (orderedIds: string[], revealedCount: number, draggedId?: string): string[] => {
    if (!draggedId) {
        if (revealedCount <= 0) return [];
        return getMultiDragPreviewIds(orderedIds.slice(0, revealedCount));
    }
    const trailingIds = orderedIds.filter((id) => id !== draggedId);
    if (revealedCount <= 0) return [draggedId];
    return getMultiDragAnchoredPreviewIds(trailingIds.slice(0, revealedCount).concat(draggedId), draggedId);
};

export const getMultiDragVisibleDepth = (visibleCount: number, index: number): number => {
    return Math.max(0, Math.min(MAX_MULTIDRAG_VISIBLE_LAYERS - 1, visibleCount - 1 - index));
};

export const getMultiDragLayerMotionProfile = (visibleCount: number, index: number) => {
    const depth = getMultiDragVisibleDepth(visibleCount, index);
    return {
        depth,
        offsetY: depth * 16,
        scale: 1 - depth * 0.03,
        opacity: Math.max(0.18, 1 - depth * 0.17),
    };
};

export const getMultiDragExtractionLayerMotionProfile = (visibleCount: number, index: number) => {
    const depth = getMultiDragVisibleDepth(visibleCount, index);
    return {
        depth,
        offsetY: depth * 8,
        scale: 1 - depth * 0.015,
        opacity: 1,
    };
};

export const getMultiDragFlightDurationMs = (visibleCount: number, index: number): number => {
    const depth = getMultiDragVisibleDepth(visibleCount, index);
    return 360 + depth * 80;
};

export const getMultiDragPhaseVisibility = (phase: MultiDragPhase) => {
    if (phase === 'extracting') {
        return {
            fallbackVisible: true,
            sourceCardsHidden: false,
            slotCardsDimmed: false,
        };
    }
    if (phase === 'inserting') {
        return {
            fallbackVisible: true,
            sourceCardsHidden: true,
            slotCardsDimmed: true,
        };
    }
    return {
        fallbackVisible: true,
        sourceCardsHidden: true,
        slotCardsDimmed: false,
    };
};

export const sanitizeMultiDragCloneClassNames = (classNames: string[]): string[] => {
    const transientClassNames = new Set([
        'is-selected',
        'is-multidrag-source',
        'is-multidrag-slot',
        'is-multidrag-slot-preview',
        'kanban-card-ghost',
        'kanban-card-chosen-custom',
        'kanban-card-drag-custom',
    ]);
    return classNames.filter((className) => !transientClassNames.has(className));
};

export const getMultiDragInsertionTimingProfile = (visibleCount: number): MultiDragInsertionTimingProfile => {
    const batchDepth = Math.max(1, Math.min(MAX_MULTIDRAG_VISIBLE_LAYERS, visibleCount));
    const durationMs = 360 + (batchDepth - 1) * 20;
    const startDelayMs = 80;
    const slotDurationMs = Math.max(0, durationMs - startDelayMs);
    const previewShrinkThreshold = Math.max(startDelayMs, durationMs - 140);

    return {
        durationMs,
        startDelayMs,
        slotDurationMs,
        previewShrinkThreshold,
    };
};

export interface GetMultiDragInsertionDistanceProfileArgs {
    startRect: RectSnapshot;
    slotFinalRect: RectSnapshot;
    visibleCount: number;
    index: number;
    maxPathDistance: number;
}

export const getMultiDragInsertionDistanceProfile = ({
    startRect,
    slotFinalRect,
    visibleCount,
    index,
    maxPathDistance,
}: GetMultiDragInsertionDistanceProfileArgs): MultiDragInsertionDistanceProfile => {
    const depth = getMultiDragVisibleDepth(visibleCount, index);
    const pathDistance = measureRectCenterDistance(startRect, slotFinalRect);
    const distanceRatio = maxPathDistance > 0 ? clamp01(pathDistance / maxPathDistance) : 1;

    return {
        stackOffsetX: depth * 6,
        stackOffsetY: depth * 4,
        startScale: 1 - depth * 0.02,
        pathDistance,
        distanceRatio,
        settleLift: depth * 4,
    };
};

export const mapMultiDragInsertionTravelProgress = (progress: number, distanceRatio: number): number => {
    const normalizedProgress = clamp01(progress);
    const normalizedRatio = clamp01(distanceRatio);
    return clamp01(normalizedProgress + normalizedRatio * normalizedProgress * (1 - normalizedProgress) * 0.5);
};

export interface GetMultiDragInsertionFrameStateArgs {
    startRect: RectSnapshot;
    slotStartRect: RectSnapshot;
    slotFinalRect: RectSnapshot;
    elapsed: number;
    timingProfile: MultiDragInsertionTimingProfile;
    distanceProfile: MultiDragInsertionDistanceProfile;
}

export const getMultiDragInsertionFrameState = ({
    startRect,
    slotStartRect,
    slotFinalRect,
    elapsed,
    timingProfile,
    distanceProfile,
}: GetMultiDragInsertionFrameStateArgs): MultiDragInsertionFrameState => {
    const durationMs = Math.max(1, timingProfile.durationMs);
    const timeProgress = clamp01(elapsed / durationMs);
    const travelProgress = mapMultiDragInsertionTravelProgress(timeProgress, distanceProfile.distanceRatio);
    const easedProgress = 1 - Math.pow(1 - travelProgress, 4);

    const currentRect: RectSnapshot = {
        left: interpolateNumber(startRect.left, slotFinalRect.left, easedProgress),
        top: interpolateNumber(startRect.top, slotFinalRect.top, easedProgress),
        width: interpolateNumber(startRect.width, slotFinalRect.width, easedProgress),
        height: interpolateNumber(startRect.height, slotFinalRect.height, easedProgress),
    };

    const landingGap = getRectGap(currentRect, slotFinalRect);
    const hasClearedStack = elapsed >= timingProfile.startDelayMs && getRectGap(currentRect, slotStartRect) <= Math.max(8, distanceProfile.settleLift * 2);

    return {
        movingTargetRect: slotFinalRect,
        travelProgress,
        easedProgress,
        hasClearedStack,
        currentRect,
        currentScale: interpolateNumber(distanceProfile.startScale, 1, easedProgress),
        lift: distanceProfile.settleLift * (1 - easedProgress),
        landingGap,
    };
};

export const shouldShrinkMultiDragInsertionPreview = (
    elapsed: number,
    durationMs: number,
    previewShrinkThreshold: number,
    frameState?: Pick<MultiDragInsertionFrameState, 'hasClearedStack' | 'landingGap' | 'lift'>,
): boolean => {
    if (!frameState?.hasClearedStack) return false;
    if (elapsed < previewShrinkThreshold) return false;
    return frameState.landingGap <= Math.max(6, frameState.lift);
};

export const applyMultiDragFinalOrderToIds = (
    currentIds: string[],
    orderedIds: string[],
    draggedId: string,
): string[] => {
    const activeIdSet = new Set(orderedIds);
    const rawIndex = currentIds.indexOf(draggedId);
    const baseCards = currentIds.filter((id) => !activeIdSet.has(id));

    if (rawIndex === -1) {
        return [...baseCards, ...orderedIds];
    }

    const selectedBeforeDragged = currentIds
        .slice(0, rawIndex)
        .filter((id) => activeIdSet.has(id)).length;
    const insertIndex = Math.max(0, Math.min(rawIndex - selectedBeforeDragged, baseCards.length));
    const finalIds = [...baseCards];
    finalIds.splice(insertIndex, 0, ...orderedIds);
    return finalIds;
};

export const runMultiDragCommitPhases = async ({
    setSuspended,
    syncMovedCards,
    playInsertion,
    rewriteTargetOrder,
    rewriteSourceOrder,
    persistSettings,
}: MultiDragCommitPhases): Promise<void> => {
    setSuspended(true);
    try {
        await syncMovedCards?.();
        await playInsertion?.();
        await rewriteTargetOrder?.();
        await rewriteSourceOrder?.();
        await persistSettings?.();
    } finally {
        setSuspended(false);
    }
};
