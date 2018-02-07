#!/usr/bin/env python

import json
import os
from os.path import abspath, dirname, join

import requests

PLAYO_AUTH = os.getenv('PLAYO_AUTH', '')
assert len(PLAYO_AUTH) > 0, 'Please set PLAYO_AUTH env var'
HERE = dirname(abspath(__file__))


LOCATION = {
    'lat': '12.9715987',
    'lng': '77.59456269999998'
}
SPORT_ID = 'SP5'
URL = 'https://playo.io/api/web/v1/venue/?page={page}&lat={lat}&lng={lng}&sportId={sport_id}'


def fetch_venues():
    page = 0
    venues = []
    while True:
        print('Fetching page {}...'.format(page))
        url = URL.format(page=page, sport_id=SPORT_ID, **LOCATION)
        response = requests.get(url, headers={'Authorization': PLAYO_AUTH}).json()
        venues_ = response.get('list', [])
        if len(venues_):
            venues.extend(venues_)
        page = response.get('nextPage')
        if not page or page == -1:
            break

    return venues


def add_markers(venues):
    for venue in venues:
        rating = int(float(venue['avgRating']))
        if rating == 5:
            venue['icon'] = 'https://maps.google.com/mapfiles/kml/pal3/icon12.png'
        elif rating == 4:
            venue['icon'] = 'https://maps.google.com/mapfiles/kml/pal3/icon11.png'
        elif rating == 3:
            venue['icon'] = 'https://maps.google.com/mapfiles/kml/pal3/icon10.png'
        else:
            venue['icon'] = 'https://maps.google.com/mapfiles/kml/pal3/icon57.png'
    return venues


def filter_inactive(venues):
    return [v for v in venues if v['active']]


def main():
    venues = add_markers(filter_inactive(fetch_venues()))
    venues_persist_path = join(HERE, '..', 'data', 'venues.json')
    with open(venues_persist_path, 'w') as f:
        json.dump(venues, f, indent=2)


if __name__ == '__main__':
    main()
