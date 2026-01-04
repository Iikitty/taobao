const express = require('express');
const cors = require('cors');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const PORT = 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/save_data', express.static('save_data'));

// 配置文件路径
const CONFIG_FILE = './config.xlsx';
const COOKIE_FILE = './cookie.json';

// 读取配置
app.get('/api/config', (req, res) => {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      return res.json({ success: true, data: [] });
    }
    
    const workbook = XLSX.readFile(CONFIG_FILE);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('读取配置失败:', error);
    res.status(500).json({ success: false, message: '读取配置失败' });
  }
});

// 保存配置
app.post('/api/config', (req, res) => {
  try {
    const { data } = req.body;
    
    if (!Array.isArray(data)) {
      return res.status(400).json({ success: false, message: '配置数据格式错误' });
    }
    
    // 创建工作簿
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, '配置');
    
    // 保存文件
    XLSX.writeFile(workbook, CONFIG_FILE);
    
    res.json({ success: true, message: '配置保存成功' });
  } catch (error) {
    console.error('保存配置失败:', error);
    res.status(500).json({ success: false, message: '保存配置失败' });
  }
});

// 读取Cookie
app.get('/api/cookie', (req, res) => {
  try {
    if (!fs.existsSync(COOKIE_FILE)) {
      return res.json({ success: true, data: null });
    }
    
    const cookieData = fs.readFileSync(COOKIE_FILE, 'utf8');
    res.json({ success: true, data: JSON.parse(cookieData) });
  } catch (error) {
    console.error('读取Cookie失败:', error);
    res.status(500).json({ success: false, message: '读取Cookie失败' });
  }
});

// 保存Cookie
app.post('/api/cookie', (req, res) => {
  try {
    const { data } = req.body;
    
    if (!data) {
      return res.status(400).json({ success: false, message: 'Cookie数据不能为空' });
    }
    
    fs.writeFileSync(COOKIE_FILE, JSON.stringify(data, null, 4));
    
    res.json({ success: true, message: 'Cookie保存成功' });
  } catch (error) {
    console.error('保存Cookie失败:', error);
    res.status(500).json({ success: false, message: '保存Cookie失败' });
  }
});

// 启动爬虫
let crawlerProcess = null;
let crawlerStatus = { running: false, logs: [] };

app.post('/api/crawler/start', (req, res) => {
  try {
    if (crawlerStatus.running) {
      return res.status(400).json({ success: false, message: '爬虫正在运行中' });
    }
    
    crawlerStatus.running = true;
    crawlerStatus.logs = [];
    
    // 启动爬虫进程
    crawlerProcess = spawn('node', ['爬取.js'], {
      cwd: __dirname,
      shell: true
    });
    
    // 捕获输出
    crawlerProcess.stdout.on('data', (data) => {
      const log = data.toString();
      crawlerStatus.logs.push({ type: 'info', message: log, time: new Date().toISOString() });
      console.log(log);
    });
    
    crawlerProcess.stderr.on('data', (data) => {
      const log = data.toString();
      crawlerStatus.logs.push({ type: 'error', message: log, time: new Date().toISOString() });
      console.error(log);
    });
    
    crawlerProcess.on('close', (code) => {
      crawlerStatus.running = false;
      crawlerStatus.logs.push({ type: 'info', message: `爬虫进程结束，退出码: ${code}`, time: new Date().toISOString() });
      console.log(`爬虫进程结束，退出码: ${code}`);
    });
    
    res.json({ success: true, message: '爬虫启动成功' });
  } catch (error) {
    console.error('启动爬虫失败:', error);
    crawlerStatus.running = false;
    res.status(500).json({ success: false, message: '启动爬虫失败' });
  }
});

// 停止爬虫
app.post('/api/crawler/stop', (req, res) => {
  try {
    if (!crawlerProcess) {
      return res.status(400).json({ success: false, message: '没有运行的爬虫进程' });
    }
    
    crawlerProcess.kill();
    crawlerStatus.running = false;
    crawlerStatus.logs.push({ type: 'info', message: '爬虫已停止', time: new Date().toISOString() });
    
    res.json({ success: true, message: '爬虫已停止' });
  } catch (error) {
    console.error('停止爬虫失败:', error);
    res.status(500).json({ success: false, message: '停止爬虫失败' });
  }
});

// 获取爬虫状态
app.get('/api/crawler/status', (req, res) => {
  res.json({ success: true, data: crawlerStatus });
});

// 获取保存的数据文件列表
app.get('/api/files', (req, res) => {
  try {
    const saveDir = './save_data';
    if (!fs.existsSync(saveDir)) {
      return res.json({ success: true, data: [] });
    }
    
    const files = fs.readdirSync(saveDir)
      .filter(file => file.endsWith('.xlsx'))
      .map(file => {
        const filePath = path.join(saveDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          path: filePath,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        };
      })
      .sort((a, b) => b.created - a.created);
    
    res.json({ success: true, data: files });
  } catch (error) {
    console.error('读取文件列表失败:', error);
    res.status(500).json({ success: false, message: '读取文件列表失败' });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 服务器已启动: http://localhost:${PORT}`);
  console.log(`📋 配置管理界面: http://localhost:${PORT}`);
});
