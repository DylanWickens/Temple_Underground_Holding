void main () {
    float d = distance(gl_PointCoord, vec2(0.5));
    if (d > 0.5) discard;

    float strength = 0.9 - d;
    if (strength < 0.01) discard;
    strength = pow(max(strength, 0.0), 10.0);

gl_FragColor = vec4(vec3(strength), strength);
}
