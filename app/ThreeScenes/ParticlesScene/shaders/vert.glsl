#pragma glslify: simplexNoise4d = require(../../functions/simplexNoise4d.glsl);

// uniform float uNoisePeriod;
// uniform float uNoiseSpeed;
// uniform float uNoiseStrength;
uniform float uSize;

attribute float aScale;

void main() {

    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    
    gl_Position = projectedPosition;

    // Pointsize
    gl_PointSize = uSize * aScale * (100.0 / -viewPosition.z);
}