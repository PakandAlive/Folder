/**
 * IP信息查询模块 - 使用自定义API获取IP信息
 * 支持Surge面板显示和定时通知功能
 * 版本: 1.2.0 - 修复API请求方式
 * 
 * 更新说明:
 * 1. 修复了API请求地址格式问题
 * 2. 增加了自动获取当前IP的功能
 * 3. 优化了错误处理和日志记录
 * 4. 完善了备用API处理逻辑
 */

// 自定义API地址（不带最后的斜杠）
const API_BASE_URL = "https://info.gooodjob.me";
// 默认查询的IP - 支持手动指定固定IP，留空则自动获取
const DEFAULT_QUERY_IP = "";
// 是否启用调试模式
const DEBUG = true;

// 主函数
!(async () => {
  const arg = typeof $argument !== "undefined" ? $argument : "";
  const isPanel = arg.includes("icon");
  
  try {
    logDebug("开始执行IP信息查询...");
    
    // 获取IP信息
    const info = await getIpInfo();
    
    if (!info) {
      logError("获取IP信息失败，返回为空");
      // 如果获取失败
      if (isPanel) {
        $done({
          title: "IP信息查询",
          content: "获取信息失败，请检查网络\n点击重试或参考故障排除指南",
          icon: getIcon("xmark.circle", "#C9C9C9"),
          backgroundColor: "#555555"
        });
      } else {
        $notification.post("IP信息查询", "获取信息失败", "请检查网络连接或查看日志");
        $done();
      }
      return;
    }
    
    logDebug("成功获取IP信息");
    logDebug(JSON.stringify(info));
    
    // 格式化数据
    const ip = info.ip || "未知";
    const country = info.country_name || "未知";
    const city = info.city || "未知";
    const isp = info.company?.name || "未知";
    const emoji = info.emoji_flag || "🌐";
    
    // 构建显示内容
    const title = `${emoji} ${ip} - ${country}`;
    const content = `位置: ${city}\nISP: ${isp}\n货币: ${info.currency?.code || "未知"}\n时区: ${info.time_zone?.abbr || "未知"}`;
    
    logDebug(`面板标题: ${title}`);
    logDebug(`面板内容: ${content}`);
    
    // 根据是否为面板模式输出不同内容
    if (isPanel) {
      $done({
        title: title,
        content: content,
        icon: getIcon("network", "#005CAF"),
        backgroundColor: "#1E1E1E"
      });
    } else {
      $notification.post(title, "", content);
      $done();
    }
  } catch (err) {
    logError(`主函数执行错误: ${err.message}`);
    if (isPanel) {
      $done({
        title: "IP信息查询出错",
        content: `错误信息: ${err.message}`,
        icon: getIcon("xmark.circle", "#FF0000"),
        backgroundColor: "#555555"
      });
    } else {
      $notification.post("IP信息查询", "执行出错", err.message);
      $done();
    }
  }
})();

// 获取IP信息
async function getIpInfo() {
  logDebug("开始获取IP信息...");
  
  // 1. 首先尝试获取当前IP
  let targetIp = DEFAULT_QUERY_IP;
  
  if (!targetIp) {
    try {
      // 尝试通过ipify API获取当前IP
      logDebug("尝试获取当前IP...");
      const ipifyUrl = "https://api.ipify.org?format=json";
      
      const ipifyResponse = await $httpClient.get({
        url: ipifyUrl,
        headers: { "Accept": "application/json" }
      });
      
      if (ipifyResponse && ipifyResponse.status === 200) {
        const ipData = JSON.parse(ipifyResponse.body);
        if (ipData && ipData.ip) {
          targetIp = ipData.ip;
          logDebug(`成功获取当前IP: ${targetIp}`);
        }
      }
    } catch (ipError) {
      logError(`获取当前IP失败: ${ipError.message}`);
    }
  }
  
  // 2. 如果获取当前IP失败，使用一个默认的公共IP进行测试
  if (!targetIp) {
    targetIp = "8.8.8.8"; // 默认使用谷歌DNS服务器IP
    logDebug(`使用默认测试IP: ${targetIp}`);
  }
  
  // 3. 构建完整的API URL
  const fullApiUrl = `${API_BASE_URL}/${targetIp}`;
  logDebug(`发起请求: ${fullApiUrl}`);
  
  try {
    const startTime = new Date().getTime();
    
    const response = await $httpClient.get({
      url: fullApiUrl,
      headers: {
        "User-Agent": "Surge/IP查询",
        "Accept": "application/json"
      }
    });
    
    const endTime = new Date().getTime();
    logDebug(`请求耗时: ${endTime - startTime}ms`);
    
    if (!response) {
      logError("请求返回为空");
      return await getBackupIpInfo(targetIp);
    }
    
    logDebug(`状态码: ${response.status}`);
    
    if (response.status === 200) {
      try {
        const rawBody = response.body;
        logDebug(`原始响应: ${rawBody.length > 100 ? rawBody.substring(0, 100) + "..." : rawBody}`);
        
        const data = JSON.parse(rawBody);
        
        // 检查是否包含错误消息
        if (data && data.message) {
          logError(`API返回消息: ${data.message}`);
          if (data.message.includes("localhost") || data.message.includes("Invalid")) {
            logDebug("API返回错误消息，切换到备用API");
            // 使用备用API
            return await getBackupIpInfo(targetIp);
          }
        }
        
        // 检查关键字段是否存在
        if (!data.ip) {
          logError("API返回数据缺少IP字段");
          logDebug("返回数据: " + JSON.stringify(data));
          return await getBackupIpInfo(targetIp);
        }
        
        return data;
      } catch (parseError) {
        logError(`解析响应JSON失败: ${parseError.message}`);
        logDebug(`原始响应内容: ${response.body}`);
        return await getBackupIpInfo(targetIp);
      }
    } else {
      logError(`获取IP信息失败, 状态码: ${response.status}`);
      return await getBackupIpInfo(targetIp);
    }
  } catch (error) {
    logError(`获取IP信息异常: ${error.message}`);
    if (error.stack) logDebug(`错误堆栈: ${error.stack}`);
    return await getBackupIpInfo(targetIp);
  }
}

// 备用IP信息获取方法
async function getBackupIpInfo(targetIp) {
  logDebug("开始使用备用API获取IP信息...");
  try {
    // 如果没有提供IP，尝试使用公共IP
    if (!targetIp) targetIp = "";
    
    // 备用API支持在URL中不指定IP，将自动检测当前IP
    const backupUrl = `https://ip-api.com/json/${targetIp}?lang=zh-CN`;
    logDebug(`发起备用请求: ${backupUrl}`);
    
    const response = await $httpClient.get({
      url: backupUrl,
      headers: {
        "User-Agent": "Surge/IP查询_备用",
        "Accept": "application/json"
      }
    });
    
    if (!response) {
      logError("备用API请求返回为空");
      return null;
    }
    
    logDebug(`备用API状态码: ${response.status}`);
    
    if (response.status === 200) {
      try {
        const data = JSON.parse(response.body);
        logDebug(`备用API返回: ${JSON.stringify(data).substring(0, 100)}...`);
        
        // 转换数据结构以兼容原有代码
        if (data && data.status === "success") {
          const result = {
            ip: data.query,
            country_name: data.country,
            city: data.city,
            company: { name: data.isp },
            emoji_flag: getFlagEmoji(data.countryCode),
            currency: { code: getCurrencyCode(data.countryCode) },
            time_zone: { abbr: data.timezone ? data.timezone.split('/')[1] : "未知" }
          };
          
          logDebug("备用API数据转换成功");
          return result;
        } else {
          logError("备用API返回状态不是success");
          return null;
        }
      } catch (parseError) {
        logError(`解析备用API响应JSON失败: ${parseError.message}`);
        return null;
      }
    } else {
      logError(`备用API获取IP信息失败, 状态码: ${response.status}`);
      return null;
    }
  } catch (error) {
    logError(`备用API异常: ${error.message}`);
    return null;
  }
}

// 根据国家代码获取国旗emoji
function getFlagEmoji(countryCode) {
  if (!countryCode) return "🌐";
  try {
    const offset = 127397;
    const codePoints = [...countryCode.toUpperCase()].map(c => c.charCodeAt() + offset);
    return String.fromCodePoint(...codePoints);
  } catch (e) {
    logError(`获取国旗emoji出错: ${e.message}`);
    return "🌐";
  }
}

// 简单的货币代码映射
function getCurrencyCode(countryCode) {
  try {
    const currencyMap = {
      "US": "USD", "CN": "CNY", "JP": "JPY", "HK": "HKD", "TW": "TWD",
      "GB": "GBP", "EU": "EUR", "RU": "RUB", "KR": "KRW", "SG": "SGD"
    };
    return currencyMap[countryCode] || "未知";
  } catch (e) {
    logError(`获取货币代码出错: ${e.message}`);
    return "未知";
  }
}

// 获取图标
function getIcon(name, color) {
  return `${encodeURIComponent(name)},${color}`;
}

// 日志函数
function logDebug(message) {
  if (DEBUG) console.log(`[IP查询-调试] ${message}`);
}

function logError(message) {
  console.log(`[IP查询-错误] ${message}`);
} 
