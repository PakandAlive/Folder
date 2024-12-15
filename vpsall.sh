#!/bin/bash

# 设置文字颜色
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 显示 LOGO
show_logo() {
    echo -e "\033[30m"
    echo "██████╗ █████╗ ██╗  ██╗ █████╗ ███╗   ██╗██████╗  █████╗ ██╗     ██╗██╗   ██╗███████╗"
    echo "██╔══██╗██╔══██╗██║ ██╔╝██╔══██╗████╗  ██║██╔══██╗██╔══██╗██║     ██║██║   ██║██╔════╝"
    echo "██████╔╝███████║█████╔╝ ███████║██╔██╗ ██║██║  ██║███████║██║     ██║██║   ██║█████╗  "
    echo "██╔═══╝ ██╔══██║██╔═██╗ ██╔══██║██║╚██╗██║██║  ██║██╔══██║██║     ██║╚██╗ ██╔╝██╔══╝  "
    echo "██║     ██║  ██║██║  ██╗██║  ██║██║ ╚████║██████╔╝██║  ██║███████╗██║ ╚████╔╝ ███████╗"
    echo "╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝  ╚══════╝"
    echo -e "${NC}"
}

# 显示菜单
show_menu() {
    clear
    show_logo
    echo -e "${GREEN}=== 服务器配置菜单 ===${NC}"
    echo ""
    echo -e "${BLUE}1. 程序安装${NC}"
    echo "   1) 安装 Docker"
    echo "   2) 安装 1Panel"
    echo "   3) 安装 TM"
    echo "   4) DockerPakNotion"
    echo ""
    echo -e "${BLUE}2. 代理协议${NC}"
    echo "   5) 安装 3to1"
    echo "   6) 安装 Alpine Hysteria2"
    echo "   7) 安装 Serv00 Hysteria2"
    echo "   8) 安装 X-UI"
    echo ""
    echo -e "${BLUE}3. 探针与检测${NC}"
    echo "   9) 安装优选 IP"
    echo "   10) 安装哪吒探针"
    echo "   11) 清理 Nezha"
    echo "   12) Serv00 后台运行"
    echo "   13) 流媒体检测"
    echo ""
    echo "0. 退出"
    echo "------------------------"
}

# 执行选择的操作
execute_option() {
    case $1 in
        1)
            echo "正在安装 Docker..."
            curl -fsSL https://get.docker.com | bash -s docker
            ;;
        2)
            echo "正在安装 1Panel..."
            curl -sSL https://resource.fit2cloud.com/1panel/package/quick_start.sh -o quick_start.sh && sudo bash quick_start.sh
            ;;
        3)
            echo "正在安装 TM..."
            docker pull traffmonetizer/cli_v2:latest
            docker run -i --name tm traffmonetizer/cli_v2 start accept --token slcaA2HXKYIsmV4mFcakxym26sJ7W0JhXbzqC5VD890=
            ;;
        4)
            echo "DockerPakNotio..."
            docker run -d -p 6006:3000 --name paknotion -e NOTION_PAGE_ID=156d008edc738093bb74ceb9bc51a116 jishubia/paknotion
            ;;
        5)
            echo "正在安装 3to1..."
            bash <(curl -fsSL https://raw.githubusercontent.com/PakandAlive/Folder/main/3to1.sh)
            ;;
        6)
            echo "正在安装 Alpine Hysteria2..."
            wget -O hy2.sh https://raw.githubusercontent.com/zrlhk/alpine-hysteria2/main/hy2.sh && sh hy2.sh
            ;;
        7)
            echo "正在安装 Sver00 Hysteria2..."
            bash <(curl -Ls https://raw.githubusercontent.com/eooce/sing-box/main/sb_serv00.sh)
            ;;
        8)
            echo "正在安装 X-UI..."
            bash <(curl -Ls https://raw.githubusercontent.com/vaxilu/x-ui/master/install.sh)
            ;;
        9)
            echo "正在安装优选 IP..."
            curl -L -O jhb.ovh/jb/sy.sh
            bash sy.sh
            ;;
        10)
            echo "正在安装哪吒探针..."
            curl -L https://raw.githubusercontent.com/nezhahq/scripts/main/agent/install.sh -o agent.sh && chmod +x agent.sh && env NZ_SERVER=mb.tmdd.me:10008 NZ_TLS=false NZ_CLIENT_SECRET=VFkcZTRL02S3cd8OEGNy32IuVXVA4459 ./agent.sh
            ;;
        11)
            echo "正在清理 Nezha..."
            # 停止所有 Nezha 相关进程
            pkill -9 -f nezha-agent
            pkill -9 -f nezha-dashboard
            pkill -9 -f app
            
            # 停止并禁用系统服务
            systemctl stop nezha-agent 2>/dev/null
            systemctl disable nezha-agent 2>/dev/null
            systemctl stop nezha-dashboard 2>/dev/null
            systemctl disable nezha-dashboard 2>/dev/null
            
            # 删除服务文件
            rm -f /etc/systemd/system/nezha-agent.service
            rm -f /etc/systemd/system/nezha-dashboard.service
            systemctl daemon-reload
            
            # 删除所有 Nezha 相关文件和目录
            rm -rf /opt/nezha
            rm -rf /etc/nezha
            
            # 清理临时文件
            rm -f ~/nezha.sh
            rm -f ~/agent.sh
            rm -f /tmp/nezha-agent_linux_*.zip
            
            echo "Nezha 清理完成！"
            ;;
        12)
            echo "正在配置 Serv00 后台运行..."
            nohup ./nezha-agent -c config.yml > nezha-agent.log 2>&1 &
            echo "Serv00 已在后台启动"
            ;;
        13)
            echo "正在检测流媒体..."
            bash <(curl -sL IP.Check.Place)
            ;;
        0)
            echo "退出程序..."
            exit 0
            ;;
        *)
            echo "无效选项，请重新选择"
            ;;
    esac
}

# 主程序循环
while true; do
    show_menu
    read -p "请选择要安装的程序 (0-13): " choice
    if [ "$choice" -eq 0 ]; then
        break
    fi
    execute_option $choice
    read -p "按回车键继续..."
done
