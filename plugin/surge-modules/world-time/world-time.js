const 地区列表 = [
  { 名称: "美东", 地点: "纽约", 时区: "America/New_York" },
  { 名称: "英国", 地点: "曼彻斯特", 时区: "Europe/London" },
  { 名称: "中国", 地点: "上海", 时区: "Asia/Shanghai" },
];

const 当前时间 = new Date();

function 格式化时间(时区) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: 时区,
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "short",
  }).format(当前时间);
}

const 内容 = 地区列表
  .map(({ 名称, 地点, 时区 }) => `${名称} - ${地点}\n${格式化时间(时区)}`)
  .join("\n\n");

$done({
  title: "世界时间",
  content: 内容,
  icon: "clock.fill",
  "icon-color": "#1677FF",
});
