// ip-check.js
!(async () => {
  try {
    console.log('开始执行IP检查脚本');
    
    // 使用 $httpClient 替代 Surge
    const getWebPage = () => {
      return new Promise((resolve, reject) => {
        $httpClient.get({
          url: 'https://ip.1eqw.com/',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
          }
        }, (error, response, data) => {
          if (error) {
            reject(error);
          } else {
            resolve(data);
          }
        });
      });
    };

    const html = await getWebPage();
    console.log('获取到响应内容');

    if (!html) {
      throw new Error('响应内容为空');
    }

    // 解析网页内容
    const scoreMatch = html.match(/Score:?\s*(\d+)/i);
    const riskMatch = html.match(/Risk:?\s*([^<\n]+)/i);
    const ispMatch = html.match(/ISP:?\s*([^<\n]+)/i);
    const countryMatch = html.match(/Country:?\s*([^<\n]+)/i);
    const isVpnMatch = html.match(/Is VPN:?\s*([^<\n]+)/i);
    const isProxyMatch = html.match(/Is Proxy:?\s*([^<\n]+)/i);

    console.log('解析结果：', {
      score: scoreMatch && scoreMatch[1],
      risk: riskMatch && riskMatch[1],
      isp: ispMatch && ispMatch[1]
    });

    // 确保至少有一些数据
    if (!scoreMatch && !riskMatch && !ispMatch) {
      throw new Error('未能解析到任何数据');
    }

    const panel = {
      title: "IP Quality Check",
      content: [
        `风险值: ${scoreMatch ? scoreMatch[1].trim() : '未知'}`,
        `风险等级: ${riskMatch ? riskMatch[1].trim() : '未知'}`,
        `ISP: ${ispMatch ? ispMatch[1].trim() : '未知'}`,
        `国家: ${countryMatch ? countryMatch[1].trim() : '未知'}`,
        `是否VPN: ${isVpnMatch ? isVpnMatch[1].trim() : '未知'}`,
        `是否代理: ${isProxyMatch ? isProxyMatch[1].trim() : '未知'}`
      ].join('\n')
    };

    $done(panel);
  } catch (err) {
    console.log('发生错误：', err.message);
    
    $done({
      title: "IP检查状态",
      content: `检查失败: ${err.message}\n请检查网络连接或重试`
    });
  }
})();
