import type { ClientModule } from 'claude-code'

// The desktop's prompt edge, drawn in the app itself so it can move on the
// app's own frame clock: the gradient flows along the line, slowly while the
// session is idle, faster while it works, and fastest while it waits on the
// person (a permission prompt or a question).

export type EdgeStatus = 'idle' | 'working' | 'asking'
export type EdgeProps = { status: EdgeStatus }

// Milliseconds for one full trip of the colours: rose -> orchid -> cyan and
// back again.
export const PERIOD: Record<EdgeStatus, number> = { idle: 16000, working: 4000, asking: 1400 }
const TICK = 50
// Each tick closes a tenth of the gap to the new speed: about half a second
// to change pace, never a jump.
const EASE = 0.1

const STOPS = ['#a32c6a', '#91376d', '#236e84'] as const
const SEGMENTS = 32
export const THICKNESS = 0.1 // of a text row: a hairline
// Each end fades to clear over its last 6 cells, in 24 eased steps.
export const FADE = 6
export const FADE_STEPS = 24

const mix = (a: string, b: string, t: number) => {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16)
  const rgb = [0, 1, 2].map(i => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t))
  return '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('')
}

// Thecla's edge, t from 0 (rose) to 1 (cyan), orchid at 55%.
const gradient = (t: number) => {
  const [rose, orchid, cyan] = STOPS
  return t <= 0.55 ? mix(rose, orchid, t / 0.55) : mix(orchid, cyan, (t - 0.55) / 0.45)
}

// The colours as a loop, u from 0 to 1: out to cyan at 0.5 and back to rose,
// so it repeats with no seam.
const cycle = (u: number) => {
  const v = ((u % 1) + 1) % 1
  return gradient(v <= 0.5 ? v * 2 : (1 - v) * 2)
}

const rgba = (hex: string, alpha: number) => {
  const [r, g, b] = [0, 1, 2].map(i => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16))
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`
}
const ease = (t: number) => t * t * t * (t * (6 * t - 15) + 10)
// Alphas from the outer end inwards; the step at the edge is all but clear.
const FADE_ALPHAS = Array.from({ length: FADE_STEPS }, (_, i) => ease((i + 0.5) / FADE_STEPS))

// The line shows half the loop at once, so at phase 0 it runs rose to cyan,
// as the still edge does; the phase slides the loop along it.
export const edgeAt = (phase: number) =>
  Array.from({ length: SEGMENTS }, (_, i) => cycle(phase + i / (SEGMENTS - 1) / 2))

// Every segment, left to right: the fade in, the gradient, the fade out, each
// fade in its end's current colour.
export const frameAt = (phase: number) => {
  const edge = edgeAt(phase)
  return {
    fadeIn: FADE_ALPHAS.map(a => rgba(edge[0]!, a)),
    edge,
    fadeOut: [...FADE_ALPHAS].reverse().map(a => rgba(edge[edge.length - 1]!, a)),
  }
}

type Motion = { phase: number; rate: number }
// What the clock reads between draws: the status the hooks last sent.
type Live = { status: EdgeStatus }
type State = { motion: Motion; live: Live }

// One tick: ease the speed toward the status's, then move the phase on.
export const step = (motion: Motion, status: EdgeStatus): Motion => {
  const rate = motion.rate + (1 / PERIOD[status] - motion.rate) * EASE
  return { phase: (motion.phase + rate * TICK) % 1, rate }
}

const Edge: ClientModule<EdgeProps, State> = (props, surface) => {
  const { Box } = surface.elements
  let state = surface.state
  if (state === undefined) {
    state = { motion: { phase: 0, rate: 1 / PERIOD[props.status] }, live: { status: props.status } }
    surface.setState(state)
    surface.every(TICK, () => {
      const now = surface.state
      // Still for less motion; at rest with the window in the background,
      // unless it waits on the person.
      if (!now || surface.isMotionReduced) return
      if (!surface.isWindowFocused && now.live.status !== 'asking') return
      surface.setState({ ...now, motion: step(now.motion, now.live.status) })
    })
  }
  // A new status goes through setState, never into the state in place: the
  // app may hand the clock a copy, and a change made in place never reaches it.
  // A props change comes between renders, so this is no render loop.
  if (state.live.status !== props.status) {
    state = { ...state, live: { status: props.status } }
    surface.setState(state)
  }

  const { fadeIn, edge, fadeOut } = frameAt(surface.isMotionReduced ? 0 : state.motion.phase)
  const end = (color: string, key: string) => (
    <Box key={key} width={FADE / FADE_STEPS} flexShrink={0} height={THICKNESS} backgroundColor={color} />
  )
  return (
    <Box flexDirection="row" width="100%" height={THICKNESS}>
      {fadeIn.map((color, i) => end(color, `in${i}`))}
      {edge.map((color, i) => (
        <Box key={String(i)} flexGrow={1} height={THICKNESS} backgroundColor={color} />
      ))}
      {fadeOut.map((color, i) => end(color, `out${i}`))}
    </Box>
  )
}

export default Edge
