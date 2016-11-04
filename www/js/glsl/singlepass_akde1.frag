precision mediump float;

uniform sampler2D uSamplerF;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform mat4 uOriginalPMatrix;
uniform float uBandwidth;
uniform float uKernelSize;
uniform float uNumBins;
uniform vec2 uAspectRatio;

varying vec2 originalPos;
varying float value;

void main(void) {

  //float f = texture2D(uSamplerF, gl_FragCoord.xy/uNumBins).r;
  vec2 pos = 0.5*(originalPos+vec2(1.0));
  pos = pos * uAspectRatio;
  float f = texture2D(uSamplerF, pos).r;
  //gl_FragColor = vec4(0,0,0,1);
  if(f > 0.0 && pos.x <= 1.0 && pos.x >= 0.0 && pos.y <= 1.0 && pos.y >= 0.0){
    f = log(f);
    gl_FragColor = vec4(f,value,1,0);
  }
  else
    gl_FragColor = vec4(0,0,0,0);

  //gl_FragColor = vec4(1, 0, 0, 1);

  //gl_FragColor = vec4(gl_FragCoord.x/uNumBins, 0, 0, 1);
  //gl_FragColor = vec4(0.5*(originalPos.y+1.0), 0, 0, 1);
  return;
  /*
  float ax = gl_FragCoord.x/uNumBins;
  float bx = 0.5*(originalPos.x+1.0);
  float ay = gl_FragCoord.y/uNumBins;
  float by = 0.5*(originalPos.y+1.0);
  by = by*0.716358839050132;
  if(abs(ay - by) <= 0.001)
    gl_FragColor = vec4(0.5, 0, 0, 1);
  else
    gl_FragColor = vec4(0, 0, 0, 1);
  */
}
