FROM node:10.17.0-alpine

EXPOSE 9229
EXPOSE 3000

RUN mkdir /service
WORKDIR /service

VOLUME /data
VOLUME /service/src
VOLUME /service/types

COPY build-context/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN apk add --no-cache su-exec && \
    chmod +x /usr/local/bin/entrypoint.sh

COPY package.json yarn.lock tsconfig.json tsconfig.build.json /service/
RUN yarn install

ENTRYPOINT [ "/usr/local/bin/entrypoint.sh" ]

CMD yarn dev
