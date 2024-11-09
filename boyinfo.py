# boyinfo.py
import requests
from telegram import Update
from telegram.ext import ApplicationBuilder, MessageHandler, filters, ContextTypes
import asyncio
import nest_asyncio
import logging
from telegram.error import Conflict, NetworkError
import re

# 配置日志记录
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# 启用嵌套事件循环
nest_asyncio.apply()

def escape_markdown(text):
    """转义 Markdown 特殊字符"""
    escape_chars = r'_*[]()~`>#+-=|{}.!'
    return re.sub(f'([{re.escape(escape_chars)}])', r'\\\1', str(text))

# 定义处理关键词 "info" 的函数
async def info(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    try:
        # 调用 API 获取随机身份证信息
        response = requests.get("https://api.pearktrue.cn/api/sfz/usa.php")
        data = response.json()

        # 检查 API 响应状态
        if data['code'] == 200:
            # 获取地址信息
            user_info = data['data']
            # 标题部分
            title = "🔍 美国身份信息\n"
            # 分隔线
            separator = "\-\-\-\-\-\-\-\-\-\-\-\-\n"
            # 信息内容
            content = (
                f"*姓名*\n`{escape_markdown(user_info['allname'])}`\n\n"
                f"*性别*\n`{escape_markdown(user_info['sex'])}`\n\n"
                f"*出生日期*\n`{escape_markdown(user_info['birthday'])}`\n\n"
                f"*地址*\n`{escape_markdown(f"{user_info['address']}, {user_info['city']}, {user_info['zipcode']}")}`\n\n"
                f"*州*\n`{escape_markdown(user_info['stateallname'])}`\n\n"
                f"*手机*\n`{escape_markdown(user_info['mobile'])}`\n\n"
                f"*社保号*\n`{escape_markdown(user_info['ssn'])}`\n\n"
                f"*信用卡类型*\n`{escape_markdown(user_info['cardtype'])}`\n\n"
                f"*信用卡号*\n`{escape_markdown(user_info['cardnumber'])}`"
            )
            
            message = f"{title}{separator}{content}"
        else:
            message = "获取信息失败，请稍后再试。"

        # 发送信息到 Telegram，使用 Markdown 格式
        await update.message.reply_text(message, parse_mode='MarkdownV2')
    except Exception as e:
        logger.error(f"Error in info handler: {e}")
        await update.message.reply_text("处理请求时发生错误，请稍后再试。")

async def main() -> None:
    try:
        # 创建 Application 对象并传入您的 Telegram 机器人令牌
        application = ApplicationBuilder().token("8057524104:AAHQce9gTP-hTKip0nmLRGQkwJOCHFz7ytY").build()

        # 注册关键词 "info" 的处理程序
        application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, info))

        # 启动机器人
        logger.info("Starting bot...")
        await application.run_polling(
            drop_pending_updates=True,  # 忽略之前的更新
            allowed_updates=Update.ALL_TYPES,
            close_loop=False
        )
    except Conflict as e:
        logger.error(f"Conflict error: {e}")
        await asyncio.sleep(5)  # 等待一段时间后重试
    except NetworkError as e:
        logger.error(f"Network error: {e}")
        await asyncio.sleep(5)  # 等待一段时间后重试
    except Exception as e:
        logger.error(f"Critical error: {e}")
        raise

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Bot stopped gracefully")
    except Exception as e:
        logger.error(f"Fatal error: {e}")
