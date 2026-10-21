#!/bin/sh
set -eu
php /opt/easylayer/configure.php
exec docker-php-entrypoint "$@"
