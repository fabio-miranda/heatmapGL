
function getShader(gl, filename, isFragShader) {


  var xmlhttp = new XMLHttpRequest(); 
  xmlhttp.open("GET", filename, false); 
  xmlhttp.send(); 
  var str = xmlhttp.responseText;


  var shader;
  if (isFragShader)
      shader = gl.createShader(gl.FRAGMENT_SHADER);
  else
      shader = gl.createShader(gl.VERTEX_SHADER);

  gl.shaderSource(shader, str);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      alert(gl.getShaderInfoLog(shader));
      return null;
  }

  return shader;
}

function deleteFBO(gl, fbo){
  if(gl.isFramebuffer(fbo))
    gl.deleteFramebuffer(fbo);
}

function clearFBO(gl, fbo){
  gl.bindFramebuffer( gl.FRAMEBUFFER, fbo);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindFramebuffer( gl.FRAMEBUFFER, null );
}

function createFBO(gl, interpolation, width, height, iformat, format, type, tex, fbo){

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture( gl.TEXTURE_2D, tex );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, interpolation);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, interpolation); 

  //gl.texImage2D( gl.TEXTURE_2D, 0, gl.ALPHA, w,h, 0, gl.ALPHA, gl.FLOAT, null );    
  gl.texImage2D(gl.TEXTURE_2D, 0, iformat, width, height, 0, format, type, null);

  gl.bindTexture( gl.TEXTURE_2D, null );
  gl.bindFramebuffer( gl.FRAMEBUFFER, fbo );
  gl.framebufferTexture2D( gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0 );

  gl.checkFramebufferStatus( gl.FRAMEBUFFER );

  gl.bindFramebuffer( gl.FRAMEBUFFER, null );

}

function createTextureFromArray(gl, interpolation, width, height, iformat, format, type, data, tex){

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, interpolation);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, interpolation); 

  gl.texImage2D(gl.TEXTURE_2D, 0, iformat, width, height, 0, format, type, data);


  gl.bindTexture(gl.TEXTURE_2D, null);

  //delete [] initialvalues;

}

function createTextureFromImage(gl, interpolation, iformat, format, type, image, tex){

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, interpolation);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, interpolation); 

  gl.texImage2D(gl.TEXTURE_2D, 0, iformat, format, type, image);


  gl.bindTexture(gl.TEXTURE_2D, null);

  //delete [] initialvalues;

}

function distance(x0, y0, x1, y1){
    return Math.sqrt((x0 -= x1) * x0 + (y0 -= y1) * y0);
};

function points(gl, hasTexture){

  this.gl = gl;
  this.array = {};
  this.pointsBuffer = null;
  this.color = null;
  this.hasTexture = hasTexture;

  this.pointsBuffer = gl.createBuffer();
  this.pointsBuffer.itemSize = 3;
  /*
  if(this.hasTexture){
    //tex coord
    this.texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    
    
    var texCoords = [
         1.0,  1.0,
         0.0,  1.0,
         1.0,  0.0,
         0.0,  0.0,
    ];
    

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);
    this.texCoordBuffer.itemSize = 2;
    this.texCoordBuffer.numItems = 4;
  }
  */
  this.numrasterpoints = 0;

}

points.prototype.add = function(x, y, group, value){

  if(this.array[group] == null)
    this.array[group] = [];
  
  this.array[group].push(x);
  this.array[group].push(y);
  this.array[group].push(value);

  this.numrasterpoints+=value;
}

points.prototype.updateBuffer = function() {
  for (var group in this.array) {
    //TODO: optimize? Do we really need to call bufferData for every point inserted?
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.pointsBuffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array(this.array[group]),
      this.gl.DYNAMIC_DRAW);
    //this.gl.bindBuffer(this.gl.ARRAY_BUFFER, 0);
  }
}

points.prototype.reset = function(){

  for(group in this.array){
    this.array[group].length = 0;
    delete this.array[group];
  }
  
  this.array = {};
  this.numrasterpoints=0;
}


points.prototype.draw = function(shaderProgram, mvMatrix, pMatrix, group, tex0, tex1){

  if(this.array[group] == null)
    return;

  //TODO: optimize? Do we really need to call bufferData for every point inserted?
  this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.pointsBuffer);
  var numpoints = this.array[group].length / 3;
  this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.array[group]), this.gl.DYNAMIC_DRAW);

  //see: http://www.mjbshaw.com/2013/03/webgl-fixing-invalidoperation.html
  //TODO: do this every frame?
  this.gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

  this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.pointsBuffer);
  this.gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, this.pointsBuffer.itemSize, this.gl.FLOAT, false, 0, 0);

  if(tex0 != null){
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, tex0);
    this.gl.uniform1i(shaderProgram.sampler0, 0);
  }

  if(tex1 != null){
    this.gl.activeTexture(this.gl.TEXTURE1);
    this.gl.bindTexture(this.gl.TEXTURE_2D, tex1);
    this.gl.uniform1i(shaderProgram.sampler1, 1);
  }


  this.gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
  this.gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
  this.gl.drawArrays(this.gl.POINTS, 0, numpoints);

  //see: http://www.mjbshaw.com/2013/03/webgl-fixing-invalidoperation.html
  this.gl.disableVertexAttribArray(shaderProgram.vertexPositionAttribute);

  if(tex0 != null)
    this.gl.disableVertexAttribArray(shaderProgram.textureCoordAttribute);
}

function lines(gl){

  this.gl = gl;
  this.array = {};
  this.linesBuffer = null;
  this.color = null;

  this.linesBuffer = [];
  this.linesBuffer.itemSize = 2;

  this.numrasterpoints = 0;

}

lines.prototype.reset = function(x, y){

  for(group in this.array){
    this.array[group].length = 0;
    delete this.array[group];
  }
  
  this.array = {};
  this.numrasterpoints=0;
}

lines.prototype.add = function(x0, y0, group){

  if(this.array[group] == null){
    this.array[group] = [];
    this.linesBuffer[group] = this.gl.createBuffer();
  }

  this.array[group].push(x0);
  this.array[group].push(y0);
  //this.array.push(x1);
  //this.array.push(y1);

  var length = this.array[group].length;
  if(length > 2){
    this.numrasterpoints += distance(x0, y0, this.array[group][length-4], this.array[group][length-3]);
  }
  //this.numrasterpoints+=0.01;

  //TODO: optimize? Do we really need to call bufferData for every point inserted?
  this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.linesBuffer[group]);
  this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.array[group]), this.gl.DYNAMIC_DRAW);
  //this.gl.bindBuffer(this.gl.ARRAY_BUFFER, 0);

}


lines.prototype.draw = function(shaderProgram, mvMatrix, pMatrix, group){

  if(this.array[group] == null)
    return;

  var numlines = this.array[group].length / 2;

  //see: http://www.mjbshaw.com/2013/03/webgl-fixing-invalidoperation.html
  //TODO: do this every frame?
  this.gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

  this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.linesBuffer[group]);
  this.gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, this.linesBuffer.itemSize, this.gl.FLOAT, false, 0, 0);


  this.gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
  this.gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
  this.gl.drawArrays(this.gl.LINE_STRIP, 0, numlines);

  //see: http://www.mjbshaw.com/2013/03/webgl-fixing-invalidoperation.html
  this.gl.disableVertexAttribArray(shaderProgram.vertexPositionAttribute);
}



function quad(gl, hasTexture){
  this.gl = gl;
  this.quadBuffer = null;
  this.texCoordBuffer = null;
  this.color = null;
  this.hasTexture = hasTexture;

  this.initBuffers(gl);

}

quad.prototype.initBuffers = function(){

  //vertices
  this.quadBuffer = this.gl.createBuffer();
  this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadBuffer);
  var vertices = [
       1.0,  1.0,  0.0,
       0.0,  1.0,  0.0,
       1.0,  0.0,  0.0,
       0.0,  0.0,  0.0
  ];
  this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertices), this.gl.STATIC_DRAW);
  this.quadBuffer.itemSize = 3;
  this.quadBuffer.numItems = 4;

  if(this.hasTexture){
    //tex coord
    this.texCoordBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
    
    
    var texCoords = [
         1.0,  1.0,
         0.0,  1.0,
         1.0,  0.0,
         0.0,  0.0,
    ];
    

    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(texCoords), this.gl.STATIC_DRAW);
    this.texCoordBuffer.itemSize = 2;
    this.texCoordBuffer.numItems = 4;
  }

}

quad.prototype.draw = function(shaderProgram, mvMatrix, pMatrix, tex0, tex1, tex2, tex3, tex4){

  //see: http://www.mjbshaw.com/2013/03/webgl-fixing-invalidoperation.html
  //TODO: do this every frame?
  this.gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

  this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadBuffer);
  this.gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, this.quadBuffer.itemSize, this.gl.FLOAT, false, 0, 0);
  
  if(tex0 != null){
    this.gl.enableVertexAttribArray(shaderProgram.textureCoordAttribute);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
    this.gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, this.texCoordBuffer.itemSize, this.gl.FLOAT, false, 0, 0);

    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, tex0);
    this.gl.uniform1i(shaderProgram.sampler0, 0);
  }

  if(tex1 != null){
    this.gl.activeTexture(this.gl.TEXTURE1);
    this.gl.bindTexture(this.gl.TEXTURE_2D, tex1);
    this.gl.uniform1i(shaderProgram.sampler1, 1);
  }

  if(tex2 != null){
    this.gl.activeTexture(this.gl.TEXTURE2);
    this.gl.bindTexture(this.gl.TEXTURE_2D, tex2);
    this.gl.uniform1i(shaderProgram.sampler2, 2);
  }

  if(tex3 != null){
    this.gl.activeTexture(this.gl.TEXTURE3);
    this.gl.bindTexture(this.gl.TEXTURE_2D, tex3);
    this.gl.uniform1i(shaderProgram.sampler3, 3);
  }

  if(tex4 != null){
    this.gl.activeTexture(this.gl.TEXTURE4);
    this.gl.bindTexture(this.gl.TEXTURE_2D, tex4);
    this.gl.uniform1i(shaderProgram.sampler4, 4);
  }

  this.gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
  this.gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
  this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, this.quadBuffer.numItems);

  //see: http://www.mjbshaw.com/2013/03/webgl-fixing-invalidoperation.html
  this.gl.disableVertexAttribArray(shaderProgram.vertexPositionAttribute);
  if(tex0 != null)
    this.gl.disableVertexAttribArray(shaderProgram.textureCoordAttribute);

}


function reduction(gl, inittexsize){
  this.gl = gl;
  this.inittexsize = inittexsize;
  this.numtex = (Math.log(this.inittexsize))/(Math.log(2))
  this.quad = new quad(this.gl, true);
  this.tex = [];
  this.fbo = [];
  this.mvMatrix = mat4.create();
  this.pMatrix = mat4.create();
  mat4.identity(this.mvMatrix);
  mat4.ortho(this.pMatrix, 0, 1, 0, 1, 0, 1);

  //fbo and tex
  var size = inittexsize;
  for(var i=0; i<this.numtex; i++){
    size = size / 2;
    this.tex[i] = this.gl.createTexture();
    this.fbo[i] = this.gl.createFramebuffer();
    createFBO(this.gl, this.gl.NEAREST, size, size, this.gl.RGBA, this.gl.RGBA, this.gl.FLOAT, this.tex[i], this.fbo[i]);
  }

  //unsigned byte tex and fbo
  this.finaltex = this.gl.createTexture();
  this.finalfbo = this.gl.createFramebuffer();
  createFBO(this.gl, this.gl.NEAREST, 1, 1, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.finaltex, this.finalfbo);

  //min reduce shader
  var fragmentShader = getShader(this.gl, "./js/glsl/reduce_min.frag", true);
  var vertexShader = getShader(this.gl, "./js/glsl/reduce.vert", false);

  this.reduceMinShader = this.gl.createProgram();
  this.gl.attachShader(this.reduceMinShader, vertexShader);
  this.gl.attachShader(this.reduceMinShader, fragmentShader);
  this.gl.linkProgram(this.reduceMinShader);

  if (!this.gl.getProgramParameter(this.reduceMinShader, this.gl.LINK_STATUS)) {
    alert("Could not initialise shaders");
  }

  this.gl.useProgram(this.reduceMinShader);

  this.reduceMinShader.vertexPositionAttribute = this.gl.getAttribLocation(this.reduceMinShader, "aVertexPosition");
  this.gl.enableVertexAttribArray(this.reduceMinShader.vertexPositionAttribute);

  this.reduceMinShader.textureCoordAttribute = this.gl.getAttribLocation(this.reduceMinShader, "aTexCoord");
  this.gl.enableVertexAttribArray(this.reduceMinShader.textureCoordAttribute);

  this.reduceMinShader.dt = this.gl.getUniformLocation(this.reduceMinShader, 'uDt');
  this.reduceMinShader.sampler0 = this.gl.getUniformLocation(this.reduceMinShader, "uSampler0");

  this.reduceMinShader.pMatrixUniform = this.gl.getUniformLocation(this.reduceMinShader, "uPMatrix");
  this.reduceMinShader.mvMatrixUniform = this.gl.getUniformLocation(this.reduceMinShader, "uMVMatrix");

  //see: http://www.mjbshaw.com/2013/03/webgl-fixing-invalidoperation.html
  this.gl.disableVertexAttribArray(this.reduceMinShader.vertexPositionAttribute);
  this.gl.disableVertexAttribArray(this.reduceMinShader.textureCoordAttribute);

  this.gl.useProgram(null);

  //max reduce shader
  var fragmentShader = getShader(this.gl, "./js/glsl/reduce_max.frag", true);
  var vertexShader = getShader(this.gl, "./js/glsl/reduce.vert", false);

  this.reduceMaxShader = this.gl.createProgram();
  this.gl.attachShader(this.reduceMaxShader, vertexShader);
  this.gl.attachShader(this.reduceMaxShader, fragmentShader);
  this.gl.linkProgram(this.reduceMaxShader);

  if (!this.gl.getProgramParameter(this.reduceMaxShader, this.gl.LINK_STATUS)) {
    alert("Could not initialise shaders");
  }

  this.gl.useProgram(this.reduceMaxShader);

  this.reduceMaxShader.vertexPositionAttribute = this.gl.getAttribLocation(this.reduceMaxShader, "aVertexPosition");
  this.gl.enableVertexAttribArray(this.reduceMaxShader.vertexPositionAttribute);

  this.reduceMaxShader.textureCoordAttribute = this.gl.getAttribLocation(this.reduceMaxShader, "aTexCoord");
  this.gl.enableVertexAttribArray(this.reduceMaxShader.textureCoordAttribute);

  this.reduceMaxShader.dt = this.gl.getUniformLocation(this.reduceMaxShader, 'uDt');
  this.reduceMaxShader.sampler0 = this.gl.getUniformLocation(this.reduceMaxShader, "uSampler0");

  this.reduceMaxShader.pMatrixUniform = this.gl.getUniformLocation(this.reduceMaxShader, "uPMatrix");
  this.reduceMaxShader.mvMatrixUniform = this.gl.getUniformLocation(this.reduceMaxShader, "uMVMatrix");

  //see: http://www.mjbshaw.com/2013/03/webgl-fixing-invalidoperation.html
  this.gl.disableVertexAttribArray(this.reduceMaxShader.vertexPositionAttribute);
  this.gl.disableVertexAttribArray(this.reduceMaxShader.textureCoordAttribute);

  this.gl.useProgram(null);

  //encode shader
  var fragmentShader = getShader(this.gl, "./js/glsl/encode.frag", true);
  var vertexShader = getShader(this.gl, "./js/glsl/encode.vert", false);

  this.encodeShader = this.gl.createProgram();
  this.gl.attachShader(this.encodeShader, vertexShader);
  this.gl.attachShader(this.encodeShader, fragmentShader);
  this.gl.linkProgram(this.encodeShader);

  if (!this.gl.getProgramParameter(this.encodeShader, this.gl.LINK_STATUS)) {
    alert("Could not initialise shaders");
  }

  this.gl.useProgram(this.encodeShader);

  this.encodeShader.vertexPositionAttribute = this.gl.getAttribLocation(this.encodeShader, "aVertexPosition");
  this.gl.enableVertexAttribArray(this.encodeShader.vertexPositionAttribute);

  this.encodeShader.textureCoordAttribute = this.gl.getAttribLocation(this.encodeShader, "aTexCoord");
  this.gl.enableVertexAttribArray(this.encodeShader.textureCoordAttribute);

  this.encodeShader.sampler0 = this.gl.getUniformLocation(this.encodeShader, "uSampler0");

  this.encodeShader.pMatrixUniform = this.gl.getUniformLocation(this.encodeShader, "uPMatrix");
  this.encodeShader.mvMatrixUniform = this.gl.getUniformLocation(this.encodeShader, "uMVMatrix");

  //see: http://www.mjbshaw.com/2013/03/webgl-fixing-invalidoperation.html
  this.gl.disableVertexAttribArray(this.encodeShader.vertexPositionAttribute);
  this.gl.disableVertexAttribArray(this.encodeShader.textureCoordAttribute);

  this.gl.useProgram(null);

}


reduction.prototype.reduceStep = function(tex, shader){

  var size = this.inittexsize;
  for(var i=0; i<this.numtex; i++){
    size = size / 2.0;

    this.gl.useProgram(shader);

    this.gl.uniform1f(shader.dt, 0.5 / size);

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.fbo[i]);
    this.gl.viewport(0, 0, size, size);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    if(i > 0){
      this.quad.draw(shader, this.mvMatrix, this.pMatrix, this.tex[i-1]);
    }
    else{
      this.quad.draw(shader, this.mvMatrix, this.pMatrix, tex);
    }

    this.gl.bindFramebuffer( this.gl.FRAMEBUFFER, null );
    this.gl.useProgram(null);
  }

  //last step: encode float texture into a unsigned byte texture
  this.gl.useProgram(this.encodeShader);
  this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.finalfbo);
  this.gl.viewport(0, 0, 1, 1);
  this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  this.quad.draw(this.encodeShader, this.mvMatrix, this.pMatrix, this.tex[this.numtex-1]);
  this.gl.bindFramebuffer( this.gl.FRAMEBUFFER, null );
  this.gl.useProgram(null);

  //Webgl does not support readback from a floating texture
  //See: http://concord-consortium.github.io/lab/experiments/webgl-gpgpu/webgl.html
  this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.finalfbo);
  outputStorage = new Uint8Array(1 * 1 * 4);
  this.gl.readPixels(0, 0, 1, 1, this.gl.RGBA, this.gl.UNSIGNED_BYTE, outputStorage);
  this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);


  outputConverted = new Float32Array(outputStorage.buffer);

  //console.log(outputConverted[0]);

  return outputConverted[0];

}

reduction.prototype.reduce = function(tex){
  //var min = this.reduceStep(tex, this.reduceMinShader);
  var max = this.reduceStep(tex, this.reduceMaxShader);

  //console.log(min, max);

  return [0, max];
}
