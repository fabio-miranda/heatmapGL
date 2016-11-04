precision mediump float;

varying float vValue;

void main(void) {

	//vec2 coord = vTexCoord.xy*uScale-uTranslation;
  //if(coord.x >= 0.0 && coord.x <= 1.0 && coord.y >= 0.0 && coord.y <= 1.0)
  	//gl_FragColor = texture2D(uSampler0, coord);
  //else
  	gl_FragColor = vec4(vValue);
  
}
