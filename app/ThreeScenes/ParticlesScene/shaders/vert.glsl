#pragma glslify: simplexNoise4d = require(../../functions/simplexNoise4d.glsl);

uniform float uTime;
uniform float uNoisePeriod;
uniform float uNoiseSpeed;
uniform float uNoiseStrength;
uniform float uSize;

// Scroll lift. Centre and radius are in NDC so the band tracks the viewport centre.
uniform float uLift;
uniform vec2 uLiftCenter;
uniform vec2 uLiftRadius;
uniform float uLiftPower;
uniform float uLiftGlow;
// View-space distance where the lift starts, and the ramp width after it.
uniform float uLiftNear;
uniform float uLiftFade;
uniform float uLiftVariance;
uniform float uLiftScatter;
uniform float uLiftSize;
// NDC y where the top-edge fade starts; fully transparent at the canvas edge (1.0).
uniform float uEdgeFadeStart;

// Pointer brush, in NDC like the lift band. uHoverRadius is aspect-corrected on
// the CPU so the brush reads as a circle on screen rather than an ellipse.
uniform vec2 uPointer;
uniform vec2 uHoverRadius;
uniform float uHoverStrength;
uniform float uHoverSize;
uniform float uHoverPower;

attribute float aScale;

varying float vGlow;
varying float vEdgeFade;

void main() {

    vec3 noiseSample = position * uNoisePeriod;

    float noiseX = simplexNoise4d(vec4(noiseSample + 0.0, uTime * uNoiseSpeed));
    float noiseY = simplexNoise4d(vec4(noiseSample + 17.3, uTime * uNoiseSpeed));
    float noiseZ = simplexNoise4d(vec4(noiseSample + 43.1, uTime * uNoiseSpeed));

    vec3 noiseOffset = vec3(noiseX, noiseY, noiseZ) * uNoiseStrength * aScale;
    vec3 displacedPosition = position + noiseOffset;

    // Where the UNDISPLACED point lands on screen. Testing the noise-displaced
    // position instead makes the band edge boil as the noise animates.
    vec4 baseView = modelViewMatrix * vec4(position, 1.0);
    vec4 baseClip = projectionMatrix * baseView;
    vec2 ndc = baseClip.xy / baseClip.w;
    vec2 q = (ndc - uLiftCenter) / uLiftRadius;
    float falloff = 1.0 - smoothstep(0.0, 1.0, length(q));
    // Points behind the camera project to a mirrored ndc; never lift those.
    falloff = baseClip.w > 0.0 ? pow(falloff, uLiftPower) : 0.0;
    // Hold the foreground still: only points beyond uLiftNear lift.
    falloff *= smoothstep(uLiftNear, uLiftNear + uLiftFade, -baseView.z);

    // Pointer brush. Reuses the same undisplaced ndc as the lift, for the same
    // reason: measuring from the noise-displaced position makes the edge boil.
    vec2 hoverQ = (ndc - uPointer) / uHoverRadius;
    float hover = 1.0 - smoothstep(0.0, 1.0, length(hoverQ));
    hover = baseClip.w > 0.0 ? pow(hover, uHoverPower) * uHoverStrength : 0.0;

    // Lift is along model Y. The Landscape node has an identity transform, so this
    // is also world Y; revisit if the points are ever rotated or scaled.
    // Lifted particles drift rather than rising as a rigid sheet: per-particle
    // height variance, plus a lateral scatter that reuses the animated noise so
    // it swirls as it rises. Both scale with the lift, so at rest nothing moves.
    float lift = falloff * uLift * mix(1.0 - uLiftVariance, 1.0 + uLiftVariance, aScale);
    displacedPosition.y += lift;
    displacedPosition.xz += vec2(noiseX, noiseZ) * lift * uLiftScatter;
    vGlow = falloff * uLiftGlow;

    vec4 modelPosition = modelMatrix * vec4(displacedPosition, 1.0);

    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    
    gl_Position = projectedPosition;

    // The footer canvas is overflow-hidden, so lifted points would otherwise be
    // cut off in a hard line at its top edge. Dissolve them before they get there.
    vEdgeFade = 1.0 - smoothstep(uEdgeFadeStart, 1.0, projectedPosition.y / projectedPosition.w);

    // Pointsize
    // Lifted particles grow with the lift; uLiftSize is already scaled by progress.
    // The hover brush is a second, independent factor, so the two compose.
    gl_PointSize = uSize * aScale * (100.0 / -viewPosition.z)
        * (1.0 + falloff * uLiftSize)
        * (1.0 + hover * uHoverSize);
}
