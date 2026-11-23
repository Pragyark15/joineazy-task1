const app = require('./app');
const config = require('./config');
const { migrate, waitForDb } = require('./db');

(async () => {
  try {
    await waitForDb();
    await migrate();
    app.listen(config.port, () => console.log(`API listening on :${config.port}`));
  } catch (err) {
    console.error('Failed to start', err);
    process.exit(1);
  }
})();
