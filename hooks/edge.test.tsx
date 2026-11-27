import { expect, test } from 'claude-code/testing'

import { EDGE } from './register.js'
import Edge, { edgeAt, frameAt, PERIOD, step } from './edge-client.js'

const { fadeIn: FADE_IN, fadeOut: FADE_OUT } = frameAt(0)

const BAND = { plugin: 'thecla-theme', component: 'AbovePrompt' } as const

const PROPS = {
  hasSurvey: false,
  isCollapsed: false,
  isWorking: false,
  maxRows: 4,
  bodyColumns: 80,
  scroll: { offset: 0, bodyRows: 24 },
  view: {},
}

const painted = async (ui: { findAll: (q: { type: string }) => Promise<{ props: Record<string, unknown> }[]> }) =>
  (await ui.findAll({ type: 'Box' })).some(b => b.props.backgroundColor === EDGE[0])

test('the edge runs rose to cyan', () => {
  expect(EDGE.length).toBe(32)
  expect(EDGE[0]).toBe('#a32c6a')
  expect(EDGE[EDGE.length - 1]).toBe('#236e84')
})

const BESIDE = { plugin: 'thecla-theme', component: 'BesidePrompt' } as const
const BESIDE_PROPS = { maxColumns: 20, floatRows: 10, floatColumns: 120, isWorking: false, view: {} }

test('mobile draws the edge in the band, idle or working', async $ => {
  for (const isWorking of [false, true]) {
    const ui = await $.ui.mount({ ...BAND, surface: 'mobile', props: { ...PROPS, isWorking } })
    const [row, ...segments] = await ui.findAll({ type: 'Box' })

    expect(row?.props.height).toBeLessThan(1)
    expect(segments.map(s => s.props.backgroundColor)).toEqual(EDGE)
    expect(await ui.find({ type: 'Text' })).toBeUndefined()
    await ui.unmount()
  }
})

test('the desktop band stays empty, so no panel draws', async $ => {
  const band = await $.ui.mount({ ...BAND, surface: 'desktop', props: PROPS })
  expect(await band.findAll({ type: 'Box' })).toEqual([])
  await band.unmount()
})

const clientOf = async (ui: { find: (q: { type: string }) => Promise<{ props: Record<string, unknown> } | undefined> }) =>
  (await ui.find({ type: 'Client' }))?.props

test('the desktop floats the edge on the message box, as wide as the band', async $ => {
  const band = await $.ui.mount({ ...BAND, surface: 'desktop', props: PROPS })
  await band.unmount()

  const ui = await $.ui.mount({ ...BESIDE, surface: 'desktop', props: BESIDE_PROPS })
  const boxes = await ui.findAll({ type: 'Box' })
  const at = boxes.findIndex(b => b.props.width === 0)
  const [cell, strip] = boxes.slice(at)

  expect(cell?.props.width).toBe(0)
  expect(strip?.props.position).toBe('absolute')
  expect(strip?.props.anchor).toBe('above')
  // 80 band columns fill a 93.2-cell box, which ends 1.15 cells short of the
  // cell; the line stops half a cell inside each end, in the corners
  expect(Math.abs(Number(strip?.props.right) - (1.15 + 0.5))).toBeLessThan(0.001)
  expect(Math.abs(Number(strip?.props.left) + (PROPS.bodyColumns * 1.136 + 2.3 + 1.15 - 0.5))).toBeLessThan(0.001)
  expect(strip?.props.height).toBeLessThan(1)

  // the app draws the line: at rest it is the still edge, faded at each end
  expect(String((await clientOf(ui))?.module).endsWith('edge-client.tsx')).toBe(true)
  const segments = await ui.findAll({ type: 'Box', in: 'edge' })
  expect(segments.slice(1).map(s => s.props.backgroundColor)).toEqual([...FADE_IN, ...EDGE, ...FADE_OUT])
  await ui.unmount()
})

test('at phase 0 the moving edge is the still one, and the phase moves it', () => {
  expect(edgeAt(0)).toEqual(EDGE)
  const later = edgeAt(0.25)
  expect(later).not.toEqual(EDGE)
  // a full loop comes back to where it began, with no seam
  expect(edgeAt(1)).toEqual(EDGE)
  // half a loop on, cyan has reached the left end
  expect(edgeAt(0.5)[0]).toBe('#236e84')
})

test('the edge runs slowest idle, faster working, fastest asking', () => {
  expect(PERIOD.idle).toBeGreaterThan(PERIOD.working)
  expect(PERIOD.working).toBeGreaterThan(PERIOD.asking)
  // the speed eases toward the new pace rather than jumping
  let motion = { phase: 0, rate: 1 / PERIOD.idle }
  motion = step(motion, 'asking')
  expect(motion.rate).toBeGreaterThan(1 / PERIOD.idle)
  expect(motion.rate).toBeLessThan(1 / PERIOD.asking)
  for (let i = 0; i < 100; i++) motion = step(motion, 'asking')
  expect(Math.abs(motion.rate - 1 / PERIOD.asking)).toBeLessThan(1e-6)
})

test('the line flows on the frame clock, and rests for less motion', async $ => {
  const ui = await $.ui.mount({ ...BESIDE, surface: 'desktop', props: { ...BESIDE_PROPS, isWorking: true } })
  const colours = async () => (await ui.findAll({ type: 'Box', in: 'edge' })).slice(1).map(s => s.props.backgroundColor)
  const first = await colours()
  await ui.advance(1000)
  const moved = await colours()
  expect(moved).not.toEqual(first)

  await ui.setMotionReduced(true)
  expect(await colours()).toEqual(first)
  await ui.unmount()
})

test('a change of status changes how fast the line flows', async $ => {
  const ui = await $.ui.mount({ ...BESIDE, surface: 'desktop', props: BESIDE_PROPS })
  const colours = async () => (await ui.findAll({ type: 'Box', in: 'edge' })).slice(1 + 24, 1 + 24 + 32).map(s => s.props.backgroundColor)

  // idle for a second, then working for a second, ticking as the client does
  let motion = { phase: 0, rate: 1 / PERIOD.idle }
  await ui.advance(1000)
  for (let i = 0; i < 20; i++) motion = step(motion, 'idle')
  expect(await colours()).toEqual(edgeAt(motion.phase))

  await ui.redraw({ ...BESIDE_PROPS, isWorking: true })
  await ui.advance(1000)
  for (let i = 0; i < 20; i++) motion = step(motion, 'working')
  // the working pace has taken over, well past where idle would have reached
  expect(motion.phase).toBeGreaterThan(0.1)
  expect(await colours()).toEqual(edgeAt(motion.phase))
  await ui.unmount()
})

test('a new status reaches the clock when the app hands out copies of the state', () => {
  // The app may give the client a fresh, read-only copy of its state on each
  // read, as one across a thread boundary would: a change made in place is
  // lost there, or throws.
  const freeze = <T,>(v: T): T => {
    if (v && typeof v === 'object') {
      for (const k of Object.keys(v)) freeze((v as Record<string, unknown>)[k])
      Object.freeze(v)
    }
    return v
  }
  let stored: unknown
  let tick = () => {}
  const surface = {
    elements: { Box: (p: unknown) => p },
    get state() {
      return stored === undefined ? undefined : freeze(JSON.parse(JSON.stringify(stored)))
    },
    setState: (next: unknown) => { stored = next },
    every: (_ms: number, fn: () => void) => { tick = fn; return () => {} },
    isWindowFocused: true,
    isMotionReduced: false,
    columns: 80,
    rows: 1,
    beneath: [],
  } as unknown as Parameters<typeof Edge>[1]

  Edge({ status: 'idle' }, surface)
  for (let i = 0; i < 20; i++) tick()
  Edge({ status: 'working' }, surface)
  for (let i = 0; i < 60; i++) tick()
  const now = stored as { motion: { rate: number }; live: { status: string } }
  expect(now.live.status).toBe('working')
  expect(Math.abs(now.motion.rate - 1 / PERIOD.working)).toBeLessThan(1e-5)
})

test('the edge says idle, working, or asking while the session waits on the person',async ($, on) => {
  // nothing beneath the plugins answers a notice in a test
  on('classic.Notification', () => ({}))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  const ui = await $.ui.mount({ ...BESIDE, surface: 'desktop', props: BESIDE_PROPS })
  expect((await clientOf(ui))?.props).toEqual({ status: 'idle' })

  await ui.redraw({ ...BESIDE_PROPS, isWorking: true })
  expect((await clientOf(ui))?.props).toEqual({ status: 'working' })

  // a plain idle notice is not a prompt
  await $.classic.Notification({ message: 'waiting', notification_type: 'idle_prompt' })
  await ui.redraw()
  expect((await clientOf(ui))?.props).toEqual({ status: 'working' })

  await $.classic.Notification({ message: 'needs permission', notification_type: 'permission_prompt' })
  await ui.redraw()
  expect((await clientOf(ui))?.props).toEqual({ status: 'asking' })

  // the person's answer ends it
  await $.prompt.submit({ text: 'yes', wait: false, origin: { kind: 'composer' } })
  await ui.redraw()
  expect((await clientOf(ui))?.props).toEqual({ status: 'working' })
  await ui.unmount()
})

test('the desktop edge fades out into the corners', () => {
  const alpha = (c: string) => Number(c.slice(c.lastIndexOf(',') + 1, -1))
  expect(FADE_IN.length).toBe(24)
  expect(FADE_IN.every(c => c.startsWith('rgba(163, 44, 106, '))).toBe(true)
  expect(FADE_OUT.every(c => c.startsWith('rgba(35, 110, 132, '))).toBe(true)
  // clear at each end, full where it meets the gradient, rising all the way
  expect(alpha(FADE_IN[0]!)).toBeLessThan(0.01)
  expect(alpha(FADE_IN[23]!)).toBeGreaterThan(0.99)
  expect(alpha(FADE_OUT[23]!)).toBeLessThan(0.01)
  expect(FADE_IN.every((c, i) => i === 0 || alpha(c) > alpha(FADE_IN[i - 1]!))).toBe(true)
})

test('before the band reports, the desktop takes the box from the pane', async $ => {
  // a fresh module, as after a reload: the float draws first
  const ui = await $.ui.mount({ ...BESIDE, surface: 'desktop', props: { ...BESIDE_PROPS, floatColumns: 102 } })
  const boxes = await ui.findAll({ type: 'Box' })
  const strip = boxes[boxes.findIndex(b => b.props.width === 0) + 1]
  expect(strip?.props.position).toBe('absolute')
  // a 102-cell pane holds a 95.45-cell box; the line stops half a cell inside each end
  const width = -Number(strip?.props.left) - Number(strip?.props.right)
  expect(Math.abs(width - (95.45 - 2 * 0.5))).toBeLessThan(0.001)
  await ui.unmount()
})

test('the terminal and a survey get no edge', async $ => {
  const terminal = await $.ui.mount({ ...BAND, surface: 'terminal', props: PROPS })
  expect(await painted(terminal)).toBe(false)
  await terminal.unmount()

  const beside = await $.ui.mount({ ...BESIDE, surface: 'terminal', props: BESIDE_PROPS })
  expect(await painted(beside)).toBe(false)
  await beside.unmount()

  const survey = await $.ui.mount({ ...BAND, surface: 'mobile', props: { ...PROPS, hasSurvey: true } })
  expect(await painted(survey)).toBe(false)
  await survey.unmount()
})
