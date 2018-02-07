#!/bin/bash
set -e

GIT_URL="https://github.com/punchagan/playo-find-venue.git"
GIT_URL=$(echo $GIT_URL|sed -e s/github.com/punchagan:"${GITHUB_TOKEN}"@github.com/g)

# Push to GitHub
git checkout "${TRAVIS_BRANCH}"
git add data/venues.json
git commit -m "Travis CI: Auto update venues" --author "punchagan (travisci) <punchagan+travis@muse-amuse.in>"
git push --quiet "${GIT_URL}" master:master
