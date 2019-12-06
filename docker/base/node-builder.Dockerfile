FROM node:10.17.0-alpine

ONBUILD RUN mkdir -p /service /artifacts/node_modules /artifacts/dist/
ONBUILD WORKDIR /service

ONBUILD COPY package*.json /service/
ONBUILD RUN npm ci --production && \
    mv /service/node_modules/ /artifacts/node_modules/ && \
    npm ci && \
    cp package.json /artifacts/

ONBUILD COPY tsconfig*.json /service/
ONBUILD COPY types/ /service/types/
ONBUILD COPY src/ /service/src/

ONBUILD RUN npm run lint && \
    npm run test && \
    npm run build

ONBUILD RUN mv dist/ /artifacts/dist/
