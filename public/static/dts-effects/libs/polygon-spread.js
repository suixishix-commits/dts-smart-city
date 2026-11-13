/*!
 * polygon-spread.js — DTS 多边形漫开前端库 (BP_PolygonSpread_V1)
 * build 2026-10-30, ported from the 2026-09-27 IsochroneFX frontend; adds setStyle and an optional pakFilePath
 *
 * Bundles earcut 3.2.3 (https://github.com/mapbox/earcut):
 * ISC License
 * 
 * Copyright (c) 2026, Mapbox
 * 
 * Permission to use, copy, modify, and/or distribute this software for any purpose
 * with or without fee is hereby granted, provided that the above copyright notice
 * and this permission notice appear in all copies.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
 * REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
 * FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
 * INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
 * OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
 * TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
 * THIS SOFTWARE.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else if (typeof define === 'function' && define.amd) define([], factory);
  else root.PolygonSpread = factory();
}(typeof self !== 'undefined' ? self : this, function () {
'use strict';
/* ---------------- earcut ---------------- */
/**
 * A vertex in a circular doubly linked list representing a polygon ring.
 * `prev`/`next` are always linked (set immediately after {@link createNode}), so they're typed
 * non-null; `prevZ`/`nextZ` are the z-order list links and are null at the ends.
 *
 * @typedef {object} Node
 * @property {number} i vertex index in the coordinates array
 * @property {number} x vertex x coordinate
 * @property {number} y vertex y coordinate
 * @property {Node} prev previous vertex node in the polygon ring
 * @property {Node} next next vertex node in the polygon ring
 * @property {number} z z-order curve value; doubles as the owning block index during eliminateHoles
 * @property {Node | null} prevZ previous node in z-order
 * @property {Node | null} nextZ next node in z-order
 */

// single-vertex holes to preserve through filterPoints (steiner points); kept off the Node
// shape since they're rare — the empty-set fast path means non-steiner inputs pay nothing
/** @type {Set<Node>} */
const steiners = new Set();

// set by filterPoints whenever it removes at least one node; read by earcutLinked's stall
// handler to decide whether another clip pass is worth attempting before the costlier stages
let filteredOut = false;

/**
 * Triangulate a polygon given as a flat array of vertex coordinates.
 *
 * @param {ArrayLike<number>} data flat array of vertex coordinates
 * @param {ArrayLike<number> | null} [holeIndices] indices (in vertices, not coordinates) where each hole ring starts
 * @param {number} [dim=2] number of coordinates per vertex in `data`
 * @returns {number[]} triangles as triplets of vertex indices into `data`
 * @example earcut([10,0, 0,50, 60,60, 70,10]); // [1,0,3, 3,2,1]
 */
function earcut(data, holeIndices, dim = 2) {

    const hasHoles = holeIndices && holeIndices.length;
    const outerLen = hasHoles ? holeIndices[0] * dim : data.length;
    if (steiners.size) steiners.clear();

    let outerNode = linkedList(data, 0, outerLen, dim, true);
    /** @type {number[]} */
    const triangles = [];

    if (!outerNode || outerNode.next === outerNode.prev) return triangles;

    let minX = 0, minY = 0, invSize = 0;

    if (hasHoles) outerNode = eliminateHoles(data, holeIndices, outerNode, dim);

    // if the shape is not too simple, we'll use z-order curve hash later; calculate polygon bbox
    if (data.length > 80 * dim) {
        minX = data[0];
        minY = data[1];
        let maxX = minX;
        let maxY = minY;

        for (let i = dim; i < outerLen; i += dim) {
            const x = data[i];
            const y = data[i + 1];
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
        }

        // minX, minY and invSize are later used to transform coords into integers for z-order calculation
        invSize = Math.max(maxX - minX, maxY - minY);
        invSize = invSize !== 0 ? 32767 / invSize : 0;
    }

    earcutLinked(outerNode, triangles, minX, minY, invSize);

    return triangles;
}

// create a circular doubly linked list from polygon points in the specified winding order
/** @param {ArrayLike<number>} data @param {number} start @param {number} end @param {number} dim @param {boolean} clockwise @returns {Node | null} */
function linkedList(data, start, end, dim, clockwise) {
    /** @type {Node | null} */
    let last = null;

    if (clockwise === (signedArea(data, start, end, dim) > 0)) {
        for (let i = start; i < end; i += dim) last = insertNode(i / dim | 0, data[i], data[i + 1], last);
    } else {
        for (let i = end - dim; i >= start; i -= dim) last = insertNode(i / dim | 0, data[i], data[i + 1], last);
    }

    if (last && equals(last, last.next)) {
        removeNode(last);
        last = last.next;
    }

    return last;
}

// Remove collinear or coincident points; removability depends only on a node's immediate
// neighbors, so we sweep forward and re-check the predecessor after each removal. With no `end`
// we sweep the whole ring, lapping until nothing is removable (the fixpoint the clipper needs).
// With an explicit `end` we heal only the dirty window around a bridge/diagonal cut, stopping at
// `end` rather than lapping — O(window) instead of O(ring).
/** @param {Node} start @param {Node} [end] @returns {Node} */
function filterPoints(start, end = start) {
    const full = end === start;

    let p = start, again;
    do {
        again = false;
        if (p !== p.next && (steiners.size === 0 || !steiners.has(p)) &&
            (equals(p, p.next) || area(p.prev, p, p.next) === 0)) {
            if (full || p === end) end = p.prev; // pull the stop bound back past the removal
            filteredOut = true;
            removeNode(p);
            p = p.prev;         // re-check the predecessor
            again = true;
        } else if (full || p !== end) {
            p = p.next;
            again = !full;      // local heal: keep looping until the sweep reaches end
        }
    } while (again || p !== end);

    return end;
}

// main ear slicing loop which triangulates a polygon (given as a linked list)
/** @param {Node} ear @param {number[]} triangles @param {number} minX @param {number} minY @param {number} invSize */
function earcutLinked(ear, triangles, minX, minY, invSize) {
    // interlink polygon nodes in z-order
    if (invSize) indexCurve(ear, minX, minY, invSize);

    let stop = ear, cured = false;

    // iterate through ears, slicing them one by one
    while (ear.prev !== ear.next) {
        const prev = ear.prev;
        /** @type {Node} */
        const next = ear.next;

        if (area(prev, ear, next) < 0 && (invSize ? isEarHashed(ear, minX, minY, invSize) : isEar(ear))) {
            triangles.push(prev.i, ear.i, next.i); // cut off the triangle

            removeNode(ear);
            ear = next;
            stop = next;
            continue;
        }

        ear = next;

        // if we looped through the whole remaining polygon and can't find any more ears
        if (ear === stop) {
            // try filtering collinear/coincident points and slicing again — repeat as long as
            // filtering actually removes nodes, since each removal can expose new ears
            filteredOut = false;
            ear = filterPoints(ear);
            if (filteredOut) { stop = ear; continue; }

            // filtering is exhausted: cure small local self-intersections once, then retry
            if (!cured) {
                ear = cureLocalIntersections(ear, triangles);
                stop = ear;
                cured = true;
                continue;
            }

            // as a last resort, try splitting the remaining polygon into two
            splitEarcut(ear, triangles, minX, minY, invSize);
            break;
        }
    }
}

// check whether a polygon node forms a valid ear with adjacent nodes
/** @param {Node} ear @returns {boolean} */
function isEar(ear) {
    // reflex check (area(a, b, c) >= 0) is hoisted into the earcutLinked caller to avoid non-inlined call here
    const a = ear.prev, b = ear, c = ear.next,
        ax = a.x, bx = b.x, cx = c.x, ay = a.y, by = b.y, cy = c.y,
        x0 = Math.min(ax, bx, cx), // triangle bbox
        y0 = Math.min(ay, by, cy),
        x1 = Math.max(ax, bx, cx),
        y1 = Math.max(ay, by, cy);

    // make sure we don't have other points inside the potential ear
    let p = c.next;
    while (p !== a) {
        if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 && !(ax === p.x && ay === p.y) &&
            pointInTriangle(ax, ay, bx, by, cx, cy, p.x, p.y) && area(p.prev, p, p.next) >= 0) return false;
        p = p.next;
    }
    return true;
}

/** @param {Node} ear @param {number} minX @param {number} minY @param {number} invSize @returns {boolean} */
function isEarHashed(ear, minX, minY, invSize) {
    // reflex check is hoisted into the earcutLinked caller (see isEar)
    const a = ear.prev, b = ear, c = ear.next,
        ax = a.x, bx = b.x, cx = c.x, ay = a.y, by = b.y, cy = c.y,
        x0 = Math.min(ax, bx, cx), // triangle bbox
        y0 = Math.min(ay, by, cy),
        x1 = Math.max(ax, bx, cx),
        y1 = Math.max(ay, by, cy),
        minZ = zOrder(x0, y0, minX, minY, invSize), // z-order range for the current triangle bbox;
        maxZ = zOrder(x1, y1, minX, minY, invSize);

    let p = ear.prevZ;
    while (p && p.z >= minZ) { // look for points inside the triangle in decreasing z-order
        if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 && p !== c && !(ax === p.x && ay === p.y) &&
            pointInTriangle(ax, ay, bx, by, cx, cy, p.x, p.y) && area(p.prev, p, p.next) >= 0) return false;
        p = p.prevZ;
    }
    let n = ear.nextZ;
    while (n && n.z <= maxZ) { // look for points in increasing z-order
        if (n.x >= x0 && n.x <= x1 && n.y >= y0 && n.y <= y1 && n !== c && !(ax === n.x && ay === n.y) &&
            pointInTriangle(ax, ay, bx, by, cx, cy, n.x, n.y) && area(n.prev, n, n.next) >= 0) return false;
        n = n.nextZ;
    }
    return true;
}

// go through all polygon nodes and cure small local self-intersections
/** @param {Node} start @param {number[]} triangles @returns {Node} */
function cureLocalIntersections(start, triangles) {
    let p = start;
    let cured = false;
    do {
        const a = p.prev,
            b = p.next.next;

        if (intersects(a, p, p.next, b, false) && locallyInside(a, b) && locallyInside(b, a)) {

            triangles.push(a.i, p.i, b.i);

            // remove two nodes involved
            removeNode(p);
            removeNode(p.next);

            p = start = b;
            cured = true;
        }
        p = p.next;
    } while (p !== start);

    return cured ? filterPoints(p) : p;
}

// try splitting polygon into two and triangulate them independently
/** @param {Node} start @param {number[]} triangles @param {number} minX @param {number} minY @param {number} invSize */
function splitEarcut(start, triangles, minX, minY, invSize) {
    // look for a valid diagonal that divides the polygon into two
    let a = start;
    do {
        let b = a.next.next;
        while (b !== a.prev) {
            if (a.i !== b.i && isValidDiagonal(a, b)) {
                // split the polygon in two by the diagonal
                let c = splitPolygon(a, b);

                // filter colinear points around the cuts
                a = filterPoints(a, a.next);
                c = filterPoints(c, c.next);

                // run earcut on each half
                earcutLinked(a, triangles, minX, minY, invSize);
                earcutLinked(c, triangles, minX, minY, invSize);
                return;
            }
            b = b.next;
        }
        a = a.next;
    } while (a !== start);
}

// true only while eliminateHoles merges holes, so removeNode keeps the block index live (growBlock)
let indexActive = false;

// link every hole into the outer loop, producing a single-ring polygon without holes
/** @param {ArrayLike<number>} data @param {ArrayLike<number>} holeIndices @param {Node} outerNode @param {number} dim @returns {Node} */
function eliminateHoles(data, holeIndices, outerNode, dim) {
    const queue = [];

    for (let i = 0, len = holeIndices.length; i < len; i++) {
        const start = holeIndices[i] * dim;
        const end = i < len - 1 ? holeIndices[i + 1] * dim : data.length;
        const list = /** @type {Node} */ (linkedList(data, start, end, dim, false));
        if (list === list.next) steiners.add(list);
        queue.push(getLeftmost(list));
    }

    queue.sort(compareXYSlope);

    // block-bbox index for findHoleBridge, grown append-only as holes merge (see notes
    // above buildBlockIndex). Seed it with the outer ring, then append each merged hole.
    buildBlockIndex(data.length / dim, holeIndices.length);
    indexSegment(outerNode, outerNode);

    // process holes from left to right; indexActive lets removeNode keep block bboxes live as
    // filterPoints heals edges during merges (see growBlock)
    indexActive = true;
    for (let i = 0; i < queue.length; i++) {
        outerNode = eliminateHole(queue[i], outerNode);
    }
    indexActive = false;

    // collapse collinear/coincident points across the whole merged ring once before clipping
    return filterPoints(outerNode);
}

/** @param {Node} a @param {Node} b @returns {number} */
function compareXYSlope(a, b) {
    // when the left-most point of 2 holes meet at a vertex, sort the holes counterclockwise so that when we find
    // the bridge to the outer shell is always the point that they meet at.
    return a.x - b.x || a.y - b.y ||
        (a.next.y - a.y) / (a.next.x - a.x) -
        (b.next.y - b.y) / (b.next.x - b.x);
}

// find a bridge between vertices that connects hole with an outer ring and link it
/** @param {Node} hole @param {Node} outerNode @returns {Node} */
function eliminateHole(hole, outerNode) {
    const bridge = findHoleBridge(hole, outerNode);
    if (!bridge) {
        return outerNode;
    }

    const bridgeReverse = splitPolygon(bridge, hole);

    // index the merged-in segment before filtering: in ring order the splice runs
    // bridge -> hole -> bridgeReverse -> bridge2 -> (bridge's old next), covering the
    // hole's edges and both new slit edges. filterPoints below only drops collinear /
    // coincident points, so these bboxes stay valid (conservative) supersets.
    const bridge2 = bridgeReverse.next;
    indexSegment(bridge, bridge2.next);

    // heal collinear/coincident points around the two new slit edges
    filterPoints(bridgeReverse, bridgeReverse.next);
    return filterPoints(bridge, bridge.next);
}

// Block-bbox index for findHoleBridge (issue #183): one [minX,minY,maxX,maxY] bbox per K
// consecutive ring edges, in a flat Float64Array, so the leftward-ray scan can skip whole
// blocks in O(1) instead of walking the entire merged ring. Grown append-only — the outer
// ring seeds it, then each merged hole appends a segment (head node, stop node, K-blocks
// over head..stop); independent segments, not a ring tiling, since splices land mid-ring.
// Buffers are sized once from the input upper bound and reused across calls.
//
// filterPoints only drops collinear/coincident points, so a stale bbox stays a conservative
// superset of its live edges (never a false skip); the scan skips dead nodes (p.prev.next !==
// p) and lazily advances a dead stop. Blocks are scanned in append (not ring) order, so the
// chosen bridge can differ from the un-indexed code — a different but equally valid result.
const K = 16; // edges per block

let blockBBox = new Float64Array(0); // [minX,minY,maxX,maxY] per block
let numBlocks = 0;
/** @type {Node[]} */
const blockHead = []; // first node of each block's segment
/** @type {Node[]} */
const blockStop = []; // node just past each block's segment (exclusive walk bound)

/** @param {number} maxNodes @param {number} numHoles */
function buildBlockIndex(maxNodes, numHoles) {
    // upper bound: every input node indexed once, +2 bridge nodes per hole, plus a partial
    // trailing block per appended segment (outer ring + one per hole)
    const maxBlocks = Math.ceil((maxNodes + 2 * numHoles) / K) + numHoles + 2;
    if (blockBBox.length < maxBlocks * 4) blockBBox = new Float64Array(maxBlocks * 4);
    numBlocks = 0;
}

// index the ring run head..stop (exclusive) as ceil(len / K) blocks; head === stop means
// the whole ring. each block's bbox covers both endpoints of every edge it owns.
/** @param {Node} head @param {Node} stop */
function indexSegment(head, stop) {
    let p = head;
    do {
        const b = numBlocks++;
        blockHead[b] = p;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let k = 0;
        do {
            const c = p.next; // edge p->c; bbox must bound both endpoints
            p.z = b; // reuse z as the owning block during eliminateHoles (see growBlock)
            if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
            if (c.x < minX) minX = c.x; if (c.x > maxX) maxX = c.x;
            if (c.y < minY) minY = c.y; if (c.y > maxY) maxY = c.y;
            p = c;
        } while (++k < K && p !== stop);
        blockStop[b] = p;
        const g = b * 4;
        blockBBox[g] = minX; blockBBox[g + 1] = minY; blockBBox[g + 2] = maxX; blockBBox[g + 3] = maxY;
    } while (p !== stop);
}

// when filterPoints heals an edge head->tail (removing the collinear node between them), the
// healed edge can extend past head's frozen block bbox if its old far endpoint lived in another
// block; grow head's block bbox to cover tail so the leftward-ray prune can't false-skip it.
/** @param {Node} head @param {Node} tail */
function growBlock(head, tail) {
    const g = head.z * 4;
    if (tail.x < blockBBox[g]) blockBBox[g] = tail.x;
    if (tail.y < blockBBox[g + 1]) blockBBox[g + 1] = tail.y;
    if (tail.x > blockBBox[g + 2]) blockBBox[g + 2] = tail.x;
    if (tail.y > blockBBox[g + 3]) blockBBox[g + 3] = tail.y;
}

/** @param {number} b @returns {Node} */
function liveBlockStop(b) {
    let stop = blockStop[b];
    while (stop.prev.next !== stop) stop = stop.next;
    blockStop[b] = stop;
    return stop;
}

// the block's head node can be removed by filterPoints during merges; advance it to the next
// live node so the walk doesn't start on (and immediately terminate at) a dead node. For the
// single full-ring seed block (head === stop) the same forward advance keeps them equal, so the
// do-while still laps the whole ring instead of collapsing to an empty walk.
/** @param {number} b @returns {Node} */
function liveBlockHead(b) {
    let head = blockHead[b];
    while (head.prev.next !== head) head = head.next;
    blockHead[b] = head;
    return head;
}

// David Eberly's algorithm for finding a bridge between hole and outer polygon
/** @param {Node} hole @param {Node} outerNode @returns {Node | null} */
function findHoleBridge(hole, outerNode) {
    let p = outerNode;
    const hx = hole.x;
    const hy = hole.y;
    let qx = -Infinity;
    /** @type {Node | undefined} */
    let m;

    // find a segment intersected by a ray from the hole's leftmost point to the left;
    // segment's endpoint with lesser x will be potential connection point
    // unless they intersect at a vertex, then choose the vertex
    if (equals(hole, p)) return p;

    // scan blocks; skip any whose bbox can't hold a crossing that beats qx and lies left
    // of hx (the prune Morton order can't express — explicit per-axis [minY,maxY]/[minX,maxX])
    for (let b = 0, g = 0; b < numBlocks; b++, g += 4) {
        if (hy < blockBBox[g + 1] || hy > blockBBox[g + 3] || blockBBox[g] > hx || blockBBox[g + 2] <= qx) continue;

        // ensure the walk's exclusive bound is live so we don't overrun into other blocks
        const stop = liveBlockStop(b);

        p = liveBlockHead(b);
        do {
            if (p.prev.next === p) { // skip nodes removed by filterPoints (stale in the index)
                if (equals(hole, p.next)) return p.next;
                else if (hy <= p.y && hy >= p.next.y && p.next.y !== p.y) {
                    const x = p.x + (hy - p.y) * (p.next.x - p.x) / (p.next.y - p.y);
                    if (x <= hx && x > qx) {
                        qx = x;
                        m = p.x < p.next.x ? p : p.next;
                        if (x === hx) return m; // hole touches outer segment; pick leftmost endpoint
                    }
                }
            }
            p = p.next;
        } while (p !== stop);
    }

    if (!m) return null;

    // look for points inside the triangle of hole point, segment intersection and endpoint;
    // if there are no points found, we have a valid connection;
    // otherwise choose the point of the minimum angle with the ray as connection point

    const mx = m.x;
    const my = m.y;
    const tminY = Math.min(hy, my); // the triangle's y span; x span is [mx, hx]
    const tmaxY = Math.max(hy, my);
    let tanMin = Infinity;

    // scan the same blocks; skip any whose bbox can't overlap the triangle's [mx,hx]×[tminY,tmaxY] box
    for (let b = 0, g = 0; b < numBlocks; b++, g += 4) {
        if (blockBBox[g + 2] < mx || blockBBox[g] > hx || blockBBox[g + 3] < tminY || blockBBox[g + 1] > tmaxY) continue;

        const stop = liveBlockStop(b);

        p = liveBlockHead(b);
        do {
            if (p.prev.next === p && hx >= p.x && p.x >= mx && hx !== p.x && // skip dead nodes
                    pointInTriangle(hy < my ? hx : qx, hy, mx, my, hy < my ? qx : hx, hy, p.x, p.y)) {

                const tan = Math.abs(hy - p.y) / (hx - p.x); // tangential

                // if hole point sits on p's horizontal edge (T-junction touch): the bridge runs
                // along that edge — locallyInside rejects it as collinear, but it's valid
                if ((locallyInside(p, hole) || (p.y === hy && p.next.y === hy && p.next.x > hx)) &&
                    (tan < tanMin || (tan === tanMin && (p.x > m.x || (p.x === m.x && sectorContainsSector(m, p)))))) {
                    m = p;
                    tanMin = tan;
                }
            }

            p = p.next;
        } while (p !== stop);
    }

    return m;
}

// whether sector in vertex m contains sector in vertex p in the same coordinates
/** @param {Node} m @param {Node} p @returns {boolean} */
function sectorContainsSector(m, p) {
    return area(m.prev, m, p.prev) < 0 && area(p.next, m, m.next) < 0;
}

// scratch buffers reused across calls and grown on demand: two node-ref arrays that
// ping-pong during the radix passes, plus parallel z-value arrays so the passes read
// z from contiguous memory instead of dereferencing each node. 256-entry histogram for
// 8-bit digits; the small histogram keeps per-call setup cheap (most rings are short)
/** @type {Node[]} */
const sortArr = [];
/** @type {Node[]} */
let sortBuf = [];
let zArr = new Uint32Array(0);
let zBuf = new Uint32Array(0);
const counts = new Uint32Array(256);

// interlink polygon nodes in z-order: collect into an array, sort by z, relink
/** @param {Node} start @param {number} minX @param {number} minY @param {number} invSize */
function indexCurve(start, minX, minY, invSize) {
    let p = start;
    let n = 0;
    do {
        // always (re)compute: z may still hold a block index left over from eliminateHoles
        p.z = zOrder(p.x, p.y, minX, minY, invSize);
        sortArr[n++] = p;
        p = p.next;
    } while (p !== start);

    sortNodes(n);

    /** @type {Node | null} */
    let prev = null;
    for (let i = 0; i < n; i++) {
        const node = sortArr[i];
        node.prevZ = prev;
        if (prev) prev.nextZ = node;
        prev = node;
    }
    /** @type {Node} */ (prev).nextZ = null;
}

// sort the first n nodes of sortArr by z, in place: insertion sort for small n (cheaper
// than histogram setup), else LSD radix in four 8-bit passes (covering z's 30 bits)
/** @param {number} n */
function sortNodes(n) {
    if (n <= 32) {
        for (let i = 1; i < n; i++) {
            const node = sortArr[i], z = node.z;
            let j = i - 1;
            while (j >= 0 && sortArr[j].z > z) { sortArr[j + 1] = sortArr[j]; j--; }
            sortArr[j + 1] = node;
        }
        return;
    }

    if (zArr.length < n) {
        zArr = new Uint32Array(n);
        zBuf = new Uint32Array(n);
        sortBuf = new Array(n);
    }
    for (let i = 0; i < n; i++) zArr[i] = sortArr[i].z;

    // even pass count lands the sorted result back in sortArr
    radixPass(n, sortArr, zArr, sortBuf, zBuf, 0);
    radixPass(n, sortBuf, zBuf, sortArr, zArr, 8);
    radixPass(n, sortArr, zArr, sortBuf, zBuf, 16);
    radixPass(n, sortBuf, zBuf, sortArr, zArr, 24);
}

// one LSD radix pass: stably scatter the first n nodes (and their z) from src to dst,
// bucketed by the 8-bit digit of z at the given bit shift
/** @param {number} n @param {Node[]} src @param {Uint32Array} srcZ @param {Node[]} dst @param {Uint32Array} dstZ @param {number} shift */
function radixPass(n, src, srcZ, dst, dstZ, shift) {
    counts.fill(0);
    for (let i = 0; i < n; i++) counts[(srcZ[i] >>> shift) & 0xff]++;
    // turn per-bucket counts into start offsets (prefix sum)
    let sum = 0;
    for (let b = 0; b < 256; b++) { const c = counts[b]; counts[b] = sum; sum += c; }
    for (let i = 0; i < n; i++) {
        const z = srcZ[i];
        const pos = counts[(z >>> shift) & 0xff]++;
        dst[pos] = src[i];
        dstZ[pos] = z;
    }
}

// z-order of a point given coords and inverse of the longer side of data bbox
/** @param {number} x @param {number} y @param {number} minX @param {number} minY @param {number} invSize @returns {number} */
function zOrder(x, y, minX, minY, invSize) {
    // coords are transformed into non-negative 15-bit integer range
    x = (x - minX) * invSize | 0;
    y = (y - minY) * invSize | 0;

    x = (x | (x << 8)) & 0x00FF00FF;
    x = (x | (x << 4)) & 0x0F0F0F0F;
    x = (x | (x << 2)) & 0x33333333;
    x = (x | (x << 1)) & 0x55555555;

    y = (y | (y << 8)) & 0x00FF00FF;
    y = (y | (y << 4)) & 0x0F0F0F0F;
    y = (y | (y << 2)) & 0x33333333;
    y = (y | (y << 1)) & 0x55555555;

    return x | (y << 1);
}

// find the leftmost node of a polygon ring
/** @param {Node} start @returns {Node} */
function getLeftmost(start) {
    let p = start,
        leftmost = start;
    do {
        if (p.x < leftmost.x || (p.x === leftmost.x && p.y < leftmost.y)) leftmost = p;
        p = p.next;
    } while (p !== start);

    return leftmost;
}

// check if a point lies within a convex triangle
/** @param {number} ax @param {number} ay @param {number} bx @param {number} by @param {number} cx @param {number} cy @param {number} px @param {number} py @returns {boolean} */
function pointInTriangle(ax, ay, bx, by, cx, cy, px, py) {
    return (cx - px) * (ay - py) >= (ax - px) * (cy - py) &&
           (ax - px) * (by - py) >= (bx - px) * (ay - py) &&
           (bx - px) * (cy - py) >= (cx - px) * (by - py);
}

// check if a diagonal between two polygon nodes is valid (lies in polygon interior)
/** @param {Node} a @param {Node} b @returns {boolean} true when the diagonal is valid */
function isValidDiagonal(a, b) {
    const zeroLength = equals(a, b) && area(a.prev, a, a.next) > 0 && area(b.prev, b, b.next) > 0; // degenerate case
    return a.next.i !== b.i && (zeroLength || locallyInside(a, b) && locallyInside(b, a) && // // locally visible
        (area(a.prev, a, b.prev) !== 0 || area(a, b.prev, b) !== 0)) && // no opposite-facing sectors
        !intersectsPolygon(a, b) && (zeroLength || middleInside(a, b)); // doesn't intersect other edges, diagonal inside polygon
}

// signed area of a triangle
/** @param {Node} p @param {Node} q @param {Node} r @returns {number} */
function area(p, q, r) {
    return (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
}

// check if two points are equal
/** @param {Node} p1 @param {Node} p2 @returns {boolean} */
function equals(p1, p2) {
    return p1.x === p2.x && p1.y === p2.y;
}

// check if two segments intersect; by default includes collinear boundary touches
/** @param {Node} p1 @param {Node} q1 @param {Node} p2 @param {Node} q2 @param {boolean} [includeBoundary] @returns {boolean} */
function intersects(p1, q1, p2, q2, includeBoundary = true) {
    const o1 = area(p1, q1, p2);
    const o2 = area(p1, q1, q2);
    const o3 = area(p2, q2, p1);
    const o4 = area(p2, q2, q1);

    if (((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0))) return true;

    if (!includeBoundary) return false;

    if (o1 === 0 && onSegment(p1, p2, q1)) return true; // p1, q1 and p2 are collinear and p2 lies on p1q1
    if (o2 === 0 && onSegment(p1, q2, q1)) return true; // p1, q1 and q2 are collinear and q2 lies on p1q1
    if (o3 === 0 && onSegment(p2, p1, q2)) return true; // p2, q2 and p1 are collinear and p1 lies on p2q2
    if (o4 === 0 && onSegment(p2, q1, q2)) return true; // p2, q2 and q1 are collinear and q1 lies on p2q2

    return false;
}

// for collinear points p, q, r, check if point q lies on segment pr
/** @param {Node} p @param {Node} q @param {Node} r @returns {boolean} */
function onSegment(p, q, r) {
    return q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) && q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y);
}

// check if a polygon diagonal intersects any polygon segments
/** @param {Node} a @param {Node} b @returns {boolean} */
function intersectsPolygon(a, b) {
    // diagonal bbox; an edge whose bbox can't overlap it can't intersect it, so
    // skip the orientation test for those (the common case — the diagonal is short)
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);

    let p = a;
    do {
        const n = p.next;
        if ((p.x > maxX && n.x > maxX) || (p.x < minX && n.x < minX) ||
            (p.y > maxY && n.y > maxY) || (p.y < minY && n.y < minY)) {
            p = n;
            continue;
        }
        if (p.i !== a.i && n.i !== a.i && p.i !== b.i && n.i !== b.i &&
                intersects(p, n, a, b)) return true;
        p = n;
    } while (p !== a);

    return false;
}

// check if a polygon diagonal is locally inside the polygon
/** @param {Node} a @param {Node} b @returns {boolean} */
function locallyInside(a, b) {
    return area(a.prev, a, a.next) < 0 ?
        area(a, b, a.next) >= 0 && area(a, a.prev, b) >= 0 :
        area(a, b, a.prev) < 0 || area(a, a.next, b) < 0;
}

// check if the middle point of a polygon diagonal is inside the polygon
/** @param {Node} a @param {Node} b @returns {boolean} */
function middleInside(a, b) {
    let p = a;
    let inside = false;
    const px = (a.x + b.x) / 2;
    const py = (a.y + b.y) / 2;
    do {
        const n = p.next;
        if (((p.y > py) !== (n.y > py)) && (px < (n.x - p.x) * (py - p.y) / (n.y - p.y) + p.x))
            inside = !inside;
        p = n;
    } while (p !== a);

    return inside;
}

// link two polygon vertices with a bridge; if the vertices belong to the same ring, it splits polygon into two;
// if one belongs to the outer ring and another to a hole, it merges it into a single ring
/** @param {Node} a @param {Node} b @returns {Node} */
function splitPolygon(a, b) {
    const a2 = createNode(a.i, a.x, a.y),
        b2 = createNode(b.i, b.x, b.y),
        an = a.next,
        bp = b.prev;

    a.next = b;
    b.prev = a;

    a2.next = an;
    an.prev = a2;

    b2.next = a2;
    a2.prev = b2;

    bp.next = b2;
    b2.prev = bp;

    return b2;
}

// create a node and optionally link it with previous one (in a circular doubly linked list)
/** @param {number} i @param {number} x @param {number} y @param {Node | null} last @returns {Node} */
function insertNode(i, x, y, last) {
    const p = createNode(i, x, y);

    if (!last) {
        p.prev = p;
        p.next = p;

    } else {
        p.next = last.next;
        p.prev = last;
        last.next.prev = p;
        last.next = p;
    }
    return p;
}

/** @param {Node} p */
function removeNode(p) {
    p.next.prev = p.prev;
    p.prev.next = p.next;

    if (p.prevZ) p.prevZ.nextZ = p.nextZ;
    if (p.nextZ) p.nextZ.prevZ = p.prevZ;

    // keep the hole-bridge index's block bboxes covering the healed prev->next edge
    if (indexActive) growBlock(p.prev, p.next);
}

/** @param {number} i @param {number} x @param {number} y @returns {Node} */
function createNode(i, x, y) {
    // prev/next are assigned by the caller before any read, so the null init is cast away here
    return /** @type {Node} */ (/** @type {unknown} */ ({
        i, // vertex index in coordinates array
        x, y, // vertex coordinates
        prev: null, // previous and next vertex nodes in a polygon ring
        next: null,
        z: 0, // z-order curve value; doubles as owning block in the hole-bridge index during eliminateHoles
        prevZ: null, // previous and next nodes in z-order
        nextZ: null
    }));
}

/**
 * Return the relative difference between the polygon area and the area of its triangulation —
 * a value near 0 means a correct triangulation. Useful for verifying output in tests.
 *
 * @param {ArrayLike<number>} data
 * @param {ArrayLike<number> | null} holeIndices
 * @param {number} dim number of coordinates per vertex in `data`
 * @param {ArrayLike<number>} triangles output of {@link earcut}
 * @returns {number}
 * @example deviation(data, holes, dim, earcut(data, holes, dim)); // ~0 if correct
 */
function deviation(data, holeIndices, dim, triangles) {
    const hasHoles = holeIndices && holeIndices.length;
    const outerLen = hasHoles ? holeIndices[0] * dim : data.length;

    let polygonArea = Math.abs(signedArea(data, 0, outerLen, dim));
    if (hasHoles) {
        for (let i = 0, len = holeIndices.length; i < len; i++) {
            const start = holeIndices[i] * dim;
            const end = i < len - 1 ? holeIndices[i + 1] * dim : data.length;
            polygonArea -= Math.abs(signedArea(data, start, end, dim));
        }
    }

    let trianglesArea = 0;
    for (let i = 0; i < triangles.length; i += 3) {
        const a = triangles[i] * dim;
        const b = triangles[i + 1] * dim;
        const c = triangles[i + 2] * dim;
        trianglesArea += Math.abs(
            (data[a] - data[c]) * (data[b + 1] - data[a + 1]) -
            (data[a] - data[b]) * (data[c + 1] - data[a + 1]));
    }

    return polygonArea === 0 && trianglesArea === 0 ? 0 :
        Math.abs((trianglesArea - polygonArea) / polygonArea);
}

/** @param {ArrayLike<number>} data @param {number} start @param {number} end @param {number} dim @returns {number} */
function signedArea(data, start, end, dim) {
    let sum = 0;
    for (let i = start, j = end - dim; i < end; i += dim) {
        sum += (data[j] - data[i]) * (data[i + 1] + data[j + 1]);
        j = i;
    }
    return sum;
}

/**
 * Turn a polygon in multi-dimensional array form (e.g. as in GeoJSON) into the flat form Earcut accepts.
 *
 * @param {ReadonlyArray<ReadonlyArray<ArrayLike<number>>>} data array of rings; the first ring is the outer contour, the rest are holes
 * @returns {{vertices: number[], holes: number[], dimensions: number}}
 * @example const {vertices, holes, dimensions} = flatten(geojson.coordinates);
 */
function flatten(data) {
    const vertices = [];
    const holes = [];
    const dimensions = data[0][0].length;
    let holeIndex = 0;
    let prevLen = 0;

    for (const ring of data) {
        for (const p of ring) {
            for (let d = 0; d < dimensions; d++) vertices.push(p[d]);
        }
        if (prevLen) {
            holeIndex += prevLen;
            holes.push(holeIndex);
        }
        prevLen = ring.length;
    }
    return {vertices, holes, dimensions};
}

// Reusable module-level scratch for refine():
//   he      = twin half-edge of each edge, or -1 on the polygon boundary
//   hTable  = open-addressing hash, slot -> half-edge index, valid iff hStamp[slot] === gen
//   edgeStamp = pending-in-stack flag, cleared when the edge is popped
/** @type {Int32Array} */ let edgeStack;
/** @type {Int32Array} */ let he;
/** @type {Int32Array} */ let hTable;
/** @type {Uint32Array} */ let hStamp;
/** @type {Uint8Array} */ let edgeStamp;
let hMask = 0, gen = 0;

/**
 * Refine a triangulation toward the constrained Delaunay triangulation by legalizing every
 * interior edge in place with Lawson flips — maximizing the minimum angle and removing most
 * slivers. An optional post-pass for {@link earcut} output, or any manifold triangle-index array
 * indexing into `coords`. Adapted from delaunator's edge legalization.
 *
 * Uses non-robust predicates: float input is fine, and the worst case is a not-quite-Delaunay
 * edge, never an invalid mesh.
 *
 * @param {number[]} triangles triangle indices, as returned by {@link earcut}; mutated in place
 * @param {ArrayLike<number>} coords the flat vertex coordinates passed to {@link earcut}
 * @param {number} [dim=2] number of coordinates per vertex in `coords`
 * @example refine(earcut(data), data);
 */
function refine(triangles, coords, dim = 2) {
    const t = triangles;
    const n = t.length;
    if (n < 6) return;
    ensureScratch(n);
    gen++;              // bumping the generation logically empties the hash (no clearing)
    he.fill(-1, 0, n);

    // Build half-edge twins with an undirected-edge hash; consumed slots mark linked pairs. As each
    // pair is linked we seed the stack with one representative (s, the earlier-inserted edge) — this
    // fuses the initial "push every interior edge" pass into the build, saving a full O(n) scan.
    // edgeStamp is all-zero here (balanced push/pop leaves it clean) and each pair links once, so
    // the seed write needs no dedup guard.
    let i = 0;
    for (let e = 0; e < n; e++) {
        const a = t[e], b = t[nextHE(e)];
        const lo = a < b ? a : b, hi = a < b ? b : a;
        let h = (Math.imul(lo, 0x9e3779b1) ^ Math.imul(hi, 0x85ebca6b)) & hMask;
        while (hStamp[h] === gen) {
            const s = hTable[h];
            // s === -1 marks a consumed slot (a pair already linked) — skip past it
            if (s !== -1) {
                const sa = t[s], sb = t[nextHE(s)];
                if ((sa === lo && sb === hi) || (sa === hi && sb === lo)) {
                    he[e] = s; he[s] = e; hTable[h] = -1; // link, then consume the slot
                    edgeStamp[s] = 1; edgeStack[i++] = s; // seed the interior edge for the cascade
                    break;
                }
            }
            h = (h + 1) & hMask;
        }
        if (hStamp[h] !== gen) { hTable[h] = e; hStamp[h] = gen; } // first occurrence: insert
    }

    while (i > 0) {
        const a = edgeStack[--i];
        edgeStamp[a] = 0;
        const b = he[a];
        if (b === -1) continue;

        const a0 = a - a % 3;
        const b0 = b - b % 3;
        const ar = a0 + (a + 2) % 3;
        const al = a0 + (a + 1) % 3;
        const bl = b0 + (b + 2) % 3;
        const br = b0 + (b + 1) % 3;
        const p0 = t[ar], pr = t[a], pl = t[al], p1 = t[bl];

        const x0 = coords[p0 * dim], y0 = coords[p0 * dim + 1];
        const xr = coords[pr * dim], yr = coords[pr * dim + 1];
        const xl = coords[pl * dim], yl = coords[pl * dim + 1];
        const x1 = coords[p1 * dim], y1 = coords[p1 * dim + 1];

        // Test inCircle first: most interior edges are already Delaunay (inCircle true → no flip),
        // so this short-circuits before the two convexity orients on the common path. The quad must
        // also be convex (both new triangles CCW) — flipping a reflex quad would push a triangle
        // outside the polygon. Boundary/hole edges need no guard — they self-protect via he === -1.
        if (!inCircle(x0, y0, xr, yr, xl, yl, x1, y1) &&
            orient(x0, y0, xr, yr, x1, y1) > 0 && orient(x0, y0, x1, y1, xl, yl) > 0) {
            t[a] = p1; t[b] = p0;
            const hbl = he[bl], har = he[ar];
            he[a] = hbl; if (hbl !== -1) he[hbl] = a;
            he[b] = har; if (har !== -1) he[har] = b;
            he[ar] = bl; he[bl] = ar;

            // re-check the quad's four outer edges; skip boundary edges (he === -1) and any
            // already queued (edgeStamp), which also keeps the stack bounded by n.
            if (hbl    !== -1 && edgeStamp[a]  === 0) { edgeStamp[a]  = 1; edgeStack[i++] = a; }
            if (har    !== -1 && edgeStamp[b]  === 0) { edgeStamp[b]  = 1; edgeStack[i++] = b; }
            if (he[al] !== -1 && edgeStamp[al] === 0) { edgeStamp[al] = 1; edgeStack[i++] = al; }
            if (he[br] !== -1 && edgeStamp[br] === 0) { edgeStamp[br] = 1; edgeStack[i++] = br; }
        }
    }
}

/** @param {number} ax @param {number} ay @param {number} bx @param {number} by @param {number} cx @param {number} cy */
function orient(ax, ay, bx, by, cx, cy) {
    return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

// Whether p is inside or exactly on the circumcircle of triangle (a, b, c). Sign is negated vs the
// usual predicate to match earcut's CCW winding — the standard sign would build the anti-Delaunay
// mesh. Cocircular quads are legal ties, so refine only flips when this returns false.
/** @param {number} ax @param {number} ay @param {number} bx @param {number} by @param {number} cx @param {number} cy @param {number} px @param {number} py */
function inCircle(ax, ay, bx, by, cx, cy, px, py) {
    const dx = ax - px, dy = ay - py, ex = bx - px, ey = by - py, fx = cx - px, fy = cy - py;
    const ap = dx * dx + dy * dy, bp = ex * ex + ey * ey, cp = fx * fx + fy * fy;
    // A near-cocircular quad is a legal Delaunay tie, but roundoff can flag both an edge and its
    // flip as illegal, cascading into an endless flip loop (#205) — so treat a determinant within
    // a small margin of zero as a tie. The determinant's worst-case roundoff error is provably
    // below 9e-16·(ap + bp + cp)² (Shewchuk-style bound), so the margin guarantees every executed
    // flip is illegal in exact arithmetic, and Lawson flipping always terminates.
    const s = ap + bp + cp;
    return dx * (ey * cp - bp * fy) - dy * (ex * cp - bp * fx) + ap * (ex * fy - ey * fx) <= 1e-13 * s * s;
}

/** @param {number} e */
function nextHE(e) { // next half-edge within the same triangle
    return e - e % 3 + (e + 1) % 3;
}

// Grow the scratch arrays on demand (like earcut's z-order arrays). Allocating lazily here rather
// than at module load lets the whole refine() block tree-shake away for callers who don't use it.
/** @param {number} n */
function ensureScratch(n) {
    // edgeStack holds at most one entry per half-edge (edgeStamp dedups), so n is a safe cap —
    // sizing it up front lets the cascade push without a bounds/grow check.
    if (!edgeStack || edgeStack.length < n) edgeStack = new Int32Array(n);
    if (!he || he.length < n) he = new Int32Array(n);
    if (!edgeStamp || edgeStamp.length < n) edgeStamp = new Uint8Array(n);
    let size = 1;
    while (size < n * 4) size <<= 1; // power-of-two table, load factor <= 0.25
    if (!hTable || hTable.length < size) { hTable = new Int32Array(size); hStamp = new Uint32Array(size); }
    hMask = size - 1;
}

/* ---------------- PolygonSpread ---------------- */
/* ------------------------------------------------------------------------
 * PolygonSpread core — geometry preparation + DTS wrapper
 *
 * The UE side (BP_PolygonSpread) is a decal whose mask is drawn from the
 * triangles sent here; the "flood" distance field is relaxed on the GPU from
 * the seeds sent here. So the payload is small: triangles + seeds + 2 numbers.
 *
 * Canonical texture space sent to UE: square box of side `size` metres centred
 * on the actor, u = east (0 = west edge), v = south (0 = north edge).
 * --------------------------------------------------------------------- */

var BP_ASSET = '/JC_CustomAssets/ObjectLibrary/Exhibition/PolygonSpreadV1/BP_PolygonSpread_V1';

var PT = { Bool: 0, Int32: 2, Float: 3, Color: 6, FloatArray: 15 };

/* ---------- WGS84 -> UTM (fallback when the DTS project has no CRS set) ---------- */
function utmZoneOf(lon) { return Math.floor((lon + 180) / 6) + 1; }

function lonLatToUTM(lon, lat, zone) {
  var a = 6378137.0, f = 1 / 298.257223563, k0 = 0.9996;
  var e2 = f * (2 - f), ep2 = e2 / (1 - e2);
  var lon0 = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180;
  var phi = lat * Math.PI / 180, lam = lon * Math.PI / 180;
  var N = a / Math.sqrt(1 - e2 * Math.sin(phi) * Math.sin(phi));
  var T = Math.tan(phi) * Math.tan(phi);
  var C = ep2 * Math.cos(phi) * Math.cos(phi);
  var A = Math.cos(phi) * (lam - lon0);
  var e4 = e2 * e2, e6 = e4 * e2;
  var M = a * ((1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * phi
    - (3 * e2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * phi)
    + (15 * e4 / 256 + 45 * e6 / 1024) * Math.sin(4 * phi)
    - (35 * e6 / 3072) * Math.sin(6 * phi));
  var x = k0 * N * (A + (1 - T + C) * Math.pow(A, 3) / 6
    + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * Math.pow(A, 5) / 120) + 500000;
  var y = k0 * (M + N * Math.tan(phi) * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * Math.pow(A, 4) / 24
    + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * Math.pow(A, 6) / 720));
  if (lat < 0) y += 10000000;
  return [x, y];
}

/* ---------- GeoJSON -> list of features, each { polygons: [ [ring, ...], ... ], properties } ---------- */
function cleanRing(ring) {
  var out = [];
  for (var i = 0; i < ring.length; i++) {
    var p = ring[i], q = out[out.length - 1];
    if (!q || q[0] !== p[0] || q[1] !== p[1]) out.push([+p[0], +p[1]]);
  }
  if (out.length > 1) {
    var f0 = out[0], fl = out[out.length - 1];
    if (f0[0] === fl[0] && f0[1] === fl[1]) out.pop();
  }
  return out;
}

function geometryPolygons(g) {
  if (!g) return [];
  if (g.type === 'Polygon') return [g.coordinates.map(cleanRing)];
  if (g.type === 'MultiPolygon') return g.coordinates.map(function (p) { return p.map(cleanRing); });
  if (g.type === 'GeometryCollection') {
    var all = [];
    g.geometries.forEach(function (s) { all = all.concat(geometryPolygons(s)); });
    return all;
  }
  return [];
}

function extractFeatures(input) {
  if (!input) return [];
  if (typeof input === 'string') input = JSON.parse(input);
  if (input.type === 'FeatureCollection') {
    return input.features.map(function (f) {
      return { polygons: geometryPolygons(f.geometry), properties: f.properties || {} };
    }).filter(function (f) { return f.polygons.length; });
  }
  if (input.type === 'Feature') return [{ polygons: geometryPolygons(input.geometry), properties: input.properties || {} }];
  return [{ polygons: geometryPolygons(input), properties: {} }];
}

/* ---------- raster helpers ---------- */
function segDist2(px, py, ax, ay, bx, by) {
  var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  var t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : (t > 1 ? 1 : t);
  var qx = ax + t * dx - px, qy = ay + t * dy - py;
  return qx * qx + qy * qy;
}

// even-odd inside test + signed distance (metres, + inside) at the centres of a G x G grid.
// Grid cell (i, j): column i from west, row j from north.
function sdfGrid(rings, x0, yTop, size, G) {
  var cell = size / G, inside = new Uint8Array(G * G), sdf = new Float32Array(G * G);
  var edges = [];
  rings.forEach(function (r) {
    for (var k = 0; k < r.length; k++) {
      var a = r[k], b = r[(k + 1) % r.length];
      edges.push(a[0], a[1], b[0], b[1]);
    }
  });
  var E = edges.length / 4, xs = [];
  for (var j = 0; j < G; j++) {
    var y = yTop - (j + 0.5) * cell;
    xs.length = 0;
    for (var e = 0; e < E; e++) {
      var ay = edges[4 * e + 1], by = edges[4 * e + 3];
      if ((ay > y) !== (by > y)) {
        var ax = edges[4 * e], bx = edges[4 * e + 2];
        xs.push(ax + (y - ay) / (by - ay) * (bx - ax));
      }
    }
    xs.sort(function (p, q) { return p - q; });
    for (var s = 0; s + 1 < xs.length; s += 2) {
      var i0 = Math.max(0, Math.ceil((xs[s] - x0) / cell - 0.5));
      var i1 = Math.min(G - 1, Math.floor((xs[s + 1] - x0) / cell - 0.5));
      for (var i = i0; i <= i1; i++) inside[j * G + i] = 1;
    }
  }
  for (var jj = 0; jj < G; jj++) {
    var cy = yTop - (jj + 0.5) * cell;
    for (var ii = 0; ii < G; ii++) {
      var cx = x0 + (ii + 0.5) * cell, best = Infinity;
      for (var e2 = 0; e2 < E; e2++) {
        var d2 = segDist2(cx, cy, edges[4 * e2], edges[4 * e2 + 1], edges[4 * e2 + 2], edges[4 * e2 + 3]);
        if (d2 < best) best = d2;
      }
      var d = Math.sqrt(best);
      sdf[jj * G + ii] = inside[jj * G + ii] ? d : -d;
    }
  }
  return { inside: inside, sdf: sdf };
}

// Dijkstra over the same 5x5 neighbourhood the GPU relaxation uses (outside cells cost `outsideCost`).
// Returns distances in cells.
function geodesic(inside, G, seeds, outsideCost) {
  var N = G * G, dist = new Float64Array(N).fill(Infinity);
  var offs = [];
  for (var oy = -2; oy <= 2; oy++) for (var ox = -2; ox <= 2; ox++) {
    if (ox || oy) offs.push([ox, oy, Math.sqrt(ox * ox + oy * oy)]);
  }
  var heap = [], hd = [];
  function push(n, d) {
    heap.push(n); hd.push(d);
    var k = heap.length - 1;
    while (k > 0) {
      var p = (k - 1) >> 1;
      if (hd[p] <= hd[k]) break;
      var tn = heap[p]; heap[p] = heap[k]; heap[k] = tn;
      var td = hd[p]; hd[p] = hd[k]; hd[k] = td; k = p;
    }
  }
  function pop() {
    var n = heap[0], d = hd[0], ln = heap.pop(), ld = hd.pop();
    if (heap.length) {
      heap[0] = ln; hd[0] = ld;
      var k = 0;
      for (;;) {
        var l = 2 * k + 1, r = l + 1, m = k;
        if (l < heap.length && hd[l] < hd[m]) m = l;
        if (r < heap.length && hd[r] < hd[m]) m = r;
        if (m === k) break;
        var tn = heap[m]; heap[m] = heap[k]; heap[k] = tn;
        var td = hd[m]; hd[m] = hd[k]; hd[k] = td; k = m;
      }
    }
    return [n, d];
  }
  seeds.forEach(function (s) {
    var n = s[1] * G + s[0];
    if (s[2] < dist[n]) { dist[n] = s[2]; push(n, s[2]); }
  });
  while (heap.length) {
    var t = pop(), n = t[0], d = t[1];
    if (d > dist[n]) continue;
    var x = n % G, y = (n - x) / G;
    for (var k = 0; k < offs.length; k++) {
      var nx = x + offs[k][0], ny = y + offs[k][1];
      if (nx < 0 || ny < 0 || nx >= G || ny >= G) continue;
      // the GPU pass weighs a step by the cost of the cell it writes to; mirror that
      var m = ny * G + nx, nd = d + offs[k][2] * (inside[m] ? 1 : outsideCost);
      if (nd < dist[m]) { dist[m] = nd; push(m, nd); }
    }
  }
  return dist;
}

/**
 * prepare(polygons, opts)
 *   polygons : [ [ outerRing, hole, ... ], ... ] in projected metres (x east, y north)
 *   opts.origins    : [[x, y], ...] projected metres (optional; default = deepest interior point)
 *   opts.margin     : metres of border around the shape (default: 4% of extent, >= 40 m)
 *   opts.grid       : grid size used for the estimate (default 128)
 *   opts.outsideCost: must match the UE material (default 8)
 * returns { center:[x,y], size, triangles:number[], seeds:number[], maxDistance, stats }
 */
function prepare(polygons, opts) {
  opts = opts || {};
  var G = opts.grid || 128, outsideCost = opts.outsideCost || 8;
  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, rings = [];
  polygons.forEach(function (poly) {
    poly.forEach(function (r) {
      if (r.length < 3) return;
      rings.push(r);
      r.forEach(function (p) {
        if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
        if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
      });
    });
  });
  if (!rings.length) throw new Error('PolygonSpread: no polygon rings');
  var ext = Math.max(maxX - minX, maxY - minY);
  var margin = opts.margin != null ? opts.margin : Math.max(40, ext * 0.04);
  var size = ext + 2 * margin;
  var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  var x0 = cx - size / 2, yTop = cy + size / 2;
  function U(x) { return (x - x0) / size; }
  function V(y) { return (yTop - y) / size; }

  // mask triangles (earcut per polygon, local metres for numerical safety)
  var tris = [], triCount = 0;
  polygons.forEach(function (poly) {
    var flat = [], holes = [];
    poly.forEach(function (r, k) {
      if (r.length < 3) return;
      if (k > 0) holes.push(flat.length / 2);
      r.forEach(function (p) { flat.push(p[0] - cx, p[1] - cy); });
    });
    if (flat.length < 6) return;
    var idx = earcut(flat, holes.length ? holes : null, 2);
    for (var t = 0; t < idx.length; t++) {
      var vx = flat[2 * idx[t]] + cx, vy = flat[2 * idx[t] + 1] + cy;
      tris.push(round5(U(vx)), round5(V(vy)));
    }
    triCount += idx.length / 3;
  });

  // interior analysis on a coarse grid (origin + duration estimate)
  var cell = size / G, S = sdfGrid(rings, x0, yTop, size, G);
  var seedsCells = [];
  var origins = opts.origins && opts.origins.length ? opts.origins : null;
  if (!origins) {
    var bi = 0;
    for (var n = 1; n < G * G; n++) if (S.sdf[n] > S.sdf[bi]) bi = n;
    var bx = bi % G, by = (bi - bx) / G;
    origins = [[x0 + (bx + 0.5) * cell, yTop - (by + 0.5) * cell]];
  }
  var seeds = [];
  origins.forEach(function (o) {
    var i = Math.min(G - 1, Math.max(0, Math.floor((o[0] - x0) / cell)));
    var j = Math.min(G - 1, Math.max(0, Math.floor((yTop - o[1]) / cell)));
    var ox = o[0], oy = o[1];
    if (!S.inside[j * G + i]) {           // snap an outside origin to the nearest inside cell
      var best = -1, bd = Infinity;
      for (var m = 0; m < G * G; m++) if (S.inside[m]) {
        var mi = m % G, mj = (m - mi) / G, dd = (mi - i) * (mi - i) + (mj - j) * (mj - j);
        if (dd < bd) { bd = dd; best = m; }
      }
      if (best >= 0) {
        i = best % G; j = (best - i) / G;
        ox = x0 + (i + 0.5) * cell; oy = yTop - (j + 0.5) * cell;
      }
    }
    seedsCells.push([i, j, 0]);
    seeds.push(round5(U(ox)), round5(V(oy)), 0);
  });
  var dist = geodesic(S.inside, G, seedsCells, outsideCost), maxD = 0, reached = 0, total = 0;
  for (var q = 0; q < G * G; q++) if (S.inside[q]) {
    total++;
    if (isFinite(dist[q])) { reached++; if (dist[q] > maxD) maxD = dist[q]; }
  }
  var maxDistance = Math.max(maxD * cell, cell * 4);
  return {
    center: [cx, cy], size: size,
    triangles: tris, seeds: seeds, maxDistance: Math.round(maxDistance * 10) / 10,
    field: opts.returnField ? Array.prototype.filter.call(dist, function (v, i) { return S.inside[i] === 1; }).map(function (v) { return v * cell; }) : undefined,
    stats: { triangles: triCount, rings: rings.length, grid: G, cell: cell, insideCells: total, reachedCells: reached, origins: origins }
  };
}

function round5(v) { return Math.round(v * 100000) / 100000; }

/* ---------- DTS wrapper ---------- */
function PolygonSpread(api, options) {
  if (!(this instanceof PolygonSpread)) return new PolygonSpread(api, options);
  options = options || {};
  this.api = api;
  this.pakFilePath = options.pakFilePath || '';      // empty: the PAK is already mounted (Content/Paks or reloadPak)
  this.assetPath = options.assetPath || BP_ASSET;
  this.projection = options.projection || 'dts';   // 'dts' = fdapi.coord.gcs2pcs, 'utm' = built-in, or function([lon,lat]) -> [x,y]
  this.offset = options.offset || [0, 0];          // added after the built-in / custom projection
  this.z = options.z || 0;
  // DTS spawns a CustomObject with yaw -90 (local +X = north, +Y = east); 'ue' = no rotation (+X = east, +Y = south)
  this.frame = options.frame || 'dts';
  this.items = {};
}

PolygonSpread.prepare = prepare;
PolygonSpread.extractFeatures = extractFeatures;
PolygonSpread.lonLatToUTM = lonLatToUTM;
PolygonSpread.BP_ASSET = BP_ASSET;

// canonical (u east, v south) -> texture space of the decal inside the spawned actor
function toFrame(arr, stride, frame) {
  if (frame !== 'dts') return arr;
  var out = arr.slice();
  for (var i = 0; i + 1 < arr.length; i += stride) {
    out[i] = round5(1 - arr[i + 1]);
    out[i + 1] = arr[i];
  }
  return out;
}
PolygonSpread.toFrame = toFrame;

PolygonSpread.prototype._call = function (id, fn, params) {
  var co = this.api.customObject;
  if (typeof co.callFunction === 'function') return co.callFunction(id, fn, undefined, undefined, params || []);
  return co.callBPFunction([{ id: id, functionName: fn, parameters: params || [] }]);
};

PolygonSpread.prototype._project = async function (pts, coordinateType) {
  var self = this;
  if (coordinateType === 0) return pts.map(function (p) { return [p[0], p[1]]; });
  var proj = this.projection;
  if (typeof proj === 'function') {
    return pts.map(function (p) { var q = proj(p); return [q[0] + self.offset[0], q[1] + self.offset[1]]; });
  }
  if (proj === 'dts' && this.api && this.api.coord && this.api.coord.gcs2pcs) {
    try {
      var res = await this.api.coord.gcs2pcs(pts.map(function (p) { return [p[0], p[1], 0]; }), 1);
      var arr = res && (res.coordinates || res.data || res.result);
      if (Array.isArray(arr) && arr.length === pts.length && Array.isArray(arr[0])) {
        return arr.map(function (q) { return [+q[0], +q[1]]; });
      }
      console.warn('[PolygonSpread] gcs2pcs returned an unexpected result, falling back to UTM', res);
    } catch (e) {
      console.warn('[PolygonSpread] gcs2pcs failed (is the project CRS set?), falling back to UTM', e);
    }
  }
  var zone = utmZoneOf(pts[0][0]);
  return pts.map(function (p) { var q = lonLatToUTM(p[0], p[1], zone); return [q[0] + self.offset[0], q[1] + self.offset[1]]; });
};

function pickFeatures(features, opts) {
  if (opts.filter) return features.filter(function (f, i) { return opts.filter(f.properties, i); });
  if (opts.category != null) {
    return features.filter(function (f) {
      var p = f.properties;
      return p.category === opts.category || p.categoryLabel === opts.category;
    });
  }
  if (opts.featureIndex != null) return [features[opts.featureIndex]].filter(Boolean);
  return features;
}

/**
 * add(id, geojson, options)
 *   options.category / featureIndex / filter(props, i) : which feature(s) to use (default: all, merged)
 *   options.coordinateType : 1 = WGS84 lon/lat (default), 0 = already projected
 *   options.origins   : [[lon, lat], ...] flood start points (default: property origin_lon/lat, else deepest point)
 *   options.duration  : seconds (default 4)
 *   options.autoPlay  : default true
 *   options.color     : [r, g, b, a] linear 0..1 (default cyan)
 *   options.opacity   : fill opacity (default 0.45)
 *   options.glow      : glow intensity multiplier (default 1; raise for bright daylight scenes)
 *   options.z         : height of the decal centre (projection box is +-600 m)
 */
PolygonSpread.prototype.add = async function (id, geojson, options) {
  options = options || {};
  var feats = pickFeatures(extractFeatures(geojson), options);
  if (!feats.length) throw new Error('PolygonSpread: no matching feature');
  var ct = options.coordinateType == null ? 1 : options.coordinateType;

  var polys = [], flat = [];
  feats.forEach(function (f) { f.polygons.forEach(function (p) { polys.push(p); p.forEach(function (r) { r.forEach(function (c) { flat.push(c); }); }); }); });
  var originsIn = options.origins;
  if (!originsIn) {
    originsIn = feats.map(function (f) { return f.properties; })
      .filter(function (p) { return p.origin_lon != null && p.origin_lat != null; })
      .map(function (p) { return [p.origin_lon, p.origin_lat]; });
  }
  var projected = await this._project(flat.concat(originsIn || []), ct);
  var k = 0;
  var pPolys = polys.map(function (p) { return p.map(function (r) { return r.map(function () { return projected[k++]; }); }); });
  var pOrigins = projected.slice(k);

  var prep = prepare(pPolys, { origins: pOrigins, margin: options.margin });
  var z = options.z != null ? options.z : this.z;
  var co = this.api.customObject;
  if (this.items[id]) await co.delete(id);
  await co.add({
    id: id, assetPath: this.assetPath,
    location: [prep.center[0], prep.center[1], z], coordinateType: 0,
    rotation: [0, 0, 0], localRotation: [0, 0, 0], scale: [1, 1, 1],
    range: [0, 1000000], enableDecal: false, collision: false, visible: true, autoHeight: false,
    ...(this.pakFilePath ? { pakFilePath: this.pakFilePath } : {})
  });
  this.items[id] = prep;

  if (options.color) await this.setColor(id, options.color);
  if (options.opacity != null) await this.setOpacity(id, options.opacity);
  if (options.glow != null) await this.setGlow(id, options.glow);
  if (options.style) await this.setStyle(id, options.style);
  var dur = options.duration || 4;
  await this._call(id, 'Play', [{ paramType: PT.Float, paramValue: dur }]);   // sets the duration only (no data yet)
  await this._call(id, 'SetPolygon', [
    { paramType: PT.FloatArray, paramValue: toFrame(prep.triangles, 2, this.frame) },
    { paramType: PT.FloatArray, paramValue: toFrame(prep.seeds, 3, this.frame) },
    { paramType: PT.Float, paramValue: prep.size },
    { paramType: PT.Float, paramValue: prep.maxDistance },
    { paramType: PT.Bool, paramValue: options.autoPlay !== false }
  ]);
  return prep;
};

PolygonSpread.prototype.play = function (id, duration) { return this._call(id, 'Play', [{ paramType: PT.Float, paramValue: duration || 4 }]); };
PolygonSpread.prototype.pause = function (id) { return this._call(id, 'Pause'); };
PolygonSpread.prototype.resume = function (id) { return this._call(id, 'Resume'); };
PolygonSpread.prototype.reset = function (id) { return this._call(id, 'Reset'); };
PolygonSpread.prototype.showFinal = function (id) { return this._call(id, 'ShowFinal'); };
PolygonSpread.prototype.setProgress = function (id, p) { return this._call(id, 'SetProgress', [{ paramType: PT.Float, paramValue: p }]); };
PolygonSpread.prototype.setColor = function (id, c) { return this._call(id, 'SetColor', [{ paramType: PT.Color, paramValue: c }]); };
PolygonSpread.prototype.setOpacity = function (id, o) { return this._call(id, 'SetOpacity', [{ paramType: PT.Float, paramValue: o }]); };
PolygonSpread.prototype.setGlow = function (id, g) { return this._call(id, 'SetGlow', [{ paramType: PT.Float, paramValue: g }]); };
PolygonSpread.STYLE = { frontWidth: 0.045, noiseAmount: 0.03, noiseScale: 2.5, edgeWidth: 1.6 };
/**
 * Set the front width, ragged-edge amount, noise tile count and outline width (all four are sent; omitted ones keep the last value).
 * @param {string} id object id
 * @param {{frontWidth?: number, noiseAmount?: number, noiseScale?: number, edgeWidth?: number}} style style fields
 * @returns {Promise<unknown>} SDK reply
 */
PolygonSpread.prototype.setStyle = function (id, style) {
  var item = this.items[id] || (this.items[id] = {});
  var s = item.style = Object.assign({}, PolygonSpread.STYLE, item.style, style);  // remembered so partial updates work
  return this._call(id, 'SetStyle', [s.frontWidth, s.noiseAmount, s.noiseScale, s.edgeWidth].map(function (v) { return { paramType: PT.Float, paramValue: v }; }));
};
PolygonSpread.prototype.focus = function (id, distance, flyTime) { return this.api.customObject.focus(id, distance || 0, flyTime == null ? 2 : flyTime); };
PolygonSpread.prototype.remove = async function (id) { delete this.items[id]; return this.api.customObject.delete(id); };
PolygonSpread.prototype.clear = async function () {
  var ids = Object.keys(this.items);
  this.items = {};
  if (ids.length) return this.api.customObject.delete(ids);
};

return PolygonSpread;
}));
