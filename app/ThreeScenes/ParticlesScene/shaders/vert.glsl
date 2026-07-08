#pragma glslify: simplexNoise4d = require(../../functions/simplexNoise4d.glsl);

void main() {

    vec4 modelPosition = modelMatrix * vec4(displacedPosition, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    gl_Position = projectionMatrix * viewPosition;

    // Pointsize
    gl_PointSize = uSize * aScale;
    gl_PointSize *= aScale / -viewPosition.z ;
}