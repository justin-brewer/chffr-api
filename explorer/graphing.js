function p(x) {
  console.log(x);
}

BACKEND = "https://api.comma.ai/"

function parseRouteDate(routeName) {
  return Date.parse(routeName.substring(0, 10)+" "+routeName.substring(12).replace("-", ":").replace("-", ":"));
}

var timeout = null;
var routeInfo = {};
var coordsAll = {};
var routeNumbersAll = {};
var flightPaths = {};
var selectedRoute = null;
var ignoreHashChange = false;

var currentIndex = 0;
var playbackSpeed = 1;
var play = false;

function unselectRoute() {
  if (selectedRoute != null) {
    flightPaths[selectedRoute].setOptions({"strokeOpacity": 0.3, 'zIndex': routeNumbersAll[selectedRoute]});
  }
  selectedRoute = null;
}

function closeViewerPanel() {
  unselectRoute();
  $("#timelineRow").css("display", "none");
  $("#viewerPanel").css("display", "none");
  $("#routePanel").css("display", "block");
  location.hash = "";
}

// Update main div with picture, coordinates, mph, offset and such
function update(coords, routeName, clickedIndex) {
  if (!play){
    p('update');  
  }
  var playbackSpeedDisplay = document.getElementById("playbackSpeed");
  playbackSpeedDisplay.innerHTML = ("playback speed: " + playbackSpeed);

  if (location.hash.substring(1) != routeName) {
    ignoreHashChange = true;
    location.hash = routeName;
  }
  // update means show the viewerPanel
  $("#routePanel").css("display", "none");
  $("#viewerPanel").css("display", "block");

  unselectRoute();
  selectedRoute = routeName;
  flightPaths[selectedRoute].setOptions({"strokeOpacity": 1.0, 'zIndex': 9999});

  var marker = coords[clickedIndex];
  if(marker === undefined) { return; }
  var totalDrive = coords[coords.length-1]['dist'];

  gmarker.setPosition({"lat": marker['lat'], "lng": marker['lng']});

  var MS_TO_MPH = 2.23694;
  var route = document.getElementById("date");
  var mph = document.getElementById("speed");
  var distance = document.getElementById("distance");
  var video_pic = document.getElementById("video_pic");

  var routeTime = parseRouteDate(routeName);
  var routeColor = colorFromRouteName(routeName);
  $("#startTime").html(new Date(routeTime).toString().substring(4, 21));
  $("#endTime").html(new Date(routeTime + (coords.length * 1000)).toString().substring(4, 21));

  $("#startTime").css("color", routeColor);
  $("#endTime").css("color", routeColor);

  route.innerHTML = new Date(routeTime + clickedIndex * 1000).toString().substring(15, 25);
  mph.innerHTML = (marker['speed'] * MS_TO_MPH).toFixed(2) + " mph";
  distance.innerHTML = (marker['dist']).toFixed(2) + "/" + totalDrive.toFixed(2) + "mi";

  function get_picture() {
    if (!play) { p("called"); }
    timeout = null;
    frames_url = routeInfo[routeName]['url'];
    video_URL = frames_url+"/sec"+clickedIndex+".jpg"
    video_pic.src = video_URL
    video_pic.onerror = function() {
      video_pic.src = "comma_default.png";
    };
  }
  if (timeout !== null) {
    clearTimeout(timeout);
  }
  timeout = setTimeout(get_picture, 100);
}

function initTimeline(coords, routeName, clickedIndex) {
  var totalIndex = coords[coords.length-1]['index']/100.0;

  $("#timelineRow").css("display", "block");

  var timelineSlider = $("#timelineSlider");
  var current = $("#current");
  var initialValue = clickedIndex;
  var handle = null;

  var updateSliderValue = function (event, ui) {
    handle = handle || $(".ui-slider-handle", timelineSlider);
    if(ui.value != undefined){currentIndex = ui.value;}
    update(coords, routeName, ui.value);
  };

  timelineSlider.slider({
      min: 0, max: totalIndex,
      slide: updateSliderValue,
      create: updateSliderValue,
      value: initialValue,
  });
}

// Initalize GMap and base settings, set map and base info
function initMap() {
  p("initMap");
  map = new google.maps.Map(document.getElementById('map'), {
    zoom: 11,
    center: {
    lat: 37.7625,
    lng: -122.4031
    },
    keyboardShortcuts: false
  });
  gmarker = new google.maps.Marker();
  gmarker.setMap(map);
  // Draw map
  drawLine(map);
}

// Generate the color for the individual routes line
// from the hash of the route itself
function colorFromRouteName(name, dim) {
  var hashCode = function(s) {
    return s.split("").reduce(function(a, b) {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a
    }, 0);
  };
  var colnum = Math.floor(15485863 * Math.abs(hashCode(name))) % 16777215;
  var colnum_str = colnum.toString(16);
  while (colnum_str.length < 6) colnum_str = "0" + colnum_str;
  var color = '#' + colnum_str;
  return color;
}

window.onhashchange = function() {
  if (ignoreHashChange) { ignoreHashChange = false; return; }
  if (location.hash == "") {
    closeViewerPanel();
  } else {
    selectRoute(location.hash.substring(1));
  }
}

function selectRoute(routeName) {
  location.hash = routeName;
  var coords = coordsAll[routeName];
  if (coords == null) { return; }
  var marker = currentIndex; //coords.length>>1;
  update(coords, routeName, currentIndex);
  initTimeline(coords, routeName, marker);
  map.panTo(new google.maps.LatLng(coords[marker]['lat'], coords[marker]['lng']));
}

// Init first route for polyline on GMap
function drawLine(map) {
  p(token);

  // Handle route coordinate and index data, set the
  // flightPath line and styles, 1st time & on click
  function handleRoute(json, routeName, routeNumber) {
    var coords = json;
    coordsAll[routeName] = coords;
    routeNumbersAll[routeName] = routeNumber;
    var tr = $(document.getElementById('r'+btoa(routeName)));
    tr.children().children().css('color', colorFromRouteName(routeName));
    tr.children().children().css('visibility', 'visible');
    tr.append("<td class=rjust>"+(coords.length/60.).toFixed(2)+" minutes</td>");
    var totalDrive = coords[coords.length-1]['dist'];
    tr.append("<td class=rjust>"+(totalDrive).toFixed(2)+" miles</td>");
    if (routeInfo[routeName]['movie']) {
      tr.append("<td style=color:goldenrod>&#x2713;</td>");
    } else if (routeInfo[routeName]['maxcamera'] != -1) {
      var tt = routeInfo[routeName]['maxcamera'] + "/" + routeInfo[routeName]['piececount'];
      tr.append("<td style='color: #d0d0d0; padding-left: 11px;' title='"+tt+"'>&#x231b</td>");
    } else {
      tr.append("<td title='not uploaded'> </td>");
    }

    var flightPath = new google.maps.Polyline({
      path: coords,
      geodesic: true,
      strokeColor: colorFromRouteName(routeName),
      strokeOpacity: 0.3,
      strokeWeight: 4.5,
      zIndex: routeNumber
    });
    flightPaths[routeName] = flightPath;

    flightPath.setMap(map);
    flightPath.addListener("click", function(e) {
      var marker = findInCoords(coords, e.latLng.lat(), e.latLng.lng());
      p(marker);
      update(coords, routeName, marker);
      initTimeline(coords, routeName, marker);
    });
  }

  // Get route, callback handleRoute()
  $.ajax({
    type: 'GET',
    crossDomain: true,
    beforeSend: function (xhr) {
      xhr.setRequestHeader("Authorization", "JWT " + token);
    },
    url: BACKEND+'v1/me/routes/',
    contentType: "application/json",
    success: function(json) {
      p(json['total']);
      routeInfo = json['routes'];

      var routes = Object.keys(routeInfo);
      routes.sort();
      routes.reverse();

      var i = 0;
      var routeList = "<table>";
      routeList += "<tr class='routeline'><td>route</td><td>time</td><td>distance</td><td></td></tr>";
      $.each(routes, function(key, val) {
        routeList += "<tr class='routeline' id='r"+btoa(val)+"'><td><a href='#"+val+"')' class='route' style='visibility: hidden; color:#ccc'>"+val+"</a></td></tr>";
        var allRoutes = routeInfo[val]['url'] + "/route.coords";
        $.ajax({
          type: 'GET',
          crossDomain: true,
          url: allRoutes,
          callback: 'jsonCallback',
          contentType: "application/json",
          dataType: 'json',
          success: function(json) { handleRoute(json, val, i); },
         });
        i += 1;
      });
      routeList += "</table>";
      $("#routePanel").html(routeList);
    }
  })
}

// Find closest coordinate from returned list & return index/offset
function findInCoords(json, lat, lng) {
  //var DISTANCE_THRESHOLD_SQ = 0.01;
  var minDistance = null;
  var minIdx = null;
  for (var i = 0; i < json.length; i++) {
    var td = (json[i]['lat'] - lat) * (json[i]['lat'] - lat) + (json[i]['lng'] - lng) * (json[i]['lng'] - lng);
    if (minDistance == null || td < minDistance) {
      minDistance = td;
      minIdx = i;
    }
  }
  return minIdx;
}

// Parse cookie and return just the dongle_id
// Copied from http://www.w3schools.com/js/js_cookies.asp
function getCookie(cname) {
  var name = cname + "=";
  var ca = document.cookie.split(';');
  for (var i = 0; i < ca.length; i++) {
    var c = ca[i];
    while (c.charAt(0) == ' ') c = c.substring(1);
    if (c.indexOf(name) == 0) return c.substring(name.length, c.length);
  }
  return null;
}

// Get dongleID set in cookies
function getDongleId() {
  return g_dongle_id;
}

$(window).keypress(function(e) {
  p(e.keyCode);
  var keyHelp = "<b>Flip</b> = 'f' | <b>Play/Pause</b> = 'v' | ";
  keyHelp += "<b>Close</b> = 'c' | <b>Next</b> = 'n' | <b>prev</b> = 'p'<br>";
  keyHelp += "<b>Faster</b> = 'u' | <b>Slower</b> = 's' | <b>Download Drive</b> = 'd'";
  var coords = coordsAll[selectedRoute];
  if (e.keyCode == 102) { // f : flip frame 180 degrees
    //p("hit f");
    if ($('#video_pic').css("transform") !== "none") {
      $('#video_pic').css("transform", "none");
    } else {
      $('#video_pic').css("transform", "scale(-1)");
    }
  } else if (e.keyCode == 118) { // v : play/pause
     if (selectedRoute != null) {
      playVid();
    }
  } else if (e.keyCode == 99) { // c : same as close button
      if (selectedRoute != null) {
        var playbackSpeedDisplay = document.getElementById("playbackSpeed");
        playbackSpeedDisplay.innerHTML = "";
        currentIndex = 0;
        play = false;
        location.hash = '';
      }
  } else if (e.keyCode == 110) { // n : next frame
    if (currentIndex < coords[coords.length-1]['index']/100.0 && selectedRoute != null){
      update(coords, selectedRoute, ++currentIndex);
      initTimeline(coords, selectedRoute, currentIndex);
    }
  } else if (e.keyCode == 112) { // p : previous frame
    if (currentIndex > 0 && selectedRoute != null) {
      update(coords, selectedRoute, --currentIndex);
      initTimeline(coords, selectedRoute, currentIndex);
    }
  } else if (e.keyCode == 117) { // u : increase playbackSpeed
    if (playbackSpeed < 10 && selectedRoute != null) {
      playbackSpeed += 1;  
      // var playbackSpeedDisplay = document.getElementById("playbackSpeed");
      document.getElementById("playbackSpeed").innerHTML = ("playback speed: " + playbackSpeed);
    }
  } else if (e.keyCode == 115) { // s : decrease playbackSpeed
    if (playbackSpeed > 1 && selectedRoute != null) {
      playbackSpeed -= 1;
      // var playbackSpeedDisplay = document.getElementById("playbackSpeed");
      document.getElementById("playbackSpeed").innerHTML = ("playback speed: " + playbackSpeed);
    }
  } else if (e.keyCode == 104) { // h : toggle key shorcut help
    var item = document.getElementById("keyHelp");
    if (item.innerHTML == "") {
      item.innerHTML = keyHelp;
    } else{
      item.innerHTML = "";
    }
  } else if (e.keyCode == 100) { // d : download route data
    if (selectedRoute != null) {downloadCoords();}
  }
});


function downloadCoords(){
  p('download');
  var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(coordsAll[selectedRoute]));
  var dlAnchorElem = document.getElementById('downloadAnchorElem');
  dlAnchorElem.setAttribute("href",     dataStr     );
  var fileName = selectedRoute + ".json";
  dlAnchorElem.setAttribute("download", fileName);
  dlAnchorElem.click();
}

async function playVid(){
  var playButton = document.getElementById('playButton');
  if(!play){
    var coords = coordsAll[selectedRoute];
    var totalIndex = coords[coords.length-1]['index']/100.0;
    play = true;
    
    // playButton.innerHTML = 'pause';
    while(play && currentIndex < totalIndex){
      update(coords, selectedRoute, currentIndex);
      initTimeline(coords, selectedRoute, currentIndex);
      var slider = document.getElementById('timelineSlider');
      slider.value++;
      await sleep(1000/playbackSpeed);
      currentIndex++;  
    }
  }
  else{
    play = false;
    // playButton.innerHTML = 'play';
    currentIndex--;
  }
}


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
