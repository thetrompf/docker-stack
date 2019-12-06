FROM node:10.17.0-alpine

ARG USER=node
ARG USER_UID=1000
ARG USER_GID=$USER_UID

RUN apk add --no-cache git bash g++ \
    && if [ "$USER_GID" != "1000" ]; then addgroup -g $USER_GID $USER; fi \
    && if [ "$USER_UID" != "1000" ]; then adduser -S -s /bin/bash -u $USER_UID -G $USER $USER; fi \
    && apk add --no-cache sudo \
    && echo "USER=$USER" \
    && echo $USER ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$USER \
    && chmod 0440 /etc/sudoers.d/$USER

ENTRYPOINT []
CMD [ "/bin/bash" ]
