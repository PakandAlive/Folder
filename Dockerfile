# 使用 Python 3.12 的官方镜像
FROM python:3.12-slim

# 设置工作目录
WORKDIR /app

# 复制当前目录的内容到容器的 /app 目录
COPY . /app

# 安装所需的 Python 库
RUN pip install python-telegram-bot requests nest-asyncio

# 运行机器人
CMD ["python", "-u", "boyinfo.py"]
