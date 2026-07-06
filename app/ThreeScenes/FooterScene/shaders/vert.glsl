#pragma glslify: simplexNoise4d = require(../../functions/simplexNoise4d.glsl)

uniform float uSize;
uniform float uTime;

attribute float aScale;

void main () {
    vec3 pos = position;

    // Animate the 4th simplex-noise axis with time to create flowing distortion.
    float noise = simplexNoise4d(vec4(pos * 2.0, uTime * 0.3));
    pos.z += noise * 0.4;

    vec4 modelPosition = modelMatrix * vec4(pos, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    gl_Position = projectionMatrix * viewPosition;

    gl_PointSize = uSize * aScale * (1.0 / -viewPosition.z);
}
