precision mediump float;

uniform sampler2D uSamplerF;
uniform sampler2D uSamplerGauss;

uniform float uKernelSize;
uniform float uBandwidth;
uniform float uNumPoints;

varying float value;


//25.0: precision or width of distribution
float gauss(float r){
  //return 0.3989422804 * exp( 25.0 * (- r*r) / 2.0);
  //return 0.3989422804 * exp( -0.5*(r*r));
  return 0.3989422804 * exp( -12.5*(r*r));
  //return exp( (- r*r) / 2.0);
}

void main(void) {

	//float dist = distance( gl_PointCoord, vec2(0.5) ); //dist in [0,0.5]
  float dist = 2.0*distance( gl_PointCoord, vec2(0.5) ) * (uKernelSize / 256.0);
	//dist = 2.0*(dist);
  //dist = 0.0;
	//float val = gauss(dist/uBandwidth)/uBandwidth;
	//float weight = 100.0 / uNumPoints;
	//val = val * weight;
  //gl_FragColor = vec4(val);

  //float gaussvalue = texture2D(uSamplerGauss, vec2(dist, 0)).a/uBandwidth; //uSamplerGauss is already divided by bandwidth
  float gaussvalue = gauss(dist/uBandwidth)/(uBandwidth);
  //gaussvalue = sqrt(gaussvalue);
  gl_FragColor = vec4(gaussvalue*value);
  
}
