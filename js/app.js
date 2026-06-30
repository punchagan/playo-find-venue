// ========================================
// Court Finder — Find nearest badminton courts
// ========================================

(function() {
  "use strict";

  // --- Config ---
  var CITIES = null;
  var ALL_VENUES = [];
  var FILTERED_VENUES = [];
  var VENUE_MARKERS = [];
  var USER_MARKER = null;
  var USER_LOCATION = null; // { lat, lng }
  var MAP = null;
  var CURRENT_CITY = "bangalore";
  var CURRENT_SPORT = "Badminton";
  var ACTIVE_POPUP_MARKER = null;

  // Rating color palette
  var RATING_COLORS = {
    0: "#999999",
    1: "#FF6B6B",
    2: "#E17055",
    3: "#FDCB6E",
    4: "#00CEC9",
    5: "#00B894"
  };

  // --- Haversine distance (km) ---
  function haversine(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // --- Format distance ---
  function formatDistance(km) {
    if (km < 1) {
      return Math.round(km * 1000) + " m";
    }
    return km.toFixed(1) + " km";
  }

  // --- Generate star string ---
  function getStars(rating) {
    var full = Math.floor(rating);
    var stars = "";
    for (var i = 0; i < 5; i++) {
      stars += i < full ? "★" : "☆";
    }
    return stars;
  }

  // --- Fetch cities config ---
  function fetchCities(callback) {
    fetch("js/locations.json")
      .then(function(r) { return r.json(); })
      .then(function(data) {
        CITIES = data;
        callback();
      })
      .catch(function(err) {
        console.error("Failed to load cities:", err);
      });
  }

  // --- Load venues for a city ---
  function loadVenues(city) {
    var url = "data/venues_" + city + ".json";
    document.getElementById("venueList").innerHTML =
      '<div class="loading"><div class="spinner"></div>Loading venues...</div>';

    fetch(url)
      .then(function(r) { return r.json(); })
      .then(function(venues) {
        ALL_VENUES = venues;
        applyFilter();
      })
      .catch(function(err) {
        console.error("Failed to load venues:", err);
        document.getElementById("venueList").innerHTML =
          '<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>Error</h3><p>Could not load venue data.</p></div>';
      });
  }

  // --- Apply sport filter and sort ---
  function applyFilter() {
    var sport = CURRENT_SPORT;

    if (sport === "All") {
      FILTERED_VENUES = ALL_VENUES.slice();
    } else {
      FILTERED_VENUES = ALL_VENUES.filter(function(v) {
        return v.filter_by && v.filter_by.indexOf(sport) >= 0;
      });
    }

    // Calculate distances if user location is set
    if (USER_LOCATION) {
      FILTERED_VENUES.forEach(function(v) {
        v._distance = haversine(USER_LOCATION.lat, USER_LOCATION.lng, v.lat, v.lng);
      });
      FILTERED_VENUES.sort(function(a, b) {
        return a._distance - b._distance;
      });
    }

    renderVenueList();
    renderVenueMarkers();
    updateVenueCount();
  }

  // --- Render venue list in sidebar ---
  function renderVenueList() {
    var container = document.getElementById("venueList");
    var venues = FILTERED_VENUES;

    // Limit to closest 50 for performance
    var displayed = venues.slice(0, 50);

    if (displayed.length === 0) {
      container.innerHTML =
        '<div class="empty-state"><div class="empty-state-icon">🏸</div>' +
        '<h3>No venues found</h3><p>Try changing the sport filter or city.</p></div>';
      return;
    }

    var html = "";
    displayed.forEach(function(venue, index) {
      var distStr = venue._distance != null ? formatDistance(venue._distance) : "";
      var ratingVal = venue.avgRating ? parseFloat(venue.avgRating).toFixed(1) : "N/A";
      var ratingNum = venue.ratingCount || 0;
      var stars = venue.avgRating ? getStars(parseFloat(venue.avgRating)) : "";

      var sportsHtml = "";
      if (venue.filter_by) {
        venue.filter_by.forEach(function(s) {
          sportsHtml += '<span class="sport-tag">' + escapeHtml(s) + '</span>';
        });
      }

      var actionsHtml = "";
      if (venue.deferLink) {
        actionsHtml += '<a class="venue-link" href="' + escapeHtml(venue.deferLink) + '" target="_blank" onclick="event.stopPropagation()">📱 Book on Playo</a>';
      }
      if (venue.fullLink) {
        actionsHtml += '<a class="venue-link" href="' + escapeHtml(venue.fullLink) + '" target="_blank" onclick="event.stopPropagation()">🌐 View Details</a>';
      }

      html += '<div class="venue-card" data-index="' + index + '" onclick="window.courtFinder.focusVenue(' + index + ')">';
      html += '<div class="venue-card-top">';
      html += '<span class="venue-name">' + escapeHtml(venue.name) + '</span>';
      if (distStr) {
        html += '<span class="venue-distance">' + distStr + '</span>';
      }
      html += '</div>';
      html += '<div class="venue-meta">';
      html += '<div class="venue-rating">';
      html += '<span class="rating-stars">' + stars + '</span>';
      html += '<span class="rating-value">' + ratingVal + '</span>';
      html += '<span class="rating-count">(' + ratingNum + ')</span>';
      html += '</div>';
      html += '</div>';
      if (sportsHtml) {
        html += '<div class="venue-sports">' + sportsHtml + '</div>';
      }
      if (actionsHtml) {
        html += '<div class="venue-actions">' + actionsHtml + '</div>';
      }
      html += '</div>';
    });

    container.innerHTML = html;
  }

  // --- Render venue markers on map ---
  function renderVenueMarkers() {
    // Clear existing markers
    VENUE_MARKERS.forEach(function(m) {
      MAP.removeLayer(m);
    });
    VENUE_MARKERS = [];

    // Only show closest 100 on the map for performance
    var displayed = FILTERED_VENUES.slice(0, 100);

    displayed.forEach(function(venue, index) {
      var rating = venue.rating || 0;
      var color = RATING_COLORS[rating] || RATING_COLORS[0];

      var marker = L.circleMarker([venue.lat, venue.lng], {
        radius: 7,
        fillColor: color,
        color: "#fff",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9
      }).addTo(MAP);

      var distStr = venue._distance != null ? " — " + formatDistance(venue._distance) : "";
      var popupContent =
        '<h3>' + escapeHtml(venue.name) + '</h3>' +
        '<strong>Rating:</strong> ' + (venue.avgRating || 'N/A') + ' (' + (venue.ratingCount || 0) + ' reviews)<br/>' +
        '<strong>Sports:</strong> ' + (venue.filter_by ? venue.filter_by.join(', ') : 'N/A') + '<br/>' +
        (distStr ? '<strong>Distance:</strong>' + distStr + '<br/>' : '') +
        (venue.deferLink ? '<br/><a href="' + venue.deferLink + '" target="_blank">Book on Playo →</a>' : '');

      marker.bindPopup(popupContent, { maxWidth: 280 });
      marker.bindTooltip(venue.name, { direction: "top", offset: [0, -8] });

      marker._venueIndex = index;
      VENUE_MARKERS.push(marker);
    });
  }

  // --- Focus on a venue (from list click) ---
  function focusVenue(index) {
    var venue = FILTERED_VENUES[index];
    if (!venue) return;

    MAP.setView([venue.lat, venue.lng], 16);

    // Open popup on the marker
    if (VENUE_MARKERS[index]) {
      VENUE_MARKERS[index].openPopup();
    }

    // Highlight card
    document.querySelectorAll(".venue-card").forEach(function(card) {
      card.classList.remove("active");
    });
    var activeCard = document.querySelector('.venue-card[data-index="' + index + '"]');
    if (activeCard) {
      activeCard.classList.add("active");
    }
  }

  // --- Set user location on map ---
  function setUserLocation(lat, lng, label) {
    USER_LOCATION = { lat: lat, lng: lng };

    // Update status
    var statusEl = document.getElementById("locationStatus");
    var textEl = document.getElementById("locationText");
    statusEl.classList.add("active");
    textEl.textContent = label || (lat.toFixed(4) + ", " + lng.toFixed(4));

    // Place/move user marker
    if (USER_MARKER) {
      MAP.removeLayer(USER_MARKER);
    }

    var userIcon = L.divIcon({
      className: "user-marker",
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });

    USER_MARKER = L.marker([lat, lng], { icon: userIcon, zIndexOffset: 1000 })
      .addTo(MAP)
      .bindPopup('<strong>📍 Your Location</strong><br/>' + (label || 'Current position'))
      .openPopup();

    MAP.setView([lat, lng], 14);

    // Re-sort venues by distance
    applyFilter();

    // Update sort info
    document.getElementById("sortInfo").textContent = "↕ By distance";
  }

  // --- Geolocation ---
  window.locateMe = function() {
    var btn = document.getElementById("locateBtn");
    btn.textContent = "⏳ Locating...";
    btn.disabled = true;

    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      btn.textContent = "📍 Use My Location";
      btn.disabled = false;
      return;
    }

    navigator.geolocation.getCurrentPosition(
      function(pos) {
        setUserLocation(pos.coords.latitude, pos.coords.longitude, "My Location");
        btn.textContent = "📍 Location Set ✓";
        setTimeout(function() {
          btn.textContent = "📍 Use My Location";
          btn.disabled = false;
        }, 2000);
      },
      function(err) {
        console.error("Geolocation error:", err);
        alert("Could not get your location. Please allow location access or search for a place.");
        btn.textContent = "📍 Use My Location";
        btn.disabled = false;
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // --- Update venue count badge ---
  function updateVenueCount() {
    var el = document.getElementById("venueCount");
    el.textContent = FILTERED_VENUES.length + " venue" + (FILTERED_VENUES.length !== 1 ? "s" : "");
  }

  // --- Setup city selector ---
  function setupCitySelect() {
    var select = document.getElementById("citySelect");
    Object.keys(CITIES).forEach(function(city) {
      var opt = document.createElement("option");
      opt.value = city;
      opt.textContent = city.charAt(0).toUpperCase() + city.slice(1);
      if (city === CURRENT_CITY) opt.selected = true;
      select.appendChild(opt);
    });

    select.addEventListener("change", function() {
      CURRENT_CITY = this.value;
      MAP.setView([CITIES[CURRENT_CITY].lat, CITIES[CURRENT_CITY].lng], 13);
      loadVenues(CURRENT_CITY);
    });
  }

  // --- Setup sport filter ---
  function setupSportFilter() {
    var select = document.getElementById("sportFilter");

    // We'll populate after first load
    function populate() {
      var sports = new Set();
      ALL_VENUES.forEach(function(v) {
        if (v.filter_by) {
          v.filter_by.forEach(function(s) { sports.add(s); });
        }
      });
      var sorted = Array.from(sports).sort();
      sorted.unshift("All");

      select.innerHTML = "";
      sorted.forEach(function(sport) {
        var opt = document.createElement("option");
        opt.value = sport;
        opt.textContent = sport;
        if (sport === CURRENT_SPORT) opt.selected = true;
        select.appendChild(opt);
      });
    }

    select.addEventListener("change", function() {
      CURRENT_SPORT = this.value;
      applyFilter();
    });

    // Expose populate for later
    window._populateSportFilter = populate;
  }

  // --- Setup search box (Nominatim) ---
  function setupSearch() {
    var input = document.getElementById("searchInput");
    var results = document.getElementById("searchResults");
    var timer = null;

    input.addEventListener("input", function() {
      var q = input.value.trim();
      clearTimeout(timer);

      if (q.length < 3) {
        results.style.display = "none";
        results.innerHTML = "";
        return;
      }

      timer = setTimeout(function() {
        var url = "https://nominatim.openstreetmap.org/search?format=json&q=" +
          encodeURIComponent(q) + "&limit=5&countrycodes=in";

        fetch(url, { headers: { "Accept-Language": "en" } })
          .then(function(r) { return r.json(); })
          .then(function(data) {
            results.innerHTML = "";
            if (data.length === 0) {
              results.style.display = "none";
              return;
            }
            data.forEach(function(item) {
              var div = document.createElement("div");
              div.className = "result-item";
              div.textContent = item.display_name;
              div.addEventListener("click", function() {
                input.value = "";
                results.style.display = "none";
                var name = item.display_name.split(",")[0];
                setUserLocation(parseFloat(item.lat), parseFloat(item.lon), name);
              });
              results.appendChild(div);
            });
            results.style.display = "block";
          })
          .catch(function(err) {
            console.error("Search error:", err);
          });
      }, 350);
    });

    document.addEventListener("click", function(e) {
      if (!input.contains(e.target) && !results.contains(e.target)) {
        results.style.display = "none";
      }
    });
  }

  // --- Escape HTML ---
  function escapeHtml(str) {
    if (!str) return "";
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Initialize ---
  function init() {
    fetchCities(function() {
      // Create map
      MAP = L.map("map", {
        center: [CITIES[CURRENT_CITY].lat, CITIES[CURRENT_CITY].lng],
        zoom: 13,
        zoomControl: true
      });

      // Dark-themed tiles (CartoDB Dark Matter)
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        maxZoom: 19,
        subdomains: "abcd"
      }).addTo(MAP);

      // Setup UI
      setupCitySelect();
      setupSportFilter();
      setupSearch();

      // Load initial venues
      var originalLoadVenues = loadVenues;
      loadVenues = function(city) {
        var url = "data/venues_" + city + ".json";
        document.getElementById("venueList").innerHTML =
          '<div class="loading"><div class="spinner"></div>Loading venues...</div>';

        fetch(url)
          .then(function(r) { return r.json(); })
          .then(function(venues) {
            ALL_VENUES = venues;
            if (window._populateSportFilter) {
              window._populateSportFilter();
            }
            applyFilter();
          })
          .catch(function(err) {
            console.error("Failed to load venues:", err);
            document.getElementById("venueList").innerHTML =
              '<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>Error</h3><p>Could not load venue data.</p></div>';
          });
      };

      loadVenues(CURRENT_CITY);
    });
  }

  // Expose focusVenue globally
  window.courtFinder = {
    focusVenue: focusVenue
  };

  // Start
  document.addEventListener("DOMContentLoaded", init);
})();
