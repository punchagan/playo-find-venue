var AppData = function(map, people, sport, city) {
  var self = this;

  this.map = map;
  this.people = ko.observableArray();
  this.circles = {};
  this.venues = ko.observableArray([]);
  this.cities = ko.observableArray(Object.keys(cities));
  this.city = ko.observable(city);
  this.city.subscribe(function(city) {
    // Remove existing circles, if city is changed
    this.people([]);
  }, this);
  this.setup_center = function(person) {
    return {
      name: person.name,
      center: person.center,
      radius: ko.observable(person.radius),
      color: ko.observable(person.color),
      id: `${person.center.lat},${person.center.lng}`
    };
  };

  this.add_people = function(person) {
    this.people.push(this.setup_center(person));
  };

  this.remove_person = function(person) {
    self.people.remove(person);
  };

  this.remove_person_by_id = function(person_id) {
    self.people().forEach(function(person) {
      if (person.id === person_id) {
        self.people.remove(person);
      }
    });
  };

  this._circles = ko.computed(function() {
    // Delete circles of removed/changed people;
    var ids = this.people().map(function(p) {
      return p.id;
    });
    Object.entries(this.circles).map(function([person_id, circle]) {
      if (ids.indexOf(person_id) < 0) {
        circle.setMap(null);
        circle = null;
        delete this.circles[person_id];
      }
    }, this);

    // Draw circles for new/changed people
    this.people().forEach(function(person) {
      if (!this.circles.hasOwnProperty(person.id)) {
        var { center, radius, color } = person;
        this.circles[person.id] = draw_circle(
          map,
          self,
          center,
          radius(),
          color()
        );
      } else {
        var circle = this.circles[person.id];
        circle.setRadius(person.radius() * 1000);
        circle.setOptions({
          fillColor: person.color(),
          strokeColor: person.color()
        });
      }
    }, this);
  }, this);

  this.current_filter = ko.observable(sport);

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

  this.venues_url = ko.computed(function() {
    return `data/venues_${this.city()}.json`;
  }, this);

  this._all_venues = ko.computed(function() {
    fetch(self.venues_url())
      .then(function(response) {
        return response.json();
      })
      .then(function(venues) {
        map.setCenter(cities[self.city()]);
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

  this.short_url = ko.observable();

  this._update_url_fragment = ko.computed(function() {
    var state = {
      p: ko.toJS(this.people),
      q: ko.toJS(this.current_filter),
      c: ko.toJS(this.city)
    };
    location.hash = btoa(JSON.stringify(state));
    this.short_url(undefined);
  }, this);

  this.shorten_url = function() {
    get_short_url(this.short_url);
  };

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
    remove_circle(data, circle);
  });
  return circle;
};

var remove_circle = function(data, circle) {
  Object.entries(data.circles).forEach(function([p, c]) {
    if (circle === c) {
      data.remove_person_by_id(p);
    }
  });
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

var hash_to_state = function() {
  var json = atob(location.hash.substring(1)),
    people = [
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
    ],
    sport = "Badminton",
    city = "bangalore",
    state = { p: people, q: sport, c: city };

  if (json) {
    Object.assign(state, JSON.parse(json));
  }
  return state;
};

var get_short_url = function(callback) {
  var API_KEY = "AIzaSyDECh_V7enCYmHscpRwPYenetjFued24j8",
    url = "https://www.googleapis.com/urlshortener/v1/url?key=" + API_KEY,
    body = JSON.stringify({ longUrl: location.href });

  fetch(url, {
    method: "POST",
    body: body,
    headers: new Headers({
      "Content-Type": "application/json"
    })
  })
    .then(function(response) {
      return response.json();
    })
    .then(function(data) {
      callback(data.id);
    });
};

var cities = {
  bangalore: { lat: 12.9715987, lng: 77.5945627 },
  hyderabad: { lat: 17.4241053, lng: 78.4657618 }
};

var initMap = function() {
  // Create the map.
  var map = new google.maps.Map(document.getElementById("map"), {
    zoom: 13,
    mapTypeId: "roadmap",
    mapTypeControl: false,
    center: cities.bangalore
  });
  setup_controls(map);
  var { p, q, c } = hash_to_state();
  var data = new AppData(map, p, q, c);
  setup_search_box(map, data);
  ko.applyBindings(data);
};
