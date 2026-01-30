#!/bin/bash
#
# Stop BotMaker via Docker Compose
#

set -e

cd "$(dirname "$0")/.."

echo "Stopping BotMaker..."
docker compose down

echo "BotMaker stopped"
