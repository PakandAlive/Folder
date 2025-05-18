/**
 * IP信息查询模块 - 使用自定义API获取IP信息
 * 支持Surge面板显示和定时通知功能
 */

// 自定义API地址
const API_URL = "https://info.gooodjob.me/";

// 主函数
!(async () => {
  const arg = typeof $argument !== "undefined" ? $argument : "";
  const isPanel = arg.includes("icon");
  
  // 获取IP信息
  const info = await getIpInfo();
  
  if (!info) {
    // 如果获取失败
    if (isPanel) {
      $done({
        title: "IP信息查询",
        content: "获取信息失败，请检查网络",
        icon: getIcon("xmark.circle", "#C9C9C9"),
        backgroundColor: "#555555"
      });
    } else {
      $notification.post("IP信息查询", "获取信息失败", "请检查网络连接");
      $done();
    }
    return;
  }
  
  // 格式化数据
  const ip = info.ip || "未知";
  const country = info.country_name || "未知";
  const city = info.city || "未知";
  const isp = info.company?.name || "未知";
  const emoji = info.emoji_flag || "🌐";
  
  // 构建显示内容
  const title = `${emoji} ${ip} - ${country}`;
  const content = `位置: ${city}\nISP: ${isp}\n货币: ${info.currency?.code || "未知"}\n时区: ${info.time_zone?.abbr || "未知"}`;
  
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
})();

// 获取IP信息
async function getIpInfo() {
  try {
    const response = await $httpClient.get({
      url: API_URL,
      headers: {
        "User-Agent": "Surge/IP查询",
        "Accept": "application/json"
      }
    });
    
    if (response.status === 200) {
      const data = JSON.parse(response.body);
      
      // 检查是否包含错误消息
      if (data && data.message && data.message.includes("localhost")) {
        console.log("API在本地环境中运行，无法获取IP");
        // 使用备用API
        return await getBackupIpInfo();
      }
      
      return data;
    } else {
      console.log(`获取IP信息失败: ${response.status}`);
      return await getBackupIpInfo();
    }
  } catch (error) {
    console.log(`获取IP信息异常: ${error}`);
    return await getBackupIpInfo();
  }
}

// 备用IP信息获取方法
async function getBackupIpInfo() {
  try {
    const response = await $httpClient.get({
      url: "https://ip-api.com/json/?lang=zh-CN",
      headers: {
        "User-Agent": "Surge/IP查询",
        "Accept": "application/json"
      }
    });
    
    if (response.status === 200) {
      const data = JSON.parse(response.body);
      // 转换数据结构以兼容原有代码
      if (data && data.status === "success") {
        return {
          ip: data.query,
          country_name: data.country,
          city: data.city,
          company: { name: data.isp },
          emoji_flag: getFlagEmoji(data.countryCode),
          currency: { code: getCurrencyCode(data.countryCode) },
          time_zone: { abbr: data.timezone ? data.timezone.split('/')[1] : "未知" }
        };
      }
      return null;
    } else {
      console.log(`备用API获取IP信息失败: ${response.status}`);
      return null;
    }
  } catch (error) {
    console.log(`备用API获取IP信息异常: ${error}`);
    return null;
  }
}

// 根据国家代码获取国旗emoji
function getFlagEmoji(countryCode) {
  if (!countryCode) return "🌐";
  const offset = 127397;
  const codePoints = [...countryCode.toUpperCase()].map(c => c.charCodeAt() + offset);
  return String.fromCodePoint(...codePoints);
}

// 简单的货币代码映射
function getCurrencyCode(countryCode) {
  const currencyMap = {
    "US": "USD", "CN": "CNY", "JP": "JPY", "HK": "HKD", "TW": "TWD",
    "GB": "GBP", "EU": "EUR", "RU": "RUB", "KR": "KRW", "SG": "SGD"
  };
  return currencyMap[countryCode] || "未知";
}

// 获取图标
function getIcon(name, color) {
  return `${encodeURIComponent(name)},${color}`;
} 
