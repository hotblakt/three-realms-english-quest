export const width = 1220;
export const height = 890;
export const entrance = { x: 477, y: 766 };
export const chest = { x: 197, y: 416 };
export const spirit = { x: 920, y: 123 };
export const shortcut = { x: 1085, y: 260 };
export const bridge = { x: 675, y: 451 };

export function streamCenter(y: number): number {
  const bend = Math.min(1, Math.max(0, (y - 540) / 172));
  return bridge.x - (y - bridge.y) * .49 + 105 * bend * bend * (3 - 2 * bend);
}

// The deck crosses the stream east-west. Model only the water outside the deck.
export const waterWalls = [
  { from: 0, to: 429 },
  { from: 474, to: height },
];

export const routes = [
  [[465, 823], [477, 766], [496, 686], [515, 599], [560, 522], [596, 464], [622, 451], [728, 451], [783, 420], [816, 349], [850, 285], [876, 210], [920, 145]],
  [[515, 599], [439, 564], [368, 565], [310, 518], [258, 492], [223, 451], [197, 420]],
  [[850, 285], [931, 288], [1001, 304], [1085, 260]],
] as const;

type Prop = readonly [number, number, number, 'dense' | 'sparse' | 'underbrush' | 'rock-large' | 'rock-small'];
export const props: readonly Prop[] = [
  [90, 250, 1.16, 'dense'], [198, 269, .86, 'sparse'], [315, 306, 1.09, 'dense'],
  [442, 208, 1.04, 'dense'], [568, 275, 1.05, 'sparse'], [670, 220, 1.17, 'dense'],
  [105, 407, .9, 'dense'], [117, 463, .65, 'sparse'], [259, 397, .92, 'dense'],
  [293, 463, .8, 'rock-small'], [155, 490, .62, 'underbrush'], [356, 415, .75, 'underbrush'],
  [72, 561, .94, 'dense'], [268, 611, .92, 'dense'], [357, 528, .9, 'sparse'],
  [406, 485, .94, 'rock-large'], [498, 429, .68, 'sparse'], [532, 562, .56, 'underbrush'],
  [727, 613, .8, 'sparse'], [661, 635, .62, 'underbrush'], [612, 718, .88, 'dense'],
  [687, 794, .9, 'dense'], [361, 726, 1.08, 'dense'], [271, 780, .75, 'sparse'],
  [397, 825, .84, 'sparse'], [550, 829, .9, 'dense'], [168, 740, 1.2, 'dense'],
  [345, 652, .68, 'rock-large'], [569, 766, .75, 'rock-small'], [430, 684, .65, 'underbrush'],
  [746, 592, .85, 'dense'], [916, 636, 1.1, 'dense'], [1081, 587, .95, 'dense'],
  [1085, 478, .8, 'sparse'], [945, 470, 1.05, 'dense'], [863, 504, .78, 'underbrush'],
  [873, 406, .7, 'rock-large'], [763, 381, .51, 'rock-small'], [916, 364, .58, 'sparse'],
  [998, 373, .66, 'rock-large'], [1142, 350, .95, 'dense'], [1136, 231, .9, 'dense'],
  [1015, 240, .7, 'underbrush'], [989, 180, .72, 'rock-small'], [1046, 137, .9, 'sparse'],
  [1152, 131, 1.11, 'dense'], [818, 149, .85, 'dense'], [874, 76, .86, 'sparse'],
  [982, 69, .85, 'dense'], [1165, 760, 1.2, 'dense'], [1005, 783, 1.05, 'dense'],
  [836, 743, .8, 'sparse'], [38, 754, 1.2, 'dense'], [47, 127, 1.1, 'dense'],
];

export function bankSamples() {
  return Array.from({ length: Math.ceil(height / 8) + 1 }, (_, i) => {
    const y = i * 8;
    const bankEase = Math.min(1, Math.abs(y - bridge.y) / 98);
    const x = streamCenter(y) + bankEase * (5 * Math.sin(y / 41) + 3 * Math.sin(y / 16));
    return {
      y, x,
      west: 42 + bankEase * (5 * Math.sin(y / 32) + 4 * Math.cos(y / 13)),
      east: 42 + bankEase * (6 * Math.cos(y / 40) + 4 * Math.sin(y / 22)),
    };
  });
}

export function creekColliders() {
  return waterWalls.flatMap(({ from, to }) => {
    const result: { x: number; y: number; width: number; height: number }[] = [];
    for (let top = from; top < to; top += 22) {
      const segment = Math.min(22, to - top);
      const y = top + segment / 2;
      result.push({ x: streamCenter(y), y, width: 75, height: segment + 1 });
    }
    return result;
  });
}
