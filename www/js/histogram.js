

function Histogram(canvas, chart){
  this.canvas = canvas
  this.gl = null;
  this.histogramShader = null;
  this.mvMatrix = mat4.create();
  this.pMatrix = mat4.create();
  this.devicePixelRatio = 1;

  this.image = null;
  this.width = null;
  this.height = null;
  this.numdim = null;
  this.dim = 0;
  this.numbinscatter = null;
  this.numbinhistogram = null;
  this.texture = null;
  this.data = [];

  this.chart = new BarChart(chart, '', '');

}

Histogram.prototype.update = function(image, width, height, numdim, numbinscatter, numbinhistogram){

  this.image = image;
  this.width = width;
  this.height = height;

  this.numdim = numdim;
  this.numbinscatter = numbinscatter;
  this.numbinhistogram = numbinhistogram;

  this.initGL();
  this.initShaders();

  this.texture = this.gl.createTexture();
  createTextureFromImage(this.gl, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.image, this.texture);

  this.histogramquad = new quad(this.gl, true);
}

Histogram.prototype.draw = function(selection){


  this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);


  //mat4.ortho(this.pMatrix, 0, this.gl.viewportWidth, 0, this.gl.viewportHeight, 0, 1);
  mat4.identity(this.mvMatrix);
  mat4.ortho(this.pMatrix, 0, 1, 0, 1, 0, 1);

  this.gl.useProgram(this.histogramShader);

  this.gl.viewport(0, 0, this.gl.viewportWidth, this.gl.viewportHeight);

  this.gl.uniform1f(this.histogramShader.numDim, this.numdim);
  this.gl.uniform1f(this.histogramShader.dim, this.dim);
  this.gl.uniform1f(this.histogramShader.numBinsScatter, this.numbinscatter);
  this.gl.uniform1f(this.histogramShader.numBinsHistogram, this.numbinhistogram);
  this.gl.uniform2f(this.histogramShader.selectionDim, selection.datatilei, selection.datatilej);
  this.gl.uniform4f(this.histogramShader.selectionBinRange,
    selection.rangei0, selection.rangei1, selection.rangej0, selection.rangej1
  );

  this.histogramquad.draw(this.gl, this.histogramShader, this.mvMatrix, this.pMatrix, this.texture);

  this.gl.useProgram(null);

  //Histogram values
  var pixelValues = new Uint8Array(4 * this.numbinhistogram);
  this.gl.readPixels(0, 0, this.numbinhistogram, 1, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixelValues);
  //console.log(pixelValues);
  this.data = [];
  for(var i=0; i<this.numbinhistogram; i++){
    this.data[i] = pixelValues[4*i];
  }

  this.chart.add(this.data);

}

Histogram.prototype.setDim = function(dim){
  this.dim = dim;
}


Histogram.prototype.initShaders = function(){


  var fragmentShader = getShader(this.gl, "./js/glsl/histogram.frag", true);
  var vertexShader = getShader(this.gl, "./js/glsl/histogram.vert", false);

  this.histogramShader = this.gl.createProgram();
  this.gl.attachShader(this.histogramShader, vertexShader);
  this.gl.attachShader(this.histogramShader, fragmentShader);
  this.gl.linkProgram(this.histogramShader);

  if (!this.gl.getProgramParameter(this.histogramShader, this.gl.LINK_STATUS)) {
    alert("Could not initialise shaders");
  }

  this.gl.useProgram(this.histogramShader);

  this.histogramShader.vertexPositionAttribute = this.gl.getAttribLocation(this.histogramShader, "aVertexPosition");
  this.gl.enableVertexAttribArray(this.histogramShader.vertexPositionAttribute);

  this.histogramShader.textureCoordAttribute = this.gl.getAttribLocation(this.histogramShader, "aTexCoord");
  this.gl.enableVertexAttribArray(this.histogramShader.textureCoordAttribute);

  this.histogramShader.numBinsScatter = this.gl.getUniformLocation(this.histogramShader, 'uNumBinsScatter');
  this.histogramShader.numBinsHistogram = this.gl.getUniformLocation(this.histogramShader, 'uNumBinsHistogram');
  this.histogramShader.numDim = this.gl.getUniformLocation(this.histogramShader, 'uNumDim');
  this.histogramShader.selectionDim = this.gl.getUniformLocation(this.histogramShader, 'uSelectionDim');
  this.histogramShader.selectionBinRange = this.gl.getUniformLocation(this.histogramShader, 'uSelectionBinRange');
  this.histogramShader.dim = this.gl.getUniformLocation(this.histogramShader, 'uDim');

  this.histogramShader.pMatrixUniform = this.gl.getUniformLocation(this.histogramShader, "uPMatrix");
  this.histogramShader.mvMatrixUniform = this.gl.getUniformLocation(this.histogramShader, "uMVMatrix");

  this.gl.useProgram(null);

}

Histogram.prototype.initGL = function(){

  this.gl = this.canvas[0].getContext("experimental-webgl");
  this.gl.viewportWidth = this.numbinhistogram;
  this.gl.viewportHeight = 1;

  this.gl.disable(this.gl.DEPTH_TEST);
  this.gl.disable(this.gl.BLEND);

  if (!this.gl){
    alert("Could not initialise Webgl.");
  }

}