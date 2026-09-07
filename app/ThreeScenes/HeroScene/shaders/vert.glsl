#pragma glslify: simplexNoise4d = require(../../functions/simplexNoise4d.glsl);

uniform float uSize;
uniform float uTime;
uniform float uNoisePeriod;
uniform float uNoiseSpeed;
uniform float uNoiseStrength;

// Reveal: seconds since this cloud was first drawn, and the twinkle's shape.
uniform float uReveal;
uniform float uRevealDuration;
uniform float uRevealTwinkle;
uniform float uRevealFlash;

attribute float aScale;
attribute float aBirth;

varying float vReveal;

void main () {
    // Twinkle-in. Each point is born at aBirth * duration, then ramps up over the
    // twinkle length with a sin bump that overshoots to (1 + flash) before settling
    // at 1. Before birth the point is fully dark.
    float ramp = clamp((uReveal - aBirth * uRevealDuration) / uRevealTwinkle, 0.0, 1.0);
    vReveal = ramp * (1.0 + uRevealFlash * sin(ramp * 3.14159265));

    vec3 noiseSample = position * uNoisePeriod;

    float noiseX = simplexNoise4d(vec4(noiseSample + 0.0, uTime * uNoiseSpeed));
    float noiseY = simplexNoise4d(vec4(noiseSample + 17.3, uTime * uNoiseSpeed));
    float noiseZ = simplexNoise4d(vec4(noiseSample + 43.1, uTime * uNoiseSpeed));

    vec3 noiseOffset = vec3(noiseX, noiseY, noiseZ) * uNoiseStrength * aScale;
    vec3 displacedPosition = position + noiseOffset;

    vec4 modelPosition = modelMatrix * vec4(displacedPosition, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    gl_Position = projectionMatrix * viewPosition;

    // An unborn point is pushed outside the clip volume rather than drawn black: with
    // additive blending black is invisible anyway, but this also spares its fill.
    if (ramp <= 0.0) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);

    // Pointsize
    gl_PointSize = uSize * aScale;
    gl_PointSize *= aScale / -viewPosition.z ;
}
