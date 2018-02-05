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


def main():
    venues = fetch_venues()
    venues_persist_path = join(HERE, '..', 'js', 'venues.js')
    with open(venues_persist_path, 'w') as f:
        code = 'venues = {};\n'.format(json.dumps(venues, indent=2))
        f.write(code)


if __name__ == '__main__':
    main()
