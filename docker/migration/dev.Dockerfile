FROM node:11.10.1-alpine

RUN mkdir /service
WORKDIR /service

COPY package.json yarn.lock /service/
RUN yarn

COPY lib/ /service/lib
COPY migrations/ /service/migrations

CMD node --experimental-modules lib/runner.mjs
