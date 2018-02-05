// This example creates circles on the map, representing populations in North
// America.

// First, create an object containing LatLng and population for each city.
var people = {
  ravi: {
    center: { lat: 12.9281594, lng: 77.6295864 },
    radius: 8,
    color: "#0000FF"
  },
  sakshi: {
    center: { lat: 12.9915374, lng: 77.6119656 },
    radius: 8,
    color: "#000FF0"
  },
  sunil: {
    center: { lat: 12.955567, lng: 77.656877434 },
    radius: 8,
    color: "#00FF00"
  },
  nitin: {
    center: { lat: 12.9744437, lng: 77.6986174 },
    radius: 8,
    color: "#0FF000"
  },
  punch: {
    center: { lat: 12.9204517, lng: 77.592301 },
    radius: 8,
    color: "#FF0000"
  }
};

var find_center = function() {
  var count = Object.keys(people).length;
  var center = Object.values(people).reduce(
    function(aggregate, x) {
      return {
        lat: aggregate.lat + x.center.lat / count,
        lng: aggregate.lng + x.center.lng / count
      };
    },
    { lat: 0, lng: 0 }
  );
  return center;
};

var initMap = function() {
  // Create the map.
  find_center();
  var map = new google.maps.Map(document.getElementById("map"), {
    zoom: 13,
    center: find_center(),
    mapTypeId: "roadmap"
  });
  draw_circles(map);
  mark_venues(map);
};

var draw_circles = function(map) {
  // Construct the circle for each person in people.
  // Note: We scale the area of the circle based on the distance they can travel.
  for (var name in people) {
    // Add the circle for this city to the map.
    var cityCircle = new google.maps.Circle({
      strokeColor: people[name].color,
      strokeOpacity: 0.8,
      strokeWeight: 1,
      fillColor: people[name].color,
      fillOpacity: 0.2,
      map: map,
      center: people[name].center,
      radius: people[name].radius * 1000
    });
  }
};

var goldStar = {
  path:
    "M 125,5 155,90 245,90 175,145 200,230 125,180 50,230 75,145 5,90 95,90 z",
  fillColor: "yellow",
  fillOpacity: 0.8,
  scale: 0.1,
  strokeColor: "yellow",
  strokeWeight: 2
};

var mark_venues = function(map) {
  venues.map(function(venue) {
    var rating = parseFloat(venue.avgRating),
      good = rating >= 4.0;
    if (rating >= 3.5) {
      // Add marker

      var marker = new google.maps.Marker({
        position: { lat: venue.lat, lng: venue.lng },
        map: map,
        icon: good ? goldStar : undefined,
        label: {
          text: venue.name,
          fontSize: good ? "10px" : "9px",
          fontWeight: good ? "800" : "400"
        },
        title:
          venue.name +
          "(" +
          venue.avgRating +
          ")" +
          " [" +
          venue.ratingCount +
          " ratings]"
      });
      // Click to open the venue
      marker.addListener("click", function() {
        window.open(venue.deferLink, "_blank");
      });
    }
  });
};
