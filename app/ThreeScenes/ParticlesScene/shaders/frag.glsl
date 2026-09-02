varying float vGlow;

void main () {
    float d = distance(gl_PointCoord, vec2(0.5));
    if (d > 0.5) discard;

    // Lifted particles brighten so Bloom picks them up.
    float strength = 0.9 - d + vGlow;

    strength = pow(max(strength, 0.0), 10.0);
    if (strength < 0.01) discard;

gl_FragColor = vec4(vec3(strength), strength);
}
