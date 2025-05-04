const $ = new Surge();

!(async () => {
  let panel = {
    title: 'IP Quality Check',
    content: '正在检查...'
  };
  
  try {
    // 先显示加载状态
    $done(panel);
    
    const response = await $.http.get({
      url: 'https://ip.1eqw.com/',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive'
      }
    });

    if (response.statusCode !== 200) {
      throw new Error(`HTTP 请求失败: ${response.statusCode}`);
    }

    const html = response.body;
    console.log('获取到网页内容');

    // 使用更精确的正则表达式
    const extractValue = (pattern) => {
      const match = html.match(pattern);
      return match ? match[1].trim() : '未知';
    };

    // 提取数据
    const score = extractValue(/"Score:"?\s*(\d+)/i);
    const risk = extractValue(/"Risk:"?\s*([^"<]+)/i);
    const isp = extractValue(/"ISP:"?\s*([^"<]+)/i);
    const country = extractValue(/"Country:"?\s*([^"<]+)/i);
    const isVpn = extractValue(/"Is VPN:"?\s*([^"<]+)/i);
    const isProxy = extractValue(/"Is Proxy:"?\s*([^"<]+)/i);

    console.log(`提取数据: score=${score}, risk=${risk}, isp=${isp}`);

    // 更新面板内容
    panel = {
      title: 'IP Quality Check',
      content: [
        `分数: ${score}`,
        `风险: ${risk}`,
        `ISP: ${isp}`,
        `国家: ${country}`,
        `VPN: ${isVpn}`,
        `代理: ${isProxy}`
      ].join('\n')
    };

    $done(panel);
  } catch (err) {
    console.log(`发生错误: ${err.message}`);
    
    // 显示错误信息
    panel = {
      title: 'IP Quality Check',
      content: `检查失败: ${err.message}\n请稍后重试`
    };
    
    $done(panel);
  }
})();
