var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
const jwt = require('jsonwebtoken');
const uuid = require('uuid/v4');

const APP_SECRET = 'olá mundo'

const votings = {}

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', function(socket){
  console.log('a user connected');
  socket.emit('customEmit', {foo: 'bar'})

  // Pass `socket` as first argument
  const withSocket = handler => (...args) => handler(socket, ...args)

  socket.on('createVoting', withSocket(onCreateVoting))
  socket.on('vote', withSocket(onVote))
  socket.on('listenVoting', withSocket(onListenVoting))
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});

function onCreateVoting(socket, { voters, options }) {
  const id = uuid()
  const votes = {}
  
  votings[id] = {
    id,
    voters,
    votes,
    options
  }

  // From 0 to N
  // The 0 token can't vote
  const tokens = Array.from({length: voters + 1}, (_, i) =>
    jwt.sign({
      votingId: id,
      userId: i,
      options
    }, APP_SECRET)
  )

  socket.emit('votingCreated', {
    id,
    options,
    tokens
  })
  
  // console.log(JSON.stringify(votings, undefined, 2))
}

function onVote(socket, {token, vote}) {
  try {
    jwt.verify(token, APP_SECRET)
  } catch (err) {
    return io.to(socket.id).emit('invalidToken', { token })
  }

  const {votingId, userId, options} = jwt.decode(token)

  if (isNaN(vote) || vote < 0 || vote >= options.length || userId === 0) {
    // TODO
    return
  }

  const voting = votings[votingId]

  voting.votes[userId] = {
    userId,
    vote
  }

  triggerVotingUpdate(votingId)
}

function onListenVoting(socket, { votingId }) {
  const votingExists = !!votings[votingId]
  const update = getVotingUpdate(votingId)
  
  if (!votingExists || !update) {
    // TODO
    return
  }
  
  socket.join(`voting:${votingId}`)
  io.to(socket.id).emit('updateVoting', update)
} 

function triggerVotingUpdate (votingId) {
  const update = getVotingUpdate(votingId)

  if (!update) {
    // TODO
    return
  }

  io.to(`voting:${votingId}`).emit('updateVoting', update)
} 

function getVotingUpdate(votingId) {
  const voting = votings[votingId]

  if (!voting) {
    return
  }

  return {
    votingId,
    votes: voting.votes
  }
}