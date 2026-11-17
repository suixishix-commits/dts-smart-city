/**
 * 模拟摄像头画面：从路灯杆高度斜看一条道路，车道上有车流、人行道上有行人。
 * 布局（道路朝向、车道数、车流密度、两侧楼宇）由摄像头编号决定，同一路摄像头每次打开都一样；
 * 运动只取决于时间，所以多个窗口看同一路摄像头时画面同步。
 */

export interface FeedScene {
  /** 画一帧，t 为秒 */
  draw(canvas: HTMLCanvasElement, t: number): void
}

/** 以字符串为种子的确定性伪随机数序列 */
export function seeded(seed: string): () => number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

/** 车身颜色：监控画面偏灰，只留少量彩色车 */
const CAR_COLORS = ['#d8dde3', '#c9ced4', '#8f969e', '#5b6168', '#2f3439', '#e9ecef', '#7d8a99', '#a5574f', '#3f5f86']

interface Mover {
  lane: number
  offset: number
  speed: number
  color: string
  /** 朝镜头开来（true）还是离开 */
  toward: boolean
  size: number
}

interface Layout {
  lanes: number
  /** 消失点的横向位置，0–1 */
  vanish: number
  horizon: number
  cars: Mover[]
  walkers: Mover[]
  buildings: { x: number; w: number; h: number; tone: number }[]
}

/** 按摄像头编号生成画面布局（纯函数，便于测试） */
export function feedLayout(cameraId: string): Layout {
  const rnd = seeded(cameraId)
  const lanes = 2 + Math.floor(rnd() * 3) // 2–4 条车道
  const cars = Array.from({ length: 6 + Math.floor(rnd() * 8) }, () => {
    const lane = Math.floor(rnd() * lanes)
    return { lane, offset: rnd(), speed: 0.05 + rnd() * 0.06, color: CAR_COLORS[Math.floor(rnd() * CAR_COLORS.length)], toward: lane < lanes / 2, size: 0.9 + rnd() * 0.5 }
  })
  const walkers = Array.from({ length: 4 + Math.floor(rnd() * 8) }, () => ({ lane: rnd() < 0.5 ? -1 : lanes, offset: rnd(), speed: 0.008 + rnd() * 0.01, color: '#b9c0c8', toward: rnd() < 0.5, size: 1 }))
  const buildings: Layout['buildings'] = []
  for (let x = 0; x < 1; ) {
    const w = 0.05 + rnd() * 0.12
    buildings.push({ x, w, h: 0.08 + rnd() * 0.2, tone: 0.18 + rnd() * 0.14 })
    x += w + rnd() * 0.02
  }
  return { lanes, vanish: 0.35 + rnd() * 0.3, horizon: 0.3 + rnd() * 0.08, cars, walkers, buildings }
}

const grey = (v: number) => {
  const c = Math.round(v * 255)
  return `rgb(${c},${c + 3},${c + 7})`
}

/** 创建一路摄像头的模拟画面。width / height 为画布像素尺寸 */
export function createFeedScene(cameraId: string, width: number, height: number): FeedScene {
  const L = feedLayout(cameraId)
  const W = width
  const H = height
  const hy = H * L.horizon
  const vx = W * L.vanish
  // 路面在画面底边的宽度：比画面略宽，看起来像从路边斜看
  const roadBottom = W * 1.3
  const roadLeft = vx - roadBottom * (0.35 + L.vanish * 0.3)
  /** 深度 p（0 地平线 → 1 画面底边）处，横向比例 u（0 路左沿 → 1 路右沿）的屏幕坐标 */
  const at = (u: number, p: number) => [vx + (roadLeft + roadBottom * u - vx) * p, hy + (H - hy) * p]

  // 静态背景只画一次
  const bg = document.createElement('canvas')
  bg.width = W
  bg.height = H
  const g = bg.getContext('2d') as CanvasRenderingContext2D
  const sky = g.createLinearGradient(0, 0, 0, hy)
  sky.addColorStop(0, '#5d6873')
  sky.addColorStop(1, '#8a939c')
  g.fillStyle = sky
  g.fillRect(0, 0, W, hy)
  L.buildings.forEach(b => {
    g.fillStyle = grey(b.tone)
    g.fillRect(b.x * W, hy - b.h * H, b.w * W, b.h * H + 1)
  })
  g.fillStyle = '#3b4148'
  g.fillRect(0, hy, W, H - hy)
  // 人行道
  const quad = (u0: number, u1: number, color: string) => {
    const [ax, ay] = at(u0, 0)
    const [bx, by] = at(u1, 0)
    const [cx, cy] = at(u1, 1)
    const [dx, dy] = at(u0, 1)
    g.fillStyle = color
    g.beginPath()
    g.moveTo(ax, ay)
    g.lineTo(bx, by)
    g.lineTo(cx, cy)
    g.lineTo(dx, dy)
    g.closePath()
    g.fill()
  }
  quad(-0.18, 0, '#6b727a')
  quad(1, 1.18, '#6b727a')
  quad(0, 1, '#2c3136')
  // 车道线：中线双黄，其余白色虚线
  g.lineWidth = Math.max(1, W / 320)
  for (let i = 1; i < L.lanes; i++) {
    const u = i / L.lanes
    const center = i === Math.floor(L.lanes / 2)
    g.strokeStyle = center ? '#b8a25a' : '#9aa0a6'
    g.setLineDash(center ? [] : [W / 40, W / 30])
    const [x0, y0] = at(u, 0.02)
    const [x1, y1] = at(u, 1)
    g.beginPath()
    g.moveTo(x0, y0)
    g.lineTo(x1, y1)
    g.stroke()
  }
  g.setLineDash([])
  // 暗角
  const vignette = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.75)
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, 'rgba(0,0,0,0.45)')

  return {
    draw(canvas, t) {
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(bg, 0, 0)
      // 远处的先画，近处的盖在上面
      const items = [...L.cars.map(c => ({ c, car: true })), ...L.walkers.map(c => ({ c, car: false }))]
        .map(({ c, car }) => {
          const phase = (((c.offset + c.speed * t) % 1) + 1) % 1
          const s = c.toward ? phase : 1 - phase
          return { c, car, p: 0.04 + s * s * 0.96 }
        })
        .sort((a, b) => a.p - b.p)
      items.forEach(({ c, car, p }) => {
        if (car) {
          const u = (c.lane + 0.5) / L.lanes
          const [x, y] = at(u, p)
          const w = (roadBottom / L.lanes) * 0.55 * p * c.size
          const h = w * 0.62
          ctx.fillStyle = 'rgba(0,0,0,0.35)'
          ctx.fillRect(x - w / 2, y - h * 0.15, w, h * 0.3)
          ctx.fillStyle = c.color
          ctx.fillRect(x - w / 2, y - h, w, h)
          ctx.fillStyle = 'rgba(20,26,32,0.75)'
          ctx.fillRect(x - w * 0.38, y - h * 0.92, w * 0.76, h * 0.32)
          // 朝镜头的车亮大灯，离开的亮尾灯
          ctx.fillStyle = c.toward ? '#f4f1dc' : '#d65a4f'
          const lw = Math.max(1, w * 0.12)
          ctx.fillRect(x - w * 0.45, y - h * 0.3, lw, lw * 0.6)
          ctx.fillRect(x + w * 0.45 - lw, y - h * 0.3, lw, lw * 0.6)
        } else {
          const u = c.lane < 0 ? -0.09 : 1.09
          const [x, y] = at(u + (c.offset - 0.5) * 0.06, p)
          const h = H * 0.09 * p
          ctx.fillStyle = c.color
          ctx.fillRect(x - h * 0.15, y - h, h * 0.3, h)
        }
      })
      ctx.fillStyle = vignette
      ctx.fillRect(0, 0, W, H)
      // 轻微噪点
      ctx.fillStyle = 'rgba(255,255,255,0.05)'
      for (let i = 0; i < 40; i++) ctx.fillRect(((i * 7919 + t * 997) % W) | 0, ((i * 104729 + t * 613) % H) | 0, 1, 1)
    }
  }
}

/** 离线摄像头：灰色雪花 */
export function drawNoSignal(canvas: HTMLCanvasElement, t = 0): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const { width: W, height: H } = canvas
  ctx.fillStyle = '#0b0f14'
  ctx.fillRect(0, 0, W, H)
  const rnd = seeded('snow' + Math.floor(t * 12))
  const cell = Math.max(2, Math.round(W / 120))
  for (let y = 0; y < H; y += cell) {
    for (let x = 0; x < W; x += cell) {
      const v = rnd()
      if (v > 0.55) {
        ctx.fillStyle = `rgba(150,160,170,${(v - 0.55) * 0.5})`
        ctx.fillRect(x, y, cell, cell)
      }
    }
  }
}
