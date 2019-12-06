#!/bin/sh

USER_ID=${LOCAL_USER_ID:-9001}

printf 'Starting with UID: %d\n' "$USER_ID"

adduser -DH -s /bin/sh -u "$USER_ID" user 1> /dev/null 2>&1

for d in build generated; do
  [ -d "/service/$d" ] && chown -R "$USER_ID:$USER_ID" "/service/$d"
done

exec /sbin/su-exec "$USER_ID:$USER_ID" "$@"
