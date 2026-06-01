const http = require('http');
const app = require('./app');
const env = require('./config/env');

const server = http.createServer(app);

server.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`CampusCA backend running on port ${env.PORT}`);
});

