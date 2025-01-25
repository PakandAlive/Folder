import json
import uuid
import random
import string

def generate_hex_64():
    """生成64位十六进制字符串"""
    return ''.join(random.choices('0123456789abcdef', k=64))

def generate_uuid():
    """生成UUID格式字符串"""
    return str(uuid.uuid4())

def update_ids():
    # 配置文件路径
    file_path = '/Users/liuxiao/Library/Application Support/Cursor/User/globalStorage/storage.json'
    
    try:
        # 读取现有文件
        with open(file_path, 'r') as file:
            data = json.load(file)
        
        # 更新ID值
        data['telemetry.macMachineId'] = generate_hex_64()
        data['telemetry.machineId'] = generate_hex_64()
        data['telemetry.devDeviceId'] = generate_uuid()
        
        # 写回文件
        with open(file_path, 'w') as file:
            json.dump(data, file, indent=2)
            
        print('ID更新成功！')
        print(f'新的macMachineId: {data["telemetry.macMachineId"]}')
        print(f'新的machineId: {data["telemetry.machineId"]}')
        print(f'新的devDeviceId: {data["telemetry.devDeviceId"]}')
            
    except FileNotFoundError:
        print(f'错误：找不到文件 {file_path}')
    except json.JSONDecodeError:
        print('错误：文件格式不正确')
    except Exception as e:
        print(f'发生错误：{str(e)}')

if __name__ == '__main__':
    update_ids() 