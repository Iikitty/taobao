# 淘宝评论爬取工具

一个基于Playwright+Node.js的淘宝商品评论爬取工具，支持爬取主评论和追评。现在提供可视化Web界面进行配置管理！

## 快速开始

### 环境要求
- **Node.js** 环境
- **Chromium** 浏览器

### 安装依赖
```bash
npm install
npx playwright install chromium  # 安装浏览器
```

## 使用方法

### 方式一：Web可视化界面（推荐）

1. **启动Web服务器**
```bash
npm start
```

2. **访问配置界面**
打开浏览器访问：`http://localhost:3000`

3. **配置Cookie**
- 在"Cookie配置"标签页中，从浏览器开发者工具复制Cookie
- 推荐使用Edge浏览器的Cookie-Editor扩展导出JSON格式
- 点击"保存Cookie"

4. **添加商品配置**
- 在"商品配置"标签页中填写：
  - 商品名称
  - 商品网址
  - 评论总数（默认1000）
  - 追评总数（默认100）
  - 下载路径（可选，默认./save_data/）
- 点击"添加配置"
- 点击"保存配置"

5. **启动爬虫**
- 点击"启动爬虫"按钮
- 在运行日志中查看爬取进度
- 爬取完成后，结果会保存到指定目录

6. **查看结果**
- 在"已保存的文件"区域查看生成的Excel文件
- 点击"打开"按钮查看结果

### 方式二：命令行方式

1. **配置商品信息**
在 `config.xlsx` 文件中按照格式填入：
- 商品名称
- 商品链接  
- 评论总数
- 追评总数
- 下载路径（可选）默认为当前目录的./save_data

2. **配置Cookie**
在项目目录下创建 `cookie.json` 文件，替换成您自己的淘宝cookie。

3. **运行爬虫**
```bash
node 爬取.js
```

## 功能特性

- ✅ **Web可视化界面** - 无需手动编辑配置文件
- ✅ **实时日志显示** - 查看爬取进度和状态
- ✅ **一键启动/停止** - 方便控制爬虫运行
- ✅ **自动登录验证**
- ✅ **主评论爬取**
- ✅ **追评爬取**  
- ✅ **自动滚动加载**
- ✅ **Excel结果导出**
- ✅ **中文文件名支持**
- ✅ **多商品批量爬取**

## API接口

Web界面提供以下API接口：

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/config` | GET | 读取配置 |
| `/api/config` | POST | 保存配置 |
| `/api/cookie` | GET | 读取Cookie |
| `/api/cookie` | POST | 保存Cookie |
| `/api/crawler/start` | POST | 启动爬虫 |
| `/api/crawler/stop` | POST | 停止爬虫 |
| `/api/crawler/status` | GET | 获取爬虫状态 |
| `/api/files` | GET | 获取已保存的文件列表 |

## 输出结果

程序会在 `save_data/` 目录下生成Excel文件，包含：
- **主评论工作表**：商品名称、商品规格、评论序号、评论内容、爬取时间
- **追评对工作表**：商品名称、商品规格、评论对序号、原评论、追评、爬取时间

## 项目结构

```
taobao/
├── 爬取.js              # 爬虫主程序
├── server.js            # Web服务器
├── package.json         # 项目配置
├── config.xlsx          # 商品配置文件
├── cookie.json          # Cookie配置文件
├── public/
│   └── index.html       # Web界面
└── save_data/           # 结果保存目录
```

## 注意事项

- 请确保cookie有效且未过期
- 爬取过程中请保持网络连接稳定
- 大数量评论爬取可能需要较长时间
- 可以去Edge浏览器获取Cookie-Editor扩展，登录淘宝后导出Cookie为JSON格式
- Web界面默认运行在3000端口，如需修改请编辑server.js中的PORT变量

## 常见问题

### Q: Cookie如何获取？
A: 推荐使用Edge浏览器的Cookie-Editor扩展：
1. 安装Cookie-Editor扩展
2. 登录淘宝网站
3. 点击扩展图标，选择"导出"
4. 选择JSON格式，复制内容到Web界面的Cookie配置中

### Q: 爬虫启动失败？
A: 请检查：
1. Cookie是否有效
2. 商品网址是否正确
3. 网络连接是否正常
4. Chromium浏览器是否已安装

### Q: 如何修改端口？
A: 编辑server.js文件，修改PORT变量的值

## 许可证

MIT License
