precision mediump float;

varying highp vec2 vTexCoord;
uniform sampler2D uSamplerColorScale;
uniform sampler2D uSamplerCount;
uniform sampler2D uSamplerIndex;
uniform sampler2D uSamplerEntry;
uniform sampler2D uSamplerFinal;
uniform float uMinCountValue;
uniform float uMaxCountValue;
uniform float uMinIndexValue;
uniform float uMaxIndexValue;
uniform float uMinEntryValue;
uniform float uMaxEntryValue;
uniform float uNumBins;
uniform float uWindowSize;
uniform float uNumPoints;
uniform float uIsFirstPass;
uniform float uUseDensity;
uniform float uBandwidth;
uniform float uEntryDataTileWidth;
uniform float uPassValue;
uniform float uNumPassValues;

const int maxloop = 50000;
const float std = 1.0;
//const float maxvalue = 1.0;

float gauss(float r){
  return 0.3989422804 * exp( -0.5 * (r*r));
  //return 0.3989422804 * exp( (- r*r) / 2.0);
  //return exp( -0.5 *  r*r );
  //return (1.0 / (sqrt(6.28318530718 * std * std))) * exp(- (r*r) / (2.0 * std * std) );
}

vec4 getValue(vec2 coord){
  float index = texture2D(uSamplerIndex, coord).r * (uMaxIndexValue - uMinIndexValue) + uMinIndexValue;
  vec2 coordValue = vec2(index/uEntryDataTileWidth, 0);
  return texture2D(uSamplerEntry, coordValue.xy);// * (uMaxEntryValue - uMinEntryValue) + uMinEntryValue;
}

void main(void) {

  vec2 coord2D = vTexCoord;

  vec4 values = texture2D(uSamplerCount, coord2D); //count, f, lambda
  float count = uNumPoints;

  //gl_FragColor = vec4(values);

  vec4 originalf = texture2D(uSamplerEntry, vTexCoord); //count, f, lambda
  //gl_FragColor = vec4(values);
  //return;

  //float x = coord2D.x;

  vec2 tex = texture2D(uSamplerIndex, vec2(0.5)).rg;
  //vec2 tex = texture2D(uSamplerIndex, coord2D).rg;
  float mean = tex.r;
  float numpoints = uNumPoints; //tex.g uNumPoints TODO; whats the difference?

  //mean = pow(mean, 1.0/uNumPoints);
  mean = mean / numpoints;
  mean = exp(mean);


  
  float f = 0.0;
  float W = 0.0;
  float numcounts = 1.0;
  for(int i=0;i<maxloop; i++){
    if(i >= int(uWindowSize )) break;

    int index = i - int(uWindowSize)/2;
    coord2D = vec2(vTexCoord.x + uIsFirstPass * (float(index) / uNumBins), vTexCoord.y + (1.0 - uIsFirstPass) * (float(index) / uNumBins)); //make sure to access not the next texel, but the next bin

    
    

    vec4 valuesi;
    valuesi  = texture2D(uSamplerCount, coord2D); //count
    float fi;

    if(uIsFirstPass > 0.0)
      fi = texture2D(uSamplerEntry, vTexCoord).r;
    else
      fi = texture2D(uSamplerEntry, vTexCoord).r;


    float value;
    if(uUseDensity <= 0.0)
      value = getValue(coord2D).r * (uMaxEntryValue - uMinEntryValue) + uMinEntryValue;
    else
      value = uPassValue;

    //TODO: remove this if. It REALLY impacts performance
    if((coord2D.x >= 0.0 && coord2D.y >= 0.0 && coord2D.x <= 1.0 && coord2D.y <= 1.0)){ //TODO: use clamp_to_border, instead of this if

      //if((uIsFirstPass <= 0.0 && valuesi.g > 0.0) || uIsFirstPass > 0.0){

        float counti = valuesi.r;
        //float fi = valuesi.r;
        //float fi = valuesi.r;
        //if(uIsFirstPass <= 0.0)
          //fi = fi * texture2D(uSamplerCount, coord2D).r;

        //if(uIsFirstPass <= 0.0){
          //fi = texture2D(uSamplerCount, coord2D).g / texture2D(uSamplerCount, coord2D).b;
        //}

        if(originalf.r <= 0.0)
          originalf.r = 0.01;

        //float lambda = sqrt(mean / fi);
        float lambda = 1.0 / (originalf.r);
        //float lambda = originalf.r / fi;

        if(lambda <= 0.0)
          lambda = 0.01;

        //if(uIsFirstPass <= 0.0){
          //gl_FragColor = vec4(1);
          //return;
          //lambda = 1.0;
        //}

        float bandwidth = uBandwidth * pow(lambda,0.5);

        //if(uIsFirstPass <= 0.0){
          //float count = texture2D(uSamplerCount, coord2D).b;
          //bandwidth = uBandwidth / count;
        //}


        

        float oneoverhi = 1.0 / bandwidth;

        //float gaus = gauss((float(index) / uNumBins) * oneoverhi);
        float gaus = (1.0 / (bandwidth)) * gauss((float(index) / uWindowSize) / bandwidth); //CESAR
        float k = counti * gaus;

        f += k;
        W += k;
        numcounts += counti;
        //W += counti ;
      //}
    }
  }
  

  //f = f / h;
  if(uIsFirstPass > 0.0){
    gl_FragColor = vec4(f, W, numcounts, 0);
    //gl_FragColor = vec4(f, W, numcounts, 0);
  }
  else{

     //f = (1.0 / (uNumPoints*h)) * f;
    //f = (1.0 / (uNumPoints*h*h)) * f;
    //f = (1.0 / (50.0*h)) * f;
    //f = f/0.3989422804;
    //f = f / uNumPoints;
    //f = f * 100.0;
    //f = f * (originalf.r);
    //f = f / uNumPoints;
    //vec3 color = texture2D(uSamplerColorScale, vec2(f, 0)).xyz;
    //gl_FragColor = vec4(color.xyz, 1);
    

    //gl_FragColor = vec4(sqrt(f / uNumPoints));
    gl_FragColor = vec4(f / uNumPoints);


    //gl_FragColor = texture2D(uSamplerEntry, vTexCoord);
    /*
    //float count = texture2D(uSamplerCount, vTexCoord).r;
    float f = texture2D(uSamplerEntry, vTexCoord).r;
    float lambda = sqrt(mean / f);
    float bandwidth = uBandwidth * lambda;
    //float gaus = gauss(1.0 / bandwidth);
    float k =  bandwidth;
    gl_FragColor = vec4(k);
    */
  }


}
