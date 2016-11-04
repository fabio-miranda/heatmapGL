precision mediump float;

varying highp vec2 vTexCoord;
uniform sampler2D uSampler0;
uniform vec2 uScale;
uniform vec2 uTranslation;

void main(void) {

	vec2 coord = vTexCoord.xy*uScale-uTranslation;
  if(coord.x >= 0.0 && coord.x <= 1.0 && coord.y >= 0.0 && coord.y <= 1.0)
  	gl_FragColor = texture2D(uSampler0, coord);
  else
  	gl_FragColor = vec4(0.95, 0.95, 0.95, 1.0);
  
}
