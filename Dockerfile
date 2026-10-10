FROM node:22-alpine

RUN apk add --no-cache vips-dev build-base python3

WORKDIR /opt/app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
ENV NODE_ENV=production
RUN npm run build

EXPOSE 1337
CMD ["npm", "run", "start"]
