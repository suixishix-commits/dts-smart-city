/* Demo and test regions for RegionDotFlow: a jittered lattice of districts whose borders are wiggly
 * polylines shared exactly by both neighbours (like regions exported from one dataset).
 * Coordinates are projected metres around a centre point.
 */
(function (global) {
  const PALETTE = Object.freeze(['#8b5cff', '#3d7bff', '#1ec8ff', '#2ee59d', '#f4d23c']); // legend: purple, blue, cyan, green, yellow
  // Showcase: L/T shapes (concave), R with a hole filled by X, M in two parts, N a 160 m strip, S a small parcel.
  const SHOWCASE = Object.freeze({
    cols: [620, 620, 620, 160, 620, 620, 620], // west to east, metres
    rows: [560, 560, 560, 160, 560, 560], // north to south, metres
    labels: ['AABNRRR', 'ACBNRXR', 'CCBNRRR', 'DDDSEEF', 'GDHHEFF', 'GGHMEMF'],
  });

  /**
   * Deterministic pseudo-random numbers (mulberry32).
   * @param {number} seed integer seed
   * @returns {() => number} generator of numbers in [0, 1)
   */
  const rng = seed => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); // mixing state
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  /**
   * Lattice partition: cells labelled with region ids, borders as wiggly polylines shared by both sides.
   * @param {object} options { center: [x, y], cols: widths (m), rows: heights (m, north first),
   *   labels: rows of ids (string = one char per cell, or array of ids; '.' = no region),
   *   wiggle = 0.05, segments = 10, jitter = 0.12, seed = 7 }
   * @returns {Array<{ id: string, rings: number[][][] }>} regions (rings even-odd)
   */
  const lattice = ({ center, cols, rows, labels, wiggle = 0.05, segments = 10, jitter = 0.12, seed = 7 }) => {
    const random = rng(seed); // node jitter
    const width = cols.reduce((a, b) => a + b, 0), height = rows.reduce((a, b) => a + b, 0); // extent
    const xs = cols.reduce((acc, w) => [...acc, acc[acc.length - 1] + w], [center[0] - width / 2]); // node columns
    const ys = rows.reduce((acc, h) => [...acc, acc[acc.length - 1] - h], [center[1] + height / 2]); // node rows (north first)
    const grid = labels.map(row => (typeof row === 'string' ? row.split('') : row)); // cell ids
    const nodes = xs.map((x, c) => ys.map((y, r) => {
      const dx = Math.min(cols[c - 1] ?? Infinity, cols[c] ?? Infinity), dy = Math.min(rows[r - 1] ?? Infinity, rows[r] ?? Infinity); // neighbour cell sizes
      return [x + (random() * 2 - 1) * jitter * dx, y + (random() * 2 - 1) * jitter * dy];
    })); // jittered nodes [c][r]
    const edges = new Map(); // "h:c:r" / "v:c:r" -> polyline from the lower-index node
    /**
     * Wiggly polyline between two nodes, deterministic per edge.
     * @param {number[]} a start node
     * @param {number[]} b end node
     * @param {number} edgeSeed seed of this edge
     * @returns {number[][]} points from a to b
     */
    const polyline = (a, b, edgeSeed) => {
      const r = rng(edgeSeed); // per-edge shape
      const [f1, f2, p1, p2] = [1 + Math.floor(r() * 2), 3 + Math.floor(r() * 2), r() * 6.283, r() * 6.283]; // frequencies and phases
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]); // edge length
      const [nx, ny] = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len]; // unit normal
      return Array.from({ length: segments + 1 }, (_, i) => {
        const t = i / segments; // position along the edge
        const o = wiggle * len * Math.sin(Math.PI * t) * (0.6 * Math.sin(6.283 * f1 * t + p1) + 0.4 * Math.sin(6.283 * f2 * t + p2)); // offset
        return [a[0] + (b[0] - a[0]) * t + nx * o, a[1] + (b[1] - a[1]) * t + ny * o];
      });
    };
    /**
     * Shared polyline of one lattice edge.
     * @param {'h'|'v'} kind horizontal (c,r)-(c+1,r) or vertical (c,r)-(c,r+1)
     * @param {number} c node column
     * @param {number} r node row
     * @returns {number[][]} points from node (c, r)
     */
    const edge = (kind, c, r) => {
      const key = `${kind}:${c}:${r}`; // edge key
      if (!edges.has(key)) edges.set(key, polyline(nodes[c][r], kind === 'h' ? nodes[c + 1][r] : nodes[c][r + 1], seed * 7919 + edges.size + c * 131 + r * 17 + (kind === 'h' ? 0 : 5003)));
      return edges.get(key);
    };
    const label = (c, r) => (grid[r] && grid[r][c] !== undefined ? grid[r][c] : '.'); // id of a cell or '.'
    const sides = new Map(); // id -> Map(start node key -> { to, points })
    grid.forEach((row, r) => row.forEach((id, c) => {
      if (id === '.') return;
      // Counter-clockwise (north up): SW -> SE -> NE -> NW.
      const around = [
        [label(c, r + 1), () => edge('h', c, r + 1), [c, r + 1], [c + 1, r + 1]],
        [label(c + 1, r), () => edge('v', c + 1, r).slice().reverse(), [c + 1, r + 1], [c + 1, r]],
        [label(c, r - 1), () => edge('h', c, r).slice().reverse(), [c + 1, r], [c, r]],
        [label(c - 1, r), () => edge('v', c, r), [c, r], [c, r + 1]],
      ]; // [neighbour id, side points, from node, to node]
      for (const [other, points, from, to] of around) {
        if (other === id) continue;
        if (!sides.has(id)) sides.set(id, new Map());
        sides.get(id).set(from.join(','), { to: to.join(','), points: points() });
      }
    }));
    return [...sides.entries()].map(([id, map]) => {
      const rings = []; // closed loops of this region
      while (map.size) {
        const [startKey] = map.keys(); // any unused side
        const ring = []; // loop points
        let key = startKey; // current node
        while (map.has(key)) {
          const side = map.get(key); // side leaving this node
          map.delete(key);
          ring.push(...side.points.slice(0, -1));
          key = side.to;
        }
        rings.push(ring);
      }
      return { id: String(id), rings };
    });
  };

  /**
   * Shoelace area of a region (even-odd, any orientation per ring is fine for lattice regions).
   * @param {number[][][]} rings region rings
   * @returns {number} area in square metres
   */
  const areaOf = rings => {
    const areas = rings.map(ring => Math.abs(ring.reduce((s, [x, y], i) => s + (x * ring[(i + 1) % ring.length][1] - ring[(i + 1) % ring.length][0] * y) / 2, 0))); // ring areas
    const outer = Math.max(...areas); // largest ring
    // Lattice regions: holes lie inside the largest ring; separate parts are other rings of similar standing.
    return areas.reduce((s, a, i) => s + (a === outer ? a : (rings.length > 1 && isInside(rings[areas.indexOf(outer)], rings[i][0]) ? -a : a)), 0);
  };

  /**
   * Even-odd point-in-ring test.
   * @param {number[][]} ring ring
   * @param {number[]} point [x, y]
   * @returns {boolean} true when inside
   */
  const isInside = (ring, [px, py]) => {
    let inside = false; // crossing parity
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      if ((ring[i][1] > py) !== (ring[j][1] > py) && px < ring[j][0] + ((py - ring[j][1]) * (ring[i][0] - ring[j][0])) / (ring[i][1] - ring[j][1])) inside = !inside;
    }
    return inside;
  };

  /**
   * Colour regions by area rank with the legend palette (small = purple ... large = yellow).
   * @param {Array<{ id: string, rings: number[][][] }>} regions regions
   * @returns {Array<{ id: string, rings: number[][][], color: string, areaKm2: number }>} coloured regions
   */
  const colorByArea = regions => {
    const withArea = regions.map(r => ({ ...r, areaKm2: areaOf(r.rings) / 1e6 })); // regions with area
    const sorted = withArea.map(r => r.areaKm2).sort((a, b) => a - b); // ranks
    return withArea.map(r => ({ ...r, color: PALETTE[Math.min(PALETTE.length - 1, Math.floor((sorted.indexOf(r.areaKm2) / sorted.length) * PALETTE.length))] }));
  };

  /**
   * The showcase districts around a centre.
   * @param {number[]} center [x, y] projected metres
   * @returns {object[]} coloured regions
   */
  const showcase = center => colorByArea(lattice({ center, ...SHOWCASE }));

  /**
   * An n x n grid of distinct districts for load tests.
   * @param {number[]} center [x, y] projected metres
   * @param {number} n cells per side
   * @param {number} [cell] cell size in metres
   * @returns {object[]} coloured regions
   */
  const grid = (center, n, cell = 400) => colorByArea(lattice({
    center, cols: Array(n).fill(cell), rows: Array(n).fill(cell),
    labels: Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => `g${r}_${c}`)), seed: 11,
  }));

  global.DemoRegions = { PALETTE, lattice, showcase, grid, colorByArea, areaOf };
})(typeof window !== 'undefined' ? window : globalThis);
