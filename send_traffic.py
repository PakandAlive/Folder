import subprocess
from datetime import datetime
import logging
import os
import json
import urllib.request
import urllib.parse

# 获取vps的运行时间/流量情况，并发送给TG


# 在脚本开头添加这个常量
SERVER_NAME = "AZ-华盛顿"

print(f"当前工作目录: {os.getcwd()}")
print(f"脚本路径: {os.path.abspath(__file__)}")

# 获取当前脚本所在的目录
current_dir = os.path.dirname(os.path.abspath(__file__))

# 设置日志文件路径
log_file = os.path.join(current_dir, 'traffic_report.log')

logging.basicConfig(filename=log_file, level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')

# Telegram Bot Token and Chat ID
BOT_TOKEN = '6035514418:AAFNWKhs700vT1jeCarHtqhoSspne1VxaPI'
CHAT_ID = '5642604303'

def get_current_time():
    return datetime.now().strftime("%Y/%m/%d %H:%M:%S")

def format_size(size_mb):
    if size_mb >= 1024 * 1024:  # 大于等于 1 TB
        return f"{size_mb / (1024 * 1024):.2f} TB"
    elif size_mb >= 1024:  # 大于等于 1 GB
        return f"{size_mb / 1024:.2f} GB"
    else:
        return f"{size_mb:.2f} MB"

def bytes_to_mb(bytes_value):
    return bytes_value / (1024 * 1024)

def get_uptime():
    # 执行 'uptime' 命令
    uptime = os.popen('uptime -p').read().strip()
    days = weeks = hours = minutes = 0

    # 解析 uptime 字符串
    parts = uptime.split(", ")
    for part in parts:
        if "week" in part:
            weeks = int(part.split()[1]) if part.split()[1].isdigit() else 0
        elif "hour" in part:
            hours = int(part.split()[1]) if part.split()[1].isdigit() else 0
        elif "minute" in part:
            minutes = int(part.split()[1]) if part.split()[1].isdigit() else 0

    # 计算总天数
    total_days = weeks * 7 + hours // 24
    return f"{total_days} 天"

def get_uptime_traffic():
    with open('/proc/net/dev', 'r') as f:
        lines = f.readlines()[2:]  # 跳过前两行
    total_rx = total_tx = 0
    for line in lines:
        interface = line.split(':')[0].strip()
        if interface != 'lo':  # 排除本地回环接口
            data = line.split(':')[1].split()
            total_rx += int(data[0])
            total_tx += int(data[8])
    return bytes_to_mb(total_rx), bytes_to_mb(total_tx)

def get_traffic_data():
    try:
        # 获取当前时间
        current_time = get_current_time()
        
        # 获取从开机到现在的流量
        uptime_rx, uptime_tx = get_uptime_traffic()
        
        # 获取 VPS 运行时间
        vps_uptime = get_uptime()
        
        # 获取 vnstat 数据
        result = subprocess.run(['vnstat', '--json'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        data = result.stdout.decode('utf-8')
        
        logging.info(f"vnstat 原始数据: {data}")
        
        if not data:
            logging.warning("vnstat 未返回数据")
            return "vnstat 未返回数据"
        
        traffic_json = json.loads(data)
        interfaces = traffic_json.get('interfaces', [])
        
        # 查找第一个非回环接口
        interface_data = get_first_non_lo_interface(interfaces)
        if not interface_data:
            logging.warning("未找到有效的网络接口数据")
            return "未找到有效的网络接口数据"
        
        # 获取本月的数据
        current_month = datetime.now().month
        current_year = datetime.now().year
        month_data = next((month for month in interface_data.get('traffic', {}).get('month', []) 
                           if month['date']['year'] == current_year and month['date']['month'] == current_month), {})
        
        month_rx = bytes_to_mb(month_data.get('rx', 0))
        month_tx = bytes_to_mb(month_data.get('tx', 0))
        
        logging.info(f"计算结果: uptime_rx={uptime_rx}, uptime_tx={uptime_tx}, month_rx={month_rx}, month_tx={month_tx}")
        
        formatted_data = (
            f"服务器名称：{SERVER_NAME}\n"
            f"当前时间：{current_time}\n"
            f"运行时间：{vps_uptime}\n"  # 添加 VPS 运行时间
            f"总下载流量：{format_size(uptime_rx)}\n"
            f"总上传流量：{format_size(uptime_tx)}\n"
            f"本月下载流量：{format_size(month_rx)}\n"
            f"本月上传流量：{format_size(month_tx)}"
        )
        return formatted_data
    except subprocess.CalledProcessError as e:
        logging.error(f"执行 vnstat 命令时出错: {e}")
        return f"获取数据时出错: {e}"
    except json.JSONDecodeError as e:
        logging.error(f"解析 JSON 数据时出错: {e}")
        return f"解析数据时出错: {e}"
    except Exception as e:
        logging.error(f"发生未知错误: {e}", exc_info=True)
        return f"发生未知错误: {e}"

def get_first_non_lo_interface(interfaces):
    # 返回第一个有效的网络接口，优先选择 eth0
    for interface in interfaces:
        if interface['name'] == 'eth0':
            return interface
    return next((interface for interface in interfaces if interface['name'] != 'lo'), None)

def send_message(message):
    url = f'https://api.telegram.org/bot{BOT_TOKEN}/sendMessage'
    data = urllib.parse.urlencode({'chat_id': CHAT_ID, 'text': message}).encode('utf-8')
    req = urllib.request.Request(url, data=data, method='POST')
    try:
        with urllib.request.urlopen(req) as response:
            if response.getcode() != 200:
                logging.error(f"发送消息到 Telegram 失败: {response.read().decode('utf-8')}")
    except Exception as e:
        logging.error(f"发送消息到 Telegram 时发生错误: {e}")

if __name__ == "__main__":
    traffic_data = get_traffic_data()
    logging.info(f"获取到的流量数据: {traffic_data}")
    send_message(traffic_data)
