import { describe, expect, it } from 'vitest'
import { focusView } from '../kit'
import { cameraAt, isTopDown, rotated, toggledTopDown, viewTarget, zoomed } from '../viewControl'

const home = [225780, 2698610, 9600, -38, -38]
const near = (a: number[], b: number[], tol = 1) => a.forEach((v, i) => expect(Math.abs(v - b[i])).toBeLessThan(tol))

describe('viewControl', () => {
  it('finds the ground point the camera looks at (inverse of focusView)', () => {
    const p = [230000, 2705000]
    const cam = focusView(p, 3000)
    near(viewTarget(cam).target, p)
  })

  it('rebuilds the same camera from its target and distance', () => {
    const { target, distance } = viewTarget(home)
    near(cameraAt(target, distance, home[3], home[4]), home)
  })

  it('zooms toward the target and keeps looking at it', () => {
    const z = zoomed(home, 0.5)
    near(viewTarget(z).target, viewTarget(home).target)
    expect(z[2]).toBeCloseTo(home[2] / 2, 0)
    expect(z[3]).toBe(home[3])
  })

  it('clamps the height when zooming too far', () => {
    expect(zoomed(home, 0.001)[2]).toBeCloseTo(150, 0)
    expect(zoomed(home, 1000)[2]).toBeCloseTo(30000, 0)
  })

  it('rotates around the target and wraps the yaw', () => {
    const r = rotated(home, 45)
    near(viewTarget(r).target, viewTarget(home).target)
    expect(r[4]).toBe(7)
    expect(rotated([0, 0, 1000, -45, 170], 45)[4]).toBe(-145)
  })

  it('switches between top-down and tilted views over the same point', () => {
    const top = toggledTopDown(home)
    expect(isTopDown(top)).toBe(true)
    near(viewTarget(top).target, viewTarget(home).target)
    const back = toggledTopDown(top)
    expect(isTopDown(back)).toBe(false)
    expect(back[3]).toBe(-38)
    near(viewTarget(back).target, viewTarget(home).target)
  })
})
