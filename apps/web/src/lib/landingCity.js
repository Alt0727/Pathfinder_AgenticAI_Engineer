/*
  landingCity.js
  City data for the landing page skyline (copied from the landing spec), plus
  helpers that turn it into SVG paths. The data is in a 1440 × 240 space where
  y = 240 is the horizon line the buildings stand on; the helpers take the
  skyline's real pixel size and stretch the data to it (like
  preserveAspectRatio="none", but with lines that stay 1px and draw in cleanly).
*/

// [x, width, height] in viewBox units (240 tall)
export const BUILDINGS = [[40,120,70],[120,60,140],[190,90,95],[290,50,170],[350,80,120],[440,110,80],[560,70,190],[640,95,130],[745,60,210],[815,85,150],[910,120,100],[1040,70,175],[1120,90,125],[1220,60,155],[1290,100,90],[1400,40,60]]
export const NOTCH_EVERY = 3 // buildings 0, 3, 6, 9… get a rooftop notch
export const EDGES = [[0,1],[1,3],[3,4],[3,6],[6,8],[8,9],[8,11],[11,13],[13,15],[2,3],[6,7],[11,12]]
export const SIGNAL_ROUTE = [1,3,6,8,11] // building indices the signal travels across

const NOTCH = 14 // rooftop notch height

const hasNotch = (i) => i % NOTCH_EVERY === 0

// Open outline of building i: up the left wall, across the roof (with a notch), down the right wall.
// sx, sy: pixels per data unit
export function buildingPath(i, sx, sy) {
  const [x, w, h] = BUILDINGS[i]
  const X = (v) => (v * sx).toFixed(1)
  const Y = (v) => (v * sy).toFixed(1)
  const y = 240 - h
  if (!hasNotch(i)) return `M${X(x)} ${Y(240)} L${X(x)} ${Y(y)} L${X(x + w)} ${Y(y)} L${X(x + w)} ${Y(240)}`
  const a = x + w * 0.35
  const b = x + w * 0.55
  const top = y - NOTCH
  return `M${X(x)} ${Y(240)} L${X(x)} ${Y(y)} L${X(a)} ${Y(y)} L${X(a)} ${Y(top)} L${X(b)} ${Y(top)} L${X(b)} ${Y(y)} L${X(x + w)} ${Y(y)} L${X(x + w)} ${Y(240)}`
}

// Where the rooftop network attaches to building i (the notch top when there is one), in pixels
export function roofPoint(i, sx, sy) {
  const [x, w, h] = BUILDINGS[i]
  const y = 240 - h
  const [px, py] = hasNotch(i) ? [x + w * 0.45, y - NOTCH] : [x + w / 2, y]
  return [px * sx, py * sy]
}
