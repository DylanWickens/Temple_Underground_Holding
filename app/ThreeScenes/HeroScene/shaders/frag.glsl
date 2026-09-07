varying float vReveal;

void main () {

    // Light point
    float strength = distance(gl_PointCoord, vec2(0.5));
    strength = 0.9 - strength;
    strength = pow(strength, 10.0);

    // Final Color — scaled by the twinkle-in; additive blending, so 0 adds nothing.
    gl_FragColor = vec4(vec3(strength * vReveal), 0.3);

}
