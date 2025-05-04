// ip-check.js
function getWebPage() {
  $httpClient.get({
    url: 'https://ip.1eqw.com/',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
    }
  }, function(error, response, data) {
    if (error) {
      $done({
        title: "IP检查状态",
        content: `请求失败: ${error}`
      });
      return;
    }

    try {
      if (!data) {
        throw new Error('响应内容为空');
      }

      // 解析网页内容
      const scoreMatch = data.match(/Score:?\s*(\d+)/i);
      const riskMatch = data.match(/Risk:?\s*([^<\n]+)/i);
      const ispMatch = data.match(/ISP:?\s*([^<\n]+)/i);
      const countryMatch = data.match(/Country:?\s*([^<\n]+)/i);
      const isVpnMatch = data.match(/Is VPN:?\s*([^<\n]+)/i);
      const isProxyMatch = data.match(/Is Proxy:?\s*([^<\n]+)/i);

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
      $done({
        title: "IP检查状态",
        content: `解析失败: ${err.message}`
      });
    }
  });
}

getWebPage();
