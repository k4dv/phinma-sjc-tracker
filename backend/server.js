const express = require('express');
const cors = require('cors');
require('dotenv').config();

const roomRoutes = require('./routes/roomRoutes');
const supplyRoutes = require('./routes/supplyRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

const userRoutes = require('./routes/userRoutes');
app.use('/api/users', userRoutes);
// Middleware
app.use(cors());
app.use(express.json());

// API Endpoints
app.use('/api/rooms', roomRoutes);
app.use('/api/supplies', supplyRoutes);

app.get('/', (req, res) => {
  res.send('SJC Custodial System - Node.js Express MVC API is Running!');
});

app.listen(PORT, () => {
  console.log(`Backend server listening at http://localhost:${PORT}`);
});