const express = require('express');
const cors = require('cors');
const { Pool, Client } = require('pg');
const redis = require('redis');

const keys = require('./keys');

const app = express();
app.use(cors());
app.use(express.json());

const pgClient = new Pool({
  user: keys.pgUser,
  database: keys.pgDatabase,
  password: keys.pgPassword,
  host: keys.pgHost,
  port: keys.pgPort,
});

pgClient.on('error', () => console.log('Lost PG connection'));
pgClient.query('CREATE TABLE IF NOT EXISTS values (number INT)')
  .catch((err) => console.log(err));

const redisClient = redis.createClient({
  socket: {
    host: keys.redisHost,
    port: keys.redisPost,
  },
});

const redisPublisher = redisClient.duplicate();

app.get('/', (req, res) => {
  res.send('Hi');
});

app.get('/values/all', async (req, res) => {
  const values = await pgClient.query('SELECT * FROM values');

  res.send(values.rows);
});

app.get('/values/current', async (req, res) => {
  await redisClient.connect();
  const values = await redisClient.hGetAll('values');
  await redisClient.disconnect();

  res.send(values);
});

app.post('/values', async (req, res) => {
  const index = req.body.index;

  if (parseInt(index) > 40) {
    return res.status(422).send('Index too high');
  }

  console.log("Inserting values into Redis")
  await redisClient.connect();
  await redisClient.hSet('values', index, 'Nothing yet!');
  await redisClient.disconnect();

  console.log("Publishing Redis insert event")
  await redisPublisher.connect();
  await redisPublisher.publish('insert', index);
  await redisPublisher.disconnect();

  console.log("Inserting values into Postgres")
  pgClient.query('INSERT INTO values(number) VALUES($1)', [index]);
  res.send({ working: true });
})

app.listen('5000', () => console.log('Listening on port 5000'));
