# playo-find-venue

Find good [Playo](https://playo.co/) venues in convenient locations

## Motivation

A group of my friends in Bangalore have started playing Badminton regularly. We
often book a court through Playo, based on the availability in areas which are
conveniently reachable by a majority of us. Often, the courts end up being not
the best ones. This app was built to make this search easier.

## Usage

- Visit the [website](https://punchagan.github.io/playo-find-venue/)
- Remove the default locations
- Enter locations of where each of the players is coming from
- Find a location in or around the area with the most overlap
- Book a venue
- Sweat it out!

## Contributing

The app currently only works for Bangalore, Hyderabad & Chennai.

It is easy to add new cities, though. The `js/locations.json` file needs to be
updated with the location of the new city to track. The `fetch_venues.py` script
needs to be run once to fetch venues for the newly added city.

## License

This code is licensed under the GNU AGPL v3. Please see the `LICENSE` file for
details.
