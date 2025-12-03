const express = require('express');
const cors = require('cors'); // จำเป็นสำหรับให้ Frontend ของคุณเรียก API ได้
const app = express();
const PORT = 3001; // Port ที่ Backend จะรัน

// --- Middlewares ---
// ตั้งค่า CORS (ควรระบุ origin ใน Production แทน * เพื่อความปลอดภัย)
app.use(cors());
// เพื่อให้ server อ่านข้อมูล JSON จาก request body ได้
app.use(express.json());

// --- API Routes ---
// Endpoint ทดสอบ
app.get('/api/test', (req, res) => {
  console.log('Test API called!');
  res.json({
    message: '🚀 Hello from the Node.js API server running via OpenLiteSpeed!',
    timestamp: new Date().toISOString()
  });
});

// Endpoint ตัวอย่างสำหรับการส่งข้อมูล
app.post('/api/data', (req, res) => {
  const receivedData = req.body;
  res.json({
    status: 'success',
    received: receivedData,
    processed: true
  });
});

// --- Server Start ---
app.listen(PORT, () => {
  console.log(`✅ Backend Server is live on port ${PORT}`);
  console.log(`Access Test API at: http://localhost:${PORT}/api/test`);
});