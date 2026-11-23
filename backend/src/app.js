const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.use(helmet());
app.use(cors({ origin: config.corsOrigin.split(',') }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/assignments', require('./routes/assignments'));
app.use('/api/analytics', require('./routes/analytics'));

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

module.exports = app;
