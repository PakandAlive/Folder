#!/bin/bash

# 设置文字颜色
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 显示 LOGO
show_logo() {
    local c1="\033[38;5;27m"
    local c2="\033[38;5;33m"
    local c3="\033[38;5;39m"
    local c4="\033[38;5;45m"
    local c5="\033[38;5;51m"
    
    echo -e "${c1}/${c2}ᐠ ${c3}- ${c4}˕ ${c3}-${c2}マ ${c1}Ⳋ"
    echo -e "${NC}"
}

# 显示主菜单
show_main_menu() {
    clear
    show_logo
    echo -e "${GREEN}=== VPS 管理脚本 ===${NC}"
    echo ""
    printf " 1)安装Docker         5)安装3to1           9)优选IP             13)流媒体检测\n"
    printf " 2)安装1Panel         6)Alpine Hy2        10)哪吒探针           14)Docker监测\n"
    printf " 3)安装TM             7)Serv00 Hy2        11)清理Nezha\n"
    printf " 4)DockerPakNotion    8)安装X-UI          12)Serv00后台\n"
    echo ""
    echo " 0) 退出"
    echo "------------------------"
}

# 显示基础程序安装子菜单
show_basic_menu() {
    clear
    show_logo
    echo -e "${GREEN}=== 基础程序安装 ===${NC}"
    echo ""
    echo "1) 安装 Docker"
    echo "2) 安装 1Panel"
    echo "3) 安装 TM"
    echo "4) DockerPakNotion"
    echo ""
    echo "0) 返回主菜单"
    echo "------------------------"
}

# 显示代理协议安装子菜单
show_proxy_menu() {
    clear
    show_logo
    echo -e "${GREEN}=== 代理协议安装 ===${NC}"
    echo ""
    echo "1) 安装 3to1"
    echo "2) 安装 Alpine Hysteria2"
    echo "3) 安装 Serv00 Hysteria2"
    echo "4) 安装 X-UI"
    echo ""
    echo "0) 返回主菜单"
    echo "------------------------"
}

# 显示探针与检测子菜单
show_monitor_menu() {
    clear
    show_logo
    echo -e "${GREEN}=== 探针与检测 ===${NC}"
    echo ""
    echo "1) 安装优选 IP"
    echo "2) 安装哪吒探针"
    echo "3) 清理 Nezha"
    echo "4) Serv00 后台运行"
    echo "5) 流媒体检测"
    echo "6) Docker 容器监测"
    echo ""
    echo "0) 返回主菜单"
    echo "------------------------"
}

# 执行基础程序安装
execute_basic() {
    case $1 in
        1)
            echo "正在安装 Docker..."
            curl -fsSL https://get.docker.com -o get-docker.sh && \
            sudo sh get-docker.sh && \
            sudo usermod -aG docker $USER && \
            sudo systemctl start docker && \
            sudo systemctl enable docker
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
            docker run -d -p 6006:3000 --name paknotion -e NOTION_PAGE_ID=15fa1a77778a809d9d9ddd97f9d9f13d jishubia/paknotion
            ;;
    esac
}

# 执行代理协议安装
execute_proxy() {
    case $1 in
        1)
            echo "正在安装 3to1..."
            bash <(curl -fsSL https://raw.githubusercontent.com/PakandAlive/Folder/main/3to1.sh)
            ;;
        2)
            echo "正在安装 Alpine Hysteria2..."
            wget -O hy2.sh https://raw.githubusercontent.com/zrlhk/alpine-hysteria2/main/hy2.sh && sh hy2.sh
            ;;
        3)
            echo "正在安装 Sver00 Hysteria2..."
            bash <(curl -Ls https://raw.githubusercontent.com/eooce/sing-box/main/sb_serv00.sh)
            ;;
        4)
            echo "正在安装 X-UI..."
            bash <(curl -Ls https://raw.githubusercontent.com/vaxilu/x-ui/master/install.sh)
            ;;
    esac
}

# 执行探针与检测
execute_monitor() {
    case $1 in
        1)
            echo "正在安装优选 IP..."
            curl -L -O jhb.ovh/jb/sy.sh
            bash sy.sh
            ;;
        2)
            echo "正在安装哪吒探针..."
            curl -L https://raw.githubusercontent.com/nezhahq/scripts/main/agent/install.sh -o agent.sh && chmod +x agent.sh && env NZ_SERVER=mb.tmdd.me:10008 NZ_TLS=false NZ_CLIENT_SECRET=VFkcZTRL02S3cd8OEGNy32IuVXVA4459 ./agent.sh
            ;;
        3)
            echo "正在清理 Nezha..."
            pkill -9 -f nezha-agent
            pkill -9 -f nezha-dashboard
            pkill -9 -f app
            systemctl stop nezha-agent 2>/dev/null
            systemctl disable nezha-agent 2>/dev/null
            systemctl stop nezha-dashboard 2>/dev/null
            systemctl disable nezha-dashboard 2>/dev/null
            rm -f /etc/systemd/system/nezha-agent.service
            rm -f /etc/systemd/system/nezha-dashboard.service
            systemctl daemon-reload
            rm -rf /opt/nezha
            rm -rf /etc/nezha
            rm -f ~/nezha.sh
            rm -f ~/agent.sh
            rm -f /tmp/nezha-agent_linux_*.zip
            echo "Nezha 清理完成！"
            ;;
        4)
            echo "正在配置 Serv00 后台运行..."
            nohup ./nezha-agent -c config.yml > nezha-agent.log 2>&1 &
            echo "Serv00 已在后台启动"
            ;;
        5)
            echo "正在检测流媒体..."
            bash <(curl -sL IP.Check.Place)
            ;;
        6)
            echo "正在启动 Docker 容器监测..."
            docker pull jishubia/docker-monitor:latest && \
            docker run -d \
              --name docker-monitor \
              --restart always \
              -v /var/run/docker.sock:/var/run/docker.sock \
              -e TZ=Asia/Shanghai \
              jishubia/docker-monitor:latest
            ;;
    esac
}

# 处理子菜单
handle_submenu() {
    local menu_type=$1
    local choice
    while true; do
        case $menu_type in
            1)
                show_basic_menu
                read -p "请选择操作 (0-4): " choice
                if [ "$choice" = "0" ]; then
                    break
                fi
                execute_basic $choice
                ;;
            2)
                show_proxy_menu
                read -p "请选择操作 (0-4): " choice
                if [ "$choice" = "0" ]; then
                    break
                fi
                execute_proxy $choice
                ;;
            3)
                show_monitor_menu
                read -p "请选择操作 (0-6): " choice
                if [ "$choice" = "0" ]; then
                    break
                fi
                execute_monitor $choice
                ;;
        esac
        read -p "按回车键继续..."
    done
}

# 主程序循环
while true; do
    show_main_menu
    read -p "请选择操作 (0-14): " choice
    case $choice in
        0)
            echo "退出程序..."
            exit 0
            ;;
        1) execute_basic 1 ;;
        2) execute_basic 2 ;;
        3) execute_basic 3 ;;
        4) execute_basic 4 ;;
        5) execute_proxy 1 ;;
        6) execute_proxy 2 ;;
        7) execute_proxy 3 ;;
        8) execute_proxy 4 ;;
        9) execute_monitor 1 ;;
        10) execute_monitor 2 ;;
        11) execute_monitor 3 ;;
        12) execute_monitor 4 ;;
        13) execute_monitor 5 ;;
        14) execute_monitor 6 ;;
        *)
            echo "无效选项，请重新选择"
            read -p "按回车键继续..."
            ;;
    esac
    [ $choice != 0 ] && read -p "按回车键继续..."
done
