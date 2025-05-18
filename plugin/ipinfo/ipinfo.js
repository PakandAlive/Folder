/*
* IP 信息查询模块 - Surge
* 用于在面板中展示当前 IP 信息
* 版本 4.1.0 (2023-05-19)
*/

const DEBUG = true; // 开启调试日志
const API_BASE_URL = "https://info.gooodjob.me"; // 主API地址

// 初始化面板
const panel = {
  title: "获取中...", 
  content: "正在获取 IP 信息..."
};

// 调试日志函数
function logDebug(message) {
  if (DEBUG) {
    console.log(`[IP查询] ${message}`);
  }
}

// 错误日志函数
function logError(message) {
  console.log(`[IP查询错误] ${message}`);
}

// 主函数
!(async () => {
  logDebug("开始执行IP信息查询脚本...");
  
  try {
    // 获取IP信息
    const ipInfo = await fetchIPInfo();
    
    if (ipInfo.error) {
      // 获取失败
      panel.title = "⚠️ 获取失败";
      panel.content = ipInfo.error;
      logError(ipInfo.error);
    } else {
      // 获取成功，格式化面板内容
      const flag = getCountryFlag(ipInfo.countryCode);
      panel.title = `${flag} ${ipInfo.ip}`;
      panel.content = [
        `国家/地区: ${ipInfo.country}`,
        `城市: ${ipInfo.city || '未知'}`,
        `运营商: ${ipInfo.isp || '未知'}`,
        `时区: ${ipInfo.timezone || '未知'}`,
        ``,
        `更新时间: ${new Date().toLocaleTimeString()}`
      ].join("\n");
      
      logDebug(`成功获取IP信息: ${JSON.stringify(ipInfo)}`);
    }
  } catch (err) {
    // 处理异常
    panel.title = "❌ 查询出错";
    panel.content = `发生错误: ${err.message || '未知错误'}`;
    logError(`脚本执行出错: ${err.message}`);
  }
  
  // 输出面板
  $done({
    title: panel.title,
    content: panel.content
  });
})();

// 获取IP信息的主函数，尝试多个API直到成功
async function fetchIPInfo() {
  // 首先，获取当前IP地址
  let currentIP;
  try {
    logDebug("正在获取当前IP地址...");
    const ipifyResponse = await $httpClient.get({
      url: "https://api.ipify.org?format=json",
      headers: {
        "User-Agent": "Surge/IP查询"
      }
    });
    
    if (ipifyResponse && ipifyResponse.body) {
      const ipData = JSON.parse(ipifyResponse.body);
      if (ipData && ipData.ip) {
        currentIP = ipData.ip;
        logDebug(`成功获取当前IP: ${currentIP}`);
      }
    }
  } catch (err) {
    logDebug(`获取当前IP时出错: ${err.message}`);
  }
  
  // 如果获取IP失败，使用备用IP
  if (!currentIP) {
    currentIP = "8.8.8.8"; // 使用谷歌DNS服务器IP作为默认值
    logDebug(`使用默认IP: ${currentIP}`);
  }
  
  // 尝试从主API获取IP信息
  try {
    logDebug(`尝试从主API获取IP信息: ${API_BASE_URL}/${currentIP}`);
    const response = await $httpClient.get({
      url: `${API_BASE_URL}/${currentIP}`,
      headers: {
        "User-Agent": "Surge/IP查询",
        "Accept": "application/json"
      }
    });
    
    if (response && response.body) {
      const data = JSON.parse(response.body);
      
      // 检查是否有错误消息
      if (data.message && data.message.includes("localhost")) {
        logDebug("主API无法识别IP，尝试备用API");
        return await fallbackToBackupAPIs(currentIP);
      }
      
      // 检查返回数据是否有效
      if (data.ip) {
        logDebug("成功从主API获取数据");
        
        return {
          ip: data.ip,
          country: data.country_name || "未知",
          countryCode: data.country_code || "",
          city: data.city || "未知",
          regionName: data.region || "",
          timezone: data.time_zone?.name || "未知",
          isp: data.company?.name || data.isp || "未知",
          org: data.org || ""
        };
      } else {
        logDebug("主API返回的数据不完整，尝试备用API");
        return await fallbackToBackupAPIs(currentIP);
      }
    } else {
      logDebug("主API返回为空，尝试备用API");
      return await fallbackToBackupAPIs(currentIP);
    }
  } catch (err) {
    logDebug(`主API请求出错: ${err.message}，尝试备用API`);
    return await fallbackToBackupAPIs(currentIP);
  }
}

// 备用API功能
async function fallbackToBackupAPIs(ip) {
  // 备用API列表
  const backupAPIs = [
    { name: "IP-API", fetch: () => fetchFromIPAPI(ip) },
    { name: "ipinfo.io", fetch: fetchFromIpInfo }
  ];
  
  logDebug(`开始尝试 ${backupAPIs.length} 个备用API...`);
  
  // 依次尝试备用API
  for (const api of backupAPIs) {
    try {
      logDebug(`尝试从备用API ${api.name} 获取IP信息...`);
      const result = await api.fetch();
      if (!result.error) {
        logDebug(`成功从备用API ${api.name} 获取IP信息`);
        return result;
      } else {
        logDebug(`备用API ${api.name} 获取失败: ${result.error}`);
      }
    } catch (err) {
      logDebug(`从备用API ${api.name} 获取时出错: ${err.message}`);
    }
  }
  
  // 所有备用API都失败
  return { error: "所有API均获取失败，请检查网络连接" };
}

// 从IP-API获取IP信息
async function fetchFromIPAPI(ip) {
  try {
    const url = ip ? `http://ip-api.com/json/${ip}?lang=zh-CN` : "http://ip-api.com/json?lang=zh-CN";
    logDebug(`正在从IP-API获取信息: ${url}`);
    
    const response = await $httpClient.get({
      url: url,
      headers: {
        "User-Agent": "Surge/IP查询"
      }
    });
    
    if (!response || !response.body) {
      return { error: "IP-API返回为空" };
    }
    
    const data = JSON.parse(response.body);
    if (data.status !== "success") {
      return { error: `IP-API返回失败状态: ${data.message || 'Unknown'}` };
    }
    
    return {
      ip: data.query,
      country: data.country,
      countryCode: data.countryCode,
      city: data.city,
      regionName: data.regionName,
      timezone: data.timezone,
      isp: data.isp,
      org: data.org
    };
  } catch (err) {
    return { error: `IP-API请求出错: ${err.message}` };
  }
}

// 从ipinfo.io获取IP信息
async function fetchFromIpInfo() {
  try {
    logDebug("正在从ipinfo.io获取信息...");
    const response = await $httpClient.get({
      url: "https://ipinfo.io/json",
      headers: {
        "User-Agent": "Surge/IP查询"
      }
    });
    
    if (!response || !response.body) {
      return { error: "ipinfo.io返回为空" };
    }
    
    const data = JSON.parse(response.body);
    if (!data || !data.ip) {
      return { error: "ipinfo.io返回格式错误" };
    }
    
    return {
      ip: data.ip,
      country: data.country,
      countryCode: data.country,
      city: data.city,
      regionName: data.region,
      timezone: data.timezone,
      isp: data.org,
      org: data.org
    };
  } catch (err) {
    return { error: `ipinfo.io请求出错: ${err.message}` };
  }
}

// 获取国家旗帜的Emoji
function getCountryFlag(countryCode) {
  if (!countryCode) return "🏳️";
  
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt());
  
  return String.fromCodePoint(...codePoints);
} 
