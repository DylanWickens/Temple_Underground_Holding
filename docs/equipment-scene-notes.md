# EquipmentScene — record of the stripped version

The OP-XY rendered as a drifting point cloud, pinned behind the Equipment list
and tumbling on scroll. Removed on 2026-08-28 so the choreography and CSS can be
rebuilt by hand. Everything below is what the deleted version did, so nothing has
to be reverse-engineered from memory.

**What was deleted:** `app/ThreeScenes/EquipmentScene/` (one 553-line component +
two shaders), and the `<EquipmentScene />` wiring in `app/page.tsx`.
**What was kept:** `public/models/opxy.ply` (2.2 MB, binary PLY, ~184k verts,
positions only, 26.677 units across its longest axis).

---

## 1. The shape of it

One file, in reading order: CONFIG → DEBUG → GEOMETRY → MATERIAL → SCENE →
CANVAS. Worth keeping — the numbers all lived at the top, the debug panel wrote
straight into live uniforms, and nothing had to be hunted for.

The DOM was **three siblings inside one wrapper**, not a canvas with a track of
its own:

```jsx
<div className="relative w-full" style={{ marginBottom: `-${SCROLL.overlapVh}vh` }}>
  <div ref={pinnedRef}
       className="pointer-events-none sticky top-0 z-0 h-[100dvh] w-full overflow-hidden">
    {shouldMount ? <Canvas .../> : null}
  </div>

  {/* pure scroll distance — how far you scroll to complete the tumble */}
  <div ref={spacerRef} aria-hidden className="w-full" style={{ height: `${SCROLL.tumbleVh}vh` }} />

  {/* the stretch the list rides over the model before the pin releases */}
  <div aria-hidden className="w-full" style={{ height: `${SCROLL.overlapVh}vh` }} />
</div>
```

And in `page.tsx`, the wrapper that owned the pin contained **both** the scene
and the list — that is what kept the canvas stuck behind the list rather than
scrolling away on its own:

```jsx
<div className="relative flex w-full flex-col items-center">
  <EquipmentScene />
  <section className="relative z-10 md:max-w-[1440px] ... pt-128">
    {/* SectionTitle + equipment lists */}
  </section>
</div>
```

---

## 2. The choreography (the part worth re-deriving)

**Rotation is a pure function of scroll position, never accumulated.**

```js
const progress = clamp01((pinHeight - spacerRect.top) / spacerRect.height);
spin.rotation.x = ease(progress) * Math.PI * 2 * Math.round(SCROLL.turns);
```

Assigning rather than accumulating is what gives it its character: it stops dead
the instant the user stops, runs backwards when they scroll up, and can't drift
out of sync. `ease = t => t * t * (3 - 2 * t)` (smoothstep) has zero slope at
both ends, so it eases out of rest and back into it — and because `ease(0)=0`,
`ease(1)=1` and turns are rounded to whole numbers, progress 1 always lands
exactly back on the resting pose. Smootherstep `t*t*t*(t*(t*6-15)+10)` for a
gentler ramp. `rotation.y` instead of `.x` for a turntable rather than a tumble.

**Progress was measured off the spacer, not the canvas.** Once the canvas is
pinned its own rect stops moving, so reading it freezes at one value. The spacer
starts one pinned-height below the top of the block, which is why `pinHeight` is
the zero point.

**The negative bottom margin is the whole trick for the overlap.** The overlap
spacer creates the scroll distance; `marginBottom: -overlapVh` cancels it out of
the flow, pulling the list up by that much so it rides over the still-pinned
model. Then the container ends, the pin releases, and both scroll away together.

Numbers that were tuned in: `tumbleVh: 88`, `overlapVh: 65`, `turns: 1`.
Nothing ever scaled — the only other motion was the shader's noise drift.

**CSS gotchas that cost time:**

- `<main>` must be `overflow-x-clip`, **not** `overflow-x-hidden`.
  `hidden` forces `overflow-y: auto`, which makes main a scroll container and
  silently kills `position: sticky` inside it.
- `pointer-events-none` on the pinned container, plus
  `style={{ pointerEvents: "inherit" }}` on `<Canvas>`. R3F hard-codes
  `pointerEvents: "auto"` inline on its own wrapper div, so `inherit` is the
  only way to hand control back and stop the canvas swallowing clicks meant for
  the list.
- `z-0` on the pin, `z-10` on the list section.
- `h-[100dvh]`, not `100vh`, for mobile browser chrome.

---

## 3. Camera — locked composition at every viewport

The camera stays on `CAMERA.position`'s sightline but sits at whatever distance
makes the model span a fixed fraction of the viewport **width**:

```js
const vFov = (CAMERA.fov * Math.PI) / 180;
const aspect = size.width / size.height;
const distance = MODEL.size / CAMERA.fillWidth / (2 * Math.tan(vFov / 2) * aspect);
camera.position.copy(target).add(offset.setLength(distance));
camera.lookAt(target);
```

Locking the visible world width means every world-space value maps to the same
fraction of the frame on every screen — so `MODEL.position.x = -0.4802` keeps
its deliberate bleed off the left edge on a phone and a 27" display alike. Ran
per frame (a few multiplies, no layout read), so resizes and debug sliders both
took effect immediately. Vectors were hoisted to module scope to avoid
per-frame allocation.

```js
const CAMERA = {
  position: [0, 1.9, 2],   // direction only — distance is always computed
  target: [0, 0, 0],
  fov: 45, near: 0.001, far: 1000,
  fillWidth: 1.0255,       // >1 = deliberately bleeds off left and right edges
};
const MODEL = {
  size: 2,                 // longest axis in world units
  rotation: [0, 0, 0],     // Polycam Z-up exports need [-Math.PI/2, 0, 0]
  position: [-0.4802, 0, 0],
};
```

**Point size had to track viewport height,** or density changed between screens:

```js
uSize = PARTICLES.size * dpr * (viewportHeight / REFERENCE_HEIGHT)  // REFERENCE_HEIGHT = 1077
```

Derived: point size goes as `uSize / distance`, and distance goes as
`height / width`, so `uSize` must track height for points to stay proportional
to the model.

---

## 4. Geometry

Raw PLY → centred, uniformly scaled cloud carrying just `position` + `aScale`.

```js
geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
geometry.center();                                    // also refreshes boundingBox
geometry.boundingBox.getSize(size);
const scale = targetSize / Math.max(size.x, size.y, size.z);
geometry.scale(scale, scale, scale);
```

- Orientation was deliberately **not** baked in — it was a prop on the group, so
  it stayed live without re-parsing 184k verts.
- `aScale` used a hashed per-index random, not `Math.random()`: a plain random
  reshuffles every point's size on a StrictMode double-render.
  ```js
  let h = (i + 1) | 0; h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
  return (h >>> 0) / 4294967295;
  ```
- `useMemo` on the build, `useEffect` cleanup calling `geometry.dispose()`.

---

## 5. Shaders (verbatim — this was the hand-authored part)

`vert.glsl` — noise drift wanders each point in place:

```glsl
#pragma glslify: simplexNoise4d = require(../../functions/simplexNoise4d.glsl)

uniform float uSize;
uniform float uTime;
uniform float uNoisePeriod;
uniform float uNoiseSpeed;
uniform float uNoiseStrength;

attribute float aScale;

void main () {
    vec3 noiseSample = position * uNoisePeriod;

    float noiseX = simplexNoise4d(vec4(noiseSample + 0.0,  uTime * uNoiseSpeed));
    float noiseY = simplexNoise4d(vec4(noiseSample + 17.3, uTime * uNoiseSpeed));
    float noiseZ = simplexNoise4d(vec4(noiseSample + 43.1, uTime * uNoiseSpeed));

    vec3 noiseOffset = vec3(noiseX, noiseY, noiseZ) * uNoiseStrength * aScale;
    vec3 displacedPosition = position + noiseOffset;

    vec4 modelPosition = modelMatrix * vec4(displacedPosition, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    gl_Position = projectionMatrix * viewPosition;

    gl_PointSize = uSize * aScale;
    gl_PointSize *= aScale / -viewPosition.z;
}
```

Note the three offsets (`0.0 / 17.3 / 43.1`) — decorrelates the axes so points
wander rather than sliding along a diagonal. `aScale` is applied twice to point
size, which is deliberate: it skews the distribution hard toward small points.

`frag.glsl` — a soft round dot, aggressively discarded:

```glsl
void main () {
    float d = distance(gl_PointCoord, vec2(0.5));
    if (d > 0.5) discard;

    float strength = 0.9 - d;
    strength = pow(max(strength, 0.0), 10.0);
    if (strength < 0.01) discard;

    gl_FragColor = vec4(vec3(strength), strength);
}
```

`pow(..., 10.0)` is what makes the falloff tight and glinty rather than a blur.
The early discards matter at 184k points with additive blending.

Material flags: `transparent`, `depthWrite={false}`,
`blending={THREE.AdditiveBlending}`. No lights in the scene — the shader writes
`gl_FragColor` directly and never reads one.

```js
const PARTICLES = {
  size: 28.21,          // at REFERENCE_HEIGHT; scales with viewport
  noisePeriod: 13.4,    // spatial frequency — higher is finer/grainier
  noiseSpeed: 0.53,     // how fast the drift churns
  noiseStrength: 0.011, // how far a point wanders from true position
};
```

`extend({ EquipmentParticles })` writes into a **global** catalogue — the key
has to stay unique across the app. FooterScene owns `particlesMaterial`,
ParticlesScene owns `particlesShader`.

---

## 6. Post-processing

```js
const POST = {
  bloomIntensity: 2.96,
  bloomThreshold: 0.01,   // luminance below this doesn't bloom
  bloomSmoothing: 0,      // softness of that threshold's edge
  grainOpacity: 0.5,
};
```

Effects were constructed **by hand** and dropped in as `<primitive object={...} />`,
never as `<Bloom>` / `<Noise>` / `<ToneMapping>`:

```js
new BloomEffect({ blendFunction: BlendFunction.ADD, intensity, luminanceThreshold, luminanceSmoothing })
new NoiseEffect({ blendFunction: BlendFunction.OVERLAY })   // .blendMode.opacity.value = grainOpacity
new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC })
```

**This is not optional.** Those drei/postprocessing wrappers `JSON.stringify`
their own props to memoise constructor args. Under React 19 `ref` arrives as a
plain prop, so a ref'd effect makes that walk
`BloomEffect → luminancePass → scene → children[0].parent` and throw on the
cycle. Owning the instances also lets debug sliders mutate them in place instead
of rebuilding an effect every tick. Memoised, and disposed in a cleanup.

`<EffectComposer multisampling={0}>`. On the canvas:
`gl.setClearColor(0x000000, 0)` and `gl.toneMapping = THREE.NoToneMapping` —
the composer's ToneMappingEffect owns tone mapping, and R3F defaults to
ACESFilmic, which would otherwise apply it twice.

---

## 7. Mount / perf

The PLY is the heaviest asset on the page, so it must not load early.

```js
const observer = new IntersectionObserver(([entry]) => {
  setInView(entry.isIntersecting);
  if (entry.isIntersecting) setShouldMount(true);   // latches — never unmounts
}, { rootMargin: "25%" });
observer.observe(pinnedRef.current);
```

Mount on approach with a 25% margin, then `frameloop={inView ? "always" : "never"}`
to park the render loop when it scrolls away. `dpr={[1, 2]}`,
`gl={{ antialias: true, alpha: true }}`, `<Suspense fallback={null}>` around the
loader.

---

## 8. Debug panel

`const DEBUG = process.env.NODE_ENV === "development"` and lil-gui imported
dynamically inside a `useEffect`, so it never reaches the production bundle.
Sliders wrote straight into live uniforms / transforms / effect instances —
nothing re-parsed, nothing reconstructed. A "Log config" button printed the
whole CONFIG block back out as pasteable source, which is how every number above
was found. Folders: Model (fillWidth, rot XYZ, pos XYZ), Particles (size,
strength, speed, frequency), Scroll (turns, stepped to whole numbers only — a
fractional turn leaves the model tilted), Post (bloom, threshold, smoothing,
grain).

Rebuilding this early pays for itself.
