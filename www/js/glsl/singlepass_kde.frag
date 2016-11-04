precision mediump float;

uniform sampler2D uSamplerGauss;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform float uBandwidth;
uniform float uKernelSize;
//uniform float uNumPoints;
//uniform float uKernelSize;
//uniform float uNumBins;

varying float value;

//25.0: precision or width of distribution

float gauss(float r){
  //return 0.3989422804 * exp( 25.0 * (- r*r) / 2.0);
  //return 0.3989422804 * exp( -0.5*(r*r));
  return 0.3989422804 * exp( -12.5*(r*r));
  //return exp( (- r*r) / 2.0);
}

void main(void) {
  
	float dist = 2.0*distance( gl_PointCoord, vec2(0.5) ) * (uKernelSize / 256.0); //dist in [0,0.5]
	//dist = (1.0/sqrt(0.5)) * dist; //dist in [0,1.0]
	//float val = gauss(dist/uBandwidth)/uBandwidth;
	//float weight = 100.0 / uNumPoints;
	//val = val * weight;
  //vec2 coord = vec2(gl_PointCoord.x-0.5, gl_PointCoord.y-0.5)/uBandwidth + vec2(0.5/uBandwidth);
  //coord = coord + vec2(0.5);
  //float gaussvalue = texture2D(uSamplerGauss, vec2(dist, 0)).a/uBandwidth; //uSamplerGauss is already divided by bandwidth
  float gaussvalue = gauss(dist/uBandwidth)/(uBandwidth);
  //float diff = abs(gaussvalue - gaussvalue2);
  //gaussvalue = sqrt(gaussvalue);
	gl_FragColor = vec4(gaussvalue*value);
}
