const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { errorHandler, notFound } = require('./middleware/errorHandlers');
const env = require('./config/env');

const authRoutes = require('./routes/authRoutes');
const roomsRoutes = require('./routes/roomsRoutes');
const quizzesRoutes = require('./routes/quizzesRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.NODE_ENV === 'production' ? env.ALLOWED_ORIGIN : '*',
    credentials: true
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'campusca-backend', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/quizzes', quizzesRoutes);
app.use('/api/analytics', analyticsRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;

