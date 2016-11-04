precision mediump float;

varying highp vec2 vTexCoord;
uniform sampler2D uSampler0;

void main(void) {
  vec2 scale = vec2(1.0);
  vec2 translate = vec2(0.0);
  gl_FragColor = vec4(texture2D(uSampler0, vTexCoord.yx).rgb, 1.0);
  
}
