precision mediump float;

uniform float uDt;
uniform sampler2D uSampler0;

varying highp vec2 vTexCoord;

void main(void) {

  float val1 = texture2D(uSampler0, vTexCoord).r;
  float val2 = texture2D(uSampler0, vTexCoord - vec2(uDt, 0)).r;
  float val3 = texture2D(uSampler0, vTexCoord - vec2(0, uDt)).r;
  float val4 = texture2D(uSampler0, vTexCoord - vec2(uDt, uDt)).r;

  //avoid getting the min as zero
  /*
  if(val1 <= 0.0)
    val1 = 10000000.0;
  if(val2 <= 0.0)
    val2 = 10000000.0;
  if(val3 <= 0.0)
    val3 = 10000000.0;
  if(val4 <= 0.0)
    val4 = 10000000.0;
  */
  
  float minimum = min(min(val1, val2), min(val3, val4));

  gl_FragColor = vec4(minimum);
  //gl_FragColor = vec4(5152.3);
  
}
