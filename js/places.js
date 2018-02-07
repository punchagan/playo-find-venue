var people = [
  {
    name: "Raheja Residency",
    center: { lat: 12.9281594, lng: 77.6295864 },
    radius: 8,
    color: "#0000FF"
  },
  {
    name: "Thom's Bakery & Supermarket",
    center: { lat: 12.9915374, lng: 77.6119656 },
    radius: 8,
    color: "#FFD700"
  },
  {
    name: "Windsor Court",
    center: { lat: 12.955567, lng: 77.656877434 },
    radius: 8,
    color: "#00FF00"
  },
  {
    name: "Alpine Eco Garden",
    center: { lat: 12.9744437, lng: 77.6986174 },
    radius: 8,
    color: "#808080"
  },
  {
    name: "Nutrition Nation",
    center: { lat: 12.9204517, lng: 77.592301 },
    radius: 8,
    color: "#FF0000"
  }
];

var AppData = function(map, people) {
  var self = this;

  this.map = map;
  this.people = ko.observableArray();
  this.circles = [];
  this.venues = ko.observableArray([]);

  this.setup_center = function(person) {
    return {
      name: person.name,
      center: person.center,
      radius: ko.observable(person.radius),
      color: ko.observable(person.color)
    };
  };

  this.add_people = function(person) {
    this.people.push(this.setup_center(person));
  };

  this.remove_person = function(person) {
    self.people.remove(person);
  };

  this.current_filter = ko.observable("Badminton");

  this.filters = ko.computed(function() {
    var filters = new Set();
    this.venues().map(function(v) {
      v.filter_by.map(filters.add, filters);
    });
    filters = Array.from(filters);
    filters.sort();
    return filters;
  }, this);

  this.filtered_venues = ko.computed(function() {
    var f = this.current_filter();
    return this.venues().filter(function(venue) {
      return venue.filter_by.indexOf(f) >= 0;
    }, this);
  }, this);

  this._circles = ko.computed(function() {
    draw_circles(self.map, self);
  });

  this._all_venues = ko.computed(function() {
    var venues_url = "data/venues.json";
    fetch(venues_url)
      .then(function(response) {
        return response.json();
      })
      .then(function(venues) {
        self.venues(venues);
      });
  });

  this._venue_markers = [];
  this._venues = ko.computed(function() {
    this._venue_markers.map(function(marker) {
      marker.setMap(null);
      marker = null;
    });
    this._venue_markers = mark_venues(self.map, self.filtered_venues());
  }, this);

  people.map(this.add_people, this);
};

var setup_search_box = function(map, data) {
  var searchInput = document.querySelector("#searchInput"),
    searchBox = new google.maps.places.SearchBox(searchInput);
  google.maps.event.addListener(searchBox, "places_changed", function() {
    var location = searchBox.getPlaces()[0];
    if (location) {
      searchInput.value = "";
      data.add_people({
        center: {
          lat: location.geometry.location.lat(),
          lng: location.geometry.location.lng()
        },
        name: location.name,
        radius: 8,
        color: "#0000FF"
      });
    }
  });
};

var set_center = function(map, data) {
  var lat = data.people().map(function(person) {
    return person.center.lat;
  });
  var lng = data.people().map(function(person) {
    return person.center.lng;
  });
  var center = {
    lat: (Math.min.apply(lat, lat) + Math.max.apply(lat, lat)) / 2,
    lng: (Math.min.apply(lng, lng) + Math.max.apply(lng, lng)) / 2
  };
  map.setCenter(center);
};

var draw_circles = function(map, data) {
  // Hide previous circles
  data.circles.map(function(circle) {
    circle.setMap(null);
    circle = null;
  });
  // Construct the circle for each person in people.
  data.circles = data.people().map(function(person) {
    var { center, radius, color } = person;
    var circle = draw_circle(map, data, center, radius(), color());
    circle.person = person;
    return circle;
  });
};

var draw_circle = function(map, data, center, radius, color) {
  var circle = new google.maps.Circle({
    strokeColor: color,
    strokeOpacity: 0.8,
    strokeWeight: 1,
    fillColor: color,
    fillOpacity: 0.2,
    map: map,
    center: center,
    radius: radius * 1000,
    clickable: true
  });
  circle.addListener("rightclick", function() {
    data.remove_person(circle.person);
  });
  return circle;
};

var mark_venues = function(map, venues) {
  var zoom = map.getZoom();
  return venues.map(function(venue) {
    // Add marker
    var marker = new google.maps.Marker({
      position: { lat: venue.lat, lng: venue.lng },
      title: venue.name,
      map: map,
      icon: {
        url: venue.icon,
        scaledSize: new google.maps.Size(zoom * 1.5, zoom * 1.5)
      }
    });
    map.addListener("zoom_changed", function() {
      var zoom = map.getZoom();
      marker.setIcon({
        url: venue.icon,
        scaledSize: new google.maps.Size(zoom * 1.5, zoom * 1.5)
      });
    });
    // infowindow that is shown when marker is clicked
    var infowindow = new google.maps.InfoWindow({
      content: venue.info,
      maxWidth: 200
    });
    marker.addListener("click", function() {
      infowindow.open(map, marker);
    });
    return marker;
  });
};

var setup_controls = function(map) {
  var controlsDiv = document.querySelector("#controls"),
    controls = map.controls[google.maps.ControlPosition.LEFT_TOP];
  controls.push(controlsDiv);
};

var initMap = function() {
  // Create the map.
  var map = new google.maps.Map(document.getElementById("map"), {
    zoom: 13,
    mapTypeId: "roadmap",
    mapTypeControl: false
  });
  setup_controls(map);
  var data = new AppData(map, people);
  setup_search_box(map, data);
  set_center(map, data);
  ko.applyBindings(data);
};
