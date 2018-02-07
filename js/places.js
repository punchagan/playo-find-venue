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

var circles = [];

var setup_search_box = function(map, searchInput) {
  var searchBox = new google.maps.places.SearchBox(searchInput);
  google.maps.event.addListener(searchBox, "places_changed", function() {
    var location = searchBox.getPlaces()[0];
    if (location) {
      searchInput.value = "";
      people.push({
        center: {
          lat: location.geometry.location.lat(),
          lng: location.geometry.location.lng()
        },
        name: location.name,
        radius: 8,
        color: "#0000FF"
      });
      draw_circles(map);
    }
  });
};

var set_center = function(map) {
  var lat = people.map(function(person) {
    return person.center.lat;
  });
  var lng = people.map(function(person) {
    return person.center.lng;
  });
  var center = {
    lat: (Math.min.apply(lat, lat) + Math.max.apply(lat, lat)) / 2,
    lng: (Math.min.apply(lng, lng) + Math.max.apply(lng, lng)) / 2
  };
  map.setCenter(center);
};

var draw_circles = function(map) {
  // Hide previous circles
  circles.map(function(circle) {
    circle.setMap(null);
  });
  // Construct the circle for each person in people.
  circles = people.map(function(person) {
    var { center, radius, color } = person;
    var circle = draw_circle(map, center, radius, color);
    circle.person = person;
    return circle;
  });
  set_center(map);
  show_people(map);
};

var draw_circle = function(map, center, radius, color) {
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
    circle.setMap(null);
    people.splice(people.indexOf(circle.person), 1);
  });
  return circle;
};

var mark_venues = function(map) {
  var venues_url = "/data/venues.json";
  fetch(venues_url)
    .then(function(response) {
      return response.json();
    })
    .then(function(venues) {
      venues.map(function(venue) {
        // Add marker
        var marker = new google.maps.Marker({
          position: { lat: venue.lat, lng: venue.lng },
          title: venue.name,
          map: map,
          icon: {
            url: venue.icon,
            scaledSize: new google.maps.Size(25, 25)
          }
        });
        // infowindow that is shown when marker is clicked
        var info_content = `
  <h3>${venue.name}</h3>
  <strong>Ratings:</strong> ${venue.avgRating} [${venue.ratingCount}]<br/>
  <strong>Phone:</strong> ${venue.inquiryPhone || "NA"}<br/>
  <a href="${venue.deferLink}" target="_blank">${venue.deferLink}</a><br/>
  `;
        var infowindow = new google.maps.InfoWindow({
          content: info_content,
          maxWidth: 200
        });
        marker.addListener("click", function() {
          infowindow.open(map, marker);
        });
      });
    });
};

var show_people = function(map) {
  var controlsDiv = document.querySelector("#controls");
  if (!controlsDiv) {
    controlsDiv = document.createElement("div");
    controlsDiv.setAttribute("id", "controls");
    map.controls[google.maps.ControlPosition.LEFT_TOP].push(controlsDiv);

    var searchBar = document.createElement("input");
    controlsDiv.appendChild(searchBar);
    searchBar.setAttribute("type", "text");
    searchBar.setAttribute("id", "searchInput");
    searchBar.setAttribute("name", "searchInput");
    searchBar.setAttribute("placeholder", "Search for a place to add a circle");
    searchBar.style.width = "95%";
    setup_search_box(map, searchBar);

    var help = document.createElement("small");
    help.textContent = "Right click on the circles to remove them";
    controlsDiv.appendChild(help);
  }

  var places = document.querySelector("#controls ol");
  if (places) {
    places.remove();
  }

  var ol = document.createElement("ol");
  controlsDiv.appendChild(ol);
  people.map(function(person) {
    var li = document.createElement("li");
    ol.appendChild(li);
    var text = person.name;
    li.textContent = text;

    var radius_input = document.createElement("input");
    radius_input.type = "number";
    radius_input.value = person.radius;
    radius_input.onchange = function(e) {
      person.radius = e.target.value;
      draw_circles(map);
    };
    li.appendChild(radius_input);

    var color_input = document.createElement("input");
    color_input.type = "color";
    color_input.value = person.color;
    color_input.onchange = function(e) {
      person.color = e.target.value;
      draw_circles(map);
    };
    li.appendChild(color_input);
  });
};

var initMap = function() {
  // Create the map.
  var map = new google.maps.Map(document.getElementById("map"), {
    zoom: 13,
    mapTypeId: "roadmap",
    mapTypeControl: false
  });
  mark_venues(map);
  draw_circles(map);
};
