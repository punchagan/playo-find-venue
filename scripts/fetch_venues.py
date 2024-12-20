#!/usr/bin/env python

import json
import os
from collections import defaultdict
from os.path import abspath, dirname, join

import requests
from bs4 import BeautifulSoup

PLAYO_AUTH = os.getenv("PLAYO_AUTH", "")
assert len(PLAYO_AUTH) > 0, "Please set PLAYO_AUTH env var"
HERE = dirname(abspath(__file__))

with open(join(HERE, "..", "js", "locations.json")) as f:
    LOCATIONS = json.load(f)

URL = "https://playo.io/api/web/v1/venue/?page={page}&lat={lat}&lng={lng}"


def fetch_venues(city):
    page = 0
    venues = []
    while True:
        print("Fetching page {}...".format(page), flush=True)
        url = URL.format(page=page, **LOCATIONS[city])
        response = requests.get(url, headers={"Authorization": PLAYO_AUTH}).json()
        venues_ = response.get("list", [])
        if len(venues_):
            venues.extend(venues_)
        page = response.get("nextPage")
        if not page or page == -1:
            break

    print("Found {n} venues in {city}".format(n=len(venues), city=city), flush=True)
    return venues


def fetch_sport_ids(debug=False):
    print("Fetching sport id map...", flush=True)
    # NOTE: We assume Bengaluru has all the sports that Playo has to offer
    url = "https://playo.co/venues/bengaluru/sports/all"
    soup = BeautifulSoup(requests.get(url).text, "lxml")

    scripts = [s for s in soup.find_all("script") if s.attrs.get("id") == "__NEXT_DATA__"]
    if len(scripts) == 0:
        return {}

    text = scripts[-1].text
    sport_ids = (
        json.loads(text).get("props", {}).get("pageProps", {}).get("allSports", {}).get("list", [])
    )
    if debug:
        print("Sport IDs: {sport_ids}".format(sport_ids=sport_ids), flush=True)
    return {sport["sportId"]: sport["name"] for sport in sport_ids}


def modify_metadata(venues, clean=True, debug=False):
    RETAIN_KEYS = {
        "name",
        "icon",
        "info",
        "lat",
        "lng",
        "filter_by",
        "avgRating",
        "rating",
        "ratingCount",
        "deferLink",
        "fullLink",
    }
    SPORT_ID_MAP = fetch_sport_ids(debug=debug)
    assert SPORT_ID_MAP, "Could not fetch Sport IDs"
    for venue in venues:
        rating = int(float(venue["avgRating"] or 0))
        icon = f"{rating}-lv.png" if rating > 0 else "red-square-lv.png"
        venue["rating"] = rating
        venue["icon"] = f"https://maps.google.com/mapfiles/kml/paddle/{icon}"
        # Add filter_by
        venue["filter_by"] = sorted(
            [SPORT_ID_MAP[s["sportId"]] for s in venue["sports"] if s["sportId"] in SPORT_ID_MAP]
        )
        venue["all_sports"] = ", ".join(venue["filter_by"])
        # Add info
        venue["info"] = get_info(venue)

    if clean:
        venues = [
            {key: value for key, value in venue.items() if key in RETAIN_KEYS} for venue in venues
        ]

    return sorted(venues, key=lambda x: x["name"])


def filter_inactive(venues):
    return [v for v in venues if v["active"]]


def get_info(venue):
    info = """
    <h3>{name}</h3>
    <strong>Ratings:</strong> {avgRating} [{ratingCount}]<br/>
    <strong>Sports:</strong> {all_sports}<br/>
    <strong>Phone:</strong> {inquiryPhone}<br/>
    <a href="{deferLink}" target="_blank">{deferLink}</a><br/>
    """
    return info.format_map(defaultdict(lambda: "N/A", venue))


def main(city, clean=True, debug=False):
    print("Fetching venues for {}".format(city.capitalize()), flush=True)
    venues = modify_metadata(filter_inactive(fetch_venues(city)), clean=clean, debug=debug)
    if debug:
        print("Cleaned {n} venues in {city}".format(n=len(venues), city=city), flush=True)
    venues_persist_path = join(HERE, "..", "data", "venues_{}.json".format(city))
    if debug:
        print(json.dumps(venues, indent=2), flush=True)
    with open(venues_persist_path, "w") as f:
        json.dump(venues, f, indent=2)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--full", action="store_true")
    parser.add_argument("--debug", action="store_true")
    parser.add_argument("city", choices=list(LOCATIONS.keys()) + ["all"])
    args = parser.parse_args()
    if args.city != "all":
        main(args.city, not args.full, args.debug)
    else:
        from concurrent.futures import ThreadPoolExecutor

        with ThreadPoolExecutor(max_workers=5) as executor:
            future_to_city = {
                executor.submit(main, city, not args.full, args.debug): city
                for city in LOCATIONS.keys()
            }
