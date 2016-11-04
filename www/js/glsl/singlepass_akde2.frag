precision mediump float;

uniform sampler2D uSamplerF;
uniform sampler2D uSamplerMean;
uniform sampler2D uSamplerGauss;

uniform float uBandwidth;
uniform float uNumPoints;
uniform float uKernelSize;
uniform float uNumBins;
uniform vec2 uAspectRatio;

varying float value;


float gauss(float r){
  //return 0.3989422804 * exp( -0.5*(r*r));
  return 0.3989422804 * exp( -12.5*(r*r));
}


//Attention: gl_FragCoord is lower left, gl_PointCoord is upper left by default

void main(void) {

  vec3 tex = texture2D(uSamplerMean, vec2(0)).rgb;
  float sumvalue = tex.g*tex.b;
  float mean = (tex.r / sumvalue);
  //float numpoints = tex.g;//uNumPoints; //TODO; whats the difference?

  //mean = pow(mean, 1.0/uNumPoints);
  //mean = mean / numpoints;
  mean = exp(mean);
  //mean = 0.1236;
  //mean = pow(mean, 1.0/100.0);

  //vec2 newFragCoord = vec2(gl_FragCoord.x, 512.0 - gl_FragCoord.y);
  vec2 newPointCoord = vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y);

  vec2 originalPos = (gl_FragCoord.xy - uKernelSize*newPointCoord.xy + uKernelSize*vec2(0.5))/uNumBins;
  //vec2 originalPos = (gl_FragCoord.xy/512.0);
  //originalPos = originalPos - 512.0*(gl_PointCoord.xy / 32.0) + 512.0*vec2(0.5)/32.0;
  //float f = texture2D(uSamplerF, gl_PointCoord.xy).r;
  float f = texture2D(uSamplerF, originalPos).r;
  //float f = texture2D(uSamplerF, gl_FragCoord.xy/512.0).r;
  //gl_FragColor = vec4(f, 0, 0, 1.0);
  //return;
  //float f = texture2D(uSamplerF, gl_FragCoord.xy).r;
  float lambda = pow(mean / f, 0.5);
  //float lambda = mean / f;
  float bandwidth = uBandwidth * lambda;
  //float bandwidth;

	//float dist = distance( gl_PointCoord, vec2(0.5) ); //dist in [0,0.5]
  float dist = 2.0*distance( gl_PointCoord, vec2(0.5) ) * (uKernelSize / 256.0);
	//dist = 2.0*(dist);
	//float val = gauss(dist / bandwidth)/bandwidth;
	//float weight = 100.0 / numpoints;
	//val = val * weight;
  //gl_FragColor = vec4(val);
  //gl_FragColor = vec4(1,0,0,1);
  //gl_FragColor = texture2D(uSamplerMean, vec2(0.5));

  //float gaussvalue = texture2D(uSamplerGauss, vec2(dist, 0)).a/bandwidth;  //uSamplerGauss is already divided by bandwidth
  float gaussvalue = gauss(dist / bandwidth)/(bandwidth);
  //gaussvalue = sqrt(gaussvalue);
  //if(abs(lambda - 1.0) <= 0.5)
    gl_FragColor = vec4(gaussvalue*value);
  //else
    //gl_FragColor = vec4(0);
  //gl_FragColor = vec4(dist);
}
