#!/bin/bash

# ============================================================================
# ALL FUNCTION DEFINITIONS - MUST BE AT THE TOP
# ============================================================================

# delay print
print_with_delay() {
    text="$1"
    delay="$2"
    for ((i = 0; i < ${#text}; i++)); do
        printf "%s" "${text:$i:1}"
        sleep "$delay"
    done
    echo
}

# colorful text
warning() { echo -e "\033[31m\033[01m$*\033[0m"; }  # 红色
error() { echo -e "\033[31m\033[01m$*\033[0m" && exit 1; } # 红色
info() { echo -e "\033[32m\033[01m$*\033[0m"; }   # 绿色
hint() { echo -e "\033[33m\033[01m$*\033[0m"; }   # 黄色
#show system and singbox info
show_status(){
    singbox_pid=$(pgrep sing-box)
    singbox_status=$(systemctl is-active sing-box)
    if [ "$singbox_status" == "active" ]; then
        cpu_usage=$(ps -p $singbox_pid -o %cpu | tail -n 1)
        memory_usage_mb=$(( $(ps -p "$singbox_pid" -o rss | tail -n 1) / 1024 ))

        p_latest_version_tag=$(curl -s "https://api.github.com/repos/SagerNet/sing-box/releases" | jq -r '[.[] | select(.prerelease==true)][0].tag_name')
        latest_version_tag=$(curl -s "https://api.github.com/repos/SagerNet/sing-box/releases" | jq -r '[.[] | select(.prerelease==false)][0].tag_name')

        latest_version=${latest_version_tag#v}  # Remove 'v' prefix from version number
        p_latest_version=${p_latest_version_tag#v}  # Remove 'v' prefix from version number

        iswarp=$(grep '^WARP_ENABLE=' /root/sbox/config | cut -d'=' -f2)
        hyhop=$(grep '^HY_HOPPING=' /root/sbox/config | cut -d'=' -f2)

        warning "SING-BOX服务状态信息:"
        hint "========================="
        info "状态: 运行中"
        info "CPU 占用: $cpu_usage%"
        info "内存 占用: ${memory_usage_mb}MB"
        info "singbox测试版最新版本: $p_latest_version"
        info "singbox正式版最新版本: $latest_version"
        info "singbox当前版本(输入4管理切换): $(/root/sbox/sing-box version 2>/dev/null | awk '/version/{print $NF}')"
        info "warp流媒体解锁(输入6管理): $(if [ "$iswarp" == "TRUE" ]; then echo "开启"; else echo "关闭"; fi)"
        info "hy2端口跳跃(输入7管理): $(if [ "$hyhop" == "TRUE" ]; then echo "开启"; else echo "关闭"; fi)"
        hint "========================="
    else
        warning "SING-BOX 未运行！"
    fi

}

download_cloudflared(){
  arch=$(uname -m)
  # Map architecture names
  case ${arch} in
      x86_64)
          cf_arch="amd64"
          ;;
      aarch64)
          cf_arch="arm64"
          ;;
      armv7l)
          cf_arch="arm"
          ;;
  esac

  # install cloudflared linux
  cf_url="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${cf_arch}"
  curl -sLo "/root/sbox/cloudflared-linux" "$cf_url"
  chmod +x /root/sbox/cloudflared-linux
  echo ""
}
#show notice
show_notice() {
    local message="$1"
    local reset="\e[0m"
    local bold="\e[1m"
    local terminal_width=$(tput cols)
    local line=""
    local padding=$(( (terminal_width - ${#message}) / 2 ))
    local padded_message="$(printf "%*s%s" $padding '' "$message")"
    for ((i=1; i<=terminal_width; i++)); do
        line+="*"
    done
    warning "${bold}${line}${reset}"
    echo ""
    warning "${bold}${padded_message}${reset}"
    echo ""
    warning "${bold}${line}${reset}"
}
#install pkgs
install_pkgs() {
  # Install qrencode, jq, and iptables if not already installed
  local pkgs=("qrencode" "jq" "iptables")
  for pkg in "${pkgs[@]}"; do
    if command -v "$pkg" &> /dev/null; then
      echo "$pkg is already installed."
    else
      echo "Installing $pkg..."
      if command -v apt &> /dev/null; then
        sudo apt update > /dev/null 2>&1 && sudo apt install -y "$pkg" > /dev/null 2>&1
      elif command -v yum &> /dev/null; then
        sudo yum install -y "$pkg"
      elif command -v dnf &> /dev/null; then
        sudo dnf install -y "$pkg"
      else
        error "Unable to install $pkg. Please install it manually and rerun the script."
      fi
      echo "$pkg has been installed."
    fi
  done
}
install_shortcut() {
  # Copy the current script to a fixed location for future use
  cp "$0" /root/sbox/3to1_main.sh
  chmod +x /root/sbox/3to1_main.sh
  
  cat > /root/sbox/nowhash.sh << 'EOF'
#!/usr/bin/env bash
if [ -f "/root/sbox/config" ]; then
    # Show the menu for already installed system
    bash /root/sbox/3to1_main.sh menu
else
    # Run installation
    bash /root/sbox/3to1_main.sh
fi
EOF
  chmod +x /root/sbox/nowhash.sh
  ln -sf /root/sbox/nowhash.sh /usr/bin/nowhash
}
reload_singbox(){
    if /root/sbox/sing-box check -c /root/sbox/sbconfig_server.json; then
      echo "检查配置文件成功，重启服务..."
      systemctl reload sing-box
    else
      error "配置文件检查错误"
    fi
}
install_singbox(){
		echo "请选择需要安装的SING-BOX版本:"
		echo "1. 正式版"
		echo "2. 测试版"
		read -p "输入你的选项 (1-2, 默认: 1): " version_choice
		version_choice=${version_choice:-1}
		# Set the tag based on user choice
		if [ "$version_choice" -eq 2 ]; then
			echo "Installing Alpha version..."
			latest_version_tag=$(curl -s "https://api.github.com/repos/SagerNet/sing-box/releases" | jq -r '[.[] | select(.prerelease==true)][0].tag_name')
		else
			echo "Installing Stable version..."
			latest_version_tag=$(curl -s "https://api.github.com/repos/SagerNet/sing-box/releases" | jq -r '[.[] | select(.prerelease==false)][0].tag_name')
		fi
		# No need to fetch the latest version tag again, it's already set based on user choice
		latest_version=${latest_version_tag#v}  # Remove 'v' prefix from version number
		echo "Latest version: $latest_version"
		# Detect server architecture
		arch=$(uname -m)
		echo "本机架构为: $arch"
    case ${arch} in
      x86_64) arch="amd64" ;;
      aarch64) arch="arm64" ;;
      armv7l) arch="armv7" ;;
    esac
    # latest_version_tag=$(curl -s "https://api.github.com/repos/SagerNet/sing-box/releases" | grep -Po '"tag_name": "\K.*?(?=")' | sort -V | tail -n 1)
    # latest_version=${latest_version_tag#v}
    echo "最新版本为: $latest_version"
    package_name="sing-box-${latest_version}-linux-${arch}"
    url="https://github.com/SagerNet/sing-box/releases/download/${latest_version_tag}/${package_name}.tar.gz"
    curl -sLo "/root/${package_name}.tar.gz" "$url"
    tar -xzf "/root/${package_name}.tar.gz" -C /root
    mv "/root/${package_name}/sing-box" /root/sbox
    rm -r "/root/${package_name}.tar.gz" "/root/${package_name}"
    chown root:root /root/sbox/sing-box
    chmod +x /root/sbox/sing-box
}

change_singbox(){
			echo "切换SING-BOX版本..."
			echo ""
			# Extract the current version
			current_version_tag=$(/root/sbox/sing-box version | grep 'sing-box version' | awk '{print $3}')

			# Fetch the latest stable and alpha version tags
			latest_stable_version=$(curl -s "https://api.github.com/repos/SagerNet/sing-box/releases" | jq -r '[.[] | select(.prerelease==false)][0].tag_name')
			latest_alpha_version=$(curl -s "https://api.github.com/repos/SagerNet/sing-box/releases" | jq -r '[.[] | select(.prerelease==true)][0].tag_name')

			# Determine current version type (stable or alpha)
      if [[ $current_version_tag == *"-alpha"* || $current_version_tag == *"-rc"* || $current_version_tag == *"-beta"* ]]; then
				echo "当前为测试版，准备切换为最新正式版..."
				echo ""
				new_version_tag=$latest_stable_version
			else
				echo "当前为正式版，准备切换为最新测试版..."
				echo ""
				new_version_tag=$latest_alpha_version
			fi

			# Stop the service before updating
			systemctl stop sing-box

			# Download and replace the binary
			arch=$(uname -m)
			case $arch in
				x86_64) arch="amd64" ;;
				aarch64) arch="arm64" ;;
				armv7l) arch="armv7" ;;
			esac

			package_name="sing-box-${new_version_tag#v}-linux-${arch}"
			url="https://github.com/SagerNet/sing-box/releases/download/${new_version_tag}/${package_name}.tar.gz"

			curl -sLo "/root/${package_name}.tar.gz" "$url"
			tar -xzf "/root/${package_name}.tar.gz" -C /root
			mv "/root/${package_name}/sing-box" /root/sbox/sing-box

			# Cleanup the package
			rm -r "/root/${package_name}.tar.gz" "/root/${package_name}"

			# Set the permissions
			chown root:root /root/sbox/sing-box
			chmod +x /root/sbox/sing-box

			# Restart the service with the new binary
			systemctl daemon-reload
			systemctl start sing-box

			echo "Version switched and service restarted with the new binary."
			echo ""
}

generate_port() {
    while :; do
        port=$((RANDOM % 10001 + 10000))
        read -p "请输入协议监听端口(默认随机生成): " user_input
        port=${user_input:-$port}
        ss -tuln | grep -q ":$port\b" || { echo "$port"; return $port; }
        echo "端口 $port 被占用，请输入其他端口"
    done
}

modify_port() {
    local current_port="$1"
    while :; do
        read -p "请输入需要修改的端口，默认随机生成 (当前端口为: $current_port): " modified_port
        modified_port=${modified_port:-$current_port}
        if [ "$modified_port" -eq "$current_port" ]; then
            break
        fi
        if ss -tuln | grep -q ":$modified_port\b"; then
            echo "端口 $port 被占用，请输入其他端口"
        else
            break
        fi
    done
    echo "$modified_port"
}
# client configuration
show_client_configuration() {
  # get ip
  server_ip=$(grep -o "SERVER_IP='[^']*'" /root/sbox/config | awk -F"'" '{print $2}')
  public_key=$(grep -o "PUBLIC_KEY='[^']*'" /root/sbox/config | awk -F"'" '{print $2}')
  
  # reality
  reality_port=$(jq -r '.inbounds[] | select(.tag == "vless-in") | .listen_port' /root/sbox/sbconfig_server.json)
  reality_uuid=$(jq -r '.inbounds[] | select(.tag == "vless-in") | .users[0].uuid' /root/sbox/sbconfig_server.json)
  reality_server_name=$(jq -r '.inbounds[] | select(.tag == "vless-in") | .tls.server_name' /root/sbox/sbconfig_server.json)
  short_id=$(jq -r '.inbounds[] | select(.tag == "vless-in") | .tls.reality.short_id[0]' /root/sbox/sbconfig_server.json)

  echo ""
  show_notice "Reality 配置参数" 
  echo ""
  info "Reality 通用参数如下"
  echo ""
  echo "服务器ip: $server_ip"
  echo "监听端口: $reality_port"
  echo "UUID: $reality_uuid"
  echo "域名SNI: $reality_server_name"
  echo "Public Key: $public_key"
  echo "Short ID: $short_id"
  echo ""

  # hy2
  hy_port=$(jq -r '.inbounds[] | select(.tag == "hy2-in") | .listen_port' /root/sbox/sbconfig_server.json)
  hy_server_name=$(grep -o "HY_SERVER_NAME='[^']*'" /root/sbox/config | awk -F"'" '{print $2}')
  hy_password=$(jq -r '.inbounds[] | select(.tag == "hy2-in") | .users[0].password' /root/sbox/sbconfig_server.json)
  
  # Check hopping status
  ishopping=$(grep '^HY_HOPPING=' /root/sbox/config | cut -d'=' -f2)
  
  echo ""
  show_notice "Hysteria2 配置参数" 
  echo ""
  info "Hysteria2 通用参数如下"
  echo ""
  echo "服务器ip: $server_ip"
  echo "端口号: $hy_port"
  if [ "$ishopping" = "FALSE" ]; then
    echo "端口跳跃未开启"
  else
    iptables_rule=$(iptables -t nat -L -n -v | grep "udp" | grep -oP 'dpts:\K\d+:\d+')
    ipv6tables_rule=$(ip6tables -t nat -L -n -v | grep "udp" | grep -oP 'dpts:\K\d+:\d+')
    output_range="${iptables_rule:-$ipv6tables_rule}"
    formatted_range=$(echo "$output_range" | sed 's/:/-/')
    echo "跳跃端口为${formatted_range}"
  fi
  echo "密码password: $hy_password"
  echo "域名SNI: $hy_server_name"
  echo "跳过证书验证（允许不安全）: True"
  echo ""
  
  # Update argo domain if needed
  if [ -f "/root/sbox/argo.log" ]; then
    cat /root/sbox/argo.log | grep trycloudflare.com | awk 'NR==2{print}' | awk -F// '{print $2}' | awk '{print $1}' | xargs -I {} sed -i "s/ARGO_DOMAIN='.*'/ARGO_DOMAIN='{}'/g" /root/sbox/config
    rm -f /root/sbox/argo.log
  fi
  
  # vmess
  argo_domain=$(grep -o "ARGO_DOMAIN='[^']*'" /root/sbox/config | awk -F"'" '{print $2}')
  vmess_uuid=$(jq -r '.inbounds[] | select(.tag == "vmess-in") | .users[0].uuid' /root/sbox/sbconfig_server.json)
  ws_path=$(jq -r '.inbounds[] | select(.tag == "vmess-in") | .transport.path' /root/sbox/sbconfig_server.json)
  
  echo ""
  show_notice "VMess 配置参数"
  echo ""
  info "VMess 通用参数如下"
  echo ""
  echo "服务器域名: $argo_domain"
  echo "UUID: $vmess_uuid"
  echo "WebSocket路径: ${ws_path}?ed=2048"
  echo "WSS端口: 443 (可选: 2053 2083 2087 2096 8443)"
  echo "WS端口: 80 (可选: 8080 8880 2052 2082 2086 2095)"
  echo ""
}

#enable bbr
enable_bbr() {
    # temporary workaround for installing bbr
    bash <(curl -L -s https://raw.githubusercontent.com/teddysun/across/master/bbr.sh)
    echo ""
}

modify_singbox() {
    #modifying reality configuration
    echo ""
    warning "开始修改reality端口号和域名"
    reality_current_port=$(jq -r '.inbounds[] | select(.tag == "vless-in") | .listen_port' /root/sbox/sbconfig_server.json)
    reality_port=$(modify_port "$reality_current_port")
    reality_current_server_name=$(jq -r '.inbounds[] | select(.tag == "vless-in") | .tls.server_name' /root/sbox/sbconfig_server.json)
    reality_server_name="$reality_current_server_name"
    while :; do
        read -p "请输入需要偷取证书的网站，必须支持 TLS 1.3 and HTTP/2 (默认: $reality_server_name): " input_server_name
        reality_server_name=${input_server_name:-$reality_server_name}

        if curl --tlsv1.3 --http2 -sI "https://$reality_server_name" | grep -q "HTTP/2"; then
            break
        else
            echo "域名 $reality_server_name 不支持 TLS 1.3 或 HTTP/2，请重新输入."
        fi
    done
    echo "域名 $reality_server_name 符合."
    echo ""
    # modifying hysteria2 configuration
    warning "开始修改hysteria2端口号"
    hy_current_port=$(jq -r '.inbounds[] | select(.tag == "hy2-in") | .listen_port' /root/sbox/sbconfig_server.json)
    hy_port=$(modify_port "$hy_current_port")

    # 修改sing-box
    jq --arg reality_port "$reality_port" \
    --arg hy_port "$hy_port" \
    --arg reality_server_name "$reality_server_name" \
    '
    (.inbounds[] | select(.tag == "vless-in") | .listen_port) |= ($reality_port | tonumber) |
    (.inbounds[] | select(.tag == "hy2-in") | .listen_port) |= ($hy_port | tonumber) |
    (.inbounds[] | select(.tag == "vless-in") | .tls.server_name) |= $reality_server_name |
    (.inbounds[] | select(.tag == "vless-in") | .tls.reality.handshake.server) |= $reality_server_name
    ' /root/sbox/sbconfig_server.json > /root/sbox/sbconfig_server.temp && mv /root/sbox/sbconfig_server.temp /root/sbox/sbconfig_server.json

    echo ""
    reload_singbox
    echo ""
}

uninstall_singbox() {
    warning "开始卸载..."
    disable_hy2hopping
    # Stop and disable services
    systemctl stop sing-box argo
    systemctl disable sing-box argo > /dev/null 2>&1

    # Remove service files
    rm -f /etc/systemd/system/sing-box.service
    rm -f /etc/systemd/system/argo.service

    # Remove configuration and executable files
    rm -f /root/sbox/sbconfig_server.json
    rm -f /root/sbox/sing-box
    rm -f /usr/bin/nowhash
    rm -f /root/sbox/nowhash.sh
    rm -f /root/sbox/cloudflared-linux
    rm -f /root/sbox/self-cert/private.key
    rm -f /root/sbox/self-cert/cert.pem
    rm -f /root/sbox/config

    # Remove directories
    rm -rf /root/sbox/self-cert/
    rm -rf /root/sbox/

    echo "卸载完成"
}
process_warp(){
    while :; do
        iswarp=$(grep '^WARP_ENABLE=' /root/sbox/config | cut -d'=' -f2)
        if [ "$iswarp" = "FALSE" ]; then
          warning "warp分流未开启，是否开启（默认解锁openai和奈飞）"
          read -p "是否开启? (y/n 默认为y): " confirm
          confirm=${confirm:-"y"}
          if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
            enable_warp
          else
            break
          fi
        else
            warp_option=$(awk -F= '/^WARP_OPTION/{gsub(/^[ \t]+|[ \t]+$/, "", $2); print $2}' /root/sbox/config)
            case $warp_option in
                0)
                    current_option="手动分流(使用geosite和domain分流)"
                    ;;
                1)
                    current_option="全局分流(接管所有流量)"
                    ;;
                *)
                    current_option="unknow!"
                    ;;
            esac
            warp_mode=$(awk -F= '/^WARP_MODE/{gsub(/^[ \t]+|[ \t]+$/, "", $2); print $2}' /root/sbox/config)
            case $warp_mode in
                0)
                    current_mode="Ipv6优先"
                    current_mode1="warp-IPv6-prefer-out"
                    ;;
                1)
                    current_mode="Ipv4优先"
                    current_mode1="warp-IPv4-prefer-out"
                    ;;
                2)
                    current_mode="Ipv6仅允许"
                    current_mode1="warp-IPv6-out"
                    ;;
                3)
                    current_mode="Ipv4仅允许"
                    current_mode1="warp-IPv4-out"
                    ;;
                *)
                    current_option="unknow!"
                    ;;
            esac
            echo ""
            warning "warp分流已经开启"
            echo ""
            hint "当前模式为: $current_mode"
            hint "当前状态为: $current_option"
            echo ""
            info "请选择选项："
            echo ""
            info "1. 切换为手动分流(geosite和domain分流)"
            info "2. 切换为全局分流(接管所有流量)" 
            info "3. 设置手动分流规则(geosite和domain分流)"  
            info "4. 切换为warp策略"
            info "5. 删除warp解锁"
            info "0. 退出"
            echo ""
            read -p "请输入对应数字（0-5）: " warp_input
        case $warp_input in
          1)
            jq '.route.final = "direct"' /root/sbox/sbconfig_server.json > /root/sbox/sbconfig_server.temp && mv /root/sbox/sbconfig_server.temp /root/sbox/sbconfig_server.json
            sed -i "s/WARP_OPTION=.*/WARP_OPTION=0/" /root/sbox/config
            reload_singbox
          ;;
          2)
            jq --arg current_mode1 "$current_mode1" '.route.final = $current_mode1' /root/sbox/sbconfig_server.json > /root/sbox/sbconfig_server.temp && mv /root/sbox/sbconfig_server.temp /root/sbox/sbconfig_server.json
            sed -i "s/WARP_OPTION=.*/WARP_OPTION=1/" /root/sbox/config
            reload_singbox
            ;;
          4)
          while :; do
              warning "请选择需要切换的warp策略"
              echo ""
              hint "当前状态为: $current_option"
              echo ""
              info "请选择切换的选项："
              echo ""
              info "1. Ipv6优先(默认)"
              info "2. Ipv4优先"
              info "3. 仅允许Ipv6"
              info "4. 仅允许Ipv4"
              info "0. 退出"
              echo ""

              read -p "请输入对应数字（0-4）: " user_input
              user_input=${user_input:-1}
              case $user_input in
                  1)
                      warp_out="warp-IPv6-prefer-out"
                      sed -i "s/WARP_MODE=.*/WARP_MODE=0/" /root/sbox/config
                      break
                      ;;
                  2)
                      warp_out="warp-IPv4-prefer-out"
                      sed -i "s/WARP_MODE=.*/WARP_MODE=1/" /root/sbox/config
                      break
                      ;;
                  3)
                      warp_out="warp-IPv6-out"
                      sed -i "s/WARP_MODE=.*/WARP_MODE=2/" /root/sbox/config
                      break
                      ;;
                  4)
                      warp_out="warp-IPv4-out"
                      sed -i "s/WARP_MODE=.*/WARP_MODE=3/" /root/sbox/config
                      break
                      ;;
                  0)
                      # Exit the loop if option 0 is selected
                      echo "退出warp"
                      exit 0
                      ;;
                  *)
                      # Handle invalid input
                      echo "无效的输入，请重新输入"
                      ;;
              esac
          done
            jq --arg warp_out "$warp_out" '.route.rules[].outbound |= $warp_out' /root/sbox/sbconfig_server.json > /root/sbox/sbconfig_server.temp && mv /root/sbox/sbconfig_server.temp /root/sbox/sbconfig_server.json
            if [ "$warp_option" -ne 0 ]; then
              jq --arg warp_out "$warp_out" '.route.final = $warp_out' /root/sbox/sbconfig_server.json > /root/sbox/sbconfig_server.temp && mv /root/sbox/sbconfig_server.temp /root/sbox/sbconfig_server.json
            fi
            reload_singbox
            ;;
          3)
            info "请选择："
            echo ""
            info "1. 手动添加geosite分流（适配singbox1.8.0)"
            info "2. 手动添加域名关键字匹配分流"
            info "0. 退出"
            echo ""

            read -p "请输入对应数字（0-2）: " user_input
            case $user_input in
                1)
                    while :; do
                      echo ""
                      warning "geosite分流为: "
                      #域名关键字为
                      jq '.route.rules[] | select(.rule_set) | .rule_set' /root/sbox/sbconfig_server.json
                      info "请选择操作："
                      echo "1. 添加geosite"
                      echo "2. 删除geosite"
                      echo "0. 退出"
                      echo ""

                      read -p "请输入对应数字（0-2）: " user_input

                      case $user_input in
                          1)
                            #add domain
                            read -p "请输入要添加的域名关键字（若要添加geosite-openai，输入openai）: " new_keyword
                            url="https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geosite/$new_keyword.srs"
                            formatted_keyword="geosite-$new_keyword"
                            # 检查是否存在相同的 geosite 关键字
                            if jq --arg formatted_keyword "$formatted_keyword" '.route.rules[0].rule_set | any(. == $formatted_keyword)' /root/sbox/sbconfig_server.json | grep -q "true"; then
                              echo "geosite已存在，不添加重复项: $formatted_keyword"
                            else
                              http_status=$(curl -s -o /dev/null -w "%{http_code}" "$url")

                              if [ "$http_status" -eq 200 ]; then
                                # 如果不存在，则添加
                                  new_rule='{
                                    "tag": "'"$formatted_keyword"'",
                                    "type": "remote",
                                    "format": "binary",
                                    "url": "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geosite/'"$new_keyword"'.srs",
                                    "download_detour": "direct"
                                  }'

                                jq --arg formatted_keyword "$formatted_keyword" '.route.rules[0].rule_set += [$formatted_keyword]' /root/sbox/sbconfig_server.json > /root/sbox/sbconfig_server.temp && mv /root/sbox/sbconfig_server.temp /root/sbox/sbconfig_server.json
                                jq --argjson new_rule "$new_rule" '.route.rule_set += [$new_rule]' /root/sbox/sbconfig_server.json > /root/sbox/sbconfig_server.temp && mv /root/sbox/sbconfig_server.temp /root/sbox/sbconfig_server.json

                                echo "geosite已添加: $new_rule"
                              else
                                echo "geosite srs文件不存在，请重新输入..."
                              fi
                            fi
                            ;;
                          2)
                            #delete domain keywords
                            read -p "请输入要删除的域名关键字（若要删除geosite-openai，输入openai） " keyword_to_delete
                            formatted_keyword="geosite-$keyword_to_delete"
                            if jq --arg formatted_keyword "$formatted_keyword" '.route.rules[0].rule_set | any(. == $formatted_keyword)' /root/sbox/sbconfig_server.json | grep -q "true"; then
                              jq --arg formatted_keyword "$formatted_keyword" '.route.rules[0].rule_set -= [$formatted_keyword]' /root/sbox/sbconfig_server.json > /root/sbox/sbconfig_server.temp && mv /root/sbox/sbconfig_server.temp /root/sbox/sbconfig_server.json
                              #卸载ruleset
                              jq --arg formatted_keyword "$formatted_keyword" 'del(.route.rule_set[] | select(.tag == $formatted_keyword))' /root/sbox/sbconfig_server.json > /root/sbox/sbconfig_server.temp && mv /root/sbox/sbconfig_server.temp /root/sbox/sbconfig_server.json
                              echo "域名关键字已删除: $formatted_keyword"
                            else
                              echo "域名关键字不存在，不执行删除操作: $formatted_keyword"
                            fi
                              ;;
                          0)
                              echo "退出"
                              break
                              ;;
                          *)
                              echo "无效的输入，请重新输入"
                              ;;
                      esac
                  done
                    break
                    ;;
                2)
                    while :; do
                      echo ""
                      warning "域名关键字为: "
                      #域名关键字为
                      jq '.route.rules[] | select(.domain_keyword) | .domain_keyword' /root/sbox/sbconfig_server.json
                      info "请选择操作："
                      echo "1. 添加域名关键字"
                      echo "2. 删除域名关键字"
                      echo "0. 退出"
                      echo ""

                      read -p "请输入对应数字（0-2）: " user_input

                      case $user_input in
                          1)
                            #add domain keywords
                            read -p "请输入要添加的域名关键字: " new_keyword
                            if jq --arg new_keyword "$new_keyword" '.route.rules[1].domain_keyword | any(. == $new_keyword)' /root/sbox/sbconfig_server.json | grep -q "true"; then
                              echo "域名关键字已存在，不添加重复项: $new_keyword"
                            else
                              jq --arg new_keyword "$new_keyword" '.route.rules[1].domain_keyword += [$new_keyword]' /root/sbox/sbconfig_server.json > /root/sbox/sbconfig_server.temp && mv /root/sbox/sbconfig_server.temp /root/sbox/sbconfig_server.json
                              echo "域名关键字已添加: $new_keyword"
                            fi
                            ;;
                          2)
                            #delete domain keywords
                            read -p "请输入要删除的域名关键字: " keyword_to_delete
                            if jq --arg keyword_to_delete "$keyword_to_delete" '.route.rules[1].domain_keyword | any(. == $keyword_to_delete)' /root/sbox/sbconfig_server.json | grep -q "true"; then
                              jq --arg keyword_to_delete "$keyword_to_delete" '.route.rules[1].domain_keyword -= [$keyword_to_delete]' /root/sbox/sbconfig_server.json > /root/sbox/sbconfig_server.temp && mv /root/sbox/sbconfig_server.temp /root/sbox/sbconfig_server.json
                              echo "域名关键字已删除: $keyword_to_delete"
                            else
                              echo "域名关键字不存在，不执行删除操作: $keyword_to_delete"
                            fi
                              ;;
                          0)
                              echo "退出"
                              break
                              ;;
                          *)
                              echo "无效的输入，请重新输入"
                              ;;
                      esac
                  done

                    break
                    ;;

                0)
                    # Exit the loop if option 0 is selected
                    echo "退出"
                    exit 0
                    ;;
                *)
                    # Handle invalid input
                    echo "无效的输入"
                    ;;
            esac
            reload_singbox
            break
            ;;
          5)
              disable_warp
              break
            ;;
          *)
              echo "退出"
              break
              ;;
        esac


        fi
        echo "配置文件更新成功"
    done
}
enable_warp(){
while :; do
     warning "请选择是否需要注册warp"
     echo ""
     info "请选择选项："
     echo ""
     info "1. 使用绵羊提供的warp节点(默认)"
     info "2. 使用手动刷的warp节点"
     info "0. 退出"
     echo ""
     read -p "请输入对应数字（0-2）: " user_input
     user_input=${user_input:-1}
     case $user_input in
         1)
             v6="2606:4700:110:87ad:b400:91:eadb:887f"
             private_key="wIC19yRRSJkhVJcE09Qo9bE3P3PIwS3yyqyUnjwNO34="
             reserved="XiBe"
             break
             ;;
         2)
             warning "开始注册warp..."
             output=$(bash -c "$(curl -L warp-reg.vercel.app)")
             v6=$(echo "$output" | grep -oP '"v6": "\K[^"]+' | awk 'NR==2')
             private_key=$(echo "$output" | grep -oP '"private_key": "\K[^"]+')
             reserved=$(echo "$output" | grep -oP '"reserved_str": "\K[^"]+')
             break
             ;;
         0)
             # Exit the loop if option 0 is selected
             echo "退出"
             exit 0
             ;;
         *)
             # Handle invalid input
             echo "无效的输入，请重新输入"
             ;;
     esac
 done
while :; do
    warning "请选择需要设置的warp策略（默认v6优先）"
    echo ""
    info "请选择选项："
    echo ""
    info "1. Ipv6优先(默认)"
    info "2. Ipv4优先"
    info "3. 仅允许Ipv6"
    info "4. 仅允许Ipv4"
    info "0. 退出"
    echo ""

    read -p "请输入对应数字（0-4）: " user_input
    user_input=${user_input:-1}
    case $user_input in
        1)
            warp_out="warp-IPv6-prefer-out"
            sed -i "s/WARP_MODE=.*/WARP_MODE=0/" /root/sbox/config
            break
            ;;
        2)
            warp_out="warp-IPv4-prefer-out"
            sed -i "s/WARP_MODE=.*/WARP_MODE=1/" /root/sbox/config
            break
            ;;
        3)
            warp_out="warp-IPv6-out"
            sed -i "s/WARP_MODE=.*/WARP_MODE=2/" /root/sbox/config
            break
            ;;
        4)
            warp_out="warp-IPv4-out"
            sed -i "s/WARP_MODE=.*/WARP_MODE=3/" /root/sbox/config
            break
            ;;
        0)
            # Exit the loop if option 0 is selected
            echo "退出warp"
            exit 0
            ;;
        *)
            # Handle invalid input
            echo "无效的输入，请重新输入"
            ;;
    esac
done
    # Command to modify the JSON configuration in-place
    jq --arg private_key "$private_key" --arg v6 "$v6" --arg reserved "$reserved" --arg warp_out "$warp_out" '
        .route = {
          "final": "direct",
          "rules": [
            {
              "rule_set": ["geosite-openai","geosite-netflix"],
              "outbound": $warp_out
            },
            {
              "domain_keyword": [
                "ipaddress"
              ],
              "outbound": $warp_out
            }
          ],
          "rule_set": [
            { 
              "tag": "geosite-openai",
              "type": "remote",
              "format": "binary",
              "url": "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geosite/openai.srs",
              "download_detour": "direct"
            },
            {
              "tag": "geosite-netflix",
              "type": "remote",
              "format": "binary",
              "url": "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geosite/netflix.srs",
              "download_detour": "direct"
            }
          ]
        } | .outbounds += [
          {
            "type": "direct",
            "tag": "warp-IPv4-out",
            "detour": "wireguard-out",
            "domain_strategy": "ipv4_only"
          },
          {
            "type": "direct",
            "tag": "warp-IPv6-out",
            "detour": "wireguard-out",
            "domain_strategy": "ipv6_only"
          },
          {
            "type": "direct",
            "tag": "warp-IPv6-prefer-out",
            "detour": "wireguard-out",
            "domain_strategy": "prefer_ipv6"
          },
          {
            "type": "direct",
            "tag": "warp-IPv4-prefer-out",
            "detour": "wireguard-out",
            "domain_strategy": "prefer_ipv4"
          },
          {
            "type": "wireguard",
            "tag": "wireguard-out",
            "server": "162.159.192.1",
            "server_port": 2408,
            "local_address": [
              "172.16.0.2/32",
              $v6 + "/128"
            ],
            "private_key": $private_key,
            "peer_public_key": "bmXOC+F1FxEMF9dyiK2H5/1SUtzH0JuVo51h2wPfgyo=",
            "reserved": $reserved,
            "mtu": 1280
          }
        ]' "/root/sbox/sbconfig_server.json" > /root/sbox/sbconfig_server.temp && mv /root/sbox/sbconfig_server.temp "/root/sbox/sbconfig_server.json"

    sed -i "s/WARP_ENABLE=FALSE/WARP_ENABLE=TRUE/" /root/sbox/config
    sed -i "s/WARP_OPTION=.*/WARP_OPTION=0/" /root/sbox/config
    reload_singbox
}

#关闭warp
disable_warp(){
    jq 'del(.route) | del(.outbounds[] | select(.tag == "warp-IPv4-out" or .tag == "warp-IPv6-out" or .tag == "warp-IPv4-prefer-out" or .tag == "warp-IPv6-prefer-out" or .tag == "wireguard-out"))' "/root/sbox/sbconfig_server.json" > /root/sbox/sbconfig_server.temp && mv /root/sbox/sbconfig_server.temp "/root/sbox/sbconfig_server.json"
    sed -i "s/WARP_ENABLE=TRUE/WARP_ENABLE=FALSE/" /root/sbox/config
    reload_singbox
}
#更新singbox
update_singbox(){
    info "更新singbox..."
    install_singbox
    # 检查配置
    if /root/sbox/sing-box check -c /root/sbox/sbconfig_server.json; then
      echo "检查配置文件成功，重启服务..."
      systemctl restart sing-box
    else
      error "启动失败，请检查配置文件"
    fi
}

process_singbox() {
  while :; do
    echo ""
    echo ""
    info "请选择选项："
    echo ""
    info "1. 重启sing-box"
    info "2. 更新sing-box内核"
    info "3. 查看sing-box状态"
    info "4. 查看sing-box实时日志"
    info "5. 查看sing-box服务端配置"
    info "6. 切换SINGBOX内核版本"
    info "0. 退出"
    echo ""
    read -p "请输入对应数字（0-）: " user_input
    echo ""
    case "$user_input" in
        1)
            warning "重启sing-box..."
            # 检查配置
            if /root/sbox/sing-box check -c /root/sbox/sbconfig_server.json; then
                info "检查配置文件，启动服务..."
                systemctl restart sing-box
            fi
            info "重启完成"
            break
            ;;
        2)
            update_singbox
            break
            ;;
        3)
            warning "singbox基本信息如下(ctrl+c退出)"
            systemctl status sing-box
            break
            ;;
        4)
            warning "singbox日志如下(ctrl+c退出)："
            journalctl -u sing-box -o cat -f
            break
            ;;
        5)
            echo "singbox服务端如下："
            cat /root/sbox/sbconfig_server.json
            break
            ;;
        6)
            change_singbox
            break
            ;;
        0)
          echo "退出"
          break
          ;;
        *)
            echo "请输入正确选项: 0-6"
            ;;
    esac
  done
}

process_hy2hopping(){

        echo ""
        echo ""
        while true; do
          ishopping=$(grep '^HY_HOPPING=' /root/sbox/config | cut -d'=' -f2)
          if [ "$ishopping" = "FALSE" ]; then
              warning "开始设置端口跳跃范围"
              enable_hy2hopping       
          else
              warning "端口跳跃已开启"
              echo ""
              info "请选择选项："
              echo ""
              info "1. 关闭端口跳跃"
              info "2. 重新设置"
              info "3. 查看规则"
              info "0. 退出"
              echo ""
              read -p "请输入对应数字（0-3）: " hopping_input
              echo ""
              case $hopping_input in
                1)
                  disable_hy2hopping
                  echo "端口跳跃规则已删除"
                  break
                  ;;
                2)
                  disable_hy2hopping
                  echo "端口跳跃规则已删除"
                  echo "开始重新设置端口跳跃"
                  enable_hy2hopping
                  break
                  ;;
                3)
                  # 查看NAT规则
                  iptables -t nat -L -n -v | grep "udp"
                  ip6tables -t nat -L -n -v | grep "udp"
                  break
                  ;;
                0)
                  echo "退出"
                  break
                  ;;
                *)
                  echo "无效的选项"
                  ;;
              esac
          fi
        done
}
# 开启hysteria2端口跳跃
enable_hy2hopping(){
    hint "开启端口跳跃..."
    warning "注意: 端口跳跃范围不要覆盖已经占用的端口，否则会错误！"
    hy_current_port=$(jq -r '.inbounds[] | select(.tag == "hy2-in") | .listen_port' /root/sbox/sbconfig_server.json)
    read -p "输入UDP端口范围的起始值(默认50000): " -r start_port
    start_port=${start_port:-50000}
    read -p "输入UDP端口范围的结束值(默认51000): " -r end_port
    end_port=${end_port:-51000}
    iptables -t nat -A PREROUTING -i eth0 -p udp --dport $start_port:$end_port -j DNAT --to-destination :$hy_current_port
    ip6tables -t nat -A PREROUTING -i eth0 -p udp --dport $start_port:$end_port -j DNAT --to-destination :$hy_current_port

    sed -i "s/HY_HOPPING=FALSE/HY_HOPPING=TRUE/" /root/sbox/config


}

disable_hy2hopping(){
  echo "关闭端口跳跃..."
  iptables -t nat -F PREROUTING >/dev/null 2>&1
  ip6tables -t nat -F PREROUTING >/dev/null 2>&1
  sed -i "s/HY_HOPPING=TRUE/HY_HOPPING=FALSE/" /root/sbox/config
    #TOREMOVE compatible with legacy users
  sed -i "s/HY_HOPPING='TRUE'/HY_HOPPING=FALSE/" /root/sbox/config
}

# Check if script is called with 'menu' parameter to show management interface
if [ "$1" = "menu" ]; then
    # 直接显示管理菜单，跳过安装逻辑
    if [ -f "/root/sbox/sbconfig_server.json" ] && [ -f "/root/sbox/config" ] && [ -f "/root/sbox/nowhash.sh" ] && [ -f "/usr/bin/nowhash" ] && [ -f "/root/sbox/sing-box" ] && [ -f "/etc/systemd/system/sing-box.service" ]; then
        echo ""
        warning "sing-box-reality-hysteria2管理菜单"
        show_status
        warning "请选择选项:"
        echo ""
        info "1. 重新安装"
        info "2. 修改配置"
        info "3. 显示客户端配置"
        info "4. sing-box基础操作"
        info "5. 一键开启bbr"
        info "6. warp解锁操作"
        info "7. hysteria2端口跳跃"
        info "8. 重启argo隧道"
        info "0. 卸载"
        hint "========================="
        echo ""
        read -p "请输入对应数字 (0-8): " choice

        case $choice in
          1)
              uninstall_singbox
            ;;
          2)
              #修改sb
              modify_singbox
              show_client_configuration
              exit 0
            ;;
          3)  
              show_client_configuration
              exit 0
          ;;	
          4)  
              process_singbox
              exit 0
              ;;
          5)
              enable_bbr
              exit 0
              ;;
          6)
              process_warp
              exit 0
              ;;
          7)
              process_hy2hopping
              exit 0
              ;;
          8)
              systemctl stop argo
              systemctl start argo
              echo "重新启动完成，查看新的客户端信息"
              show_client_configuration
              exit 0
              ;;
          0)
              uninstall_singbox
	            exit 0
              ;;
          *)
              echo "Invalid choice. Exiting."
              exit 1
              ;;
        esac
    else
        error "sing-box 未正确安装，请先运行安装脚本"
    fi
    exit 0
fi

# 作者介绍
print_with_delay "PakandAlive" 0.03
echo ""
echo ""
#install pkgs
install_pkgs
# Check if reality.json, sing-box, and sing-box.service already exist
if [ -f "/root/sbox/sbconfig_server.json" ] && [ -f "/root/sbox/config" ] && [ -f "/root/sbox/nowhash.sh" ] && [ -f "/usr/bin/nowhash" ] && [ -f "/root/sbox/sing-box" ] && [ -f "/etc/systemd/system/sing-box.service" ]; then
    echo ""
    warning "sing-box-reality-hysteria2已安装"
    show_status
    warning "请选择选项:"
    echo ""
    info "1. 重新安装"
    info "2. 修改配置"
    info "3. 显示客户端配置"
    info "4. sing-box基础操作"
    info "5. 一键开启bbr"
    info "6. warp解锁操作"
    info "7. hysteria2端口跳跃"
    info "8. 重启argo隧道"
    info "0. 卸载"
    hint "========================="
    echo ""
    read -p "请输入对应数字 (0-7): " choice

    case $choice in
      1)
          uninstall_singbox
        ;;
      2)
          #修改sb
          modify_singbox
          show_client_configuration
          exit 0
        ;;
      3)  
          show_client_configuration
          exit 0
      ;;	
      4)  
          process_singbox
          exit 0
          ;;
      5)
          enable_bbr
          exit 0
          ;;
      6)
          process_warp
          exit 0
          ;;
      7)
          process_hy2hopping
          exit 0
          ;;
      8)
          systemctl stop argo
          systemctl start argo
          echo "重新启动完成，查看新的客户端信息"
          show_client_configuration
          exit 0
          ;;
      0)
          uninstall_singbox
	        exit 0
          ;;
      *)
          echo "Invalid choice. Exiting."
          exit 1
          ;;
	esac
	fi

mkdir -p "/root/sbox/"

install_singbox
download_cloudflared

echo ""
echo ""
# reality
warning "开始配置Reality..."
echo ""
key_pair=$(/root/sbox/sing-box generate reality-keypair)
private_key=$(echo "$key_pair" | awk '/PrivateKey/ {print $2}' | tr -d '"')
public_key=$(echo "$key_pair" | awk '/PublicKey/ {print $2}' | tr -d '"')
info "生成的公钥为:  $public_key"
info "生成的私钥为:  $private_key"
reality_uuid=$(/root/sbox/sing-box generate uuid)
short_id=$(/root/sbox/sing-box generate rand --hex 8)
info "生成的uuid为:  $reality_uuid"
info "生成的短id为:  $short_id"
echo ""
reality_port=$(generate_port)
info "生成的端口号为: $reality_port"
reality_server_name="itunes.apple.com"
while :; do
    read -p "请输入需要偷取证书的网站，必须支持 TLS 1.3 and HTTP/2 (默认: $reality_server_name): " input_server_name
    reality_server_name=${input_server_name:-$reality_server_name}

    if curl --tlsv1.3 --http2 -sI "https://$reality_server_name" | grep -q "HTTP/2"; then
        break
    else
        echo "域名 $reality_server_name 不支持 TLS 1.3 或 HTTP/2，请重新输入."
    fi
done
info "域名 $reality_server_name 符合."
echo ""
echo ""
# hysteria2
warning "开始配置hysteria2..."
echo ""
hy_password=$(/root/sbox/sing-box generate rand --hex 8)
info "password: $hy_password"
echo ""
hy_port=$(generate_port)
info "生成的端口号为: $hy_port"
read -p "输入自签证书域名 (默认为: bing.com): " hy_server_name
hy_server_name=${hy_server_name:-bing.com}
mkdir -p /root/sbox/self-cert/ && openssl ecparam -genkey -name prime256v1 -out /root/sbox/self-cert/private.key && openssl req -new -x509 -days 36500 -key /root/sbox/self-cert/private.key -out /root/sbox/self-cert/cert.pem -subj "/CN=${hy_server_name}"
info "自签证书生成完成,保存于/root/sbox/self-cert/"
echo ""
echo ""
# vmess ws
warning "开始配置vmess"
echo ""
# Generate hysteria necessary values
vmess_uuid=$(/root/sbox/sing-box generate uuid)
vmess_port=$(generate_port)
info "生成的端口号为: $vmess_port"
read -p "ws路径 (无需加斜杠,默认随机生成): " ws_path
ws_path=${ws_path:-$(/root/sbox/sing-box generate rand --hex 6)}
info "生成的path为: $ws_path"
#get ip
server_ip=$(curl -s4m8 ip.sb -k) || server_ip=$(curl -s6m8 ip.sb -k)

#generate config
cat > /root/sbox/config <<EOF
# VPS ip
SERVER_IP='$server_ip'
# Reality
PUBLIC_KEY='$public_key'
# Hysteria2
HY_SERVER_NAME='$hy_server_name'
HY_HOPPING=FALSE
# Vmess
VMESS_PORT=$vmess_port
# Argo
ARGO_DOMAIN=''
# Warp
WARP_ENABLE=FALSE
# 1 2 3 4
WARP_MODE=1
# 0 局部分流 1 全局分流
WARP_OPTION=0
EOF

echo "设置argo"
cat > /etc/systemd/system/argo.service << EOF
[Unit]
Description=Cloudflare Tunnel
After=network.target

[Service]
Type=simple
NoNewPrivileges=yes
TimeoutStartSec=0
ExecStart=/bin/bash -c "/root/sbox/cloudflared-linux tunnel --url http://localhost:$vmess_port --no-autoupdate --edge-ip-version auto --protocol http2>/root/sbox/argo.log 2>&1 "
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target

EOF

systemctl daemon-reload
systemctl enable argo
systemctl start argo
systemctl restart argo

#generate singbox server config
cat > /root/sbox/sbconfig_server.json << EOF
{
  "log": {
    "disabled": false,
    "level": "info",
    "timestamp": true
  },
  "inbounds": [
    {
      "sniff": true,
      "sniff_override_destination": true,
      "type": "vless",
      "tag": "vless-in",
      "listen": "::",
      "listen_port": $reality_port,
      "users": [
        {
          "uuid": "$reality_uuid",
          "flow": "xtls-rprx-vision"
        }
      ],
      "tls": {
        "enabled": true,
        "server_name": "$reality_server_name",
        "reality": {
          "enabled": true,
          "handshake": {
            "server": "$reality_server_name",
            "server_port": 443
          },
          "private_key": "$private_key",
          "short_id": ["$short_id"]
        }
      }
    },
    {
        "sniff": true,
        "sniff_override_destination": true,
        "type": "hysteria2",
        "tag": "hy2-in",
        "listen": "::",
        "listen_port": $hy_port,
        "users": [
            {
                "password": "$hy_password"
            }
        ],
        "tls": {
            "enabled": true,
            "alpn": [
                "h3"
            ],
            "certificate_path": "/root/sbox/self-cert/cert.pem",
            "key_path": "/root/sbox/self-cert/private.key"
        }
    },
    {
        "sniff": true,
        "sniff_override_destination": true,
        "type": "vmess",
        "tag": "vmess-in",
        "listen": "::",
        "listen_port": $vmess_port,
        "users": [
            {
                "uuid": "$vmess_uuid",
                "alterId": 0
            }
        ],
        "transport": {
            "type": "ws",
            "path": "$ws_path",
            "max_early_data":2048,
            "early_data_header_name":"Sec-WebSocket-Protocol"
        }
    }
  ],
    "outbounds": [
        {
            "type": "direct",
            "tag": "direct"
        },
        {
            "type": "block",
            "tag": "block"
        }
    ]
}
EOF
# Create sing-box.service
cat > /etc/systemd/system/sing-box.service <<EOF
[Unit]
After=network.target nss-lookup.target

[Service]
User=root
WorkingDirectory=/root/sbox
CapabilityBoundingSet=CAP_NET_ADMIN CAP_NET_BIND_SERVICE CAP_NET_RAW
AmbientCapabilities=CAP_NET_ADMIN CAP_NET_BIND_SERVICE CAP_NET_RAW
ExecStart=/root/sbox/sing-box run -c /root/sbox/sbconfig_server.json
ExecReload=/bin/kill -HUP \$MAINPID
Restart=on-failure
RestartSec=10
LimitNOFILE=infinity

[Install]
WantedBy=multi-user.target
EOF


# Check configuration and start the service
if /root/sbox/sing-box check -c /root/sbox/sbconfig_server.json; then
    hint "check config profile..."
    systemctl daemon-reload
    systemctl enable sing-box > /dev/null 2>&1
    systemctl start sing-box
    systemctl restart sing-box
    install_shortcut
    show_client_configuration
    hint "输入nowhash,打开菜单"
else
    error "check sing-box server config profile error!"
fi

# 脚本执行完成
echo ""
info "脚本执行完成！"
echo ""
