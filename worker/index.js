const keys = require('./keys');
const redis = require('redis');

const redisClient = redis.createClient({
  socket: {
    host: keys.redisHost,
    port: keys.redisPost,
  },
});

const sub = redisClient.duplicate();

function fib(index) {
  if (index < 2) return 1;
  return fib(index - 1) + fib(index - 2);
}

sub.on('error', err => console.log('Redis Client Error', err));

sub.subscribe('insert', async (message) => {
  console.log(`Calculating for value: ${message}`);
  await redisClient.connect();
  await redisClient.hSet('values', message, fib(parseInt(message)));
  await redisClient.disconnect();
});

sub.connect();