FROM node:lts

WORKDIR /src

#ADD package.json /src

#RUN npm install

#ADD . /src

CMD npm install && npm run start
