// 使用Playwright实现滚动和评论爬取
const { chromium } = require('playwright');
const fs = require('fs');
const XLSX = require('xlsx');
const path = require('path');
const os = require('os');

// 从Excel文件读取配置
function readConfigFromExcel() {
  try {
    const workbook = XLSX.readFile('./config.xlsx');
    const sheetName = workbook.SheetNames[0]; // 获取第一个工作表名称
    const worksheet = workbook.Sheets[sheetName];
    
    // 将Excel数据转换为JSON
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    console.log('📋 从Excel文件读取到以下配置:');
    data.forEach((item, index) => {
      console.log(`${index + 1}. 商品名称: ${item['商品名称']}`);
      console.log(`   商品网址: ${item['商品网址']}`);
      console.log(`   评论总数: ${item['评论总数']}`);
      console.log(`   追评总数: ${item['追评总数']}`);
      console.log(`   下载路径: ${item['下载路径'] || './save_data/'}`);
    });
    
    return data;
  } catch (error) {
    console.error('❌ 读取Excel配置文件失败:', error);
    return [];
  }
}

// 生成结果Excel文件
function generateResultExcel(results, downloadPath = null) {
  try {
    // 创建工作簿
    const workbook = XLSX.utils.book_new();
    
    // 准备主评论数据
    const mainCommentsData = [];
    // 添加表头
    mainCommentsData.push(['商品名称', '评论序号', '评论内容', '爬取时间']);
    
    // 准备追评数据
    const additionalCommentsData = [];
    // 添加表头
    additionalCommentsData.push(['商品名称', '评论对序号', '原评论', '追评', '爬取时间']);
    
    // 添加数据
    results.forEach(result => {
      const now = new Date();
      const timeStr = now.toLocaleString('zh-CN');
      
      // 添加主评论
      if (result.comments && result.comments.length > 0) {
        result.comments.forEach((comment, index) => {
          mainCommentsData.push([
            result.productName,
            `评论${index + 1}`,
            comment,
            timeStr
          ]);
        });
      }
      
      // 添加评论对
      if (result.commentPairs && result.commentPairs.length > 0) {
        result.commentPairs.forEach((pair, index) => {
          additionalCommentsData.push([
            result.productName,
            `评论对${index + 1}`,
            pair.originalComment || '',
            pair.additionalComment || '',
            timeStr
          ]);
        });
      }
    });
    
    // 创建主评论工作表
    const mainCommentsSheet = XLSX.utils.aoa_to_sheet(mainCommentsData);
    // 将主评论工作表添加到工作簿
    XLSX.utils.book_append_sheet(workbook, mainCommentsSheet, '主评论');
    
    // 创建追评工作表
    const additionalCommentsSheet = XLSX.utils.aoa_to_sheet(additionalCommentsData);
    // 将追评工作表添加到工作簿
    XLSX.utils.book_append_sheet(workbook, additionalCommentsSheet, '追评');
    
    // 生成文件名
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 19).replace(/:/g, '-');
    const fileName = `淘宝评论结果_${dateStr}.xlsx`;
    
    // 确定保存路径
    let finalPath;
    if (downloadPath && downloadPath.trim() !== '') {
      // 使用指定的下载路径
      // 如果路径不以/或\结尾，添加路径分隔符
      const normalizedPath = downloadPath.replace(/\\/g, '/');
      if (!normalizedPath.endsWith('/')) {
        downloadPath = normalizedPath + '/';
      }
      finalPath = path.join(downloadPath, fileName);
      
      // 确保目录存在
      if (!fs.existsSync(downloadPath)) {
        fs.mkdirSync(downloadPath, { recursive: true });
        console.log(`📁 创建目录: ${downloadPath}`);
      }
    } else {
      // 使用默认路径 ./save_data/
      const defaultPath = './save_data/';
      finalPath = path.join(defaultPath, fileName);
      
      // 确保默认目录存在
      if (!fs.existsSync(defaultPath)) {
        fs.mkdirSync(defaultPath, { recursive: true });
        console.log(`📁 创建默认目录: ${defaultPath}`);
      }
    }
    
    // 保存文件
    XLSX.writeFile(workbook, finalPath);
    
    console.log(`💾 结果已保存到: ${finalPath}`);
    console.log(`📊 主评论数量: ${mainCommentsData.length - 1}`);
    console.log(`📊 追评对数量: ${additionalCommentsData.length - 1}`);
    return finalPath;
  } catch (error) {
    console.error('❌ 生成结果Excel文件失败:', error);
    return null;
  }
}

// 爬取单个商品的评论
async function scrapeProductComments(productConfig, browser) {
  console.log(`🚀 开始爬取商品: ${productConfig['商品名称']}`);
  
  // 创建新的页面
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // 读取cookie文件
    const cookies = JSON.parse(fs.readFileSync('./cookie.json', 'utf8'));
  
    // 修复cookie的sameSite属性，将所有非标准值转换为Playwright支持的值
    const fixedCookies = cookies.map(cookie => {
      // 如果sameSite属性不存在或为null，则删除该属性
      if (cookie.sameSite === null || cookie.sameSite === undefined) {
        const { sameSite, ...rest } = cookie;
        return rest;
      }
      
      // 将"no_restriction"转换为"None"
      if (cookie.sameSite === 'no_restriction') {
        return { ...cookie, sameSite: 'None' };
      }
      
      // 将其他可能的非标准值转换为"Lax"
      if (!['Strict', 'Lax', 'None'].includes(cookie.sameSite)) {
        return { ...cookie, sameSite: 'Lax' };
      }
      
      // 如果已经是标准值，则保持不变
      return cookie;
    });
    
    // 添加修复后的cookie到上下文
    await context.addCookies(fixedCookies);
    
    // 导航到淘宝商品页面
    const targetUrl = productConfig['商品网址'];
    console.log('📍 导航到:', targetUrl);
    console.log('🔐 已使用cookie进行登录...');
    await page.goto(targetUrl);
    
    // 等待页面加载完成
    await page.waitForLoadState('networkidle');
    
    // 检查是否登录成功
    const isLoggedIn = await page.evaluate(() => {
      // 检查页面是否包含登录相关的元素
      const loginElements = document.querySelectorAll('.login, .signin, [href*="login"], [href*="signin"]');
      return loginElements.length === 0;
    });
    
    if (!isLoggedIn) {
      console.log('❌ 登录失败，请检查cookie是否有效');
      return [];
    }
    
    console.log('✅ 登录成功，开始爬取评论...');
    
    // 点击"查看全部评价"按钮
    try {
      console.log('🖱️ 尝试点击"查看全部评价"按钮...');
      await page.waitForSelector('.ShowButton--fMu7HZNs', { timeout: 10000 });
      await page.click('.ShowButton--fMu7HZNs');
      console.log('✅ 已点击"查看全部评价"按钮');
      // 等待评论区域加载
      await page.waitForTimeout(2000);
    } catch (error) {
      console.log('⚠️ 未找到"查看全部评价"按钮，可能已经显示全部评论');
    }
    
    // 辅助函数：提取当前已加载的评论
    const extractComments = async () => {
      return await page.evaluate(() => {
        // 使用更精确的选择器，只选择评论内容区域
        const elements = document.querySelectorAll('.content--uonoOhaz');
        const comments = [];
        
        for (let i = 0; i < elements.length; i++) {
          const text = elements[i].innerText.trim();
          // 过滤掉模板化的评论内容
          if (text.length > 5 &&
              /[一-龯]/.test(text) &&
              !text.includes('该用户觉得商品非常好') &&
              !text.includes('该用户未填写评价内容') &&
              !text.includes('该用户觉得商品')) {
            // 去重
            if (comments.indexOf(text) === -1) {
              comments.push(text);
            }
          }
        }
        
        return comments;
      });
    };

    // 找到评论区域的滚动容器
    const getCommentsContainer = async () => {
      // 首先尝试使用XPath定位评论容器
      try {
        const containerByXPath = await page.waitForSelector('xpath=/html/body/div[7]/div[2]/div[2]/div[3]', { timeout: 5000 });
        if (containerByXPath) {
          console.log('通过XPath找到评论容器');
          return containerByXPath;
        }
      } catch (error) {
        console.log('通过XPath未找到评论容器，尝试其他方法');
      }
      
      // 如果XPath方法失败，尝试使用CSS选择器
      return await page.evaluate(() => {
        // 尝试找到评论区域的滚动容器
        let container = document.querySelector('.comments--ChxC7GEN');
        if (!container) {
          container = document.querySelector('[class*="comments"]');
        }
        if (!container) {
          container = document.querySelector('[class*="comment"]');
        }
        
        // 如果找到了容器，确保它是可滚动的
        if (container) {
          console.log('找到评论容器:', container.className);
          // 检查容器是否有滚动条
          const hasScroll = container.scrollHeight > container.clientHeight;
          console.log('评论容器是否有滚动条:', hasScroll);
        } else {
          console.log('未找到评论容器');
        }
        
        return container;
      });
    };

    // 滚动评论容器到底部
    const scrollToBottom = async (container) => {
      if (container) {
        await page.evaluate((container) => {
          // 在评论容器内滚动
          const scrollHeight = container.scrollHeight;
          const clientHeight = container.clientHeight;
          const maxScroll = scrollHeight - clientHeight;
          
          console.log('评论容器信息:', {
            scrollHeight: scrollHeight,
            clientHeight: clientHeight,
            maxScroll: maxScroll,
            currentScrollTop: container.scrollTop
          });
          
          // 滚动到底部
          container.scrollTop = maxScroll;
          console.log('滚动到:', maxScroll);
          
          // 验证滚动是否成功
          setTimeout(() => {
            console.log('滚动后scrollTop:', container.scrollTop);
          }, 100);
        }, container);
      } else {
        // 如果找不到评论容器，尝试使用XPath定位
        try {
          await page.evaluate(() => {
            // 尝试通过XPath找到评论容器
            const xpath = '/html/body/div[7]/div[2]/div[2]/div[3]';
            const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            const commentsContainer = result.singleNodeValue;
            
            if (commentsContainer) {
              const scrollHeight = commentsContainer.scrollHeight;
              const clientHeight = commentsContainer.clientHeight;
              const maxScroll = scrollHeight - clientHeight;
              
              console.log('通过XPath找到评论容器:', {
                scrollHeight: scrollHeight,
                clientHeight: clientHeight,
                maxScroll: maxScroll,
                currentScrollTop: commentsContainer.scrollTop
              });
              
              // 滚动到底部
              commentsContainer.scrollTop = maxScroll;
              console.log('通过XPath滚动到:', maxScroll);
            } else {
              // 最后的备选方案：滚动整个页面
              window.scrollTo(0, document.body.scrollHeight);
              console.log('滚动整个页面到:', document.body.scrollHeight);
            }
          });
        } catch (error) {
          console.log('通过XPath滚动失败:', error);
          // 最后的备选方案：滚动整个页面
          await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
            console.log('滚动整个页面到:', document.body.scrollHeight);
          });
        }
      }
    };

    // 检查并点击"加载更多"按钮
    const clickLoadMoreButton = async () => {
      return await page.evaluate(() => {
        let loadMoreBtn = document.querySelector('.comment-show-more');
        if (!loadMoreBtn) {
          // 尝试查找包含"加载更多"文本的按钮
          const buttons = document.querySelectorAll('button, span, div');
          for (let i = 0; i < buttons.length; i++) {
            const el = buttons[i];
            if (el.textContent && el.textContent.includes('加载更多') && el.offsetParent !== null) {
              loadMoreBtn = el;
              break;
            }
          }
        }
        
        // 如果还没找到，尝试查找包含"more"的元素
        if (!loadMoreBtn) {
          loadMoreBtn = document.querySelector('[class*="more"]') ||
                         document.querySelector('[data-spm-click*="more"]');
        }

        if (loadMoreBtn && loadMoreBtn.offsetParent !== null) { // 确保可见
          loadMoreBtn.click();
          return true;
        }
        return false;
      });
    };

    // 检查是否已加载全部评论
    const checkAllCommentsLoaded = async () => {
      return await page.evaluate(() => {
        const allText = document.body.innerText;
        return allText.includes('没有更多') || allText.includes('已显示全部');
      });
    };

    let lastCount = 0;
    let retryNoChange = 0; // 连续无新增次数
    const maxRetries = 5;
    const maxComments = productConfig['评论总数'] || 1000; // 默认最多爬取1000条评论

    while (retryNoChange < maxRetries) {
      const commentsContainer = await getCommentsContainer();
      
      // 滚动评论容器到底部，而不是整个页面
      console.log('🔽 滚动评论容器到底部...');
      await scrollToBottom(commentsContainer);

      // 等待新内容加载（通常需要 1~2 秒）
      await page.waitForTimeout(2000);

      // 尝试点击"加载更多"按钮（常见于天猫）
      const buttonClicked = await clickLoadMoreButton();
      if (buttonClicked) {
        console.log('🖱️ 点击"加载更多"按钮...');
        await page.waitForTimeout(1500);
      }

      // 再次滚动到底（确保触发懒加载）
      await scrollToBottom(commentsContainer);
      await page.waitForTimeout(1000);

      // 检查评论数量是否增加
      const currentComments = await extractComments();
      console.log(`📊 当前已加载评论数: ${currentComments.length}`);

      // 检查是否已达到设定的评论数量
      if (currentComments.length >= maxComments) {
        console.log(`✅ 已达到设定的评论数量: ${maxComments}`);
        break;
      }

      if (currentComments.length > lastCount) {
        lastCount = currentComments.length;
        retryNoChange = 0; // 有新增，重置计数
      } else {
        retryNoChange++;
        console.log(`⚠️ 连续 ${retryNoChange} 次未发现新评论`);
      }

      // 如果页面出现"没有更多评论"提示，提前退出
      const allLoaded = await checkAllCommentsLoaded();
      if (allLoaded) {
        console.log('✅ 已加载全部评论（检测到"没有更多"提示）');
        break;
      }
    }

    // 最终提取全部评论
    const allComments = await extractComments();
    console.log(`🎉 共提取到 ${allComments.length} 条评论！`);
    console.table(allComments);

    // 爬取追评
    console.log('🔄 开始爬取追评...');
    
    // 点击追评按钮
    try {
      console.log('🖱️ 尝试点击追评按钮...');
      
      // 首先尝试使用XPath定位追评按钮
      let additionalTabClicked = false;
      try {
        const additionalTabByXPath = await page.waitForSelector('xpath=/html/body/div[7]/div[2]/div[2]/div[2]/div[1]/span[3]', { timeout: 5000 });
        if (additionalTabByXPath) {
          await additionalTabByXPath.click();
          console.log('✅ 通过XPath已点击追评按钮');
          additionalTabClicked = true;
          // 等待追评区域加载
          await page.waitForTimeout(3000);
        }
      } catch (xpathError) {
        console.log('通过XPath未找到追评按钮，尝试CSS选择器...');
        // 如果XPath方法失败，尝试使用CSS选择器
        try {
          await page.waitForSelector('.imprItem--fTAkDWa5', { timeout: 10000 });
          await page.click('.imprItem--fTAkDWa5');
          console.log('✅ 通过CSS选择器已点击追评按钮');
          additionalTabClicked = true;
          // 等待追评区域加载
          await page.waitForTimeout(3000);
        } catch (cssError) {
          console.log('通过CSS选择器也未找到追评按钮');
        }
      }
      
      // 如果没有成功点击追评按钮，则跳过追评爬取
      if (!additionalTabClicked) {
        throw new Error('无法找到追评按钮');
      }
      
      // 辅助函数：提取当前已加载的追评
      const extractAdditionalComments = async () => {
        return await page.evaluate(() => {
          // 使用CSS选择器提取原评论和追评
          const commentPairs = [];
          
          // 获取所有评论项
          const commentItems = document.querySelectorAll('.Comment--H5QmJwe9');
          
          commentItems.forEach(item => {
            // 提取原评论 - 第一个content--uonoOhaz
            let originalComment = '';
            try {
              const contentWrapper = item.querySelector('.contentWrapper--cSa5gEtn');
              if (contentWrapper) {
                const originalElement = contentWrapper.querySelector('.content--uonoOhaz');
                if (originalElement) {
                  originalComment = originalElement.innerText.trim();
                  // 过滤掉模板化的评论内容
                  if (originalComment.includes('该用户觉得商品非常好') ||
                      originalComment.includes('该用户未填写评价内容') ||
                      originalComment.includes('该用户觉得商品') ||
                      originalComment.length < 5) {
                    originalComment = ''; // 设为空，表示没有有效的原评论
                  }
                }
              }
            } catch (e) {
              console.log('提取原评论出错:', e);
            }
            
            // 提取追评 - append--WvlQlFdT中的content--uonoOhaz
            let additionalComment = '';
            try {
              const appendWrapper = item.querySelector('.append--WvlQlFdT');
              if (appendWrapper) {
                const additionalContent = appendWrapper.querySelector('.content--uonoOhaz');
                if (additionalContent) {
                  // 获取追评内容，排除appendInternal--bdb3JNSs部分
                  const spans = additionalContent.querySelectorAll('span');
                  let additionalText = '';
                  spans.forEach(span => {
                    if (!span.classList.contains('appendInternal--bdb3JNSs')) {
                      additionalText += span.innerText.trim();
                    }
                  });
                  additionalComment = additionalText;
                }
              }
            } catch (e) {
              console.log('提取追评出错:', e);
            }
            
            // 如果原评论为空但追评有内容，尝试从其他位置获取原评论
            if (!originalComment && additionalComment) {
              try {
                // 尝试从评论项的其他位置获取原评论
                const allContentElements = item.querySelectorAll('.content--uonoOhaz');
                if (allContentElements.length > 0) {
                  // 第一个content--uonoOhaz通常是原评论
                  const firstContent = allContentElements[0].innerText.trim();
                  // 再次过滤模板化内容
                  if (!firstContent.includes('该用户觉得商品非常好') &&
                      !firstContent.includes('该用户未填写评价内容') &&
                      !firstContent.includes('该用户觉得商品') &&
                      firstContent.length >= 5) {
                    originalComment = firstContent;
                  }
                }
              } catch (e) {
                console.log('尝试从其他位置获取原评论出错:', e);
              }
            }
            
            // 如果原评论或追评不为空，则添加到配对列表中
            if (originalComment || additionalComment) {
              commentPairs.push({
                originalComment: originalComment,
                additionalComment: additionalComment
              });
            }
          });
          
          // 返回包含原评论和追评配对的对象
          return {
            commentPairs: commentPairs
          };
        });
      };
      
      let lastAdditionalCount = 0;
      let retryNoAdditionalChange = 0; // 连续无新增次数
      const maxAdditionalRetries = 5;
      const maxAdditionalComments = productConfig['追评总数'] || 100; // 默认最多爬取100条追评
      
      // 滚动加载追评
      while (retryNoAdditionalChange < maxAdditionalRetries) {
        const commentsContainer = await getCommentsContainer();
        
        // 滚动评论容器到底部，加载更多追评
        console.log('🔽 滚动评论容器加载追评...');
        await scrollToBottom(commentsContainer);
        
        // 等待新内容加载
        await page.waitForTimeout(2000);
        
        // 检查追评数量是否增加
        const currentAdditionalComments = await extractAdditionalComments();
        console.log(`📊 当前已加载追评对数: ${currentAdditionalComments.commentPairs.length}`);
        
        // 检查是否已达到设定的追评数量
        if (currentAdditionalComments.commentPairs.length >= maxAdditionalComments) {
          console.log(`✅ 已达到设定的追评数量: ${maxAdditionalComments}`);
          break;
        }
        
        if (currentAdditionalComments.commentPairs.length > lastAdditionalCount) {
          lastAdditionalCount = currentAdditionalComments.commentPairs.length;
          retryNoAdditionalChange = 0; // 有新增，重置计数
        } else {
          retryNoAdditionalChange++;
          console.log(`⚠️ 连续 ${retryNoAdditionalChange} 次未发现新追评`);
        }
        
        // 如果页面出现"没有更多"提示，提前退出
        const allLoaded = await checkAllCommentsLoaded();
        if (allLoaded) {
          console.log('✅ 已加载全部追评（检测到"没有更多"提示）');
          break;
        }
      }
      
      // 最终提取全部追评
      const allAdditionalComments = await extractAdditionalComments();
      console.log(`🎉 共提取到 ${allAdditionalComments.commentPairs.length} 对原评论和追评！`);
      console.table(allAdditionalComments.commentPairs);
      
      // 将评论和追评转换为文本
      const text = allAdditionalComments.commentPairs.map((pair, index) => {
        let result = `评论对${index + 1}:\n`;
        if (pair.originalComment) {
          result += `原评论: ${pair.originalComment}\n`;
        }
        if (pair.additionalComment) {
          result += `追评: ${pair.additionalComment}`;
        }
        return result;
      }).join('\n\n');
      
      // 复制到剪贴板
      try {
        await page.evaluate(async (text) => {
          await navigator.clipboard.writeText(text);
        }, text);
        console.log('📋 已复制全部评论对到剪贴板！');
      } catch (err) {
        console.warn('⚠️ 无法自动复制，请手动复制上方内容。');
        console.log(text);
      }
      
      // 返回结果对象
      return {
        productName: productConfig['商品名称'],
        comments: allComments,
        commentPairs: allAdditionalComments.commentPairs || []
      };
    } catch (error) {
      console.log('⚠️ 未找到追评按钮或爬取追评失败:', error);
      
      // 将主评论转换为文本
      const text = allComments.map((comment, index) => {
        return `评论${index + 1}: ${comment}`;
      }).join('\n\n');
      
      // 复制到剪贴板
      try {
        await page.evaluate(async (text) => {
          await navigator.clipboard.writeText(text);
        }, text);
        console.log('📋 已复制全部评论到剪贴板！');
      } catch (err) {
        console.warn('⚠️ 无法自动复制，请手动复制上方内容。');
        console.log(text);
      }
      
      // 返回结果对象（只有主评论）
      return {
        productName: productConfig['商品名称'],
        comments: allComments,
        commentPairs: []
      };
    }
  } catch (error) {
    console.error('❌ 爬取评论时出错:', error);
    return null;
  } finally {
    // 关闭页面和上下文
    await page.close();
    await context.close();
  }
}

// 主函数
async function main() {
  console.log('🚀 开始执行淘宝评论爬取程序...');
  
  // 读取配置
  const configs = readConfigFromExcel();
  if (configs.length === 0) {
    console.log('❌ 没有找到配置信息，程序退出');
    return;
  }
  
  // 启动浏览器
  const browser = await chromium.launch({ headless: false });
  
  // 存储所有结果
  const allResults = [];
  
  try {
    // 遍历每个商品配置
    for (const config of configs) {
      const result = await scrapeProductComments(config, browser);
      if (result) {
        allResults.push(result);
      }
    }
    
    // 生成结果Excel文件
    if (allResults.length > 0) {
      // 获取第一个商品的下载路径作为全局下载路径
      // 如果需要为每个商品单独设置路径，可以修改这里的逻辑
      const downloadPath = configs[0]['下载路径'] || './save_data/';
      const resultPath = generateResultExcel(allResults, downloadPath);
      if (resultPath) {
        console.log(`✅ 所有商品评论爬取完成，结果已保存到: ${resultPath}`);
      }
    } else {
      console.log('❌ 没有成功爬取到任何评论');
    }
  } catch (error) {
    console.error('❌ 程序执行出错:', error);
  } finally {
    // 关闭浏览器
    await browser.close();
  }
}

// 执行主函数
main().catch(console.error);
