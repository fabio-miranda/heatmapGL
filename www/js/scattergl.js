
measureTime = false;
avgtime = []
avgtimesize = 10;
var now;
function starttime(gl){
  now = window.performance.now();
}

function endtime(gl){
  //glfinish does not work (equal to glflush)
  //to make sure everything is done by the time we measure the time, just do a readPixels, instead of glfinish
  var pixelValues = new Uint8Array(4 * 1);
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixelValues);
  
  return (window.performance.now() - now);
  //console.log('Time: '+(window.performance.now() - now));
}

function SelectionQuad(gl){
  this.quad = new quad(gl, false);
  this.p0 = [0, 0];
  this.p1 = [0, 0];
  this.bottomleft = [0, 0];
  this.topright = [0, 0];//[gl.viewportWidth, gl.viewportHeight];
}

function Datatile(gl, image, imgsize, numpoints, numdim, dim1, dim2, dim3, numbin, minvalue, maxvalue){
  this.image = image;
  this.imgsize = imgsize;
  this.numpoints = numpoints;
  this.numdim = numdim;
  this.numbin = numbin;
  this.minvalue = minvalue;
  this.maxvalue = maxvalue;
  this.dim1 = dim1;
  this.dim2 = dim2;
  this.dim3 = dim3;

  this.texture = gl.createTexture();
  createTextureFromImage(gl, gl.NEAREST, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.image, this.texture);
}

SelectionQuad.prototype.updateBB = function(){
  this.bottomleft[0] = Math.min(this.p0[0], this.p1[0]);
  this.bottomleft[1] = Math.min(this.p0[1], this.p1[1]);
  this.topright[0] = Math.max(this.p0[0], this.p1[0]);
  this.topright[1] = Math.max(this.p0[1], this.p1[1]);
}


function ScatterGL(canvas, numdim, numentries, useStreaming, isLine, opt_kdetype, opt_bandwidth, opt_alpha) {
  this.canvas = canvas;
  this.gl = null;
  this.numdim = numdim;
  this.numentries = numentries;
  this.scatterShader = null;
  this.selectionShader = null;
  this.mvMatrix = mat4.create();
  this.pMatrix = mat4.create();
  this.windowpMatrix = mat4.create();
  this.mousestate = 'MOUSEUP';
  this.devicePixelRatio = 1;
  this.bandwidth = opt_bandwidth || 0.01;
  this.contourWidth = 0.0;
  this.alphaMultiplier = opt_alpha || 1.0;
  this.kdetype = opt_kdetype || 'singlekde';
  this.drawReady = false;
  this.drawOutliers = false;
  this.zoomLevel = 0.0;
  this.outliersThreshold = 0.5;
  this.outliersSize = 4.0;
  this.translation = [0.0,0.0];
  this.latlng = null;
  this.flagUpdateTexture = false;
  this.windowSize = 128;
  this.meanSize = 64;
  this.pointSize = 1.0;
  if(useStreaming)
    this.useStreaming = 1.0;
  else
    this.useStreaming = 0.0;
  this.normalize = true;
  this.contour = true;

  this.FIRST_VALID_COLOR_SCALE_VALUE = 4 * 10;

  this.numbin = 0;
  this.datatiles = {};
  this.histogram = null;
  this.colorscaletex = null;
  this.useDensity = 0;

  this.initGL();
  this.initShaders();

  this.fbo1 = this.gl.createFramebuffer();
  this.fbotex1 = this.gl.createTexture();
  this.fbo2 = this.gl.createFramebuffer();
  this.fbotex2 = this.gl.createTexture();
  this.fbof = this.gl.createFramebuffer();
  this.fbotexf = this.gl.createTexture();
  this.fbofinal = this.gl.createFramebuffer();
  this.fbotexfinal = this.gl.createTexture();
  this.fbocount = this.gl.createFramebuffer();
  this.fbotexcount = this.gl.createTexture();
  //createFBO(this.gl, this.canvas.width, this.canvas.height, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.fbotex, this.fbo);

  this.gausstex = this.gl.createTexture();

  this.scatterquad = new quad(this.gl, true);

  this.finalquad = new quad(this.gl, true);

  this.selection = new SelectionQuad(this.gl);

  if(isLine){
    this.isLine = 1.0;
    this.primitives = new lines(this.gl, true);
  }
  else{
    this.isLine = 0.0;
    this.primitives = new points(this.gl, true);
  }

  //this.createGaussianTex();

}


ScatterGL.prototype.setTexturesSize = function(numbin){

  this.numbin = numbin;

   //For float textures, only NEAREST is supported? (http://www.khronos.org/registry/gles/extensions/OES/OES_texture_float.txt)
  createFBO(this.gl, this.gl.LINEAR, numbin, numbin, this.gl.RGBA, this.gl.RGBA, this.gl.FLOAT, this.fbotex1, this.fbo1);
  createFBO(this.gl, this.gl.LINEAR, numbin, numbin, this.gl.RGBA, this.gl.RGBA, this.gl.FLOAT, this.fbotex2, this.fbo2);
  createFBO(this.gl, this.gl.LINEAR, numbin, numbin, this.gl.RGBA, this.gl.RGBA, this.gl.FLOAT, this.fbotexfinal, this.fbofinal);
  createFBO(this.gl, this.gl.LINEAR, numbin, numbin, this.gl.RGBA, this.gl.RGBA, this.gl.FLOAT, this.fbotexf, this.fbof);
  createFBO(this.gl, this.gl.LINEAR, numbin, numbin, this.gl.RGBA, this.gl.RGBA, this.gl.FLOAT, this.fbotexcount, this.fbocount);

  //testing reduction
  this.reduction = new reduction(this.gl, this.numbin);

}


ScatterGL.prototype.setHistogram = function(histogram){

  this.histogram = histogram;

}

ScatterGL.prototype.setColorScale = function(colorscalevalues){
  // Saves values for future use.
  this.colorScaleValues = colorscalevalues;

  //No shared resource. I create the texture two times, one for each canvas
  this.colorscaletex = this.gl.createTexture();
  createTextureFromArray(this.gl, this.gl.NEAREST, colorscalevalues.length/4, 1, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, colorscalevalues, this.colorscaletex);

  this.flagUpdateTexture = true;

}

ScatterGL.prototype.setGeoInfo = function(latlng0, latlng1){

  this.latlng = [];
  this.latlng[0] = latlng0;
  this.latlng[1] = latlng1;

}

ScatterGL.prototype.changeBandwidth = function(bandwidth){
  if (bandwidth == this.bandwidth) {
    return;
  }

  this.bandwidth = bandwidth;
  //this.createGaussianTex();

  this.flagUpdateTexture = true;

}

/*
ScatterGL.prototype.changeBandwidthMultiplier = function(bandwidthmultiplier){

  if (bandwidthmultiplier == this.bandwidthmultiplier) {
    return;
  }

  this.bandwidthmultiplier = bandwidthmultiplier;

  this.flagUpdateTexture = true;

}
*/

ScatterGL.prototype.setContourWidth = function(contourWidth){

  this.contourWidth = contourWidth;

  this.flagUpdateTexture = true;

}

ScatterGL.prototype.setContour = function(contour){

  this.contour = contour;

  this.flagUpdateTexture = true;

}

ScatterGL.prototype.setNormalize = function(normalize){

  this.normalize = normalize;

  this.flagUpdateTexture = true;

}

ScatterGL.prototype.setAlphaMultiplier = function(alphaMultiplier){
  //console.log(alphaMultiplier);
  this.alphaMultiplier = alphaMultiplier;

  this.flagUpdateTexture = true;

}

ScatterGL.prototype.setPointSize = function(size){
  this.pointSize = size;
}

ScatterGL.prototype.changeZoom = function(delta){
  this.zoomLevel += delta;
  this.flagUpdateTexture = true;
}

ScatterGL.prototype.setZoom = function(zoomLevel){
  this.zoomLevel = zoomLevel;
  this.flagUpdateTexture = true;
}

ScatterGL.prototype.changeKDEType = function(kdetype){

  this.kdetype = kdetype;

  this.flagUpdateTexture = true;

}

ScatterGL.prototype.changeOutliers = function(drawOutliers){

  this.drawOutliers = drawOutliers;

  this.flagUpdateTexture = true;

}

ScatterGL.prototype.setOutliersThreshold = function(value){

  this.outliersThreshold = value;

  this.flagUpdateTexture = true;

}

ScatterGL.prototype.setOutliersSize = function(value){

  this.outliersSize = value;

  this.flagUpdateTexture = true;

}

ScatterGL.prototype.changeWindowSize = function(windowSize){

  this.windowSize = windowSize;

  //this.createGaussianTex();

  this.flagUpdateTexture = true;

}

ScatterGL.prototype.changeMeanSize = function(meanSize){

  this.meanSize = meanSize;

  this.flagUpdateTexture = true;

}


ScatterGL.prototype.getSelection = function(){

  var uSelectionQuad = {};
  uSelectionQuad.x = this.selection.bottomleft[0] / this.gl.viewportWidth;
  uSelectionQuad.y = this.selection.bottomleft[1] / this.gl.viewportHeight;
  uSelectionQuad.z = this.selection.topright[0] / this.gl.viewportWidth;
  uSelectionQuad.w = this.selection.topright[1] / this.gl.viewportHeight;
  var sizeBin = (1.0 / (this.maxdim + 1.0)) / this.numbin;
  var datatilei = Math.floor(uSelectionQuad.z * (this.maxdim+1));
  var datatilej = Math.floor(uSelectionQuad.w * (this.maxdim+1));
  var rangei0 = Math.floor((uSelectionQuad.x / sizeBin) - datatilei * this.numbin);
  var rangei1 = Math.floor((uSelectionQuad.z / sizeBin) - datatilei * this.numbin);
  var rangej0 = Math.floor((uSelectionQuad.y / sizeBin) - datatilej * this.numbin);
  var rangej1 = Math.floor((uSelectionQuad.w / sizeBin) - datatilej * this.numbin);

  var selection = {};
  selection.datatilei = datatilei;
  selection.datatilej = datatilej;
  selection.rangei0 = rangei0;
  selection.rangei1 = rangei1;
  selection.rangej0 = rangej0;
  selection.rangej1 = rangej1;

  return selection;

}

ScatterGL.prototype.updateSinglePassKDE = function(map, canvaslayer){

  //this.drawTexture();
  //return;
  this.gl.disable(this.gl.DEPTH_TEST);
  this.gl.enable(this.gl.BLEND);
  this.gl.blendFunc(this.gl.ONE, this.gl.ONE);

  var width = this.canvas.width;
  var height = this.canvas.height;

  mat4.identity(this.mvMatrix);

  this.gl.useProgram(this.singlepass_kdeShader);
  //this.gl.viewport(0, 0, this.numbin, this.numbin);

  if(width > height)
    this.gl.viewport(0, 0, this.numbin, (height/width)*this.numbin);
  else
    this.gl.viewport(0, 0, (width/height)*this.numbin, this.numbin);

  this.gl.uniform1f(this.singlepass_kdeShader.bandwidth, this.bandwidth);
  this.gl.uniform1f(this.singlepass_kdeShader.numPoints, this.primitives.numrasterpoints);
  this.gl.uniform1f(this.singlepass_kdeShader.numBins, this.numbin);
  this.gl.uniform1f(this.singlepass_kdeShader.kernelSize, this.windowSize);


  if(map != null && canvaslayer != null && map.getProjection() != null){
    var mapProjection = map.getProjection();

    mat4.copy(this.pMatrix, [2/width, 0, 0, 0, 0, -2/height, 0, 0, 0, 0, 0, 0, -1, 1, 0, 1]);

    var scale = Math.pow(2, map.zoom);

    var offset = mapProjection.fromLatLngToPoint(canvaslayer.getTopLeft());
    var pos0 = mapProjection.fromLatLngToPoint(this.latlng[0]); //bounding box 
    var pos1 = mapProjection.fromLatLngToPoint(this.latlng[1]); //bounding box


    mat4.scale(this.pMatrix, this.pMatrix, [scale, scale, 0]);
    mat4.translate(this.pMatrix, this.pMatrix, [-offset.x, -offset.y, 0.0]);

    mat4.translate(this.mvMatrix, this.mvMatrix, [pos0.x, pos0.y, 0]);
    mat4.scale(this.mvMatrix, this.mvMatrix, [pos1.x-pos0.x,pos1.y-pos0.y,1]);
  }
  else{
    mat4.ortho(this.pMatrix, 0, 1, 0, 1, 0, 1);

    mat4.translate(this.mvMatrix, this.mvMatrix, [this.translation[0]/width, this.translation[1]/height, 0]);
    mat4.scale(this.mvMatrix, this.mvMatrix, [1.0+this.zoomLevel, 1.0+this.zoomLevel, 0]);
  }



  this.gl.bindFramebuffer( this.gl.FRAMEBUFFER, this.fbof);
  this.gl.clear(this.gl.COLOR_BUFFER_BIT);

  //TODO: make sure this.primitives.array have the GROUPS, not some other variable
  for(group in this.primitives.array)
    this.primitives.draw(this.singlepass_kdeShader, this.mvMatrix, this.pMatrix, group, this.gausstex);
    
  this.gl.bindFramebuffer( this.gl.FRAMEBUFFER, null);
  this.gl.useProgram(null);

  this.gl.disable(this.gl.BLEND);


  this.updateShade(0, 1);


}

ScatterGL.prototype.updateSinglePassAKDE = function(){

  //this.drawTexture();
  //return;
  this.gl.disable(this.gl.DEPTH_TEST);
  this.gl.enable(this.gl.BLEND);

  var width = this.canvas.width;
  var height = this.canvas.height;

  mat4.identity(this.mvMatrix);

  var ratiox, ratioy;

  
  if(width > height){
    ratiox = 1.0;
    ratioy = (height/width);
    //alert('multiply y by:');
    //alert((height/width));
  }
  else{
    ratiox = (width/height);
    ratioy = 1.0;
    //alert('multiply x by:');
    //alert((width/height));
  }
  
  this.gl.viewport(0, 0, ratiox*this.numbin, ratioy*this.numbin);


  if(map != null && canvaslayer != null && map.getProjection() != null){
    var mapProjection = map.getProjection();

    mat4.copy(this.pMatrix, [2/width, 0, 0, 0, 0, -2/height, 0, 0, 0, 0, 0, 0, -1, 1, 0, 1]);

    var scale = Math.pow(2, map.zoom);

    var offset = mapProjection.fromLatLngToPoint(canvaslayer.getTopLeft());
    var pos0 = mapProjection.fromLatLngToPoint(this.latlng[0]); //bounding box 
    var pos1 = mapProjection.fromLatLngToPoint(this.latlng[1]); //bounding box


    mat4.scale(this.pMatrix, this.pMatrix, [scale, scale, 0]);
    mat4.translate(this.pMatrix, this.pMatrix, [-offset.x, -offset.y, 0.0]);

    mat4.translate(this.mvMatrix, this.mvMatrix, [pos0.x, pos0.y, 0]);
    mat4.scale(this.mvMatrix, this.mvMatrix, [pos1.x-pos0.x,pos1.y-pos0.y,1]);
  }
  else{
    mat4.ortho(this.pMatrix, 0, 1, 0, 1, 0, 1);

    mat4.translate(this.mvMatrix, this.mvMatrix, [this.translation[0]/width, this.translation[1]/height, 0]);
    mat4.scale(this.mvMatrix, this.mvMatrix, [1.0+this.zoomLevel, 1.0+this.zoomLevel, 0]);
  }



  //first pass
  {

    this.gl.blendFunc(this.gl.ONE, this.gl.ONE);

    this.gl.useProgram(this.singlepass_akdeShader[0]);
    this.gl.uniform1f(this.singlepass_akdeShader[0].bandwidth, this.bandwidth);
    this.gl.uniform1f(this.singlepass_akdeShader[0].numPoints, this.primitives.numrasterpoints);
    this.gl.uniform1f(this.singlepass_akdeShader[0].numBins, this.numbin);
    this.gl.uniform1f(this.singlepass_akdeShader[0].kernelSize, this.windowSize);


    this.gl.bindFramebuffer( this.gl.FRAMEBUFFER, this.fbo1); //fbo1
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    //TODO: make sure this.primitives.array have the GROUPS, not some other variable
    for(group in this.primitives.array)
      this.primitives.draw(this.singlepass_akdeShader[0], this.mvMatrix, this.pMatrix, group, this.gausstex);
      
    this.gl.bindFramebuffer( this.gl.FRAMEBUFFER, null);
    this.gl.useProgram(null);
  }

  //return;

  //console.log("First pass: "+this.reduction.reduce(this.fbotex1));
  

  //second pass
  {

    //
    /*
    var mapProjection = map.getProjection();

    mat4.copy(this.pMatrix, [2/this.numbin, 0, 0, 0, 0, -2/this.numbin, 0, 0, 0, 0, 0, 0, -1, 1, 0, 1]);

    var scale = Math.pow(2, map.zoom);

    var offset = mapProjection.fromLatLngToPoint(canvaslayer.getTopLeft());
    var pos0 = mapProjection.fromLatLngToPoint(this.latlng[0]); //bounding box 
    var pos1 = mapProjection.fromLatLngToPoint(this.latlng[1]); //bounding box


    mat4.scale(this.pMatrix, this.pMatrix, [scale, scale, 0]);
    mat4.translate(this.pMatrix, this.pMatrix, [-offset.x, -offset.y, 0.0]);
    */

    //
    //this.gl.viewport(0, 0, 1, 1);
    
    mat4.ortho(this.windowpMatrix, 0, 1, 0, 1, 0, 1);

    //this.gl.blendFunc(this.gl.ONE, this.gl.ONE);
    this.gl.blendFunc(this.gl.ONE, this.gl.ONE);
    //this.gl.blendFunc(this.gl.DST_COLOR, this.gl.ONE);

    this.gl.useProgram(this.singlepass_akdeShader[1]);
    this.gl.uniform1f(this.singlepass_akdeShader[1].bandwidth, this.bandwidth);
    this.gl.uniform1f(this.singlepass_akdeShader[1].numPoints, this.primitives.numrasterpoints);
    this.gl.uniform1f(this.singlepass_akdeShader[1].numBins, this.numbin);
    this.gl.uniform1f(this.singlepass_akdeShader[1].kernelSize, this.windowSize);
    this.gl.uniformMatrix4fv(this.singlepass_akdeShader[1].originalpMatrixUniform, false, this.pMatrix);
    this.gl.uniform2f(this.singlepass_akdeShader[1].aspectRatio, ratiox, ratioy);

    this.gl.bindFramebuffer( this.gl.FRAMEBUFFER, this.fbo2); //fbo2
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    

    //TODO: make sure this.primitives.array have the GROUPS, not some other variable
    for(group in this.primitives.array)
      this.primitives.draw(this.singlepass_akdeShader[1], this.mvMatrix, this.windowpMatrix, group, this.fbotex1); //this.fbotexf
      
    this.gl.bindFramebuffer( this.gl.FRAMEBUFFER, null);
    this.gl.useProgram(null);
    
  }


  //read back geomean value:
  /*
  this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.fbo2);
  outputStorage = new Uint8Array(1 * 1 * 4);
  this.gl.readPixels(0, 0, 1, 1, this.gl.RGBA, this.gl.UNSIGNED_BYTE, outputStorage);
  this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  outputConverted = new Float32Array(outputStorage.buffer);
  console.log(outputConverted[0]);
  */


  //console.log("Second pass: "+this.reduction.reduce(this.fbotex2));

  //return;
  
  //third pass
  {
    
    //this.gl.viewport(0, 0, ratiox*this.numbin, ratioy*this.numbin);

    //this.gl.blendFunc(this.gl.ONE, this.gl.ZERO);
    this.gl.blendFunc(this.gl.ONE, this.gl.ONE);

    this.gl.useProgram(this.singlepass_akdeShader[2]);
    this.gl.uniform1f(this.singlepass_akdeShader[2].bandwidth, this.bandwidth);
    this.gl.uniform1f(this.singlepass_akdeShader[2].numPoints, this.primitives.numrasterpoints);
    this.gl.uniform1f(this.singlepass_akdeShader[2].numBins, this.numbin);
    this.gl.uniform1f(this.singlepass_akdeShader[2].kernelSize, this.windowSize);
    this.gl.uniform2f(this.singlepass_akdeShader[2].aspectRatio, ratiox, ratioy);


    this.gl.bindFramebuffer( this.gl.FRAMEBUFFER, this.fbof);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    //TODO: make sure this.primitives.array have the GROUPS, not some other variable
    for(group in this.primitives.array)
      this.primitives.draw(this.singlepass_akdeShader[2], this.mvMatrix, this.pMatrix, group, this.fbotex1, this.fbotex2, this.gausstex);
      
    this.gl.bindFramebuffer( this.gl.FRAMEBUFFER, null);
    this.gl.useProgram(null);
    
  }
  //return;

  //console.log("Third pass: "+this.reduction.reduce(this.fbotexf));
  
  this.gl.disable(this.gl.BLEND);
  this.updateShade(0, 1);

  //console.log("Second pass: "+this.reduction.reduce(this.fbotex2));
  //var minmax = this.reduction.reduce(this.fbotex2);
  //var geomean = Math.pow(Math.E, minmax[1] / 24753.0);
  //console.log(geomean);
}

ScatterGL.prototype.updateKDE = function(pass, numgroups, width, height){

  this.gl.useProgram(this.multipass_kdeShader);

  //horizontal pass
  this.gl.viewport(0, 0, this.numbin, this.numbin);
  //this.gl.viewport(0, 0, width, height);
  this.gl.bindFramebuffer( this.gl.FRAMEBUFFER, this.fbo1);
  this.gl.uniform1f(this.multipass_kdeShader.numBins, this.numbin);

  if(this.useStreaming > 0){
    if(this.isLine) {
      this.gl.uniform1f(this.multipass_kdeShader.numPoints, this.primitives.numrasterpoints * this.numbin);
    } else {
      // TODO Cesar: change to max of all frames.
      //var MAX_NUM_POINTS_PER_FRAME = 20000;
      this.gl.uniform1f(this.multipass_kdeShader.numPoints, this.primitives.numrasterpoints);
      //this.gl.uniform1f(this.multipass_kdeShader.numPoints, MAX_NUM_POINTS_PER_FRAME);
    }
    this.gl.uniform1f(this.multipass_kdeShader.minCountValue, 0);
    this.gl.uniform1f(this.multipass_kdeShader.maxCountValue, 1);
    this.gl.uniform1f(this.multipass_kdeShader.minIndexValue, 0);
    this.gl.uniform1f(this.multipass_kdeShader.maxIndexValue, 1);
    this.gl.uniform1f(this.multipass_kdeShader.minEntryValue, 0);
    this.gl.uniform1f(this.multipass_kdeShader.maxEntryValue, 1);
    this.gl.uniform1f(this.multipass_kdeShader.entryDataTileWidth, 0);
    this.gl.uniform1f(this.multipass_kdeShader.passValue, pass);
  }
  else{
    this.gl.uniform1f(this.multipass_kdeShader.numPoints, this.datatiles['count'].numpoints);
    this.gl.uniform1f(this.multipass_kdeShader.minCountValue, this.datatiles['count'].minvalue);
    this.gl.uniform1f(this.multipass_kdeShader.maxCountValue, this.datatiles['count'].maxvalue);
    this.gl.uniform1f(this.multipass_kdeShader.minIndexValue, this.datatiles['index'].minvalue);
    this.gl.uniform1f(this.multipass_kdeShader.maxIndexValue, this.datatiles['index'].maxvalue);
    this.gl.uniform1f(this.multipass_kdeShader.minEntryValue, this.datatiles['entry'].minvalue);
    this.gl.uniform1f(this.multipass_kdeShader.maxEntryValue, this.datatiles['entry'].maxvalue);
    this.gl.uniform1f(this.multipass_kdeShader.entryDataTileWidth, this.datatiles['entry'].imgsize);
    this.gl.uniform1f(this.multipass_kdeShader.passValue, this.datatiles['entry'].minvalue+pass);
  }

  this.gl.uniform1f(this.multipass_kdeShader.bandwidth, this.bandwidth);
  this.gl.uniform1f(this.multipass_kdeShader.windowSize, this.windowSize);
  this.gl.uniform1f(this.multipass_kdeShader.isFirstPass, 1.0);
  this.gl.uniform1f(this.multipass_kdeShader.useStreaming, this.useStreaming);
  this.gl.uniform1f(this.multipass_kdeShader.useDensity, this.useDensity);
  this.gl.uniform1f(this.multipass_kdeShader.numPassValues, numgroups);
  this.gl.clear(this.gl.COLOR_BUFFER_BIT);

  var texcount, texindex, texentry;
  if(this.useStreaming > 0){
    texcount = this.fbotexcount;
    texindex = null;
    texentry = null;
  }
  else{
    texcount = this.datatiles['count'].texture;
    texindex = this.datatiles['index'].texture;
    texentry = this.datatiles['entry'].texture;
  }

  this.scatterquad.draw(
    this.multipass_kdeShader,
    this.mvMatrix,
    this.pMatrix,
    texcount,
    this.colorscaletex,
    texindex,
    texentry
  );
  this.gl.bindFramebuffer( this.gl.FRAMEBUFFER, null );
  //return;

  //vertical pass
  this.gl.viewport(0, 0, this.numbin, this.numbin);
  //this.gl.viewport(i*width, j*height, width, height);
  this.gl.bindFramebuffer( this.gl.FRAMEBUFFER, this.fbof);
  if(pass==0)
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  this.gl.uniform1f(this.multipass_kdeShader.isFirstPass, 0.0);
  
  this.scatterquad.draw(
    this.multipass_kdeShader,
    this.mvMatrix,
    this.pMatrix,
    this.fbotex1,
    this.colorscaletex,
    texindex,
    texentry,
    this.fbotexfinal
  );
  this.gl.bindFramebuffer( this.gl.FRAMEBUFFER, null );

  this.gl.useProgram(null);
}

ScatterGL.prototype.updateSingleAKDEPass = function(akdePass, isHorizontal, pass, numgroups, texcount, texindex, texentry, texold){


  if(this.useStreaming > 0){
    if(this.isLine)
      this.gl.uniform1f(this.multipass_akdeShader[akdePass].numPoints, this.primitives.numrasterpoints * this.numbin);
    else
      this.gl.uniform1f(this.multipass_akdeShader[akdePass].numPoints, this.primitives.numrasterpoints);

    this.gl.uniform1f(this.multipass_akdeShader[akdePass].minCountValue, 0);
    this.gl.uniform1f(this.multipass_akdeShader[akdePass].maxCountValue, 1);
    this.gl.uniform1f(this.multipass_akdeShader[akdePass].minIndexValue, 0);
    this.gl.uniform1f(this.multipass_akdeShader[akdePass].maxIndexValue, 1);
    this.gl.uniform1f(this.multipass_akdeShader[akdePass].minEntryValue, 0);
    this.gl.uniform1f(this.multipass_akdeShader[akdePass].maxEntryValue, 1);
    this.gl.uniform1f(this.multipass_akdeShader[akdePass].entryDataTileWidth, 0);
    this.gl.uniform1f(this.multipass_akdeShader[akdePass].passValue, pass);
  }
  else{
    this.gl.uniform1f(this.multipass_akdeShader[akdePass].numPoints, this.datatiles['count'].numpoints);
    this.gl.uniform1f(this.multipass_akdeShader[akdePass].minCountValue, this.datatiles['count'].minvalue);
    this.gl.uniform1f(this.multipass_akdeShader[akdePass].maxCountValue, this.datatiles['count'].maxvalue);
    this.gl.uniform1f(this.multipass_akdeShader[akdePass].minIndexValue, this.datatiles['index'].minvalue);
    this.gl.uniform1f(this.multipass_akdeShader[akdePass].maxIndexValue, this.datatiles['index'].maxvalue);
    this.gl.uniform1f(this.multipass_akdeShader[akdePass].minEntryValue, this.datatiles['entry'].minvalue);
    this.gl.uniform1f(this.multipass_akdeShader[akdePass].maxEntryValue, this.datatiles['entry'].maxvalue);
    this.gl.uniform1f(this.multipass_akdeShader[akdePass].entryDataTileWidth, this.datatiles['entry'].imgsize);
    this.gl.uniform1f(this.multipass_kdeShader.passValue, this.datatiles['entry'].minvalue+pass);
  }

  this.gl.uniform1f(this.multipass_akdeShader[akdePass].numBins, this.numbin);
  this.gl.uniform1f(this.multipass_akdeShader[akdePass].useStreaming, this.useStreaming);
  this.gl.uniform1f(this.multipass_akdeShader[akdePass].bandwidth, this.bandwidth);
  this.gl.uniform1f(this.multipass_akdeShader[akdePass].windowSize, this.windowSize);
  this.gl.uniform1f(this.multipass_akdeShader[akdePass].isFirstPass, isHorizontal);
  this.gl.uniform1f(this.multipass_akdeShader[akdePass].useDensity, this.useDensity);
  this.gl.uniform1f(this.multipass_akdeShader[akdePass].numPassValues, numgroups);


  this.scatterquad.draw(
    this.multipass_akdeShader[akdePass],
    this.mvMatrix,
    this.pMatrix,
    texcount,
    this.colorscaletex,
    texindex,
    texentry,
    texold
  );

}

ScatterGL.prototype.updateAKDE = function(pass, numgroups, width, height){
  
  var texcount, texindex, texentry;
  if(this.useStreaming > 0){
    texcount = this.fbotexcount;
    texindex = null;
    texentry = null;
  }
  else{
    texcount = this.datatiles['count'].texture;
    texindex = this.datatiles['index'].texture;
    texentry = this.datatiles['entry'].texture;
  }

  //first pass (f)
  {
    this.gl.useProgram(this.multipass_akdeShader[0]);

    //horizontal pass
    this.gl.viewport(0, 0, this.numbin, this.numbin);
    //this.gl.viewport(i*width, j*height, width, height);
    this.gl.bindFramebuffer( this.gl.FRAMEBUFFER, this.fbo1);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.updateSingleAKDEPass(0, 1, pass, numgroups, texcount);
    this.gl.bindFramebuffer( this.gl.FRAMEBUFFER, null );
    //return;

    //vertical pass
    this.gl.viewport(0, 0, this.numbin, this.numbin);
    //this.gl.viewport(i*width, j*height, width, height);
    this.gl.bindFramebuffer( this.gl.FRAMEBUFFER, this.fbo2);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.updateSingleAKDEPass(0, 0, pass, numgroups, this.fbotex1);
    this.gl.bindFramebuffer( this.gl.FRAMEBUFFER, null );
  }

  //return;


  //second pass (g)
  /*
  {
    this.gl.useProgram(this.multipass_akdeShader[1]);

    this.gl.uniform1f(this.multipass_akdeShader[1].meanSize, this.meanSize);

    //horizontal pass
    this.gl.viewport(0, 0, this.numbin, this.numbin);
    //this.gl.viewport(i*width, j*height, width, height);
    this.gl.bindFramebuffer( this.gl.FRAMEBUFFER, this.fbo1);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.updateSingleAKDEPass(1, 1, pass, numgroups, this.fbotex2, texindex, texentry);
    this.gl.bindFramebuffer( this.gl.FRAMEBUFFER, null );
    //return;
  }
  //return;
  */
  //second pass
  /*
  {

    var width = this.canvas.width;
    var height = this.canvas.height;

    mat4.identity(this.mvMatrix);

    this.gl.useProgram(this.pointShader);

    if(width > height)
      this.gl.viewport(0, 0, this.numbin, (height/width)*this.numbin);
    else
      this.gl.viewport(0, 0, (width/height)*this.numbin, this.numbin);
    this.gl.viewport(0, 0, this.numbin, this.numbin);

    var mapProjection = map.getProjection();

    mat4.copy(this.pMatrix, [2/width, 0, 0, 0, 0, -2/height, 0, 0, 0, 0, 0, 0, -1, 1, 0, 1]);

    var scale = Math.pow(2, map.zoom);

    var offset = mapProjection.fromLatLngToPoint(canvaslayer.getTopLeft());
    var pos0 = mapProjection.fromLatLngToPoint(this.latlng[0]); //bounding box 
    var pos1 = mapProjection.fromLatLngToPoint(this.latlng[1]); //bounding box

    //pos0.y*=1.001;
    //pos1.y*=1.1;

    var max = Math.max(pos1.x-pos0.x,pos1.y-pos0.y);


    mat4.scale(this.pMatrix, this.pMatrix, [scale, scale, 0]);
    mat4.translate(this.pMatrix, this.pMatrix, [-offset.x, -offset.y, 0.0]);

    mat4.translate(this.mvMatrix, this.mvMatrix, [pos0.x, pos0.y, 0]);
    mat4.scale(this.mvMatrix, this.mvMatrix, [pos1.x-pos0.x,pos1.y-pos0.y,1]);



    this.gl.enable(this.gl.BLEND);
    //this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    //this.gl.blendFunc(this.gl.GL_DST_COLOR, this.gl.ZERO); //multiplicative blending
    this.gl.blendFunc(this.gl.ONE, this.gl.ONE);

    this.gl.useProgram(this.singlepass_akdeShader[1]);
    this.gl.uniform1f(this.singlepass_akdeShader[1].bandwidth, this.bandwidth);
    this.gl.uniform1f(this.singlepass_akdeShader[1].numPoints, this.primitives.numrasterpoints);
    this.gl.uniform1f(this.singlepass_akdeShader[1].numBins, this.numbin);
    this.gl.uniform1f(this.singlepass_akdeShader[1].kernelSize, this.windowSize);


    this.gl.bindFramebuffer( this.gl.FRAMEBUFFER, this.fbo1); //fbo1
    //this.gl.viewport(0, 0, this.numbin, this.numbin);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    //TODO: make sure this.primitives.array have the GROUPS, not some other variable
    for(group in this.primitives.array)
      this.primitives.draw(this.singlepass_akdeShader[1], this.mvMatrix, this.pMatrix, group, this.fbotex2); //this.fbotexf
      
    this.gl.bindFramebuffer( this.gl.FRAMEBUFFER, null);
    this.gl.useProgram(null);

    this.gl.disable(this.gl.BLEND);

  }
  
  return;
  */



  //third pass (^f)
  {
    this.gl.useProgram(this.multipass_akdeShader[2]);

    //horizontal pass
    this.gl.viewport(0, 0, this.numbin, this.numbin);
    //this.gl.viewport(i*width, j*height, width, height);
    this.gl.bindFramebuffer( this.gl.FRAMEBUFFER, this.fbofinal);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.updateSingleAKDEPass(2, 1, pass, numgroups, texcount, this.fbotex1, this.fbotex2); //texentry
    this.gl.bindFramebuffer( this.gl.FRAMEBUFFER, null );
    //return;

    //vertical pass
    this.gl.viewport(0, 0, this.numbin, this.numbin);
    //this.gl.viewport(i*width, j*height, width, height);
    this.gl.bindFramebuffer( this.gl.FRAMEBUFFER, this.fbof);
    if(pass==0)
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.updateSingleAKDEPass(2, 0, pass, numgroups, this.fbotexfinal, this.fbotex1, this.fbotex2);
    this.gl.bindFramebuffer( this.gl.FRAMEBUFFER, null );
  }

}

ScatterGL.prototype.updateDiscrete = function(map, canvaslayer){

  this.gl.useProgram(this.discreteShader);

  this.gl.uniform1f(this.discreteShader.pointSize, this.pointSize);
  this.gl.uniform1f(this.discreteShader.alpha, this.alphaMultiplier / 10.0);
  var colorIndex = Math.floor(0.5 * (this.FIRST_VALID_COLOR_SCALE_VALUE +
      this.colorScaleValues.length));
  var color = [
    this.colorScaleValues[colorIndex + 0] / 255,
    this.colorScaleValues[colorIndex + 1] / 255,
    this.colorScaleValues[colorIndex + 2] / 255];
  this.gl.uniform3fv(this.discreteShader.color, color);

  //this.gl.uniform1f(this.discreteShader.numPassValues, numgroups);



  //this.drawTexture();
  //return;
  this.gl.disable(this.gl.DEPTH_TEST);
  this.gl.enable(this.gl.BLEND);
  this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

  var width = this.canvas.width;
  var height = this.canvas.height;

  mat4.identity(this.mvMatrix);

  //this.gl.useProgram(this.pointShader);
  this.gl.viewport(0, 0, width, height);
  //console.log(this.numbin);

  //console.log(this.translation[0]);

  //mat4.translate(this.mvMatrix, this.mvMatrix, [this.translation[0]/this.gl.viewportWidth, this.translation[1]/this.gl.viewportHeight, 0]);
  //mat4.scale(this.mvMatrix, this.mvMatrix, [scale, scale, 0]);

  if(map != null && canvaslayer != null && map.getProjection() != null){
    var mapProjection = map.getProjection();

    mat4.copy(this.pMatrix, [2/width, 0, 0, 0, 0, -2/height, 0, 0, 0, 0, 0, 0, -1, 1, 0, 1]);

    var scale = Math.pow(2, map.zoom);

    var offset = mapProjection.fromLatLngToPoint(canvaslayer.getTopLeft());
    var pos0 = mapProjection.fromLatLngToPoint(this.latlng[0]);
    var pos1 = mapProjection.fromLatLngToPoint(this.latlng[1]);

    //pos0.y*=1.001;
    //pos1.y*=1.1;


    mat4.scale(this.pMatrix, this.pMatrix, [scale, scale, 0]);
    mat4.translate(this.pMatrix, this.pMatrix, [-offset.x, -offset.y, 0.0]);

    mat4.translate(this.mvMatrix, this.mvMatrix, [pos0.x, pos0.y, 0]);
    mat4.scale(this.mvMatrix, this.mvMatrix, [pos1.x-pos0.x,pos1.y-pos0.y,1]);

  }
  else{
    mat4.ortho(this.pMatrix, 0, 1, 0, 1, 0, 1);

    mat4.translate(this.mvMatrix, this.mvMatrix, [this.translation[0]/this.gl.viewportWidth, this.translation[1]/this.gl.viewportHeight, 0]);
    mat4.scale(this.mvMatrix, this.mvMatrix, [1.0+this.zoomLevel, 1.0+this.zoomLevel, 1]);
  }


  this.gl.clear(this.gl.COLOR_BUFFER_BIT);

  for(group in this.primitives.array)
    this.primitives.draw(this.discreteShader, this.mvMatrix, this.pMatrix, group);
    
  this.gl.useProgram(null);

  this.gl.disable(this.gl.BLEND);

}

ScatterGL.prototype.updateOutliers = function(numgroups){

  this.gl.useProgram(this.outliersShader);

  //horizontal pass
  this.gl.viewport(0, 0, this.numbin, this.numbin);
  //this.gl.viewport(i*width, j*height, width, height);
  this.gl.bindFramebuffer( this.gl.FRAMEBUFFER, this.fbo1);
  this.gl.uniform1f(this.outliersShader.minCountValue, this.datatiles['count'].minvalue);
  this.gl.uniform1f(this.outliersShader.maxCountValue, this.datatiles['count'].maxvalue);
  this.gl.uniform1f(this.outliersShader.minIndexValue, this.datatiles['index'].minvalue);
  this.gl.uniform1f(this.outliersShader.maxIndexValue, this.datatiles['index'].maxvalue);
  this.gl.uniform1f(this.outliersShader.minEntryValue, this.datatiles['entry'].minvalue);
  this.gl.uniform1f(this.outliersShader.maxEntryValue, this.datatiles['entry'].maxvalue);
  this.gl.uniform1f(this.outliersShader.numBins, this.numbin);
  this.gl.uniform1f(this.outliersShader.numPoints, this.datatiles['count'].numpoints);
  this.gl.uniform1f(this.outliersShader.bandwidth, this.bandwidth);
  this.gl.uniform1f(this.outliersShader.outliersSize, this.outliersSize);
  this.gl.uniform1f(this.outliersShader.isFirstPass, 1.0);
  this.gl.uniform1f(this.outliersShader.useDensity, this.useDensity);
  this.gl.uniform1f(this.outliersShader.entryDataTileWidth, this.datatiles['entry'].imgsize);
  this.gl.uniform1f(this.outliersShader.numPassValues, numgroups);
  this.gl.uniform1f(this.outliersShader.outliersThreshold, this.outliersThreshold);
  this.gl.clear(this.gl.COLOR_BUFFER_BIT);

  this.scatterquad.draw(
    this.outliersShader,
    this.mvMatrix,
    this.pMatrix,
    this.datatiles['count'].texture,
    this.colorscaletex,
    this.datatiles['index'].texture,
    this.datatiles['entry'].texture,
    this.fbotexfinal
  );
  this.gl.bindFramebuffer( this.gl.FRAMEBUFFER, null );
  //return;

  //vertical pass
  this.gl.viewport(0, 0, this.numbin, this.numbin);
  //this.gl.viewport(i*width, j*height, width, height);
  this.gl.bindFramebuffer( this.gl.FRAMEBUFFER, this.fbo2);

  this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  this.gl.uniform1f(this.outliersShader.isFirstPass, 0.0);
  
  this.scatterquad.draw(
    this.outliersShader,
    this.mvMatrix,
    this.pMatrix,
    this.fbotex1,
    this.colorscaletex,
    this.datatiles['index'].texture,
    this.datatiles['entry'].texture,
    this.fbotexfinal
  );
  this.gl.bindFramebuffer( this.gl.FRAMEBUFFER, null );

  this.gl.useProgram(null);

  //just send to final tex. TODO: performance hit?
  this.gl.useProgram(this.simpleShader);
  this.gl.viewport(0, 0, this.numbin, this.numbin);
  this.gl.bindFramebuffer( this.gl.FRAMEBUFFER, this.fbofinal);
  this.gl.uniform2f(this.simpleShader.scale, 1.0, 1.0);
  this.gl.uniform2f(this.simpleShader.translation, 0.0, 0.0);


  this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  
  this.scatterquad.draw(
    this.simpleShader,
    this.mvMatrix,
    this.pMatrix,
    this.fbotex2
  );
  this.gl.bindFramebuffer( this.gl.FRAMEBUFFER, null );

  this.gl.useProgram(null);

}

ScatterGL.prototype.updateShade = function(pass, numgroups){


  var maxf = 1.0;
  var minf = 0.0;
  if(this.normalize){
    //starttime(this.gl);
    minmax = this.reduction.reduce(this.fbotexf);
    minf = minmax[0];
    maxf = minmax[1];
    //console.log(minmax);
    //console.log("Reduce time: "+endtime(this.gl));
  }

  this.gl.useProgram(this.shadeShader);

  //horizontal pass
  this.gl.viewport(0, 0, this.numbin, this.numbin);
  mat4.identity(this.mvMatrix);
  mat4.ortho(this.pMatrix, 0, 1, 0, 1, 0, 1);
  //this.gl.viewport(i*width, j*height, width, height);
  this.gl.bindFramebuffer( this.gl.FRAMEBUFFER, this.fbo1);
  this.gl.uniform1f(this.shadeShader.useDensity, this.useDensity);
  this.gl.uniform1f(this.shadeShader.numBins, this.numbin);
  this.gl.uniform1f(this.shadeShader.numPassValues, numgroups);
  this.gl.uniform1f(this.shadeShader.contourWidth, this.contourWidth);
  this.gl.uniform1f(this.shadeShader.alphaMultiplier, this.alphaMultiplier);
  this.gl.uniform1f(this.shadeShader.maxf, maxf);
  this.gl.uniform1f(this.shadeShader.minf, minf);

  if(this.useStreaming > 0)
    this.gl.uniform1f(this.shadeShader.passValue, pass);
  else
    this.gl.uniform1f(this.shadeShader.passValue, this.datatiles['entry'].minvalue+pass);

  this.gl.clear(this.gl.COLOR_BUFFER_BIT);

  this.scatterquad.draw(
    this.shadeShader,
    this.mvMatrix,
    this.pMatrix,
    this.fbotexf,
    this.colorscaletex,
    this.fbotexfinal
  );
  this.gl.bindFramebuffer( this.gl.FRAMEBUFFER, null );
  //return;

  this.gl.useProgram(null);

  //just send to final tex. TODO: performance hit?
  this.gl.useProgram(this.simpleShader);
  this.gl.viewport(0, 0, this.numbin, this.numbin);
  this.gl.bindFramebuffer( this.gl.FRAMEBUFFER, this.fbofinal);
  this.gl.uniform2f(this.simpleShader.scale, 1.0, 1.0);
  this.gl.uniform2f(this.simpleShader.translation, 0.0, 0.0);


  this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  
  this.scatterquad.draw(
    this.simpleShader,
    this.mvMatrix,
    this.pMatrix,
    this.fbotex1
  );
  this.gl.bindFramebuffer( this.gl.FRAMEBUFFER, null );

  this.gl.useProgram(null);

}



ScatterGL.prototype.update = function(){

  if(this.useStreaming == false && (this.datatiles['count'] == null || this.datatiles['index'] == null || this.datatiles['entry'] == null))
    return;

  if(this.useStreaming && this.numbin == 0)
    return;
  
  this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

  //plots
  //var width = this.gl.viewportWidth / (this.maxdim + 1);
  //var height = this.gl.viewportHeight / (this.maxdim + 1);
  var width = this.canvas.width;
  var height = this.canvas.height;
  mat4.identity(this.mvMatrix);
  mat4.ortho(this.pMatrix, 0, 1, 0, 1, 0, 1);


  //this.drawReady = true;

  //TODO: performance hit?
  clearFBO(this.gl, this.fbofinal);

  //render
  var numgroups;
  var startgroup;
  //console.log(this.useDensity);
  if(this.useDensity > 0 || this.useStreaming > 0)
    numgroups = 1;
  else
    numgroups = this.datatiles['entry'].maxvalue - this.datatiles['entry'].minvalue + 1;

  
  if(this.kdetype == 'kde'){
    for(var i=0; i<numgroups; i++){
      this.updateKDE(i, numgroups, width, height);
      this.updateShade(i, numgroups);
    }
  }
  else if(this.kdetype == 'akde'){
    for(var i=0; i<numgroups; i++){
      this.updateAKDE(i, numgroups, width, height);
      this.updateShade(i, numgroups);
    }
  }
  /*
  else if(this.kdetype == 'discrete'){
    this.updateDiscrete(width, height);
  }
  */

  if(this.drawOutliers){
    this.updateOutliers(numgroups);
  }

  //this.updateContour(scatter);

  this.flagUpdateTexture = false;
  
}//

ScatterGL.prototype.updateBandwidth = function(zoom) {
  var aux = Math.pow(2.0, zoom);
  //console.log("r: "+(this.canvas.width/aux)+", "+(this.canvas.height/aux));
  var w = ((this.canvas.width/aux)/1920);
  var h = ((this.canvas.height/aux)/1200);
  console.log("s: "+w+", "+h);
  console.log("values between w: "+2.0*w+", "+20.0*w +", avg: "+(10.0*w));
  console.log("values between h: "+2.0*h+", "+20.0*h +", avg: "+(10.0*h));
  //console.log('Best bandwidth: '+(1.0 / (Math.pow(2.0, zoom))));

  //this.bandwidth = (10.0*h);
  console.log("new bandwidth: "+this.bandwidth);
  return;
  //console.log(zoom);
  //this.bandwidth = 1.0 / (Math.pow(2.0, zoom));
  //console.log(this.bandwidthmultiplier);
  //this.bandwidth *= this.bandwidthmultiplier;
}


ScatterGL.prototype.draw = function(map, canvaslayer) {


  if(measureTime)
    starttime(this.gl);

  //change bandwidth according to zoom level
  this.updateBandwidth(map.zoom);


  //this.update();

  //if(this.drawReady == false) return;

  if(this.kdetype == 'discrete'){
    this.updateDiscrete(map, canvaslayer);
    return;
  }
  else if(this.kdetype == 'singlekde'){
    this.updateSinglePassKDE(map, canvaslayer);
  }
  else if(this.kdetype == 'singleakde'){
    this.updateSinglePassAKDE();
  }
  else if(this.flagUpdateTexture == true){
    if(this.useStreaming == true)
      this.drawPoints(map,canvaslayer);
    this.update();
  }

  //var width = this.gl.viewportWidth / (this.maxdim + 1);
  //var height = this.gl.viewportHeight / (this.maxdim + 1);
  var width = this.canvas.width;
  var height = this.canvas.height;
  var maxdimension = Math.max(width, height);

  mat4.identity(this.mvMatrix);

  this.gl.useProgram(this.simpleShader);
  this.gl.viewport(0, 0, maxdimension, maxdimension);
  this.gl.clear(this.gl.COLOR_BUFFER_BIT);

  this.gl.uniform2f(this.simpleShader.scale, 1, 1);
  this.gl.uniform2f(this.simpleShader.translation, 0, 0);

  if(this.useStreaming == false && map != null && canvaslayer != null && map.getProjection() != null){
    
    var mapProjection = map.getProjection();

    mat4.copy(this.pMatrix, [2/width, 0, 0, 0, 0, -2/height, 0, 0, 0, 0, 0, 0, -1, 1, 0, 1]);

    var scale = Math.pow(2, map.zoom) ;

    var offset = mapProjection.fromLatLngToPoint(canvaslayer.getTopLeft());
    var pos0 = mapProjection.fromLatLngToPoint(this.latlng[0]);
    var pos1 = mapProjection.fromLatLngToPoint(this.latlng[1]);

    //console.log(offset);


    mat4.scale(this.pMatrix, this.pMatrix, [scale, scale, 1]);
    mat4.translate(this.pMatrix, this.pMatrix, [-offset.x, -offset.y, 0.0]);

    mat4.translate(this.mvMatrix, this.mvMatrix, [pos0.x, pos0.y, 0]);
    mat4.scale(this.mvMatrix, this.mvMatrix, [pos1.x-pos0.x,pos1.y-pos0.y,1]);
  
    //this.zoomLevel = 0;
    //this.translation[0] = 0;
    //this.translation[1] = 0;
  }
  else{
    mat4.ortho(this.pMatrix, 0, 1, 0, 1, 0, 1);

    if(this.useStreaming == false){
      this.gl.uniform2f(this.simpleShader.scale, 1.0-this.zoomLevel, 1.0-this.zoomLevel);
      this.gl.uniform2f(this.simpleShader.translation, this.translation[0]/this.gl.viewportWidth, this.translation[1]/this.gl.viewportHeight);
    }
  }

  
  
  this.finalquad.draw(
    this.simpleShader,
    this.mvMatrix,
    this.pMatrix,
    this.fbotexfinal
  );

  this.gl.useProgram(null);


  if(measureTime){
    var time = endtime(this.gl);
    avgtime.push(time);
    if(avgtime.length == avgtimesize){
      var sum=0;
      for(var i=0; i<avgtime.length; i++){
        sum+= avgtime[i];
      }
      console.log("Avg time between "+avgtimesize+" frames: "+(sum/avgtime.length));
      avgtime = [];
    }

  }

  //selection
  /*
  this.gl.useProgram(this.selectionShader);
  var width, height;
  
  width = this.selection.topright[0] - this.selection.bottomleft[0];
  height = this.selection.topright[1] - this.selection.bottomleft[1];
  if(width > 0 && height > 0){
    this.gl.viewport(this.selection.bottomleft[0], this.selection.bottomleft[1], width, height);
    this.selection.quad.draw(this.gl, this.selectionShader, this.mvMatrix, this.pMatrix);
  }
  */
}

ScatterGL.prototype.drawPoints = function(map, canvaslayer, fbo){

  if(fbo == null)
    fbo = this.fbocount;

  //this.drawTexture();
  //return;
  this.gl.disable(this.gl.DEPTH_TEST);
  this.gl.enable(this.gl.BLEND);
  this.gl.blendFunc(this.gl.ONE, this.gl.ONE);
  //this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

  var width = this.canvas.width;
  var height = this.canvas.height;

  mat4.identity(this.mvMatrix);

  this.gl.useProgram(this.pointShader);

  if(width > height)
    this.gl.viewport(0, 0, this.numbin, (height/width)*this.numbin);
  else
    this.gl.viewport(0, 0, (width/height)*this.numbin, this.numbin);
  //console.log(this.numbin);

  //console.log(this.translation[0]);

  //mat4.translate(this.mvMatrix, this.mvMatrix, [this.translation[0]/this.gl.viewportWidth, this.translation[1]/this.gl.viewportHeight, 0]);
  //mat4.scale(this.mvMatrix, this.mvMatrix, [scale, scale, 0]);

  if(map != null && canvaslayer != null && map.getProjection() != null){
    var mapProjection = map.getProjection();

    mat4.copy(this.pMatrix, [2/width, 0, 0, 0, 0, -2/height, 0, 0, 0, 0, 0, 0, -1, 1, 0, 1]);

    var scale = Math.pow(2, map.zoom);

    var offset = mapProjection.fromLatLngToPoint(canvaslayer.getTopLeft());
    var pos0 = mapProjection.fromLatLngToPoint(this.latlng[0]); //bounding box 
    var pos1 = mapProjection.fromLatLngToPoint(this.latlng[1]); //bounding box

    //pos0.y*=1.001;
    //pos1.y*=1.1;

    var max = Math.max(pos1.x-pos0.x,pos1.y-pos0.y);


    mat4.scale(this.pMatrix, this.pMatrix, [scale, scale, 0]);
    mat4.translate(this.pMatrix, this.pMatrix, [-offset.x, -offset.y, 0.0]);

    mat4.translate(this.mvMatrix, this.mvMatrix, [pos0.x, pos0.y, 0]);
    mat4.scale(this.mvMatrix, this.mvMatrix, [pos1.x-pos0.x,pos1.y-pos0.y,1]);

  }
  else{
    mat4.ortho(this.pMatrix, 0, 1, 0, 1, 0, 1);

    mat4.translate(this.mvMatrix, this.mvMatrix, [this.translation[0]/this.gl.viewportWidth, this.translation[1]/this.gl.viewportHeight, 0]);
    mat4.scale(this.mvMatrix, this.mvMatrix, [1.0+this.zoomLevel, 1.0+this.zoomLevel, 1]);
  }



  this.gl.bindFramebuffer( this.gl.FRAMEBUFFER, fbo);
  this.gl.clear(this.gl.COLOR_BUFFER_BIT);

  for(group in this.primitives.array)
    this.primitives.draw(this.pointShader, this.mvMatrix, this.pMatrix, group);
    
  this.gl.bindFramebuffer( this.gl.FRAMEBUFFER, null);
  this.gl.useProgram(null);

  this.gl.disable(this.gl.BLEND);

  //return;

  //this.updateTexture();
  //this.drawTexture(map, canvaslayer);
}


ScatterGL.prototype.initShaders = function(){
  /*
  //scatter
  var fragmentShader = getShader(this.gl, "./js/glsl/scatter.frag", true);
  var vertexShader = getShader(this.gl, "./js/glsl/scatter.vert", false);

  this.scatterShader = this.gl.createProgram();
  this.gl.attachShader(this.scatterShader, vertexShader);
  this.gl.attachShader(this.scatterShader, fragmentShader);
  this.gl.linkProgram(this.scatterShader);

  if (!this.gl.getProgramParameter(this.scatterShader, this.gl.LINK_STATUS)) {
    alert("Could not initialise shaders");
  }

  this.gl.useProgram(this.scatterShader);

  this.scatterShader.vertexPositionAttribute = this.gl.getAttribLocation(this.scatterShader, "aVertexPosition");
  this.gl.enableVertexAttribArray(this.scatterShader.vertexPositionAttribute);

  this.scatterShader.textureCoordAttribute = this.gl.getAttribLocation(this.scatterShader, "aTexCoord");
  this.gl.enableVertexAttribArray(this.scatterShader.textureCoordAttribute);

  this.scatterShader.dim = this.gl.getUniformLocation(this.scatterShader, 'uDim');
  this.scatterShader.numBins = this.gl.getUniformLocation(this.scatterShader, 'uNumBins');
  this.scatterShader.maxDim = this.gl.getUniformLocation(this.scatterShader, 'uMaxDim');
  this.scatterShader.minValue = this.gl.getUniformLocation(this.scatterShader, 'uMinValue');
  this.scatterShader.maxValue = this.gl.getUniformLocation(this.scatterShader, 'uMaxValue');
  this.scatterShader.numDim = this.gl.getUniformLocation(this.scatterShader, 'uNumDim');
  this.scatterShader.selectionDim = this.gl.getUniformLocation(this.scatterShader, 'uSelectionDim');
  this.scatterShader.selectionBinRange = this.gl.getUniformLocation(this.scatterShader, 'uSelectionBinRange');
  this.scatterShader.sampler0 = this.gl.getUniformLocation(this.scatterShader, "uSampler0");
  this.scatterShader.sampler0 = this.gl.getUniformLocation(this.scatterShader, "uSampler1");

  this.scatterShader.pMatrixUniform = this.gl.getUniformLocation(this.scatterShader, "uPMatrix");
  this.scatterShader.mvMatrixUniform = this.gl.getUniformLocation(this.scatterShader, "uMVMatrix");

  this.gl.useProgram(null);
  */
  //kde
  var fragmentShader = getShader(this.gl, "./js/glsl/multipass_kde.frag", true);
  var vertexShader = getShader(this.gl, "./js/glsl/simple.vert", false);

  this.multipass_kdeShader = this.gl.createProgram();
  this.gl.attachShader(this.multipass_kdeShader, vertexShader);
  this.gl.attachShader(this.multipass_kdeShader, fragmentShader);
  this.gl.linkProgram(this.multipass_kdeShader);

  if (!this.gl.getProgramParameter(this.multipass_kdeShader, this.gl.LINK_STATUS)) {
    alert("Could not initialise shaders");
  }

  this.gl.useProgram(this.multipass_kdeShader);

  this.multipass_kdeShader.vertexPositionAttribute = this.gl.getAttribLocation(this.multipass_kdeShader, "aVertexPosition");
  this.gl.enableVertexAttribArray(this.multipass_kdeShader.vertexPositionAttribute);

  this.multipass_kdeShader.textureCoordAttribute = this.gl.getAttribLocation(this.multipass_kdeShader, "aTexCoord");
  this.gl.enableVertexAttribArray(this.multipass_kdeShader.textureCoordAttribute);

  this.multipass_kdeShader.minCountValue = this.gl.getUniformLocation(this.multipass_kdeShader, 'uMinCountValue');
  this.multipass_kdeShader.maxCountValue = this.gl.getUniformLocation(this.multipass_kdeShader, 'uMaxCountValue');
  this.multipass_kdeShader.minIndexValue = this.gl.getUniformLocation(this.multipass_kdeShader, 'uMinIndexValue');
  this.multipass_kdeShader.maxIndexValue = this.gl.getUniformLocation(this.multipass_kdeShader, 'uMaxIndexValue');
  this.multipass_kdeShader.minEntryValue = this.gl.getUniformLocation(this.multipass_kdeShader, 'uMinEntryValue');
  this.multipass_kdeShader.maxEntryValue = this.gl.getUniformLocation(this.multipass_kdeShader, 'uMaxEntryValue');
  this.multipass_kdeShader.numBins = this.gl.getUniformLocation(this.multipass_kdeShader, 'uNumBins');
  this.multipass_kdeShader.useStreaming = this.gl.getUniformLocation(this.multipass_kdeShader, 'uUseStreaming');
  this.multipass_kdeShader.isFirstPass = this.gl.getUniformLocation(this.multipass_kdeShader, 'uIsFirstPass');
  this.multipass_kdeShader.useDensity = this.gl.getUniformLocation(this.multipass_kdeShader, 'uUseDensity');
  this.multipass_kdeShader.bandwidth = this.gl.getUniformLocation(this.multipass_kdeShader, 'uBandwidth');
  this.multipass_kdeShader.windowSize = this.gl.getUniformLocation(this.multipass_kdeShader, 'uWindowSize');
  this.multipass_kdeShader.numPoints = this.gl.getUniformLocation(this.multipass_kdeShader, 'uNumPoints');
  this.multipass_kdeShader.sampler0 = this.gl.getUniformLocation(this.multipass_kdeShader, "uSamplerCount");
  this.multipass_kdeShader.sampler1 = this.gl.getUniformLocation(this.multipass_kdeShader, "uSamplerColorScale");
  this.multipass_kdeShader.sampler2 = this.gl.getUniformLocation(this.multipass_kdeShader, "uSamplerIndex");
  this.multipass_kdeShader.sampler3 = this.gl.getUniformLocation(this.multipass_kdeShader, "uSamplerEntry");
  this.multipass_kdeShader.sampler4 = this.gl.getUniformLocation(this.multipass_kdeShader, "uSamplerFinal");
  this.multipass_kdeShader.entryDataTileWidth = this.gl.getUniformLocation(this.multipass_kdeShader, "uEntryDataTileWidth");
  this.multipass_kdeShader.passValue = this.gl.getUniformLocation(this.multipass_kdeShader, "uPassValue");
  this.multipass_kdeShader.numPassValues = this.gl.getUniformLocation(this.multipass_kdeShader, "uNumPassValues");


  this.multipass_kdeShader.pMatrixUniform = this.gl.getUniformLocation(this.multipass_kdeShader, "uPMatrix");
  this.multipass_kdeShader.mvMatrixUniform = this.gl.getUniformLocation(this.multipass_kdeShader, "uMVMatrix");

  //see: http://www.mjbshaw.com/2013/03/webgl-fixing-invalidoperation.html
  this.gl.disableVertexAttribArray(this.multipass_kdeShader.vertexPositionAttribute);
  this.gl.disableVertexAttribArray(this.multipass_kdeShader.textureCoordAttribute);

  this.gl.useProgram(null);


  //akde
  this.multipass_akdeShader = [];
  for(var i=0; i<3; i++){

    var fragmentShader = getShader(this.gl, "./js/glsl/multipass_akde"+i+".frag", true);
    var vertexShader = getShader(this.gl, "./js/glsl/simple.vert", false);

    this.multipass_akdeShader[i] = this.gl.createProgram();
    this.gl.attachShader(this.multipass_akdeShader[i], vertexShader);
    this.gl.attachShader(this.multipass_akdeShader[i], fragmentShader);
    this.gl.linkProgram(this.multipass_akdeShader[i]);

    if (!this.gl.getProgramParameter(this.multipass_akdeShader[i], this.gl.LINK_STATUS)) {
      alert("Could not initialise shaders");
    }

    this.gl.useProgram(this.multipass_akdeShader[i]);

    this.multipass_akdeShader[i].vertexPositionAttribute = this.gl.getAttribLocation(this.multipass_akdeShader[i], "aVertexPosition");
    this.gl.enableVertexAttribArray(this.multipass_akdeShader[i].vertexPositionAttribute);

    this.multipass_akdeShader[i].textureCoordAttribute = this.gl.getAttribLocation(this.multipass_akdeShader[i], "aTexCoord");
    this.gl.enableVertexAttribArray(this.multipass_akdeShader[i].textureCoordAttribute);

    this.multipass_akdeShader[i].minCountValue = this.gl.getUniformLocation(this.multipass_akdeShader[i], 'uMinCountValue');
    this.multipass_akdeShader[i].maxCountValue = this.gl.getUniformLocation(this.multipass_akdeShader[i], 'uMaxCountValue');
    this.multipass_akdeShader[i].minIndexValue = this.gl.getUniformLocation(this.multipass_akdeShader[i], 'uMinIndexValue');
    this.multipass_akdeShader[i].maxIndexValue = this.gl.getUniformLocation(this.multipass_akdeShader[i], 'uMaxIndexValue');
    this.multipass_akdeShader[i].minEntryValue = this.gl.getUniformLocation(this.multipass_akdeShader[i], 'uMinEntryValue');
    this.multipass_akdeShader[i].maxEntryValue = this.gl.getUniformLocation(this.multipass_akdeShader[i], 'uMaxEntryValue');
    this.multipass_akdeShader[i].numBins = this.gl.getUniformLocation(this.multipass_akdeShader[i], 'uNumBins');
    this.multipass_akdeShader[i].useStreaming = this.gl.getUniformLocation(this.multipass_akdeShader[i], 'uUseStreaming');
    this.multipass_akdeShader[i].isFirstPass = this.gl.getUniformLocation(this.multipass_akdeShader[i], 'uIsFirstPass');
    this.multipass_akdeShader[i].useDensity = this.gl.getUniformLocation(this.multipass_akdeShader[i], 'uUseDensity');
    this.multipass_akdeShader[i].bandwidth = this.gl.getUniformLocation(this.multipass_akdeShader[i], 'uBandwidth');
    this.multipass_akdeShader[i].windowSize = this.gl.getUniformLocation(this.multipass_akdeShader[i], 'uWindowSize');
    this.multipass_akdeShader[i].numPoints = this.gl.getUniformLocation(this.multipass_akdeShader[i], 'uNumPoints');
    this.multipass_akdeShader[i].sampler0 = this.gl.getUniformLocation(this.multipass_akdeShader[i], "uSamplerCount");
    this.multipass_akdeShader[i].sampler1 = this.gl.getUniformLocation(this.multipass_akdeShader[i], "uSamplerColorScale");
    this.multipass_akdeShader[i].sampler2 = this.gl.getUniformLocation(this.multipass_akdeShader[i], "uSamplerIndex");
    this.multipass_akdeShader[i].sampler3 = this.gl.getUniformLocation(this.multipass_akdeShader[i], "uSamplerEntry");
    this.multipass_akdeShader[i].sampler4 = this.gl.getUniformLocation(this.multipass_akdeShader[i], "uSamplerFinal");
    this.multipass_akdeShader[i].entryDataTileWidth = this.gl.getUniformLocation(this.multipass_akdeShader[i], "uEntryDataTileWidth");
    this.multipass_akdeShader[i].passValue = this.gl.getUniformLocation(this.multipass_akdeShader[i], "uPassValue");
    this.multipass_akdeShader[i].numPassValues = this.gl.getUniformLocation(this.multipass_akdeShader[i], "uNumPassValues");


    this.multipass_akdeShader[i].pMatrixUniform = this.gl.getUniformLocation(this.multipass_akdeShader[i], "uPMatrix");
    this.multipass_akdeShader[i].mvMatrixUniform = this.gl.getUniformLocation(this.multipass_akdeShader[i], "uMVMatrix");

    //see: http://www.mjbshaw.com/2013/03/webgl-fixing-invalidoperation.html
    this.gl.disableVertexAttribArray(this.multipass_akdeShader[i].vertexPositionAttribute);
    this.gl.disableVertexAttribArray(this.multipass_akdeShader[i].textureCoordAttribute);

    this.gl.useProgram(null);

  }

  this.multipass_akdeShader[1].meanSize = this.gl.getUniformLocation(this.multipass_akdeShader[1], 'uMeanSize');

  //discrete
  var fragmentShader = getShader(this.gl, "./js/glsl/discrete.frag", true);
  var vertexShader = getShader(this.gl, "./js/glsl/discrete.vert", false);

  this.discreteShader = this.gl.createProgram();
  this.gl.attachShader(this.discreteShader, vertexShader);
  this.gl.attachShader(this.discreteShader, fragmentShader);
  this.gl.linkProgram(this.discreteShader);

  if (!this.gl.getProgramParameter(this.discreteShader, this.gl.LINK_STATUS)) {
    alert("Could not initialise shaders");
  }

  this.gl.useProgram(this.discreteShader);

  this.discreteShader.vertexPositionAttribute = this.gl.getAttribLocation(this.discreteShader, "aVertexPosition");
  this.gl.enableVertexAttribArray(this.discreteShader.vertexPositionAttribute);

  //this.discreteShader.textureCoordAttribute = this.gl.getAttribLocation(this.discreteShader, "aTexCoord");
  //this.gl.enableVertexAttribArray(this.discreteShader.textureCoordAttribute);

  this.discreteShader.pointSize = this.gl.getUniformLocation(this.discreteShader, 'uPointSize');
  this.discreteShader.alpha = this.gl.getUniformLocation(this.discreteShader, 'uAlpha');
  this.discreteShader.color = this.gl.getUniformLocation(this.discreteShader, 'uColor');

  this.discreteShader.pMatrixUniform = this.gl.getUniformLocation(this.discreteShader, "uPMatrix");
  this.discreteShader.mvMatrixUniform = this.gl.getUniformLocation(this.discreteShader, "uMVMatrix");

  //see: http://www.mjbshaw.com/2013/03/webgl-fixing-invalidoperation.html
  this.gl.disableVertexAttribArray(this.discreteShader.vertexPositionAttribute);
  //this.gl.disableVertexAttribArray(this.discreteShader.textureCoordAttribute);

  this.gl.useProgram(null);
  

  //zoom
  var fragmentShader = getShader(this.gl, "./js/glsl/zoom.frag", true);
  var vertexShader = getShader(this.gl, "./js/glsl/simple.vert", false);

  this.simpleShader = this.gl.createProgram();
  this.gl.attachShader(this.simpleShader, vertexShader);
  this.gl.attachShader(this.simpleShader, fragmentShader);
  this.gl.linkProgram(this.simpleShader);

  if (!this.gl.getProgramParameter(this.simpleShader, this.gl.LINK_STATUS)) {
    alert("Could not initialise shaders");
  }

  this.gl.useProgram(this.simpleShader);

  this.simpleShader.vertexPositionAttribute = this.gl.getAttribLocation(this.simpleShader, "aVertexPosition");
  this.gl.enableVertexAttribArray(this.simpleShader.vertexPositionAttribute);

  this.simpleShader.textureCoordAttribute = this.gl.getAttribLocation(this.simpleShader, "aTexCoord");
  this.gl.enableVertexAttribArray(this.simpleShader.textureCoordAttribute);

  this.simpleShader.translation = this.gl.getUniformLocation(this.simpleShader, "uTranslation");
  this.simpleShader.scale = this.gl.getUniformLocation(this.simpleShader, "uScale");
  this.simpleShader.sampler0 = this.gl.getUniformLocation(this.simpleShader, "uSampler0");

  this.simpleShader.pMatrixUniform = this.gl.getUniformLocation(this.simpleShader, "uPMatrix");
  this.simpleShader.mvMatrixUniform = this.gl.getUniformLocation(this.simpleShader, "uMVMatrix");

  //see: http://www.mjbshaw.com/2013/03/webgl-fixing-invalidoperation.html
  this.gl.disableVertexAttribArray(this.simpleShader.vertexPositionAttribute);
  this.gl.disableVertexAttribArray(this.simpleShader.textureCoordAttribute);

  this.gl.useProgram(null);
  
  //point
  
  var fragmentShader = getShader(this.gl, "./js/glsl/point.frag", true);
  var vertexShader = getShader(this.gl, "./js/glsl/point.vert", false);

  this.pointShader = this.gl.createProgram();
  this.gl.attachShader(this.pointShader, vertexShader);
  this.gl.attachShader(this.pointShader, fragmentShader);
  this.gl.linkProgram(this.pointShader);

  if (!this.gl.getProgramParameter(this.pointShader, this.gl.LINK_STATUS)) {
    alert("Could not initialise shaders");
  }

  this.gl.useProgram(this.pointShader);

  this.pointShader.vertexPositionAttribute = this.gl.getAttribLocation(this.pointShader, "aVertexPosition");
  this.gl.enableVertexAttribArray(this.pointShader.vertexPositionAttribute);

  this.pointShader.pMatrixUniform = this.gl.getUniformLocation(this.pointShader, "uPMatrix");
  this.pointShader.mvMatrixUniform = this.gl.getUniformLocation(this.pointShader, "uMVMatrix");

  this.gl.disableVertexAttribArray(this.pointShader.vertexPositionAttribute);

  this.gl.useProgram(null);
  /*
  //outliers
  var fragmentShader = getShader(this.gl, "./js/glsl/outliers.frag", true);
  var vertexShader = getShader(this.gl, "./js/glsl/simple.vert", false);

  this.outliersShader = this.gl.createProgram();
  this.gl.attachShader(this.outliersShader, vertexShader);
  this.gl.attachShader(this.outliersShader, fragmentShader);
  this.gl.linkProgram(this.outliersShader);

  if (!this.gl.getProgramParameter(this.outliersShader, this.gl.LINK_STATUS)) {
    alert("Could not initialise shaders");
  }

  this.gl.useProgram(this.outliersShader);

  this.outliersShader.vertexPositionAttribute = this.gl.getAttribLocation(this.outliersShader, "aVertexPosition");
  this.gl.enableVertexAttribArray(this.outliersShader.vertexPositionAttribute);

  this.outliersShader.textureCoordAttribute = this.gl.getAttribLocation(this.outliersShader, "aTexCoord");
  this.gl.enableVertexAttribArray(this.outliersShader.textureCoordAttribute);

  this.outliersShader.minCountValue = this.gl.getUniformLocation(this.outliersShader, 'uMinCountValue');
  this.outliersShader.maxCountValue = this.gl.getUniformLocation(this.outliersShader, 'uMaxCountValue');
  this.outliersShader.minIndexValue = this.gl.getUniformLocation(this.outliersShader, 'uMinIndexValue');
  this.outliersShader.maxIndexValue = this.gl.getUniformLocation(this.outliersShader, 'uMaxIndexValue');
  this.outliersShader.minEntryValue = this.gl.getUniformLocation(this.outliersShader, 'uMinEntryValue');
  this.outliersShader.maxEntryValue = this.gl.getUniformLocation(this.outliersShader, 'uMaxEntryValue');
  this.outliersShader.numBins = this.gl.getUniformLocation(this.outliersShader, 'uNumBins');
  this.outliersShader.isFirstPass = this.gl.getUniformLocation(this.outliersShader, 'uIsFirstPass');
  this.outliersShader.bandwidth = this.gl.getUniformLocation(this.outliersShader, 'uBandwidth');
  this.outliersShader.outliersSize = this.gl.getUniformLocation(this.outliersShader, 'uOutliersSize');
  this.outliersShader.numPoints = this.gl.getUniformLocation(this.outliersShader, 'uNumPoints');
  this.outliersShader.sampler0 = this.gl.getUniformLocation(this.outliersShader, "uSamplerCount");
  this.outliersShader.sampler1 = this.gl.getUniformLocation(this.outliersShader, "uSamplerColorScale");
  this.outliersShader.sampler2 = this.gl.getUniformLocation(this.outliersShader, "uSamplerIndex");
  this.outliersShader.sampler3 = this.gl.getUniformLocation(this.outliersShader, "uSamplerEntry");
  this.outliersShader.sampler4 = this.gl.getUniformLocation(this.outliersShader, "uSamplerFinal");
  this.outliersShader.entryDataTileWidth = this.gl.getUniformLocation(this.outliersShader, "uEntryDataTileWidth");
  this.outliersShader.outliersThreshold = this.gl.getUniformLocation(this.outliersShader, "uOutliersThreshold");


  this.outliersShader.pMatrixUniform = this.gl.getUniformLocation(this.outliersShader, "uPMatrix");
  this.outliersShader.mvMatrixUniform = this.gl.getUniformLocation(this.outliersShader, "uMVMatrix");

  //see: http://www.mjbshaw.com/2013/03/webgl-fixing-invalidoperation.html
  this.gl.disableVertexAttribArray(this.outliersShader.vertexPositionAttribute);
  this.gl.disableVertexAttribArray(this.outliersShader.textureCoordAttribute);

  this.gl.useProgram(null);
  */

  //shade
  var fragmentShader = getShader(this.gl, "./js/glsl/shade.frag", true);
  var vertexShader = getShader(this.gl, "./js/glsl/simple.vert", false);

  this.shadeShader = this.gl.createProgram();
  this.gl.attachShader(this.shadeShader, vertexShader);
  this.gl.attachShader(this.shadeShader, fragmentShader);
  this.gl.linkProgram(this.shadeShader);

  if (!this.gl.getProgramParameter(this.shadeShader, this.gl.LINK_STATUS)) {
    alert("Could not initialise shaders");
  }

  this.gl.useProgram(this.shadeShader);

  this.shadeShader.vertexPositionAttribute = this.gl.getAttribLocation(this.shadeShader, "aVertexPosition");
  this.gl.enableVertexAttribArray(this.shadeShader.vertexPositionAttribute);

  this.shadeShader.textureCoordAttribute = this.gl.getAttribLocation(this.shadeShader, "aTexCoord");
  this.gl.enableVertexAttribArray(this.shadeShader.textureCoordAttribute);

  this.shadeShader.sampler0 = this.gl.getUniformLocation(this.shadeShader, "uSamplerF");
  this.shadeShader.sampler1 = this.gl.getUniformLocation(this.shadeShader, "uSamplerColorScale");
  this.shadeShader.sampler2 = this.gl.getUniformLocation(this.shadeShader, "uSamplerFinal");
  this.shadeShader.numBins = this.gl.getUniformLocation(this.shadeShader, 'uNumBins');
  this.shadeShader.useDensity = this.gl.getUniformLocation(this.shadeShader, 'uUseDensity');
  this.shadeShader.passValue = this.gl.getUniformLocation(this.shadeShader, "uPassValue");
  this.shadeShader.numPassValues = this.gl.getUniformLocation(this.shadeShader, "uNumPassValues");
  this.shadeShader.contourWidth = this.gl.getUniformLocation(this.shadeShader, "uContourWidth");
  this.shadeShader.alphaMultiplier = this.gl.getUniformLocation(this.shadeShader, "uAlphaMultiplier");
  this.shadeShader.maxf = this.gl.getUniformLocation(this.shadeShader, "uMaxf");
  this.shadeShader.minf = this.gl.getUniformLocation(this.shadeShader, "uMinf");
  //this.shadeShader.contour = this.gl.getUniformLocation(this.shadeShader, "uContour");


  this.shadeShader.pMatrixUniform = this.gl.getUniformLocation(this.shadeShader, "uPMatrix");
  this.shadeShader.mvMatrixUniform = this.gl.getUniformLocation(this.shadeShader, "uMVMatrix");

  //see: http://www.mjbshaw.com/2013/03/webgl-fixing-invalidoperation.html
  this.gl.disableVertexAttribArray(this.shadeShader.vertexPositionAttribute);
  this.gl.disableVertexAttribArray(this.shadeShader.textureCoordAttribute);

  this.gl.useProgram(null);

  //single pass kde
  var fragmentShader = getShader(this.gl, "./js/glsl/singlepass_kde.frag", true);
  var vertexShader = getShader(this.gl, "./js/glsl/singlepass_kde.vert", false);

  this.singlepass_kdeShader = this.gl.createProgram();
  this.gl.attachShader(this.singlepass_kdeShader, vertexShader);
  this.gl.attachShader(this.singlepass_kdeShader, fragmentShader);
  this.gl.linkProgram(this.singlepass_kdeShader);

  if (!this.gl.getProgramParameter(this.singlepass_kdeShader, this.gl.LINK_STATUS)) {
    alert("Could not initialise shaders");
  }

  this.gl.useProgram(this.singlepass_kdeShader);

  this.singlepass_kdeShader.vertexPositionAttribute = this.gl.getAttribLocation(this.singlepass_kdeShader, "aVertexPosition");
  this.gl.enableVertexAttribArray(this.singlepass_kdeShader.vertexPositionAttribute);

  this.singlepass_kdeShader.bandwidth = this.gl.getUniformLocation(this.singlepass_kdeShader, "uBandwidth");
  this.singlepass_kdeShader.numPoints = this.gl.getUniformLocation(this.singlepass_kdeShader, 'uNumPoints');
  this.singlepass_kdeShader.numBins = this.gl.getUniformLocation(this.singlepass_kdeShader, 'uNumBins');
  this.singlepass_kdeShader.kernelSize = this.gl.getUniformLocation(this.singlepass_kdeShader, 'uKernelSize');
  this.singlepass_kdeShader.sampler0 = this.gl.getUniformLocation(this.singlepass_kdeShader, "uSamplerGauss");
  //this.shadeShader.contour = this.gl.getUniformLocation(this.shadeShader, "uContour");


  this.singlepass_kdeShader.pMatrixUniform = this.gl.getUniformLocation(this.singlepass_kdeShader, "uPMatrix");
  this.singlepass_kdeShader.mvMatrixUniform = this.gl.getUniformLocation(this.singlepass_kdeShader, "uMVMatrix");

  //see: http://www.mjbshaw.com/2013/03/webgl-fixing-invalidoperation.html
  this.gl.disableVertexAttribArray(this.singlepass_kdeShader.vertexPositionAttribute);

  this.gl.useProgram(null);
  
  
  //single pass akde
  this.singlepass_akdeShader = [];
  for(var i=0; i<3; i++){

    var fragmentShader = getShader(this.gl, "./js/glsl/singlepass_akde"+i+".frag", true);
    var vertexShader = getShader(this.gl, "./js/glsl/singlepass_akde"+i+".vert", false);

    this.singlepass_akdeShader[i] = this.gl.createProgram();
    this.gl.attachShader(this.singlepass_akdeShader[i], vertexShader);
    this.gl.attachShader(this.singlepass_akdeShader[i], fragmentShader);
    this.gl.linkProgram(this.singlepass_akdeShader[i]);

    if (!this.gl.getProgramParameter(this.singlepass_akdeShader[i], this.gl.LINK_STATUS)) {
      alert("Could not initialise shaders");
    }

    this.gl.useProgram(this.singlepass_akdeShader[i]);

    this.singlepass_akdeShader[i].vertexPositionAttribute = this.gl.getAttribLocation(this.singlepass_akdeShader[i], "aVertexPosition");
    this.gl.enableVertexAttribArray(this.singlepass_akdeShader[i].vertexPositionAttribute);

    //we dont need tex coords. Access using the frag coord
    //this.singlepass_akdeShader[i].textureCoordAttribute = this.gl.getAttribLocation(this.singlepass_akdeShader[i], "aTexCoord");
    //this.gl.enableVertexAttribArray(this.singlepass_akdeShader[i].textureCoordAttribute);

    this.singlepass_akdeShader[i].bandwidth = this.gl.getUniformLocation(this.singlepass_akdeShader[i], "uBandwidth");
    this.singlepass_akdeShader[i].numPoints = this.gl.getUniformLocation(this.singlepass_akdeShader[i], 'uNumPoints');
    this.singlepass_akdeShader[i].numBins = this.gl.getUniformLocation(this.singlepass_akdeShader[i], 'uNumBins');
    this.singlepass_akdeShader[i].kernelSize = this.gl.getUniformLocation(this.singlepass_akdeShader[i], 'uKernelSize');
    this.singlepass_akdeShader[i].sampler0 = this.gl.getUniformLocation(this.singlepass_akdeShader[i], "uSamplerF");
    //this.shadeShader.contour = this.gl.getUniformLocation(this.shadeShader, "uContour");

    this.singlepass_akdeShader[i].pMatrixUniform = this.gl.getUniformLocation(this.singlepass_akdeShader[i], "uPMatrix");
    this.singlepass_akdeShader[i].mvMatrixUniform = this.gl.getUniformLocation(this.singlepass_akdeShader[i], "uMVMatrix");

    //see: http://www.mjbshaw.com/2013/03/webgl-fixing-invalidoperation.html
    this.gl.disableVertexAttribArray(this.singlepass_akdeShader[i].vertexPositionAttribute);
    this.gl.disableVertexAttribArray(this.singlepass_akdeShader[i].textureCoordAttribute);

  }

  this.singlepass_akdeShader[1].originalpMatrixUniform = this.gl.getUniformLocation(this.singlepass_akdeShader[1], "uOriginalPMatrix");
  this.singlepass_akdeShader[1].aspectRatio = this.gl.getUniformLocation(this.singlepass_akdeShader[1], "uAspectRatio");
  this.singlepass_akdeShader[2].sampler1 = this.gl.getUniformLocation(this.singlepass_akdeShader[2], "uSamplerMean");
  this.singlepass_akdeShader[2].aspectRatio = this.gl.getUniformLocation(this.singlepass_akdeShader[2], "uAspectRatio");

  this.singlepass_akdeShader[0].sampler1 = this.gl.getUniformLocation(this.singlepass_akdeShader[0], "uSamplerGauss");
  this.singlepass_akdeShader[2].sampler2 = this.gl.getUniformLocation(this.singlepass_akdeShader[2], "uSamplerGauss");


  this.gl.useProgram(null);
  


  //selection
  /*
  var fragmentShader = getShader(this.gl, "./js/glsl/selection.frag", true);
  var vertexShader = getShader(this.gl, "./js/glsl/selection.vert", false);

  this.selectionShader = this.gl.createProgram();
  this.gl.attachShader(this.selectionShader, vertexShader);
  this.gl.attachShader(this.selectionShader, fragmentShader);
  this.gl.linkProgram(this.selectionShader);

  if (!this.gl.getProgramParameter(this.selectionShader, this.gl.LINK_STATUS)) {
    alert("Could not initialise shaders");
  }

  this.gl.useProgram(this.selectionShader);

  this.selectionShader.vertexPositionAttribute = this.gl.getAttribLocation(this.selectionShader, "aVertexPosition");
  this.gl.enableVertexAttribArray(this.selectionShader.vertexPositionAttribute);

  this.selectionShader.pMatrixUniform = this.gl.getUniformLocation(this.selectionShader, "uPMatrix");
  this.selectionShader.mvMatrixUniform = this.gl.getUniformLocation(this.selectionShader, "uMVMatrix");

  this.gl.disableVertexAttribArray(this.selectionShader.vertexPositionAttribute);
  
  this.gl.useProgram(null);
  */

}

function getxy(that, evt){
  var rect = that.canvas.getBoundingClientRect();
  var x = that.devicePixelRatio * (evt.clientX - rect.left);
  var y = that.devicePixelRatio * (evt.clientY - rect.top);

  return [x, that.gl.viewportHeight - y];
}

ScatterGL.prototype.mousedown = function(evt){

  var xy = getxy(this, evt);

  if(this.mousestate == 'MOUSEUP'){
    this.mousestate = 'MOUSEDOWN';
    this.selection.p0 = xy;
    this.selection.p1 = xy;
    this.selection.updateBB();
  }
  this.flagUpdateTexture = true;
  if(this.histogram != null) this.histogram.draw(this.getSelection());
  this.draw();
}

ScatterGL.prototype.mouseup = function(evt){

  var xy = getxy(this, evt);

  if(this.mousestate == 'MOUSEDOWN'){
    this.mousestate = 'MOUSEUP';
    this.selection.p1 = xy;
    this.selection.updateBB();
  }

  this.flagUpdateTexture = true;
  if(this.histogram != null) this.histogram.draw(this.getSelection());
  this.draw();
}

ScatterGL.prototype.mousemove = function(evt){

  if(this.mousestate != 'MOUSEDOWN')
    return;

  var xy = getxy(this, evt);

  this.translation = [this.translation[0]+xy[0]-this.selection.p1[0], this.translation[1]+xy[1]-this.selection.p1[1]];

  this.selection.p1 = xy;
  this.selection.updateBB();

  this.flagUpdateTexture = true;
  if(this.histogram != null) this.histogram.draw(this.getSelection());
  this.draw();
}

ScatterGL.prototype.toDataURL = function() {
  var image = canvaslayer.canvas.toDataURL();
  return image;
};

ScatterGL.prototype.gaussian2d = function(x, y) {
  var mux = 0.0;
  var sigx = 1.0;
  var muy = 0.0;
  var sigy = 1.0;
  return 0.15915494309 * Math.exp(-(Math.pow(x - mux, 2.0) / 2.0 * Math.pow(sigx, 2.0) + Math.pow(y - muy, 2.0) / 2.0 * Math.pow(sigy, 2.0)));
};


ScatterGL.prototype.gaussian1d = function(x) {
  return 0.3989422804 * Math.exp( -0.5*(x*x));
};


  

ScatterGL.prototype.createGaussianTex = function() {
  /*
  var size = parseInt(this.windowSize);
  var values = new Float32Array(size*size);

  for(var i=0; i<size; i++){
    for(var j=0; j<size; j++){
      var x = (i-0.5*size) / (0.5*size);
      var y = (j-0.5*size) / (0.5*size);
      //console.log(x+' '+y);
      var value =  this.gaussian2d(x, y);
      values[(i*size+j)] = value;
    }
  }

  //normalize?
  var max = -Infinity;
  var min = Infinity;
  for(var i=0; i<values.length; i++){
    max = Math.max(values[i], max);
    min = Math.min(values[i], min);
  }
  
  for(var i=0; i<values.length; i++){
    values[i] = (values[i] - min) / (max - min);
  }

  console.log(values);
  //console.log(this.gaussian(0,0));

  createTextureFromArray(this.gl, this.gl.NEAREST, size, size, this.gl.ALPHA, this.gl.ALPHA, this.gl.FLOAT, values, this.gausstex);
  */

  var size = 512;
  var values = new Float32Array(size);

  var count=0;
  for(var i=0; i<size; i++){
    var x = (i / size) / this.bandwidth;
    //var x = i;
    //console.log(x+' '+this.gaussian1d(x));
    values[count] = this.gaussian1d(x);
    count++;
  }
  //values[values.length-1] = 0;
  /*
  //normalize?
  var max = -Infinity;
  var min = Infinity;
  for(var i=0; i<values.length; i++){
    max = Math.max(values[i], max);
    min = Math.min(values[i], min);
  }
  
  for(var i=0; i<values.length; i++){
    values[i] = (values[i] - min) / (max - min);
  }
  */
  console.log(values);

  createTextureFromArray(this.gl, this.gl.LINEAR, size, 1, this.gl.ALPHA, this.gl.ALPHA, this.gl.FLOAT, values, this.gausstex);




};

ScatterGL.prototype.initGL = function(){

  var that = this;

  //http://www.khronos.org/webgl/wiki/HandlingHighDPI
  this.devicePixelRatio = window.devicePixelRatio || 1;
  this.canvas.width = this.canvas.clientWidth * this.devicePixelRatio;
  this.canvas.height = this.canvas.clientHeight * this.devicePixelRatio;
  this.canvas.addEventListener("mousedown", function(evt){that.mousedown(evt);}, false);
  this.canvas.addEventListener("mouseup", function(evt){that.mouseup(evt);}, false);
  this.canvas.addEventListener("mousemove", function(evt){that.mousemove(evt);}, false);

  this.gl = this.canvas.getContext("webgl");//, {alpha:false});
  this.gl.viewportWidth = this.canvas.width;
  this.gl.viewportHeight = this.canvas.height;

  this.gl.disable(this.gl.DEPTH_TEST);
  this.gl.disable(this.gl.BLEND);
  //this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE);
  //this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
  this.gl.clearColor(0, 0, 0, 0);

  var float_texture_linear_ext = this.gl.getExtension('OES_texture_float_linear');
  var float_texture_ext = this.gl.getExtension('OES_texture_float');
  var standard_derivatives_ext = this.gl.getExtension('OES_standard_derivatives');

  if (!this.gl){
    alert("Could not initialise Webgl.");
  }
  if(!float_texture_linear_ext){
    alert("OES_texture_float_linear not supported.");
  }
  if(!float_texture_ext){
    alert("OES_texture_float not supported.");
  }
  if(!standard_derivatives_ext){
    alert("OES_standard_derivatives not supported.");
  }
}
