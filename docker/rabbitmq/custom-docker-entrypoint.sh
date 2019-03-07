#!/bin/sh -e

RABBITMQ_ERLANG_COOKIE="$(cat "$RABBITMQ_ERLANG_COOKIE_FILE")"
export RABBITMQ_ERLANG_COOKIE

exec docker-entrypoint.sh "${@}"
