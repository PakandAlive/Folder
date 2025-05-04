const $ = new Surge();

!(async () => {
  try {
    // 发送HTTP GET请求获取网页内容
    const response = await $.http.get({
      url: 'https://ip.1eqw.com/',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
      }
    });

    const html = response.body;
    
    // 解析网页内容，提取所需信息
    const scoreMatch = html.match(/Score:<\/\w+>\s*(\d+)/i);
    const riskMatch = html.match(/Risk:<\/\w+>\s*([^<]+)/i);
    const ispMatch = html.match(/ISP:<\/\w+>\s*([^<]+)/i);
    const countryMatch = html.match(/Country:<\/\w+>\s*([^<]+)/i);
    const isVpnMatch = html.match(/Is VPN:<\/\w+>\s*([^<]+)/i);
    const isProxyMatch = html.match(/Is Proxy:<\/\w+>\s*([^<]+)/i);

    // 构建显示内容
    const panel = {
      title: "IP Quality Check",
      content: [
        `风险值: ${scoreMatch ? scoreMatch[1] : '未知'}`,
        `风险等级: ${riskMatch ? riskMatch[1].trim() : '未知'}`,
        `ISP: ${ispMatch ? ispMatch[1].trim() : '未知'}`,
        `国家: ${countryMatch ? countryMatch[1].trim() : '未知'}`,
        `是否VPN: ${isVpnMatch ? isVpnMatch[1].trim() : '未知'}`,
        `是否代理: ${isProxyMatch ? isProxyMatch[1].trim() : '未知'}`
      ].join('\n')
    };

    // 添加缓存
    $.write(JSON.stringify({
      timestamp: Date.now(),
      data: panel
    }), 'ip_quality_cache');

    $done(panel);
  } catch (err) {
    // 如果发生错误，尝试读取缓存
    const cache = $.read('ip_quality_cache');
    if (cache) {
      const cacheData = JSON.parse(cache);
      $done(cacheData.data);
    } else {
      $done({
        title: "IP检查失败",
        content: `错误信息: ${err.message}`
      });
    }
  }
})();
