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

attribute float aScale;

varying float vGlow;

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

    // Pointsize
    // Lifted particles grow with the lift; uLiftSize is already scaled by progress.
    gl_PointSize = uSize * aScale * (100.0 / -viewPosition.z) * (1.0 + falloff * uLiftSize);
}
