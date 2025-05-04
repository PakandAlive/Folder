// 简单版IP查询脚本
$httpClient.get('https://ip.1eqw.com/', function (error, response, data) {
  if (error) {
    $done({
      title: 'IP检查',
      content: '请求失败: ' + error
    });
    return;
  }
  
  try {
    // 使用更通用的正则表达式
    const ipMatch = data.match(/Your IP Address:\s*\*\*([^*]+)\*\*/i) || data.match(/IP Address:\s*([^\s<]+)/i);
    const scoreMatch = data.match(/Score:\s*(\d+)/i);
    const riskMatch = data.match(/Risk:\s*([^<\n]+)/i);
    const ispMatch = data.match(/ISP:\s*([^<\n]+)/i);
    
    $done({
      title: 'IP质量检查',
      content: [
        `IP: ${ipMatch ? ipMatch[1].trim() : '未知'}`,
        `风险值: ${scoreMatch ? scoreMatch[1].trim() : '未知'}`,
        `风险等级: ${riskMatch ? riskMatch[1].trim() : '未知'}`,
        `ISP: ${ispMatch ? ispMatch[1].trim() : '未知'}`
      ].join('\n')
    });
  } catch (err) {
    $done({
      title: 'IP检查',
      content: '解析失败: ' + err.message
    });
  }
});
