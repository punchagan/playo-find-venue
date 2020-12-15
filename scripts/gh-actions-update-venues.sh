#!/bin/bash
set -e

GIT_URL="https://github.com/punchagan/playo-find-venue.git"
GIT_URL=$(echo $GIT_URL|sed -e s/github.com/punchagan:"${GITHUB_TOKEN}"@github.com/g)

# Push to GitHub
git add data/
git config user.email "punchagan+ghactions@muse-amuse.in"
git config user.name "punchagan (gh-actions)"
git commit -m "GH Actions: Auto update venues [ci skip]"
git push --quiet "${GIT_URL}" master:master
