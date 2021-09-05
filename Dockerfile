FROM node:12

# Create app directory
WORKDIR /app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm install
# If you are building your code for production
# RUN npm ci --only=production

# Bundle app source
COPY . .

EXPOSE 8000

RUN npm install pm2 -g
RUN apt-get update && apt-get install -y vim
RUN apt-get install -y telnet
CMD [ "pm2-runtime" , "index.js" , "--name", "nodeman" ]