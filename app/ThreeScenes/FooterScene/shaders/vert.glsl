#pragma glslify: simplexNoise4d = require(../../functions/simplexNoise4d.glsl)

uniform float uSize;
uniform float uTime;

uniform float uNoisePeriod;
uniform float uNoiseSpeed;
uniform float uNoiseFreq;
uniform float uNoiseStrength;

uniform float uSinElevation;
uniform float uSinSpeed;
uniform float uSinFreq;

attribute float aScale;

void main () {

    vec3 pos = position;
    vec4 modelPosition = modelMatrix * vec4(pos, 1.0);

    float x = modelPosition.x;
    float z = modelPosition.z;

    float wave1 = sin( x + z * 0.35 ) * uSinElevation;
    float wave2 = sin( x * 2.1 - z * 0.6 ) * uSinElevation * 0.173;

    float noise = simplexNoise4d(vec4(x * uNoiseFreq, z * (uNoiseFreq * 0.4), uTime * uNoiseSpeed, 0.0));
    float crest = smoothstep(0.0, 0.35, wave1 + wave2); 

    float y = wave1 + wave2 + noise * uNoiseStrength * crest;
    
    vec3 finalPos = vec3(pos.x + y, pos.y + y , pos.z + y);


    modelPosition = modelMatrix * vec4(finalPos, 1.0);


    vec4 viewPosition = viewMatrix * modelPosition;
    gl_Position = projectionMatrix * viewPosition;

    gl_PointSize = uSize * aScale * (1.0 / -viewPosition.z);
}
