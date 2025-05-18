/*
* IP 信息查询模块 - Surge
* 用于在面板中展示当前 IP 信息
* 版本 4.2.0 (2023-05-19)
*/

const DEBUG = true; // 开启调试日志
const API_BASE_URL = "https://info.gooodjob.me"; // 主API地址
const TIMEOUT = 5000; // 超时时间（毫秒）

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
  logDebug("开始执行IP信息查询脚本，版本4.2.0...");
  
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
    if (err.stack) {
      logError(`错误堆栈: ${err.stack}`);
    }
  } finally {
    // 输出面板
    logDebug(`最终面板内容 - 标题: ${panel.title}, 内容: ${panel.content}`);
    $done({
      title: panel.title,
      content: panel.content
    });
  }
})();

// 获取IP信息的主函数，尝试多个API直到成功
async function fetchIPInfo() {
  logDebug("开始获取IP信息...");
  
  // 在一个请求中尝试使用IP-API直接获取所有信息，这是最可靠的方式
  try {
    logDebug("尝试直接从IP-API获取IP信息...");
    const ipApiResponse = await makeRequest({
      url: "http://ip-api.com/json?lang=zh-CN",
      headers: {
        "User-Agent": "Surge/IP查询/4.2.0",
        "Accept": "application/json"
      }
    });
    
    if (ipApiResponse.success && ipApiResponse.data) {
      const data = ipApiResponse.data;
      
      if (data.status === "success") {
        logDebug(`成功从IP-API直接获取IP信息: ${JSON.stringify(data)}`);
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
      } else {
        logDebug(`IP-API返回失败状态: ${data.message || 'Unknown'}`);
      }
    } else {
      logDebug(`IP-API请求失败: ${ipApiResponse.error}`);
    }
  } catch (err) {
    logError(`IP-API直接请求异常: ${err.message}`);
  }
  
  // 如果直接请求失败，尝试先获取IP，再查询主API
  try {
    // 1. 获取当前IP (使用多个来源尝试)
    let currentIP = await getCurrentIP();
    
    if (!currentIP) {
      return { error: "无法获取当前IP地址，请检查网络连接" };
    }
    
    // 2. 使用获取到的IP查询主API
    logDebug(`准备通过主API查询IP[${currentIP}]信息...`);
    
    // 构建主API请求
    const mainApiUrl = `${API_BASE_URL}/${currentIP}`;
    logDebug(`请求主API: ${mainApiUrl}`);
    
    const mainApiResponse = await makeRequest({
      url: mainApiUrl,
      headers: {
        "User-Agent": "Surge/IP查询/4.2.0",
        "Accept": "application/json"
      }
    });
    
    if (mainApiResponse.success && mainApiResponse.data) {
      const data = mainApiResponse.data;
      
      // 检查是否有错误消息
      if (data.message && typeof data.message === 'string') {
        logDebug(`主API返回消息: ${data.message}`);
        // 继续尝试备用API
      } else if (data.ip) {
        // 有效的响应
        logDebug(`主API返回有效数据: ${JSON.stringify(data).substring(0, 200)}`);
        
        return {
          ip: data.ip,
          country: data.country_name || data.country || "未知",
          countryCode: data.country_code || "",
          city: data.city || "未知",
          regionName: data.region || data.regionName || "",
          timezone: data.time_zone?.name || data.timezone || "未知",
          isp: data.company?.name || data.isp || "未知",
          org: data.org || ""
        };
      } else {
        logDebug(`主API返回数据格式不符合预期: ${JSON.stringify(data).substring(0, 200)}`);
      }
    } else {
      logDebug(`主API请求失败: ${mainApiResponse.error}`);
    }
    
    // 3. 如果主API失败，尝试使用IP-API再次查询
    logDebug(`尝试使用IP-API查询IP[${currentIP}]信息...`);
    const ipApiDetailUrl = `http://ip-api.com/json/${currentIP}?lang=zh-CN`;
    
    const ipApiDetailResponse = await makeRequest({
      url: ipApiDetailUrl,
      headers: {
        "User-Agent": "Surge/IP查询/4.2.0",
        "Accept": "application/json"
      }
    });
    
    if (ipApiDetailResponse.success && ipApiDetailResponse.data) {
      const data = ipApiDetailResponse.data;
      
      if (data.status === "success") {
        logDebug(`成功从IP-API获取IP[${currentIP}]信息`);
        return {
          ip: currentIP,
          country: data.country,
          countryCode: data.countryCode,
          city: data.city,
          regionName: data.regionName,
          timezone: data.timezone,
          isp: data.isp,
          org: data.org
        };
      } else {
        logDebug(`IP-API查询IP[${currentIP}]返回失败状态: ${data.message || 'Unknown'}`);
      }
    } else {
      logDebug(`IP-API查询IP[${currentIP}]请求失败: ${ipApiDetailResponse.error}`);
    }
    
    // 4. 最后尝试ipinfo.io
    logDebug(`尝试使用ipinfo.io获取IP信息...`);
    const ipinfoResponse = await makeRequest({
      url: "https://ipinfo.io/json",
      headers: {
        "User-Agent": "Surge/IP查询/4.2.0",
        "Accept": "application/json"
      }
    });
    
    if (ipinfoResponse.success && ipinfoResponse.data) {
      const data = ipinfoResponse.data;
      
      if (data.ip) {
        logDebug(`成功从ipinfo.io获取IP信息`);
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
      } else {
        logDebug(`ipinfo.io返回数据缺少IP字段`);
      }
    } else {
      logDebug(`ipinfo.io请求失败: ${ipinfoResponse.error}`);
    }
    
    // 所有尝试都失败
    return { error: "所有API请求均失败，请检查网络连接或稍后再试" };
  } catch (err) {
    logError(`获取IP信息过程中发生异常: ${err.message}`);
    return { error: `获取IP信息时发生错误: ${err.message}` };
  }
}

// 获取当前设备IP地址的函数，尝试多个来源
async function getCurrentIP() {
  // IP获取来源列表
  const ipSources = [
    { 
      name: "ipify", 
      url: "https://api.ipify.org?format=json",
      parser: (data) => data.ip
    },
    { 
      name: "ipinfo", 
      url: "https://ipinfo.io/json",
      parser: (data) => data.ip
    },
    { 
      name: "ip-api", 
      url: "http://ip-api.com/json?fields=query",
      parser: (data) => data.query
    }
  ];
  
  // 遍历每个来源尝试获取IP
  for (const source of ipSources) {
    try {
      logDebug(`尝试从${source.name}获取当前IP...`);
      
      const response = await makeRequest({
        url: source.url,
        headers: {
          "User-Agent": "Surge/IP查询/4.2.0",
          "Accept": "application/json"
        }
      });
      
      if (response.success && response.data) {
        const ip = source.parser(response.data);
        if (ip && isValidIP(ip)) {
          logDebug(`成功从${source.name}获取IP: ${ip}`);
          return ip;
        } else {
          logDebug(`从${source.name}获取的IP无效: ${ip}`);
        }
      } else {
        logDebug(`从${source.name}获取IP失败: ${response.error}`);
      }
    } catch (err) {
      logDebug(`从${source.name}获取IP出错: ${err.message}`);
    }
  }
  
  // 所有来源都失败，返回默认IP
  logDebug("所有IP获取来源均失败，使用默认IP: 8.8.8.8");
  return "8.8.8.8";
}

// 包装HTTP请求函数，添加超时和错误处理
async function makeRequest(options) {
  return new Promise((resolve) => {
    // 添加超时处理
    const timeoutTimer = setTimeout(() => {
      logDebug(`请求超时: ${options.url}`);
      resolve({
        success: false,
        error: "请求超时"
      });
    }, TIMEOUT);
    
    // 发起请求
    $httpClient.get(options, (error, response, body) => {
      clearTimeout(timeoutTimer);
      
      if (error) {
        logDebug(`请求错误 ${options.url}: ${error}`);
        resolve({
          success: false,
          error: error
        });
        return;
      }
      
      if (!response) {
        logDebug(`请求无响应 ${options.url}`);
        resolve({
          success: false,
          error: "无响应"
        });
        return;
      }
      
      if (response.status !== 200) {
        logDebug(`请求状态码非200 ${options.url}: ${response.status}`);
        resolve({
          success: false,
          error: `状态码 ${response.status}`
        });
        return;
      }
      
      try {
        const data = JSON.parse(body);
        resolve({
          success: true,
          data: data,
          response: response
        });
      } catch (err) {
        logDebug(`解析JSON出错 ${options.url}: ${err.message}, body: ${body.substring(0, 100)}`);
        resolve({
          success: false,
          error: `解析JSON出错: ${err.message}`,
          body: body
        });
      }
    });
  });
}

// 验证IP地址格式是否正确
function isValidIP(ip) {
  // IPv4正则表达式
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  // IPv6正则表达式（简化版）
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^([0-9a-fA-F]{1,4}:){1,7}:|^([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}$|^([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}$|^([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}$|^([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}$|^([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}$|^[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})$|^:((:[0-9a-fA-F]{1,4}){1,7}|:)$/;
  
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
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
