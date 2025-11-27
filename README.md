# 淘宝评论爬取工具

一个基于Playwright+node.js的淘宝商品评论爬取工具，支持爬取主评论和追评。

## 快速开始

### 环境要求
- **Node.js** 环境
- **Chromium** 浏览器

### 安装依赖
```bash
git clone https://github.com/Iikitty/taobao.git #下载资源
cd taobao #进入文件夹
npm install #安装依赖
npm install playwright #安装playwright
npx playwright install chromium  # 安装浏览器
npm install xlsx #安装excel依赖
```

## 使用方法

### 1. 配置商品信息
在 `config.xlsx` 文件中按照格式填入：
- 商品名称
- 商品链接  
- 评论总数
- 追评总数
- 下载路径（可选）默认为当前目录的./save_data

### 2. 配置Cookie
在项目目录下创建 `cookie.json` 文件，替换成您自己的淘宝cookie。

### 3. 运行爬虫
```bash
node 爬取.js
```

## 功能特性

- ✅ 自动登录验证
- ✅ 主评论爬取
- ✅ 追评爬取  
- ✅ 自动滚动加载
- ✅ Excel结果导出
- ✅ 中文文件名支持

## 输出结果

程序会在 `save_data/` 目录下生成Excel文件，包含：
- 主评论工作表
- 追评对工作表

## 注意事项

- 请确保cookie有效且未过期
- 爬取过程中请保持网络连接稳定
- 大数量评论爬取可能需要较长时间
- 可以去edge浏览器获取扩展，有个Cookie-Editor的扩展。去淘宝登录，然后用刚下载的扩展有个导出的功能，导出为Json格式到根目录就行
