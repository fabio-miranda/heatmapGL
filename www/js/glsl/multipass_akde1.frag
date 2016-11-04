precision mediump float;

varying highp vec2 vTexCoord;
uniform sampler2D uSamplerColorScale;
uniform sampler2D uSamplerCount;
uniform sampler2D uSamplerIndex;
uniform sampler2D uSamplerEntry;
uniform float uMinCountValue;
uniform float uMaxCountValue;
uniform float uMinIndexValue;
uniform float uMaxIndexValue;
uniform float uMinEntryValue;
uniform float uMaxEntryValue;
uniform float uNumBins;
uniform float uWindowSize;
uniform float uMeanSize;
uniform float uNumPoints;
uniform float uIsFirstPass;
uniform float uUseDensity;
uniform float uBandwidth;
uniform float uEntryDataTileWidth;
uniform float uPassValue;
uniform float uNumPassValues;

const int maxloop = 50000;

vec4 getValue(vec2 coord){
  float index = texture2D(uSamplerIndex, coord).r * (uMaxIndexValue - uMinIndexValue) + uMinIndexValue;
  vec2 coordValue = vec2(index/uEntryDataTileWidth, 0);
  return texture2D(uSamplerEntry, coordValue.xy);// * (uMaxEntryValue - uMinEntryValue) + uMinEntryValue;
}

void main(void) {
  
  vec2 coord2D = vTexCoord;
  vec4 values  = texture2D(uSamplerCount, coord2D); //count, f
  float mean=0.0;
  float n=0.0;
  float window = uMeanSize;
  for(int i=0; i<maxloop; i++){
    if(i >= int(window)) break;

    int index0 = i - int(window)/2;

    for(int j=0; j<maxloop; j++){
      if(j >= int(window)) break;

      int index1 = j - int(window)/2;

      vec2 coord2D = vTexCoord + vec2((float(index0) / uNumBins), (float(index1) / uNumBins));
      vec4 valuesij = texture2D(uSamplerCount, coord2D); //count, f

      //TODO: remove this if. It REALLY impacts performance
      //TODO: should I consider all points, or just the one in the groups?
      //Note: im just considering the groups, since in the last pass I filter them.
      if(coord2D.x >= 0.0 && coord2D.y >= 0.0 && coord2D.x <= 1.0 && coord2D.y <= 1.0){ //TODO: use clamp_to_border, instead of this if

        //mean *= valuesij.g;
        if(valuesij.g > 0.0){
          mean += log(valuesij.g);
          n++;
        }
      }

    }
  }


  gl_FragColor = vec4(mean, n, 0.0, 1.0);
  return;

  mean = exp(mean / n);

  float g = 0.0;
  float lambda = 0.0;

  if(values.g > 0.0){
    //g = pow(mean, 1.0/(n));
    g = mean;
    lambda = sqrt(g / values.g); //TODO: see here. Replace with uNumPoints?
  }

  //gl_FragColor = values; //count, f, lambda
  if(mean > 0.0)
    gl_FragColor = vec4(0, 0, 1.0, 1.0);
  else
    gl_FragColor = vec4(1, 0, 0.0, 1.0);
  //gl_FragColor = vec4(lambda, 0, 0, 1.0);
  gl_FragColor = vec4(values.r, values.g, lambda, 1.0);
  return;
  if(lambda <= 0.0)
    gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
  else if(lambda <= 1.0)
    gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0);
  else if(lambda  <= 1.5)
    gl_FragColor = vec4(0.0, 0.0, 0.25, 1.0);
  else if(lambda  <= 5.0)
    gl_FragColor = vec4(0.0, 0.0, 0.75, 1.0);
  else
    gl_FragColor = vec4(0.0, 0.0, 1.0, 1.0);


  /*
  float f = values.r;
  float n = 0.0;
  float mean = 1.0;
  for(int i=0;i<maxloop; i++){
    if(i >= int(uWindowSize)) break;

    int index = i - int(uWindowSize)/2;
    coord2D = vec2(vTexCoord.x + uIsFirstPass * (float(index) / uNumBins), vTexCoord.y + (1.0 - uIsFirstPass) * (float(index) / uNumBins)); //make sure to access not the next texel, but the next bin

    vec4 valuesi = texture2D(uSampler0, coord2D);
    if(valuesi.r > 0.0 && coord2D.x >= 0.0 && coord2D.y >= 0.0 && coord2D.x <= 1.0 && coord2D.y <= 1.0){ //TODO: use clamp_to_border, instead of this if
      
      mean *= valuesi.g;

      n++;
      
    }
  }

  float g = pow(mean, 1.0/n);
  float lambda = sqrt(g / f);

  if(uIsFirstPass > 0.0)
    gl_FragColor = vec4(values.r, values.g, lambda, 1.0); //count, f, lambdahoriz, lambdavert
  else
    gl_FragColor = vec4(values.r, values.g, values.b, lambda); //count, f, lambdahoriz, lambdavert
  */

}
