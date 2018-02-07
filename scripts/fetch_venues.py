#!/usr/bin/env python

from collections import defaultdict
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


def modify_metadata(venues, clean=True):
    RETAIN_KEYS = {'name', 'icon', 'info', 'lat', 'lng'}
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
        # Add info
        venue['info'] = get_info(venue)

    if clean:
        venues = [
            {key: value for key, value in venue.items() if key in RETAIN_KEYS}
            for venue in venues
        ]

    return venues


def filter_inactive(venues):
    return [v for v in venues if v['active']]


def get_info(venue):
    info = """
    <h3>{name}</h3>
    <strong>Ratings:</strong> {avgRating} [{ratingCount}]<br/>
    <strong>Phone:</strong> {inquiryPhone}<br/>
    <a href="{deferLink}" target="_blank">{deferLink}</a><br/>
    """
    return info.format_map(defaultdict(lambda: 'N/A', venue))


def main(clean=True):
    venues = modify_metadata(filter_inactive(fetch_venues()), clean=clean)
    venues_persist_path = join(HERE, '..', 'data', 'venues.json')
    with open(venues_persist_path, 'w') as f:
        json.dump(venues, f, indent=2)


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--full', action='store_true')
    args = parser.parse_args()
    main(not args.full)
