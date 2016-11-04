
var USE_DARK_STYLE = false;
var USE_ALL_WHITE = false;
var SAVE_STATE = true;

var histogram;
var scattermatrix;
var map = null;
var canvaslayer = null;
var datapath;
var info;
var linearcolorscale;
var discretecolorscale;
var canvas;
var map_text_layer = null;
var numberOfPoints = 0;
var lastReceivedDateTime = null;
var pointsSummaryData = null;
var idsSamplesCountData = null;
var pointsSummaryChart = null;
var lastPointsRequestTime = 0;

var useMap = true;
var useStreaming = false;
var isline = false;
var datapath;
var currententry;
var numentries;
var state = {};

var allowedBounds = new google.maps.LatLngBounds(
  new google.maps.LatLng(-67, -175),
  new google.maps.LatLng(67, 175)
);

var ANIM_STEP = 1 * 60 * 60;              // animation step: 60 minutes.
var ANIM_TS_INITIAL;                      // Initial timestamp in the animation. Set on cb_receivedInfoData
var ANIM_TS_FINAL;                        // Final timestamp in the animation. Set on cb_receivedInfoData

var anim_prev_ts;                         //Set on cb_receivedInfoData
var anim_cur_ts;                          // Current timestamp in the animation. Set on cb_receivedInfoData
var anim_on = false;                      // Animation on/off flag.
var ANIMATION_INTERVAL = 200;
var previous_zoom_level = null;


function getQueryVariable(variable) {
  var query = window.location.search.substring(1);
  var vars = query.split('&');
  for (var i = 0; i < vars.length; i++) {
      var pair = vars[i].split('=');
      if (decodeURIComponent(pair[0]) == variable) {
          var value = decodeURIComponent(pair[1]);
          if(value == 'false')
            return false;
          else
            return value;
      }
  }
  return false;
}

function getUrlFromState(){
  
  var str = location.origin + location.pathname + '?';
  
  for(i in state){
    str += i+'='+state[i]+'&';
  }
  //console.log(state['zoomTranslate']);
  return str;
  
}

function pushState(state, page){

  if(SAVE_STATE == false)
    return;

  history.pushState(state, page, getUrlFromState());
}


var toggleAnimation = function(enabled) {
  anim_on = enabled;
  var images = {true: '../img/anim-pause.png', false: '../img/anim-play.png'};

  var svg = d3.selectAll('#play_button').data(['play_button'])
    .on('click', function () {
      toggleAnimation(!anim_on);
    });
    
  var radius = 20;
  var image = svg.selectAll('image').data(['play_button']);
  image
    .enter().append('svg:image')
    .attr('x', '0')
    .attr('y', '0')
    .attr('width', radius)
    .attr('height', radius);
  image.attr('xlink:href', images[anim_on]);
};


var setupAnimButtons = function() {
  var radius = 20;

  // Forward button.
  d3.selectAll('#fw_button').data(['fw_button'])
      .on('click', function () {
        // Forwards animation one time step.
        toggleAnimation(false);
        var anim_ts = Math.min(ANIM_TS_FINAL, anim_cur_ts + ANIM_STEP);
        $('#div_animslider').slider('value', anim_ts);
      })
      .selectAll('image').data(['fw_button'])
    .enter()
      .append('svg:image')
      .attr('x', '0')
      .attr('y', '0')
      .attr('width', radius)
      .attr('height', radius)
      .attr('xlink:href', '../img/anim-fw.png');

  // Rewind button.
  d3.selectAll('#rw_button').data(['rw_button'])
      .on('click', function () {
        // Rewinds animation one time step.
        toggleAnimation(false);
        var anim_ts = Math.max(ANIM_TS_INITIAL, anim_cur_ts - ANIM_STEP);
        $('#div_animslider').slider('value', anim_ts);
      })
      .selectAll('image').data(['rw_button'])
    .enter()
      .append('svg:image')
      .attr('x', '0')
      .attr('y', '0')
      .attr('width', radius)
      .attr('height', radius)
      .attr('xlink:href', '../img/anim-rw.png');
};


var createDateFromTimestampInMinutes = function(ts) {
  var date = new Date(0);
  date.setUTCSeconds(ts);
  return date;
};


var getNumberOfPoints = function() {
  return numberOfPoints;
};


var updateAnimation = function() {

  if (anim_cur_ts == anim_prev_ts) {
    return;
  }
  if (anim_on) {
    // Advances step in animation, of stops when finished.
    if (anim_cur_ts == ANIM_TS_FINAL) {
      toggleAnimation(false);
    } else {
      anim_prev_ts = anim_cur_ts;
      anim_cur_ts += ANIM_STEP;
    }
    $( '#div_animslider' ).slider('value', anim_cur_ts);

    //requestPoints();
    console.log('anim_cur_ts ' + anim_cur_ts);
    console.log('limit: ' + (ANIM_TS_FINAL));
  }
  // Updates overlay for text on top of the map.
  updateMapOverlay();

  if (pointsSummaryChart) {
    var date1 = createDateFromTimestampInMinutes(anim_cur_ts);
    var date2 = createDateFromTimestampInMinutes(anim_cur_ts + ANIM_STEP);
    pointsSummaryChart.updateBrush(date1, date2);
  }
};


var parseDateTime = function(ts) {
  var date = createDateFromTimestampInMinutes(ts);

  var daysOfWeek = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  var month = date.getMonth() + 1;
  month = month < 10 ? '0' + month : month;
  var day = date.getDate();
  day = day < 10 ? '0' + day : day;
  var dw = daysOfWeek[date.getDay()];
  var year = date.getFullYear();
  
  var dateStr = dw + ' ' + month + '/' + day + '/' + year;

  var hour = date.getHours();
  hour = hour < 10 ? '0' + hour : hour;
  var min = date.getMinutes();
  min = min < 10 ? '0' + min : min;
  var timeStr = hour + ':' + min;

  return {date: dateStr, time: timeStr};
};


var getRenderedTimeText = function() {
  if (!lastReceivedDateTime) {
    return '';
  }

  var initial = parseDateTime(lastReceivedDateTime);
  var final = parseDateTime(lastReceivedDateTime + ANIM_STEP - 60);

  if (initial.date != final.date) {
    var initialText = initial.date + ' ' + initial.time;
    var finalText = final.date + ' ' + final.time;
    return initialText + ' - ' + finalText;
  } else {
    var initialText = initial.date + ' ' + initial.time;
    return initialText + ' - ' + final.time;
  }
};


var setAnimCurTime = function(ts) {
  anim_cur_ts = ts;
  requestPoints();
};


var requestPoints = function() {
  // TODO remove
  //console.log(map.getBounds());

  console.log('trying');

  // Ignores requests that happen to often.
  var pointsRequestTime = new Date().getTime();
  if (anim_on ||
      pointsRequestTime - lastPointsRequestTime > ANIMATION_INTERVAL) {
    lastPointsRequestTime = pointsRequestTime;

    var ts1 = anim_cur_ts;
    var ts2 = anim_cur_ts + ANIM_STEP;

    requestPointsData(ts1, ts2);
  }
  console.log('did');
};


// Sets up user interface elements. Should be called only once.
var setupUI = function() {
  // Sets correct css.
  var head = document.getElementsByTagName('head')[0];
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.type = 'text/css';
  link.href = USE_DARK_STYLE ? 'css/style-black.css' : 'css/style-white.css';
  head.appendChild(link);

  utils = new Utils();

  // Sets up map.
  initMap();
  canvas = canvaslayer.canvas;
  $('#scatterplotmatrix').hide();
  $('#zoom').hide();

  // Set up menu
  $( "#menu_container" ).draggable();
  $( "#menu_container" ).attr('style', 'position: absolute; bottom: 3%; right: 2%;');

  // Sets up sliders.
  var bandwidthvalue = 0.1;
  $( '#div_bandwidthslider' ).slider({
    min: 0.01,
    value: bandwidthvalue,
    max: 100.0,
    step: 0.01,
    slide: function( event, ui ) {
      var must_redraw = true;
      changeBandwidth(ui.value, must_redraw);
    }
  });

  $( "#div_contourwidthslider" ).slider({
    min: 0.0,
    max: 5.0,
    value: 0.5,
    step: 0.25,
    slide: function( event, ui ) {
      setContourWidth(ui.value);
    }
  });

  var alpha_value = 10;
  if(state['alphamult'] != false)
    alpha_value = parseFloat(state['alphamult']);
  $( '#div_alphaslider' ).slider({
    min: 0.0,
    max: 100.0,
    value: alpha_value,
    step: 0.001,
    slide: function( event, ui ) {
      //changeColorScale();
      //console.log('New alpha: '+ui.value);
      setAlphaMultiplier(ui.value);
    }
  });

  $( '#div_pointslider' ).slider({
    min: 0.0,
    max: 10.0,
    value: 1.0,
    step: 1.0,
    slide: function( event, ui ) {
      setPointSize(ui.value);
    }
  });

  var lastSlide = 0;
  $( '#div_animslider' ).slider({
    min: ANIM_TS_INITIAL,
    max: ANIM_TS_FINAL,
    value: ANIM_TS_INITIAL,
    step: ANIM_STEP,
    stop: function(event, ui) {
      setAnimCurTime(ui.value);
    },
    change: function(event, ui) {
      setAnimCurTime(ui.value);
    },
    slide: function(event, ui) {
      toggleAnimation(false);
      setAnimCurTime(ui.value);
    }
  });
  setAnimCurTime(ANIM_TS_INITIAL);

  // Instantiates webgl renderer.
  var NUM_DIM = 2;
  var NUM_ENTRIES = 0;
  var USE_STREAMING = true;
  var IS_LINE = false;
  var KDE_TYPE = 'singlekde';
  scattermatrix = new ScatterGL(
    canvas, NUM_DIM, NUM_ENTRIES, USE_STREAMING, IS_LINE, KDE_TYPE, 1.0, alpha_value);
  // Sets up scatter matrix.
  var NUM_BIN_SCATTER = 2048;
  var USE_DENSITY = 1;  //TODO: change that!
  scattermatrix.setTexturesSize(NUM_BIN_SCATTER);
  scattermatrix.useDensity = USE_DENSITY;

  // Sets up color scale.
  colorscale = new ColorScale(document.getElementById('color_scale'));
  initColorScale();

  var must_redraw = false;
  changeBandwidth(bandwidthvalue, must_redraw);
  changeAccuracy(100000000, must_redraw);
  changeWindowSize();
  setContour();
  setNormalize();

  toggleAnimation(anim_on);

  setupAnimButtons();
};


var getMapBoundaries = function(latlng0, latlng1) {
  //fitBounds doesnt zoom in as good as it should.
  //Fix: https://code.google.com/p/gmaps-api-issues/issues/detail?id=3117
  var bounds = new google.maps.LatLngBounds(latlng0, latlng1);
  var sw = bounds.getSouthWest();
  var ne = bounds.getNorthEast();

  var lat1 = sw.lat();
  var lng1 = sw.lng();
  var lat2 = ne.lat();
  var lng2 = ne.lng();

  var dx = (lng1 - lng2) / 2.;
  var dy = (lat1 - lat2) / 2.;
  var cx = (lng1 + lng2) / 2.;
  var cy = (lat1 + lat2) / 2.;

  // work around a bug in google maps...///
  lng1 = cx + dx / 1.5;
  lng2 = cx - dx / 1.5;
  lat1 = cy + dy / 1.5;
  lat2 = cy - dy / 1.5;
  /////////////////////////////////////////
  
  sw = new google.maps.LatLng(lat1,lng1);
  ne = new google.maps.LatLng(lat2,lng2);
  return new google.maps.LatLngBounds(sw,ne);
};


var cb_receivedInfoData = function(data){
  info = data;

  ANIM_TS_INITIAL =  info['tsmin'];
  ANIM_TS_FINAL = info['tsmax'] - ANIM_STEP;

  ANIM_STEP = info['bucketsize'];

  anim_prev_ts = Infinity;
  anim_cur_ts = ANIM_TS_INITIAL;

  setupUI();

  //request data
  requestPoints();

  setInterval(function() {
      updateAnimation();
    },
    ANIMATION_INTERVAL
  );
}

var fromLatLngToPoint = function(lat, lng) {
  mapWidth    = 1;
  mapHeight   = 1;

  // get x value
  x = (lng+180)*(mapWidth/360)

  // convert from degrees to radians
  latRad = lat*Math.PI/180;

  // get y value
  mercN = Math.log(Math.tan((0.25*Math.PI)+(0.5*latRad)));
  y     = (0.5*mapHeight)-(mapWidth*mercN/(2*Math.PI));

  return [x, y];
};


var cb_receivedPointsData = function(data) {
  numberOfPoints = data['points'].length;
  lastReceivedDateTime = +data['ts1'];

  // Sets map boundaries.
  var min_lat = Math.max(allowedBounds.getSouthWest().lat(), data['min_lat']); 
  var min_lon = Math.max(allowedBounds.getSouthWest().lng(), data['min_lon'] + 0.5 * (data['max_lon'] - data['min_lon']));
  var max_lat = Math.min(allowedBounds.getNorthEast().lat(), data['max_lat']); 
  var max_lon = Math.min(allowedBounds.getNorthEast().lng(), data['max_lon'] + 0.5 * (data['max_lon'] - data['min_lon']));
  var latlng0 = new google.maps.LatLng(min_lat, min_lon);
  var latlng1 = new google.maps.LatLng(max_lat, max_lon);
  scattermatrix.setGeoInfo(latlng0, latlng1);
  var bounds = getMapBoundaries(latlng0, latlng1);

  var newlat0 = getQueryVariable('lat0');
  var newlng0 = getQueryVariable('lng0');
  var newlat1 = getQueryVariable('lat1');
  var newlng1 = getQueryVariable('lng1');
  if(newlat0 != false && newlng0 != false && newlat1 != false && newlng1 != false){
    var bounds = getMapBoundaries(new google.maps.LatLng(newlat0, newlng0), new google.maps.LatLng(newlat1, newlng1));
  }

  map.fitBounds(bounds);
  

  var newzoom = getQueryVariable('zoom');
  if(newzoom != false){
    map.setZoom(parseInt(newzoom));
  }


  scattermatrix.primitives.reset();

  //console.log(data);

  var aux = fromLatLngToPoint(min_lat, min_lon);
  min = [aux[0], aux[1]];
  aux = fromLatLngToPoint(max_lat, max_lon);
  max = [aux[0], aux[1]];

  var inv_len_lat = 1 / (max[0] - min[0]);
  var inv_len_lon = 1 / (max[1] - min[1]);
  var inv_len_value = 1.0;
  if(data['max_value'] - data['min_value'] > 0)
    inv_len_value = 1 / (data['max_value'] - data['min_value']);
  else
    data['min_value'] = 0;

  for (pos in data['points']) {
    var point = data['points'][pos];
    var point_lat = point[0];
    var point_lon = point[1];
    var point_val = point[2];

    //var lat = (point_lat - min_lat) * inv_len_lat;
    //var lon = (point_lon - min_lon) * inv_len_lon;

    var newpoints = fromLatLngToPoint(point_lat, point_lon);

    // NOTE: must inform lon for x and lat for y here.
    //scattermatrix.primitives.add((newpoints[0] - min[0]) * inv_len_lat, (newpoints[1] - min[1]) * inv_len_lon , 0, (point_val - data['min_value']) * inv_len_value);
    scattermatrix.primitives.add((newpoints[0] - min[0]) * inv_len_lat, (newpoints[1] - min[1]) * inv_len_lon , 0, point_val);
  }
  scattermatrix.primitives.updateBuffer();

  var must_redraw = false;
  // TODO update bandwidth! changeBandwidth(data['h'] * 20.0, must_redraw);
  
  //console.log(data);
  draw();
};


var requestPointsData = function(ts1, ts2) {

  $.post(
    '/getPoints',
    {
      'query_ts1' : ts1,
      'query_ts2' : ts2,
      'initial_ts' : ANIM_TS_INITIAL,
      'final_ts' : ANIM_TS_FINAL,
      'bucketsize' : info['bucketsize'],
      'datapath' : getQueryVariable('datapath'),
      'max_accuracy' : $('#accuracy').prop('value')
    },
    cb_receivedPointsData
  );
};

var requestInfoData = function() {

  $.post(
    '/getInfo',
    {
      'datapath' : getQueryVariable('datapath'),
    },
    cb_receivedInfoData
  );
};


var createdropdown = function(id, values, onchange, className) {
  //TODO: replace with jquery
  var dropdown = document.createElement('select');
  dropdown.id = id;
  dropdown.className = className;
  dropdown.onchange = onchange;

  for(var i=0; i<values.length; i++){
    var option=document.createElement('option');
    option.text = values[i];
    dropdown.add(option, null);
  }

  return dropdown;
};


var changeColorScale = function() {
  var colorType = $('#colorType').prop('value');
  var alphaType = $('#alphaType').prop('value');
  var kdetype = $('#kdetype').prop('value');

  //console.log($('#div_alphaslider').slider('value'));

  var isColorLinear = false;
  var isAlphaLinear = false;
  if(colorType == 'color_linear')
    isColorLinear = true;
  if(alphaType == 'alpha_linear')
    isAlphaLinear = true;

  var fixedAlpha = null;
  if(alphaType == 'alpha_fixed')
    fixedAlpha = 1.0;
  
  var colors = getColorsForColorScale();
  if (colors != null) {
    colorscale.setValues(colors, isColorLinear, isAlphaLinear, fixedAlpha);

    scattermatrix.setColorScale(colorscale.texdata);
    draw();
  }
};


var getColorsForColorScale = function() {
  var color = $('#colorbrewer').prop('value');
  var dataclasses = $('#dataclasses').prop('value');
  
  var colors = colorbrewer[color][dataclasses];
  //return USE_DARK_STYLE ? colors : colors.reverse();

  if($('#reverse').prop('checked'))
    return colors.slice(0).reverse();
  return colors;
};


var changeTransparency = function() {
  changeColorScale();
  draw();
};


var changeRenderType = function(value) {
  scattermatrix.changeKDEType(value);
  draw();
};

var changeDataset = function(value){
  window.location.search = 'datapath='+value;
};


var changeBandwidth = function(value, must_redraw) {
  //scattermatrix.changeBandwidthMultiplier(value);
  scattermatrix.changeBandwidth(value);

  if (must_redraw) {
    draw();
  }

  //update slider and input
  $('#bandwidth').attr('value', scattermatrix.bandwidth);
  $('#div_bandwidthslider').slider('value', value);
};

var changeAccuracy = function(value, must_redraw) {
  //scattermatrix.changeBandwidthMultiplier(value);

  if (must_redraw) {
    draw();
  }

  //update slider and input
  $('#accuracy').attr('value', value);

  requestPoints();
};


var setContourWidth = function(value){
  $('#div_contourwidthslider').slider('value', value);
  scattermatrix.setContourWidth(value);
  draw();
};

var setContour = function(){
  scattermatrix.setContour($('#contour').prop('checked'));
  draw();
};

var setNormalize = function(){
  scattermatrix.setNormalize($('#normalize').prop('checked'));
  draw();
};

var setAlphaMultiplier = function(value) {
  $('#div_alphaslider').slider('value', value);
  state['alphamult'] = value;
  pushState(state, 'akde');
  scattermatrix.setAlphaMultiplier(value);
  draw();
};


var setPointSize = function(value) {
  scattermatrix.setPointSize(value);
  draw();
};

var changeWindowSize = function(){
  scattermatrix.changeWindowSize($('#windowsize').prop('value'));
  draw();
};

var initColorScale = function() {
  var values = [];
  for (var color in colorbrewer) {
    values.push(color);
  }

  var dropbox = createdropdown('colorbrewer', values, changeColorScale);
  $('#div_colorbrewer').append(dropbox);
  var initialColor = USE_DARK_STYLE ? 'Spectral' : 'YlOrRd';
  $('#colorbrewer').val(initialColor);


  var dropbox = createdropdown('dataclasses', [3,4,5,6,7,8,9,10,11,12], changeColorScale);
  $('#div_dataclasses').append(dropbox);
  $('#dataclasses').val('9');

  changeColorScale();
};


var resize = function() {
  scattermatrix.draw(map, canvaslayer);
};


var draw = function() {
  scattermatrix.flagUpdateTexture = true;
  scattermatrix.draw(map, canvaslayer);
};


var initMap = function() {

  if(USE_ALL_WHITE){
    var BRIGHT_STYLE = [
      {
        'featureType': 'all',
        'stylers': [
          { 'saturation': 100 },
          { 'lightness': 100 }
        ]
      },{
        'featureType': 'water',
        'stylers': [
          { 'visibility': 'simplified' },
          { 'lightness': -10 }
        ]
      },{
        'featureType': 'poi',
        'stylers': [
          { 'lightness': 5 }
        ]
      },{
        'featureType': 'road',
        'stylers': [
          //{ 'lightness': -40 }
          { 'visibility': 'off' }
        ]
      },{
        'featureType': 'all',
        //'elementType': 'labels',
        'stylers': [
          { 'visibility': 'off' }
        ]
      },{
        'featureType': 'administrative',
        'elementType': 'geometry',
        'stylers': [
          { 'lightness': -10 }
        ]
      }
    ];
  }
  else{

    var BRIGHT_STYLE = [
      {
        'featureType': 'all',
        'stylers': [
          { 'saturation': -100 }, //100
          { 'lightness': -10 } //100
        ]
      },{
        'featureType': 'water',
        'stylers': [
          { 'visibility': 'simplified' },
          //{ 'lightness': -10 } //grey
          { "saturation": 0 },
          { "lightness": 30 }
        ]
      },{
        'featureType': 'poi',
        'stylers': [
          //{ 'lightness': 5 }
          { 'visibility': 'off' }
        ]
      },{
        'featureType': 'road',
        'stylers': [
          { 'lightness': -40 }
          //{ 'visibility': 'off' }
        ]
      },{
        'featureType': 'road',
        'stylers': [
          { 'lightness': -40 }
          //{ 'visibility': 'off' }
        ]
      },{
        'featureType': 'road.local',
        'stylers': [
          { 'lightness': -5 }
          //{ 'visibility': 'off' }
        ]
      },{
        'featureType': 'all',
        'elementType': 'labels',
        'stylers': [
          { 'visibility': 'off' }
        ]
      },{
        'featureType': 'administrative',
        'elementType': 'geometry',
        'stylers': [
          { 'lightness': -20 }
        ]
      },{
        'featureType': 'administrative.province',
        'elementType': 'geometry',
        'stylers': [
         { 'visibility': 'off' }
        ]
      },{
        'featureType': 'transit',
        'stylers': [
         { 'visibility': 'off' }
        ]
      },{
        'featureType': 'landscape',
        'stylers': [
          { 'lightness': -25 }
        ]
      }
    ];
  }

  var DARK_STYLE = [
    {
      'featureType': 'all',
      'stylers': [
        { 'invert_lightness': 'true' },
        { 'saturation': -100 },
	     { 'lightness': -70 }
      ]
    },{
      'featureType': 'water',
      'stylers': [
        { 'visibility': 'simplified' }, //{ 'visibility': 'simplified' }
        { 'lightness': -100 }
      ]
    },{
      'featureType': 'poi',
      'stylers': [
        { 'lightness': -30 }
      ]
    },{
      'featureType': 'road',
      'stylers': [
        //{ 'lightness': -40 }
        { 'visibility': 'off' }
      ]
    },{
      'featureType': 'all',
      'elementType': 'labels',
      'stylers': [
        { 'visibility': 'off' }
      ]
    },{
      'featureType': 'administrative',
      'elementType': 'geometry',
      'stylers': [
        { 'visibility': 'off' }
      ]
    },{
      'featureType': 'administrative.country',
      'elementType': 'geometry',
      'stylers': [
        { 'visibility': 'off' }
      ]
    }
  ];


  var mapOptions = {
    zoom: 14,
    center: new google.maps.LatLng(0,0),
    mapTypeId: google.maps.MapTypeId.ROADMAP,
    panControl: false,
    zoomControl: true,
    mapTypeControl: true,
    scaleControl: true,
    streetViewControl: false,
    overviewMapControl: false,
    styles: USE_DARK_STYLE ? DARK_STYLE : BRIGHT_STYLE
  };

  var div = document.getElementById('map_container');
  map = new google.maps.Map(div, mapOptions);

  //kml layer
  //from: https://www.google.com/fusiontables/DataSource?docid=17mMrmy5DaEPNlPabZeKrTmY3e8cP7-qCFrrFyxk#rows:id=1
  var kmladdress = getQueryVariable('kml');
  if(kmladdress){
    /*
    var kmllayer = new google.maps.KmlLayer({
      url: kmladdress,
      suppressInfoWindows: true,
      map: map
    });
    */
    
    var parser = new geoXML3.parser({
          map: map,
          processStyles: true,
          zoom: false,
          suppressInfoWindows: true,
          failedParse: function(){
            alert('failed kml parse.');
          },
          afterParse: function(kml){

            for(var i=0; i<kml[0].placemarks.length; i++){
              kml[0].placemarks[i].polygon.strokeColor = '#FF0000';
              kml[0].placemarks[i].polygon.strokeWeight = 1;
              kml[0].placemarks[i].polygon.strokeOpacity = 1;
              kml[0].placemarks[i].polygon.fillColor = '#FFFFFF';
              kml[0].placemarks[i].polygon.fillOpacity = 1;
            }
          }
          //infoWindow: false
    });

    parser.parse('kml/'+kmladdress);
    

  }
  
  //canvas layer
  var canvasLayerOptions = {
    map: map,
    resizeHandler: resize,
    animate: false,
    updateHandler: draw
  };
  canvaslayer = new CanvasLayer(canvasLayerOptions);

  // Sets up zoom handler callback.
  google.maps.event.addListener(map, 'zoom_changed', function() {
    //console.log(map);
    updateOnZoom(map.getZoom());

    if(map.getZoom() < 4){
      map.setCenter(new google.maps.LatLng(0,0));
    }

    state['zoom'] = map.getZoom();
    pushState(state, 'akde');

  });

  //Limit navigation
  map.lastValidCenter = map.getCenter();
  var newLat, newLng;
  google.maps.event.addListener(map, 'center_changed', function() {
    //console.log(map);
    //console.log('1.Current bounds');
    //console.log(map.getBounds());
    //console.log(getMapBoundaries(map.getBounds().getSouthWest(), map.getBounds().getNorthEast()));

    //make sure sw is left of ne
    var currentbounds = map.getBounds();
    if(currentbounds.getSouthWest().lng() < currentbounds.getNorthEast().lng()){
      //console.log('sw left of ne');
      map.lastValidCenter = map.getCenter();
    }
    else if(map.lastValidCenter != map.getCenter()){
      //console.log('sw right of ne');
      map.setCenter(map.lastValidCenter);
    }
    //console.log(map.getCenter());
    state['lat0'] = currentbounds.getSouthWest().lat();
    state['lng0'] = currentbounds.getSouthWest().lng();
    state['lat1'] = currentbounds.getNorthEast().lat();
    state['lng1'] = currentbounds.getNorthEast().lng();
    pushState(state, 'akde');

  });
};


var updateMapOverlay = function() {
  var svg = d3.select('#map_overlay')
      .selectAll('svg').data(['map_overlay']);
  svg.enter().append('svg');

  var dateText = svg.selectAll('#date').data(['map_overlay']);
  dateText
    .enter().append('svg:text')
    .attr('id', 'date')
    .attr('x', 50)
    .attr('y', 15)
    .attr('dy', '.31em');
  dateText.text(getRenderedTimeText());

  var numberOfPointsText =
    svg.selectAll('#numberOfPoints').data(['map_overlay']);
  numberOfPointsText
    .enter().append('svg:text')
    .attr('id', 'numberOfPoints')
    .attr('x', 50)
    .attr('y', 40)
    .attr('dy', '.31em');
  numberOfPointsText.text(getNumberOfPoints() + ' samples');
};


var updateOnZoom = function(zoom_level) {
  if (previous_zoom_level != null) {
    previous_zoom_level = zoom_level;
  }

  var dZoom = previous_zoom_level - zoom_level;

  

  // TODO use old_zoom_level to adjust bandwidth.

  //console.log('zoom_level' + zoom_level);
  // TODO
  //var bandwidth = 0.025 + Math.max(0, (zoom_level - 11) * (0.1 / 3));
  //var must_redraw = false;
  //changeBandwidth(bandwidth, must_redraw);
};


var initialize = function(){
  requestInfoData();
  state['datapath'] = getQueryVariable('datapath');
  state['zoom'] = getQueryVariable('zoom');
  state['lat0'] = getQueryVariable('lat0');
  state['lng0'] = getQueryVariable('lng0');
  state['lat1'] = getQueryVariable('lat1');
  state['lng1'] = getQueryVariable('lng1');
  state['alphamult'] = getQueryVariable('alphamult');

  pushState(state, "akde");
};



window.onload = initialize;
