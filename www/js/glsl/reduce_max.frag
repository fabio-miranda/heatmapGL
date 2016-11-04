precision mediump float;

uniform float uDt;
uniform sampler2D uSampler0;

varying highp vec2 vTexCoord;

void main(void) {

  float val1 = texture2D(uSampler0, vTexCoord).r;
  float val2 = texture2D(uSampler0, vTexCoord - vec2(uDt, 0)).r;
  float val3 = texture2D(uSampler0, vTexCoord - vec2(0, uDt)).r;
  float val4 = texture2D(uSampler0, vTexCoord - vec2(uDt, uDt)).r;

  float maximum = max(max(val1, val2), max(val3, val4));

  gl_FragColor = vec4(maximum);
  //gl_FragColor = vec4(5152.3);
  
}
