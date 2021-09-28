require('dotenv').config({ path: './config.env' });
const httpServer = require('http');
// and https for secure server
// const httpsServer = require('https');
const express = require('express');
const socketio = require('socket.io');
const mongoose = require('mongoose');

const app = express();

// maintaining connection list acoording to userId(_id in user collection)
var users = [];

const addUser = ({ socketId, userId }) => {
  !users.some((user) => user.userId === userId) && users.push({ socketId, userId });
};

const removeUser = (socketId) => {
  users = users.filter((user) => user.socketId !== socketId);
};

const getUser = (userId) => {
  // return users.find((user) => user.userId === userId);

  // convert objectId to string
  return users.find((user) => `${user.userId}` === `${userId}`);
};

const connection_string = process.env.MONGO_STRING.replace('<PASSWORD>', process.env.MONGO_PASSWORD);

const server = httpServer.createServer(app);

const io = socketio(server, { cors: { origin: 'http://localhost:3000' } });

// listening events
// socket is client browser info
io.on('connection', (socket) => {
  // here socket is client socket id
  console.log(`we have a new connection`);
  socket.on('connect', () => console.log('connect'));
  // here online is defined event
  // yahan pa ya online event ki jagah hum kuch bhi name rakh skate hain but phir hamain then same name sa client pa use karna hoga
  socket.on('online', (userId) => {
    console.log('user connect');
    addUser({ socketId: socket.id, userId });
    console.log('users : ', users);
  }); // here on means listen event and that event is comes from client

  //  here disconnect is predefined event
  socket.on('disconnect', () => {
    console.log('user disconnect');
    removeUser(socket.id);
    console.log('users : ', users);
  });
});

mongoose.connect(connection_string, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  //   useCreateIndex: true,
  //   useFindAndModify: false,
});

// we db.once for just our DB live whenever any new thing is append it return a event listener
const db = mongoose.connection;
db.once('open', () => {
  console.log('DB connected!');

  // watching notifications
  const notificationCollection = db.collection('notifications');
  const notificationChangeStream = notificationCollection.watch();
  notificationChangeStream.on('change', (change) => {
    if (change.operationType === 'insert') {
      var doc = change.fullDocument;
      var { user } = doc;
      var connectedUser = getUser(user);
      if (connectedUser) {
        //server => client (event)
        io.to(connectedUser.socketId).emit('notification', doc); // notification defined event
      }
    }
  });

  // watching messages
  const messageCollection = db.collection('messages');
  const messageChangeStream = messageCollection.watch();
  messageChangeStream.on('change', (change) => {
    if (change.operationType === 'insert') {
      var doc = change.fullDocument;
      var { receiver } = doc;
      var connectedUser = getUser(receiver);
      if (connectedUser) {
        io.to(connectedUser.socketId).emit('message', doc); // message defined event
      }
    }
  });
});

const PORT = process.env.PORT || 8000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// for staqrting server first time after production
// "start": "node server.js"
