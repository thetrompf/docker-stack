FROM node:11.13.0-alpine

RUN mkdir /service
WORKDIR /service

COPY package.json yarn.lock /service/
RUN yarn

COPY server.mjs /service/

CMD node --experimental-modules --inspect=0.0.0.0:9229 server.mjs
