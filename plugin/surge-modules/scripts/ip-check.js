// IPdata API 查询脚本
const API_KEY = '2822b0279f3968e29081bb29d037f66484ca5cab2a3a93be3e6d683b';

$httpClient.get(`https://api.ipdata.co?api-key=${API_KEY}`, function(error, response, data) {
  if (error) {
    $done({
      title: 'IP检查',
      content: '请求失败: ' + error
    });
    return;
  }

  try {
    const ipInfo = JSON.parse(data);
    
    // 计算一个简单的风险评分（0-100）
    let riskScore = 0;
    let riskLevel = '安全';
    
    // 根据威胁指标计算风险分数
    if (ipInfo.threat.is_tor) riskScore += 20;
    if (ipInfo.threat.is_proxy) riskScore += 15;
    if (ipInfo.threat.is_datacenter) riskScore += 10;
    if (ipInfo.threat.is_anonymous) riskScore += 15;
    if (ipInfo.threat.is_known_attacker) riskScore += 20;
    if (ipInfo.threat.is_known_abuser) riskScore += 15;
    if (ipInfo.threat.is_threat) riskScore += 5;
    
    // 设置风险等级
    if (riskScore >= 50) {
      riskLevel = '高风险';
    } else if (riskScore >= 30) {
      riskLevel = '中风险';
    } else if (riskScore >= 10) {
      riskLevel = '低风险';
    }

    $done({
      title: 'IP质量检查',
      content: [
        `IP: ${ipInfo.ip}`,
        `风险值: ${riskScore}`,
        `风险等级: ${riskLevel}`,
        `ISP: ${ipInfo.asn?.name || '未知'}`,
        `位置: ${ipInfo.country_name}${ipInfo.city ? ' - ' + ipInfo.city : ''}`,
        `组织: ${ipInfo.asn?.domain || '未知'}`
      ].join('\n')
    });
  } catch (err) {
    $done({
      title: 'IP检查',
      content: '解析失败: ' + err.message
    });
  }
}); 
