precision mediump float;

uniform float uAlpha;
uniform vec3 uColor;

void main(void) {
  gl_FragColor = vec4(uColor.rgb, uAlpha);
}
