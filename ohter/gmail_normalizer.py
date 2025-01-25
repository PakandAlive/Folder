def generate_gmail_aliases(email):
    """
    生成Gmail邮箱的所有可能别名
    
    Args:
        email (str): 基础Gmail邮箱地址
        
    Returns:
        set: 所有可能的别名邮箱集合
    """
    if not isinstance(email, str) or '@' not in email:
        raise ValueError("无效的邮箱地址")
    
    # 分离用户名和域名
    username, domain = email.lower().split('@')
    
    if domain != 'gmail.com':
        raise ValueError("请输入Gmail邮箱地址")
    
    aliases = set()
    
    # 1. 生成所有可能的点号组合
    username_length = len(username)
    # 获取所有可能的点号位置组合
    from itertools import combinations
    
    for i in range(username_length):
        # 获取所有可能的i个点号的位置组合
        for positions in combinations(range(1, username_length), i):
            # 在指定位置插入点号
            new_username = list(username)
            offset = 0
            for pos in positions:
                new_username.insert(pos + offset, '.')
                offset += 1
            aliases.add(f"{''.join(new_username)}@gmail.com")
            # 同时为googlemail.com生成别名
            aliases.add(f"{''.join(new_username)}@googlemail.com")
    
    # 2. 添加原始域名的版本
    aliases.add(f"{username}@gmail.com")
    aliases.add(f"{username}@googlemail.com")
    
    # 3. 添加一些常用的+后缀组合
    common_suffixes = ['spam', 'important', 'work', 'personal', 'social']
    for suffix in common_suffixes:
        # 无点号版本
        aliases.add(f"{username}+{suffix}@gmail.com")
        aliases.add(f"{username}+{suffix}@googlemail.com")
        
        # 带点号版本（使用第一个点号位置的版本作为示例）
        if username_length > 1:
            dotted_name = username[:1] + '.' + username[1:]
            aliases.add(f"{dotted_name}+{suffix}@gmail.com")
            aliases.add(f"{dotted_name}+{suffix}@googlemail.com")
    
    return aliases

def main():
    try:
        email = input("请输入基础Gmail邮箱地址（例如：abcdef@gmail.com）：")
        aliases = generate_gmail_aliases(email)
        print(f"\n为 {email} 生成的所有可能别名：")
        for i, alias in enumerate(aliases, 1):
            print(f"{i}. {alias}")
        print(f"\n总共生成了 {len(aliases)} 个别名邮箱地址")
    except Exception as e:
        print(f"错误：{str(e)}")

if __name__ == "__main__":
    main() 
