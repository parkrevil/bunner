#!/bin/bash

set -e

SCRIPTS_DIR="$(dirname "$0")"

echo "Giving execute permissions to all .sh scripts in $SCRIPTS_DIR ..."

find "$SCRIPTS_DIR" -type f -name "*.sh" -exec chmod +x {} \;

echo "Done!"
