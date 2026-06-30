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
        map.removeLayer(circle);
        delete this.circles[person_id];
      }
    }, this);

    // Draw circles for new/changed people
    this.people().forEach(function(person) {
      if (!this.circles.hasOwnProperty(person.id)) {
        var { center, radius, color } = person;
        this.circles[person.id] = draw_circle(map, center, radius(), color());
      } else {
        var circle = this.circles[person.id];
        circle.setRadius(person.radius() * 1000);
        circle.setStyle({
          fillColor: person.color(),
          color: person.color()
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
    return ["All"].concat(filters);
  }, this);

  this.filtered_venues = ko.computed(function() {
    var f = this.current_filter();
    if (f == "All") {
      return this.venues();
    }
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
        map.setView([cities[self.city()].lat, cities[self.city()].lng], 13);
        self.venues(venues);
      });
  });

  this._venue_markers = [];
  this._venues = ko.computed(function() {
    this._venue_markers.map(function(marker) {
      map.removeLayer(marker);
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
    // URL shortener API is no longer free; just copy the full URL
    navigator.clipboard.writeText(location.href).then(function() {
      alert("URL copied to clipboard!");
    }).catch(function() {
      prompt("Copy this URL:", location.href);
    });
  };

  people.map(this.add_people, this);
};

var setup_search_box = function(map, data) {
  var searchInput = document.querySelector("#searchInput");
  var searchResults = document.querySelector("#searchResults");
  var debounceTimer = null;

  searchInput.addEventListener("input", function() {
    var query = searchInput.value.trim();
    clearTimeout(debounceTimer);

    if (query.length < 3) {
      searchResults.style.display = "none";
      searchResults.innerHTML = "";
      return;
    }

    debounceTimer = setTimeout(function() {
      // Use Nominatim (OpenStreetMap) for geocoding — free, no API key
      var url = "https://nominatim.openstreetmap.org/search?format=json&q=" +
        encodeURIComponent(query) + "&limit=5&countrycodes=in";

      fetch(url, {
        headers: { "Accept-Language": "en" }
      })
        .then(function(response) { return response.json(); })
        .then(function(results) {
          searchResults.innerHTML = "";
          if (results.length === 0) {
            searchResults.style.display = "none";
            return;
          }
          results.forEach(function(result) {
            var div = document.createElement("div");
            div.className = "result-item";
            div.textContent = result.display_name;
            div.addEventListener("click", function() {
              searchInput.value = "";
              searchResults.style.display = "none";
              searchResults.innerHTML = "";
              var name = result.display_name.split(",")[0];
              data.add_people({
                center: {
                  lat: parseFloat(result.lat),
                  lng: parseFloat(result.lon)
                },
                name: name,
                radius: 8,
                color: "#0000FF"
              });
            });
            searchResults.appendChild(div);
          });
          searchResults.style.display = "block";
        })
        .catch(function(err) {
          console.error("Search error:", err);
          searchResults.style.display = "none";
        });
    }, 300);
  });

  // Close results when clicking outside
  document.addEventListener("click", function(e) {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
      searchResults.style.display = "none";
    }
  });
};

var draw_circle = function(map, center, radius, color) {
  var circle = L.circle([center.lat, center.lng], {
    color: color,
    fillColor: color,
    fillOpacity: 0.2,
    weight: 1,
    opacity: 0.8,
    radius: radius * 1000
  }).addTo(map);
  return circle;
};

var RATING_COLORS = {
  0: "#999999",
  1: "#e74c3c",
  2: "#e67e22",
  3: "#f1c40f",
  4: "#2ecc71",
  5: "#27ae60"
};

var mark_venues = function(map, venues) {
  return venues.map(function(venue) {
    var rating = venue.rating || 0;
    var color = RATING_COLORS[rating] || "#999";

    // Create a colored circle marker instead of relying on Google icon URLs
    var marker = L.circleMarker([venue.lat, venue.lng], {
      radius: 6,
      fillColor: color,
      color: "#fff",
      weight: 1.5,
      opacity: 1,
      fillOpacity: 0.9
    }).addTo(map);

    marker.bindPopup(venue.info, { maxWidth: 250 });
    marker.bindTooltip(venue.name, { direction: "top", offset: [0, -6] });

    return marker;
  });
};

var hash_to_state = function() {
  var json = atob(location.hash.substring(1)),
    people = [
      {
        name: "Raheja Residency",
        center: { lat: 12.9281594, lng: 77.6295864 },
        radius: 5,
        color: "#0000FF"
      },
      {
        name: "Windsor Court",
        center: { lat: 12.955567, lng: 77.656877434 },
        radius: 4,
        color: "#00FF00"
      },
      {
        name: "Microsoft Research",
        center: { lat: 12.96613, lng: 77.59629139999993 },
        radius: 6,
        color: "#0000FF"
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

var fetch_cities = function() {
  var cities;
  var xhr = new XMLHttpRequest();
  xhr.open("GET", "js/locations.json", false);
  xhr.onload = function(e) {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        console.log(xhr.responseText);
        cities = JSON.parse(xhr.responseText);
      } else {
        console.error(xhr.statusText);
      }
    }
  };
  xhr.onerror = function(e) {
    console.error(xhr.statusText);
  };
  xhr.send(null);
  return cities;
};

var cities = fetch_cities();

// Initialize the map using Leaflet + OpenStreetMap
var initMap = function() {
  var map = L.map("map", {
    center: [cities.bangalore.lat, cities.bangalore.lng],
    zoom: 13,
    zoomControl: true
  });

  // Add OpenStreetMap tiles (completely free, no API key)
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(map);

  var { p, q, c } = hash_to_state();
  var data = new AppData(map, p, q, c);
  setup_search_box(map, data);
  ko.applyBindings(data);
};

// Initialize on page load
document.addEventListener("DOMContentLoaded", initMap);
