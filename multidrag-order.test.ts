import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as multiDragOrder from './src/multidrag-order.ts';

const {
  applyMultiDragFinalOrderToIds,
  getMultiDragAnchoredPreviewIds,
  getMultiDragPreviewIds,
  getMultiDragExtractionPreviewIds,
  getMultiDragVisibleDepth,
  getMultiDragLayerMotionProfile,
  getMultiDragExtractionLayerMotionProfile,
  getMultiDragFlightDurationMs,
  getMultiDragPhaseVisibility,
  sanitizeMultiDragCloneClassNames,
  runMultiDragCommitPhases,
} = multiDragOrder;

test('runtime multidrag flow does not emit debug notices or console logs during drag lifecycle', () => {
  const mainTs = readFileSync(new URL('./src/main.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(mainTs, /private reportMultiDragGate\(/);
  assert.doesNotMatch(mainTs, /private reportMultiDragVisual\(/);
  assert.doesNotMatch(mainTs, /new Notice\(`\[BKV /);
  assert.doesNotMatch(mainTs, /console\.log\('\[bases-kanban-view\] multi-drag/);
});


test('same-column leading selection keeps its original anchor when dragged card is not batch head', () => {
  const finalIds = applyMultiDragFinalOrderToIds(['A', 'B', 'X', 'C', 'D'], ['A', 'B'], 'B');
  assert.deepEqual(finalIds, ['A', 'B', 'X', 'C', 'D']);
});

test('same-column move inserts the full batch using dragged position among non-selected cards', () => {
  const finalIds = applyMultiDragFinalOrderToIds(['A', 'X', 'B', 'C', 'D'], ['A', 'B'], 'B');
  assert.deepEqual(finalIds, ['X', 'A', 'B', 'C', 'D']);
});

test('cross-column move inserts the ordered batch at the drop position', () => {
  const finalIds = applyMultiDragFinalOrderToIds(['X', 'B', 'C', 'D'], ['A', 'B'], 'B');
  assert.deepEqual(finalIds, ['X', 'A', 'B', 'C', 'D']);
});

test('preview keeps batch order when dragged card is in the middle', () => {
  assert.deepEqual(getMultiDragPreviewIds(['A', 'B', 'C']), ['A', 'B', 'C']);
});

test('preview keeps batch order when dragged card is the first card', () => {
  assert.deepEqual(getMultiDragPreviewIds(['A', 'B']), ['A', 'B']);
});

test('extraction preview grows one visible layer at a time before capping at five cards', () => {
  assert.equal(typeof getMultiDragExtractionPreviewIds, 'function');
  assert.deepEqual(getMultiDragExtractionPreviewIds(['A', 'B', 'C', 'D', 'E', 'F'], 1), ['A']);
  assert.deepEqual(getMultiDragExtractionPreviewIds(['A', 'B', 'C', 'D', 'E', 'F'], 3), ['A', 'B', 'C']);
  assert.deepEqual(getMultiDragExtractionPreviewIds(['A', 'B', 'C', 'D', 'E', 'F'], 6), ['B', 'C', 'D', 'E', 'F']);
});

test('anchored preview keeps the dragged card on top while preserving visible trailing cards behind it', () => {
  assert.equal(typeof getMultiDragAnchoredPreviewIds, 'function');
  assert.deepEqual(getMultiDragAnchoredPreviewIds(['A', 'B', 'C'], 'B'), ['A', 'C', 'B']);
  assert.deepEqual(getMultiDragAnchoredPreviewIds(['A', 'B', 'C', 'D', 'E', 'F'], 'B'), ['C', 'D', 'E', 'F', 'B']);
});

test('anchored extraction preview keeps the dragged card visible from the start and reveals other cards behind it', () => {
  assert.equal(typeof getMultiDragExtractionPreviewIds, 'function');
  assert.deepEqual(getMultiDragExtractionPreviewIds(['A', 'B', 'C', 'D'], 0, 'B'), ['B']);
  assert.deepEqual(getMultiDragExtractionPreviewIds(['A', 'B', 'C', 'D'], 1, 'B'), ['A', 'B']);
  assert.deepEqual(getMultiDragExtractionPreviewIds(['A', 'B', 'C', 'D', 'E', 'F'], 5, 'B'), ['C', 'D', 'E', 'F', 'B']);
});

test('visible depth caps at five layers and fades deeper cards progressively', () => {
  assert.equal(getMultiDragVisibleDepth(5, 0), 4);
  assert.equal(getMultiDragVisibleDepth(5, 1), 3);
  assert.equal(getMultiDragVisibleDepth(5, 2), 2);
  assert.equal(getMultiDragVisibleDepth(5, 3), 1);
  assert.equal(getMultiDragVisibleDepth(5, 4), 0);
  assert.equal(getMultiDragVisibleDepth(10, 0), 4);
  assert.equal(getMultiDragVisibleDepth(10, 9), 0);
});

test('layer motion profile reuses five visible layers for insertion and extraction', () => {
  const back = getMultiDragLayerMotionProfile(7, 0);
  const mid = getMultiDragLayerMotionProfile(7, 3);
  const front = getMultiDragLayerMotionProfile(7, 6);
  const extractionBack = getMultiDragExtractionLayerMotionProfile(7, 0);
  const extractionMid = getMultiDragExtractionLayerMotionProfile(7, 3);
  const extractionFront = getMultiDragExtractionLayerMotionProfile(7, 6);

  assert.equal(back.depth, 4);
  assert.equal(back.offsetY, 64);
  assert.equal(back.scale, 0.88);
  assert.ok(Math.abs(back.opacity - 0.32) < 1e-9);

  assert.equal(mid.depth, 3);
  assert.equal(mid.offsetY, 48);
  assert.equal(mid.scale, 0.91);
  assert.ok(Math.abs(mid.opacity - 0.49) < 1e-9);

  assert.deepEqual(front, {
    depth: 0,
    offsetY: 0,
    scale: 1,
    opacity: 1,
  });

  assert.equal(extractionBack.depth, 4);
  assert.equal(extractionBack.offsetY, 32);
  assert.equal(extractionBack.scale, 0.94);
  assert.equal(extractionBack.opacity, 1);

  assert.equal(extractionMid.depth, 3);
  assert.equal(extractionMid.offsetY, 24);
  assert.equal(extractionMid.scale, 0.955);
  assert.equal(extractionMid.opacity, 1);

  assert.deepEqual(extractionFront, {
    depth: 0,
    offsetY: 0,
    scale: 1,
    opacity: 1,
  });
});

test('flight duration stays long enough to read depth while still getting shorter near the pointer stack front', () => {
  assert.equal(typeof getMultiDragFlightDurationMs, 'function');
  assert.equal(getMultiDragFlightDurationMs(5, 0), 680);
  assert.equal(getMultiDragFlightDurationMs(5, 2), 520);
  assert.equal(getMultiDragFlightDurationMs(5, 4), 360);
});


test('runtime updates multidrag preview layers in place instead of rebuilding the whole fallback stack on every state change', () => {
  const mainTs = readFileSync(new URL('./src/main.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(mainTs, /fallback\.innerHTML = '';/);
  assert.doesNotMatch(mainTs, /stackIds\.forEach\(\(id, index\) => \{[\s\S]*?const clone = \(sourceEl \|\| item\)\.cloneNode\(true\) as HTMLElement;[\s\S]*?fallback\.appendChild\(layer\);[\s\S]*?\}\);/);
  assert.match(mainTs, /const existingLayers = Array\.from\(fallback\.querySelectorAll\(':scope > \.kanban-multidrag-stack-card'\)\) as HTMLElement\[\];/);
  assert.match(mainTs, /const existingLayerMap = new Map\(existingLayers\.map\(\(layer\) => \[layer\.dataset\.previewId \|\| '', layer\]\)\);/);
  assert.match(mainTs, /const nextIdSet = new Set\(stackIds\);/);
  assert.match(mainTs, /existingLayers\.forEach\(\(layer\) => \{[\s\S]*?if \(!nextIdSet\.has\(layer\.dataset\.previewId \|\| ''\)\) layer\.remove\(\);[\s\S]*?\}\);/);
  assert.match(mainTs, /let layer = existingLayerMap\.get\(id\);/);
  assert.match(mainTs, /if \(!layer\) \{[\s\S]*?layer = document\.createElement\('div'\);[\s\S]*?const clone = \(sourceEl \|\| item\)\.cloneNode\(true\) as HTMLElement;/);
  assert.match(mainTs, /layer\.dataset\.previewId = id;/);
  assert.match(mainTs, /fallback\.insertBefore\(layer, badge\);/);
});


test('runtime snapshots a clean dragged preview source at drag start and reuses it for the top preview layer', () => {
  const mainTs = readFileSync(new URL('./src/main.ts', import.meta.url), 'utf8');
  assert.match(mainTs, /const draggedPreviewEl = item\.cloneNode\(true\) as HTMLElement;/);
  assert.match(mainTs, /draggedPreviewEl\.className = sanitizeMultiDragCloneClassNames\(Array\.from\(draggedPreviewEl\.classList\)\)\.join\(' '\);/);
  assert.match(mainTs, /this\._multiDragState = \{[\s\S]*?draggedPreviewEl,[\s\S]*?\};/);
  assert.match(mainTs, /const draggedPreviewEl = this\._multiDragState\?\.draggedPreviewEl \?\? null;/);
  assert.match(mainTs, /const sourceEl = id === draggedId\s*\? draggedPreviewEl \|\| draggedSourceEl \|\| item\s*:/);
});


test('extraction clones follow the live pointer stack every frame instead of easing toward stale targets', () => {
  const mainTs = readFileSync(new URL('./src/main.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(mainTs, /clone\.style\.transitionDuration = `\$\{duration\}ms`;[\s\S]*?const animateClone = \(\) => \{/);
  assert.match(mainTs, /const animateClone = \(elapsed: number\) => \{[\s\S]*?const progress = Math\.min\(1, elapsed \/ duration\);[\s\S]*?const liveTargetRect = this\.getMultiDragLiveTargetRect\(fallback\);[\s\S]*?clone\.style\.transitionDuration = '0ms';/);
  assert.match(mainTs, /const currentLeft = rect\.left \+ \(liveTargetRect\.left - rect\.left\) \* easedProgress;/);
  assert.match(mainTs, /const currentTop = rect\.top \+ \(liveTargetRect\.top - rect\.top\) \* easedProgress;/);
  assert.match(mainTs, /const currentScale = 1 \+ \(profile\.scale - 1\) \* easedProgress;/);
  assert.match(mainTs, /clone\.style\.transform = `translate\(\$\{currentLeft - rect\.left\}px, \$\{currentTop - rect\.top \+ profile\.offsetY \* easedProgress\}px\) scale\(\$\{currentScale\}\)`;/);
  assert.match(mainTs, /animateClone\(0\);[\s\S]*?let rafId = window\.requestAnimationFrame\(tick\);[\s\S]*?window\.cancelAnimationFrame\(rafId\);[\s\S]*?animateClone\(duration\);/);
});


test('runtime keeps stack and fly clones fully opaque instead of fading layers by profile opacity', () => {
  const mainTs = readFileSync(new URL('./src/main.ts', import.meta.url), 'utf8');
  assert.match(mainTs, /private createFlyClone\(sourceEl: HTMLElement, rect: RectSnapshot\) \{[\s\S]*?clone\.style\.opacity = '1';/);
  assert.match(mainTs, /const clone = \(sourceEl \|\| item\)\.cloneNode\(true\) as HTMLElement;[\s\S]*?clone\.style\.opacity = '1';[\s\S]*?layer\.appendChild\(clone\);/);
  assert.doesNotMatch(mainTs, /clone\.style\.opacity = `\$\{profile\.opacity\}`;/);
});


test('drag preview uses the real dragged card instead of cloning the transparent fallback shell for the top layer', () => {
  const mainTs = readFileSync(new URL('./src/main.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(mainTs, /const sourceEl = id === draggedId\s*\? item\s*:/);
  assert.match(mainTs, /const draggedSourceEl = this\.boardEl\.querySelector\(`\.kanban-card\[data-id="\$\{CSS\.escape\(draggedId\)\}"\]`\) as HTMLElement \| null;/);
  assert.match(mainTs, /const sourceEl = id === draggedId\s*\? draggedPreviewEl \|\| draggedSourceEl \|\| item\s*:/);
});


test('extraction clones chase the live fallback position instead of locking onto the first fallback snapshot', () => {
  const mainTs = readFileSync(new URL('./src/main.ts', import.meta.url), 'utf8');
  assert.match(mainTs, /const animateClone = \(elapsed: number\) => \{[\s\S]*?const liveTargetRect = this\.getMultiDragLiveTargetRect\(fallback\);/);
  assert.match(mainTs, /animateClone\(0\);[\s\S]*?let rafId = window\.requestAnimationFrame\(tick\);[\s\S]*?window\.cancelAnimationFrame\(rafId\);/);
});


test('runtime launches extraction and insertion clones together while varying their duration by layer depth', () => {
  const mainTs = readFileSync(new URL('./src/main.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(mainTs, /for \(const \{ sourceEl, rect, id, index \} of sources\) \{[\s\S]*?await this\.wait\(MULTIDRAG_EXTRACTION_STEP_MS\);/);
  assert.doesNotMatch(mainTs, /for \(let index = 0; index < orderedEls\.length; index \+= 1\) \{[\s\S]*?await this\.wait\(120\);/);
  assert.match(mainTs, /const animations = sources\.map\(\(\{ sourceEl, rect, id \}, index\) => \(async \(\) => \{/);
  assert.match(mainTs, /const duration = getMultiDragFlightDurationMs\(finalVisibleIds\.length, finalLayerIndex === -1 \? finalVisibleIds\.length - 1 : finalLayerIndex\);/);
  assert.match(mainTs, /await Promise\.all\(animations\);/);
  assert.match(mainTs, /const animations = orderedEls\.map\(\(leavingEl, index\) => \(async \(\) => \{/);
  assert.match(mainTs, /clone\.style\.transitionDuration = `\$\{(?:getMultiDragFlightDurationMs\(visibleIds\.length, layerIndex === -1 \? visibleIds\.length - 1 : layerIndex\)|duration)\}ms`;/);
});


test('multidrag stack layers render at their target depth immediately instead of animating from full-card layout', () => {
  const stylesCss = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
  const stackLayerRule = stylesCss.match(/\.kanban-multidrag-stack-card\s*\{([\s\S]*?)\}/)?.[1] ?? '';
  const normalizedStackLayerRule = stackLayerRule.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.notEqual(normalizedStackLayerRule.trim(), '');
  assert.doesNotMatch(normalizedStackLayerRule, /transition\s*:/);
  assert.match(stylesCss, /\.kanban-multidrag-stack-card\.is-layer-4\s*\{[\s\S]*?transform:\s*translateY\(32px\) scale\(0\.94\);/);
  assert.match(stylesCss, /\.kanban-multidrag-stack-card\.is-layer-1\s*\{[\s\S]*?transform:\s*translateY\(8px\) scale\(0\.985\);/);
});


test('stack preview cards stay fully opaque so the top layer completely covers the cards behind it', () => {
  const stylesCss = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
  const stackCardRule = stylesCss.match(/\.kanban-multidrag-stack-card\s*>\s*\.kanban-card\s*\{([\s\S]*?)\}/)?.[1] ?? '';
  const normalizedStackCardRule = stackCardRule.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.notEqual(normalizedStackCardRule.trim(), '');
  assert.match(normalizedStackCardRule, /opacity:\s*1\s*!important;/);
  assert.match(normalizedStackCardRule, /background:\s*var\(--background-primary\)\s*!important;/);
  assert.match(normalizedStackCardRule, /border:\s*1px solid var\(--background-modifier-border\)\s*!important;/);
  assert.match(stylesCss, /\.kanban-multidrag-stack-card\.is-layer-4\s*\{[\s\S]*?opacity:\s*1;/);
  assert.match(stylesCss, /\.kanban-multidrag-stack-card\.is-layer-1\s*\{[\s\S]*?opacity:\s*1;/);
});




test('runtime syncs multidrag fallback position directly from drag events instead of style observers', () => {
  const mainTs = readFileSync(new URL('./src/main.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(mainTs, /new MutationObserver\(/);
  assert.doesNotMatch(mainTs, /_transformObserver/);
  assert.match(mainTs, /private syncMultiDragFallbackPosition\(fallback: HTMLElement, clientX: number, clientY: number\) \{/);
  assert.match(mainTs, /this\.syncMultiDragFallbackPosition\(fallback, mouseX, mouseY\);/);
  assert.match(mainTs, /onMove: \(evt: any\) => \{[\s\S]*?const fallback = document\.querySelector\('\.kanban-card-fallback'\) as HTMLElement \| null;[\s\S]*?const moveEvent = evt\.originalEvent as MouseEvent \| undefined;[\s\S]*?if \(fallback && moveEvent\) this\.syncMultiDragFallbackPosition\(fallback, moveEvent\.clientX, moveEvent\.clientY\);[\s\S]*?return true;[\s\S]*?\},/);
});


test('extraction flights target final visible stack depths instead of temporary revealed depths', () => {
  const mainTs = readFileSync(new URL('./src/main.ts', import.meta.url), 'utf8');
  assert.match(mainTs, /const finalVisibleIds = getMultiDragAnchoredPreviewIds\(orderedIds, draggedId\);/);
  assert.match(mainTs, /const finalLayerIndex = finalVisibleIds\.indexOf\(id\);/);
  assert.match(mainTs, /const profile = getMultiDragExtractionLayerMotionProfile\(finalVisibleIds\.length, finalLayerIndex === -1 \? finalVisibleIds\.length - 1 : finalLayerIndex\);/);
  assert.match(mainTs, /const duration = getMultiDragFlightDurationMs\(finalVisibleIds\.length, finalLayerIndex === -1 \? finalVisibleIds\.length - 1 : finalLayerIndex\);/);
  assert.doesNotMatch(mainTs, /const profile = getMultiDragExtractionLayerMotionProfile\(nextVisibleIds\.length, layerIndex === -1 \? nextVisibleIds\.length - 1 : layerIndex\);/);
  assert.doesNotMatch(mainTs, /const duration = getMultiDragFlightDurationMs\(nextVisibleIds\.length, layerIndex === -1 \? nextVisibleIds\.length - 1 : layerIndex\);/);
});



test('phase visibility keeps source cards visible during extraction so clones can launch from original positions, hides them while dragging, then shows real cards during insertion', () => {
  assert.deepEqual(getMultiDragPhaseVisibility('extracting'), {
    fallbackVisible: true,
    sourceCardsHidden: false,
    slotCardsDimmed: false,
  });
  assert.deepEqual(getMultiDragPhaseVisibility('dragging'), {
    fallbackVisible: true,
    sourceCardsHidden: true,
    slotCardsDimmed: false,
  });
  assert.deepEqual(getMultiDragPhaseVisibility('inserting'), {
    fallbackVisible: true,
    sourceCardsHidden: false,
    slotCardsDimmed: true,
  });
});


test('clone class sanitization strips selected styling so drag previews do not keep the purple outline', () => {
  assert.deepEqual(
    sanitizeMultiDragCloneClassNames(['kanban-card', 'is-selected', 'is-multidrag-source', 'foo']),
    ['kanban-card', 'foo'],
  );
});


test('dragging state removes selected-card outline styling from real cards as well as clones', () => {
  const stylesCss = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
  assert.match(stylesCss, /\.is-dragging-card \.kanban-card\.is-selected,[\s\S]*?\.is-dragging-card \.kanban-card\.is-pinned\.is-selected \{[\s\S]*?border-color:\s*transparent !important;[\s\S]*?box-shadow:\s*none !important;/);
});


test('multidrag fly clones keep softer easing and elevated shadows during extraction', () => {
  const stylesCss = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
  assert.match(stylesCss, /\.kanban-multidrag-stack-card > \.kanban-card\s*\{[\s\S]*?box-shadow:\s*0 18px 36px rgba\(0,0,0,0\.18\), 0 6px 14px rgba\(0,0,0,0\.12\) !important;/);
  assert.match(stylesCss, /\.kanban-multidrag-fly-card\s*\{[\s\S]*?transition:\s*transform 260ms cubic-bezier\(\.22,1,\.36,1\), width 260ms cubic-bezier\(\.22,1,\.36,1\), height 260ms cubic-bezier\(\.22,1,\.36,1\), opacity 260ms ease;/);
});


test('extraction fly clone shadows ease down as cards converge into the stack', () => {
  const mainTs = readFileSync(new URL('./src/main.ts', import.meta.url), 'utf8');
  assert.match(mainTs, /private getMultiDragExtractionShadow\(progress: number\): string \{/);
  assert.match(mainTs, /clone\.style\.boxShadow = this\.getMultiDragExtractionShadow\(0\);/);
  assert.match(mainTs, /clone\.style\.boxShadow = this\.getMultiDragExtractionShadow\(easedProgress\);/);
});


test('runtime defers full stack preview until extraction has cards to reveal', () => {
  const mainTs = readFileSync(new URL('./src/main.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(mainTs, /this\.buildMultiDragPreview\(fallback, item, orderedIds, draggedId\);\s*\n\s*this\.applyMultiDragPhaseVisibility\('extracting'/);
  assert.match(mainTs, /await this\.playMultiDragExtraction\(item, fallback, orderedIds\)/);
});


test('runtime lets each concurrent extraction clone add itself to the stack only after its own flight finishes', () => {
  const mainTs = readFileSync(new URL('./src/main.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(mainTs, /for \(const \{ sourceEl, rect, id, index \} of sources\) \{/);
  assert.match(mainTs, /const animations = sources\.map\(\(\{ sourceEl, rect, id \}, index\) => \(async \(\) => \{[\s\S]*?const duration = getMultiDragFlightDurationMs\(finalVisibleIds\.length, finalLayerIndex === -1 \? finalVisibleIds\.length - 1 : finalLayerIndex\);[\s\S]*?let rafId = window\.requestAnimationFrame\(tick\);[\s\S]*?await this\.wait\(duration\);[\s\S]*?window\.cancelAnimationFrame\(rafId\);[\s\S]*?animateClone\(duration\);[\s\S]*?revealedIds\.add\(id\);[\s\S]*?this\.buildMultiDragPreview\(fallback, item, orderedIds, draggedId, getMultiDragAnchoredPreviewIds\(orderedIds\.filter\(\(candidateId\) => candidateId === draggedId \|\| revealedIds\.has\(candidateId\)\), draggedId\)\);[\s\S]*?clone\.remove\(\);/);
});


test('runtime paints each extraction clone at its source before launch and hides that source only after motion begins', () => {
  const mainTs = readFileSync(new URL('./src/main.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(mainTs, /this\.applyMultiDragPhaseVisibility\('extracting', fallback, sourceEls\)/);
  assert.match(mainTs, /this\.applyMultiDragPhaseVisibility\('extracting', fallback, \[\]\)/);
  assert.match(mainTs, /this\.buildMultiDragPreview\(fallback, item, orderedIds, draggedId, getMultiDragExtractionPreviewIds\(orderedIds, 0, draggedId\)\);/);
  assert.match(mainTs, /const animations = sources\.map\(\(\{ sourceEl, rect, id \}, index\) => \(async \(\) => \{[\s\S]*?const clone = this\.createFlyClone\(sourceEl, rect\);[\s\S]*?overlay\.appendChild\(clone\);[\s\S]*?await this\.nextFrame\(\);[\s\S]*?animateClone\(0\);[\s\S]*?sourceEl\.addClass\('is-multidrag-source'\);/);
});


test('playInsertion makes target cards open visible room before fly clones land', () => {
  const mainTs = readFileSync(new URL('./src/main.ts', import.meta.url), 'utf8');
  assert.match(mainTs, /private applyMultiDragInsertionSlotLayout\(slotEls: HTMLElement\[], targetRects: RectSnapshot\[\]\) \{/);
  assert.match(mainTs, /private clearMultiDragInsertionSlotLayout\(slotEls: HTMLElement\[\]\) \{/);
  assert.match(mainTs, /private async playMultiDragInsertion\(fallback: HTMLElement \| null, item: HTMLElement, orderedEls: HTMLElement\[\]\) \{[\s\S]*?this\.applyMultiDragPhaseVisibility\('inserting', fallback, [^\)]*\);[\s\S]*?this\.applyMultiDragInsertionSlotLayout\(orderedEls, targetRects\);/);
  assert.match(mainTs, /await Promise\.all\(animations\);[\s\S]*?this\.clearMultiDragInsertionSlotLayout\(orderedEls\);/);
  assert.doesNotMatch(mainTs, /this\.applyMultiDragPhaseVisibility\('inserting', fallback, [^\)]*, orderedEls\);/);
});


test('playInsertion also shifts existing target-column cards into their post-insertion positions', () => {
  const mainTs = readFileSync(new URL('./src/main.ts', import.meta.url), 'utf8');
  assert.match(mainTs, /pendingInsertionRoomIds\?: string\[\];/);
  assert.match(mainTs, /pendingInsertionRoomRects\?: RectSnapshot\[\];/);
  assert.match(mainTs, /private measureMultiDragInsertionRoomLayout\(toContainer: HTMLElement, orderedIds: string\[], draggedItem: HTMLElement\) \{/);
  assert.match(mainTs, /playInsertion: async \(\) => \{[\s\S]*?const roomLayout = this\.measureMultiDragInsertionRoomLayout\([\s\S]*?this\._multiDragState\.pendingInsertionRoomIds = roomLayout\.ids;[\s\S]*?this\._multiDragState\.pendingInsertionRoomRects = roomLayout\.rects;/);
  assert.match(mainTs, /private async playMultiDragInsertion\(fallback: HTMLElement \| null, item: HTMLElement, orderedEls: HTMLElement\[\]\) \{[\s\S]*?const slotRoomIds = state\?\.pendingInsertionRoomIds \?\? \[\];[\s\S]*?const slotRoomRects = state\?\.pendingInsertionRoomRects \?\? \[\];[\s\S]*?const slotRoomEls = slotRoomIds[\s\S]*?this\.applyMultiDragInsertionSlotLayout\(slotRoomEls, slotRoomRects\);/);
});
test('target rect measurement includes moved cards when building offscreen final insertion layout', () => {
  const mainTs = readFileSync(new URL('./src/main.ts', import.meta.url), 'utf8');
  assert.match(mainTs, /private measureMultiDragTargetRects\(toContainer: HTMLElement, orderedEls: HTMLElement\[], draggedItem: HTMLElement\): RectSnapshot\[] \{[\s\S]*?const sourceMap = new Map<string, HTMLElement>\(\);[\s\S]*?currentCards\.forEach\(\(el\) => \{[\s\S]*?if \(id\) sourceMap\.set\(id, el\);[\s\S]*?\}\);[\s\S]*?orderedEls\.forEach\(\(el\) => \{[\s\S]*?const id = el\.dataset\.id \|\| '';[\s\S]*?if \(id\) sourceMap\.set\(id, el\);[\s\S]*?\}\);[\s\S]*?finalIds\.forEach/);
});


test('insertion room measurement includes moving cards before shifting existing target cards', () => {
  const mainTs = readFileSync(new URL('./src/main.ts', import.meta.url), 'utf8');
  assert.match(mainTs, /private measureMultiDragInsertionRoomLayout\(toContainer: HTMLElement, orderedIds: string\[], draggedItem: HTMLElement\) \{[\s\S]*?const sourceMap = new Map<string, HTMLElement>\(\);[\s\S]*?currentCards\.forEach\(\(el\) => \{[\s\S]*?if \(id\) sourceMap\.set\(id, el\);[\s\S]*?\}\);[\s\S]*?orderedIds\.forEach\(\(id\) => \{[\s\S]*?const sourceEl = this\.boardEl\.querySelector\(`\.kanban-card\[data-id="\$\{CSS\.escape\(id\)\}"\]`\) as HTMLElement \| null;[\s\S]*?if \(sourceEl\) sourceMap\.set\(id, sourceEl\);[\s\S]*?\}\);[\s\S]*?finalIds\.forEach/);
});


test('final DOM commit looks up moved cards from the whole board so empty target columns render immediately', () => {
  const mainTs = readFileSync(new URL('./src/main.ts', import.meta.url), 'utf8');
  assert.match(mainTs, /private commitMultiDragFinalOrder\(toContainer: HTMLElement, orderedIds: string\[], draggedItem: HTMLElement\) \{[\s\S]*?const orderedElMap = new Map<string, HTMLElement>\(\);[\s\S]*?currentCards\.forEach\(\(el\) => \{[\s\S]*?if \(id\) orderedElMap\.set\(id, el\);[\s\S]*?\}\);[\s\S]*?orderedIds\.forEach\(\(id\) => \{[\s\S]*?const el = this\.boardEl\.querySelector\(`\.kanban-card\[data-id="\$\{CSS\.escape\(id\)\}"\]`\) as HTMLElement \| null;[\s\S]*?if \(el\) orderedElMap\.set\(id, el\);[\s\S]*?\}\);/);
});


test('playInsertion clears source hidden state before opening visible room so insertion motion can be seen', () => {
  const mainTs = readFileSync(new URL('./src/main.ts', import.meta.url), 'utf8');
  assert.match(mainTs, /private async playMultiDragInsertion\(fallback: HTMLElement \| null, item: HTMLElement, orderedEls: HTMLElement\[\]\) \{[\s\S]*?this\.applyMultiDragPhaseVisibility\('inserting', fallback, orderedEls\);[\s\S]*?this\.buildMultiDragPreview\([\s\S]*?await this\.nextFrame\(\);[\s\S]*?this\.applyMultiDragInsertionSlotLayout\(orderedEls, targetRects\);/);
  assert.doesNotMatch(mainTs, /private async playMultiDragInsertion\(fallback: HTMLElement \| null, item: HTMLElement, orderedEls: HTMLElement\[\]\) \{[\s\S]*?this\.applyMultiDragPhaseVisibility\('inserting', fallback, \[\]\);[\s\S]*?this\.buildMultiDragPreview\([\s\S]*?await this\.nextFrame\(\);[\s\S]*?this\.applyMultiDragInsertionSlotLayout\(orderedEls, targetRects\);/);
});


test('insertion fly clone shadows ease out as cards leave the stack', () => {
  const mainTs = readFileSync(new URL('./src/main.ts', import.meta.url), 'utf8');
  assert.match(mainTs, /private getMultiDragInsertionShadow\(progress: number\): string \{/);
  assert.match(mainTs, /clone\.style\.boxShadow = this\.getMultiDragInsertionShadow\(0\);/);
  assert.match(mainTs, /clone\.style\.boxShadow = this\.getMultiDragInsertionShadow\(easedProgress\);/);
});


test('runtime removes one card from the pointer stack after each concurrent insertion clone finishes', () => {
  const mainTs = readFileSync(new URL('./src/main.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(mainTs, /for \(let index = 0; index < orderedEls\.length; index \+= 1\) \{/);
  assert.match(mainTs, /const animations = orderedEls\.map\(\(leavingEl, index\) => \(async \(\) => \{[\s\S]*?clone\.style\.transform = `translate\([\s\S]*?await this\.wait\((?:getMultiDragFlightDurationMs\(visibleIds\.length, layerIndex === -1 \? visibleIds\.length - 1 : layerIndex\)|duration)\);[\s\S]*?pendingIds\.delete\(leavingEl\.dataset\.id \|\| ''\);\s*this\.buildMultiDragPreview\([\s\S]*?getMultiDragAnchoredPreviewIds\(orderedIds\.filter\(\(candidateId\) => pendingIds\.has\(candidateId\)\), item\.dataset\.id \|\| ''\),[\s\S]*?clone\.remove\(\);/);
});




test('extraction settles into the final stack without rebuilding the same preview twice at the end', () => {
  const mainTs = readFileSync(new URL('./src/main.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(
    mainTs,
    /revealedIds\.add\(id\);[\s\S]*?this\.buildMultiDragPreview\(fallback, item, orderedIds, draggedId, getMultiDragAnchoredPreviewIds\(orderedIds\.filter\(\(candidateId\) => candidateId === draggedId \|\| revealedIds\.has\(candidateId\)\), draggedId\)\);[\s\S]*?await Promise\.all\(animations\);[\s\S]*?overlay\.remove\(\);[\s\S]*?this\.buildMultiDragPreview\(fallback, item, orderedIds, draggedId\);/
  );
  assert.match(
    mainTs,
    /revealedIds\.add\(id\);[\s\S]*?this\.buildMultiDragPreview\(fallback, item, orderedIds, draggedId, getMultiDragAnchoredPreviewIds\(orderedIds\.filter\(\(candidateId\) => candidateId === draggedId \|\| revealedIds\.has\(candidateId\)\), draggedId\)\);[\s\S]*?await Promise\.all\(animations\);[\s\S]*?overlay\.remove\(\);[\s\S]*?this\.applyMultiDragPhaseVisibility\('dragging', fallback, sourceEls\);/
  );
});

test('multi-drag commit suspends rerender before any writes and releases after commit', async () => {
  assert.equal(typeof runMultiDragCommitPhases, 'function');

  const events: string[] = [];
  let suspended = false;

  await runMultiDragCommitPhases({
    setSuspended(value) {
      suspended = value;
      events.push(`suspend:${value}`);
    },
    syncMovedCards: async () => {
      events.push(`sync:${suspended}`);
    },
    playInsertion: async () => {
      events.push(`animate:${suspended}`);
    },
    rewriteTargetOrder: async () => {
      events.push(`target:${suspended}`);
    },
    rewriteSourceOrder: async () => {
      events.push(`source:${suspended}`);
    },
    persistSettings: async () => {
      events.push(`save:${suspended}`);
    },
  });

  assert.deepEqual(events, [
    'suspend:true',
    'sync:true',
    'animate:true',
    'target:true',
    'source:true',
    'save:true',
    'suspend:false',
  ]);
});

test('multi-drag commit always releases rerender suspension after failure', async () => {
  assert.equal(typeof runMultiDragCommitPhases, 'function');

  const events: string[] = [];
  let suspended = false;

  await assert.rejects(
    runMultiDragCommitPhases({
      setSuspended(value) {
        suspended = value;
        events.push(`suspend:${value}`);
      },
      syncMovedCards: async () => {
        events.push(`sync:${suspended}`);
        throw new Error('sync failed');
      },
      playInsertion: async () => {
        events.push(`animate:${suspended}`);
      },
      rewriteTargetOrder: async () => {
        events.push(`target:${suspended}`);
      },
    }),
    /sync failed/,
  );

  assert.deepEqual(events, [
    'suspend:true',
    'sync:true',
    'suspend:false',
  ]);
});
