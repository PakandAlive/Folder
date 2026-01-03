#!/bin/bash

# 设置文字颜色
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
ORANGE='\033[0;33m'

# 显示 LOGO
show_logo() {
    local GREEN='\033[0;32m'
    
    echo -e "${GREEN}/ᐠ - ˕ -マ Ⳋ"
    echo -e "${NC}"
}

# 显示主菜单
show_main_menu() {
    clear
    show_logo
    echo -e "${GREEN}=== VPS 管理脚本 ===${NC}"
    echo ""
    printf " ${GREEN}01)安装Docker${NC}        ${GREEN}02)安装1Panel${NC}        ${GREEN}03)修改系统密码${NC}\n"
    printf " ${GREEN}04)解压工具${NC}          ${GREEN}05)清理Nezha${NC}         ${GREEN}06)流媒体检测${NC}\n"
    printf " ${GREEN}07)优选IP${NC}            ${GREEN}08)查看Sbox链接${NC}      ${GREEN}09)PM2状态${NC}\n"
    printf " ${GREEN}10)安装TM${NC}            ${ORANGE}11)安装H-UI${NC}          ${ORANGE}12)安装3to1${NC}\n"
    printf " ${ORANGE}13)哪吒探针${NC}          ${ORANGE}14)安装X-UI${NC}          ${BLUE}15)Docker监测${NC}\n"
    printf " ${BLUE}16)DockerPakNotion${NC}   ${BLUE}17)Dockerweb${NC}         ${BLUE}18)OKXBot${NC}\n"
    printf " ${BLUE}19)0xfuckNotion${NC}      ${ORANGE}20)Snell协议${NC}\n"
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
    echo "5) 0xfuckNotion"
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
    echo "5) 安装 H-UI"
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
        5)
            echo "正在部署 0xfuckNotion..."
            docker run -d \
              --name 0xfucknotion \
              -p 8020:8020 \
              --restart unless-stopped \
              -e NODE_ENV=production \
              -e PORT=8020 \
              -e NEXT_TELEMETRY_DISABLED=1 \
              --health-cmd="wget --no-verbose --tries=1 --spider http://localhost:8020/ || exit 1" \
              --health-interval=30s \
              --health-timeout=10s \
              --health-retries=3 \
              --health-start-period=40s \
              jishubia/0xfucknotion:latest
            echo "0xfuckNotion 已部署完成！"
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
        5)
            echo "正在安装 H-UI..."
            bash <(curl -fsSL https://raw.githubusercontent.com/jonssonyan/h-ui/main/install.sh)
            ;;
        6)
            echo "正在安装 Snell 协议..."
            wget -q https://raw.githubusercontent.com/passeway/Snell/main/Snell.sh -O Snell.sh && chmod +x Snell.sh && ./Snell.sh
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
            curl -L https://raw.githubusercontent.com/nezhahq/scripts/main/agent/install.sh -o agent.sh && chmod +x agent.sh && env NZ_SERVER=mb.tmdd.me:10008 NZ_TLS=false NZ_CLIENT_SECRET=VbLtiXco4MUrDoFTDKO6NAHJlRb3GvLG ./agent.sh
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

# 添加新的执行函数
execute_tools() {
    case $1 in
        1)
            echo "正在安装解压工具..."
            sudo apt install unzip
            ;;
        2)
            echo "正在连接到 Hummingbot..."
            docker attach hummingbot
            ;;
        3)
            echo "正在查看 Sbox 链接..."
            cd sbox
            journalctl -u sing-box -f | grep -v "ERROR"
            ;;
        4)
            echo "正在查看 PM2 状态..."
            pm2 status
            ;;
        5)
            echo "正在修改系统密码和 SSH 配置..."
            # 修改 root 密码
            echo "root:97TTY36MpwMr9TkL" | chpasswd

            # 备份原始 SSH 配置
            cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak
            
            # 直接写入新的 SSH 配置
            cat > /etc/ssh/sshd_config << EOF
Port 22
AddressFamily inet
ListenAddress 0.0.0.0
Protocol 2
HostKey /etc/ssh/ssh_host_rsa_key
HostKey /etc/ssh/ssh_host_ecdsa_key
HostKey /etc/ssh/ssh_host_ed25519_key
PermitRootLogin yes
PubkeyAuthentication yes
PasswordAuthentication yes
ChallengeResponseAuthentication no
UsePAM yes
X11Forwarding yes
PrintMotd no
AcceptEnv LANG LC_*
Subsystem sftp /usr/lib/openssh/sftp-server
EOF

            # 重启 SSH 服务
            systemctl restart sshd
            
            echo "密码已修改为: 97TTY36MpwMr9TkL"
            echo "已启用 root 登录和密码认证"
            echo "SSH 配置已更新，请尝试使用 root 账户登录"
            ;;
        6)
            echo "正在部署 dockerweb..."
            docker pull jishubia/dockerweb:latest
            docker run -d --restart=always -p 8976:8976 --name dockerweb jishubia/dockerweb:latest
            ;;
        7)
            echo "正在部署 OKXBot..."
            docker pull jishubia/okxdatapushbot:latest
            docker run -d \
              --name crypto-monitor-bot \
              --restart unless-stopped \
              -e TZ=Asia/Shanghai \
              -v /etc/localtime:/etc/localtime:ro \
              jishubia/okxdatapushbot:latest
            echo "OKXBot 已部署完成！"
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
                read -p "请选择操作 (0-5): " choice
                if [ "$choice" = "0" ]; then
                    break
                fi
                execute_basic $choice
                ;;
            2)
                show_proxy_menu
                read -p "请选择操作 (0-5): " choice
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
    read -p "请选择操作 (0-20): " choice
    case $choice in
        0)
            echo "退出程序..."
            exit 0
            ;;
        1) execute_basic 1 ;;
        2) execute_basic 2 ;;
        3) execute_tools 5 ;;
        4) execute_tools 1 ;;
        5) execute_monitor 3 ;;
        6) execute_monitor 5 ;;
        7) execute_monitor 1 ;;
        8) execute_tools 3 ;;
        9) execute_tools 4 ;;
        10) execute_basic 3 ;;
        11) execute_proxy 5 ;;
        12) execute_proxy 1 ;;
        13) execute_monitor 2 ;;
        14) execute_proxy 4 ;;
        15) execute_monitor 6 ;;
        16) execute_basic 4 ;;
        17) execute_tools 6 ;;
        18) execute_tools 7 ;;
        19) execute_basic 5 ;;
        20) execute_proxy 6 ;;
        *)
            echo "无效选项，请重新选择"
            read -p "按回车键继续..."
            ;;
    esac
    [ $choice != 0 ] && read -p "按回车键继续..."
done
