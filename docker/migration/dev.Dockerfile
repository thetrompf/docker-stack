FROM node:11.13.0-alpine as build

RUN mkdir /service /artifacts
WORKDIR /service

COPY package.json yarn.lock tsconfig.json tsconfig.build.json /service/
RUN yarn install --production && \
    mv /service/node_modules /artifacts/node_modules && \
    yarn install && \
    cp package.json tsconfig.json /artifacts/

COPY types/ /service/types/
COPY src/ /service/src/

RUN yarn build

FROM node:11.13.0-alpine

RUN mkdir /service
WORKDIR /service

COPY --from=build /artifacts/ /service/

VOLUME /data

COPY bin/psql /service/bin/psql
RUN chmod +x /service/bin/psql

CMD yarn start
