/**
 * IP信息查询模块 - 使用自定义API获取IP信息
 * 支持Surge面板显示和定时通知功能
 */

// 自定义API地址
const API_URL = "http://13.36.237.141:7896";

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
      return JSON.parse(response.body);
    } else {
      console.log(`获取IP信息失败: ${response.status}`);
      return null;
    }
  } catch (error) {
    console.log(`获取IP信息异常: ${error}`);
    return null;
  }
}

// 获取图标
function getIcon(name, color) {
  return `${encodeURIComponent(name)},${color}`;
} 
