import os
from celery import Celery
from django.conf import settings

# 设置默认的 Django 设置模块
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'media_manager.settings')

# 创建 Celery 应用实例
app = Celery('media_manager')

# 从 Django 设置中加载配置，使用 CELERY 前缀
app.config_from_object('django.conf:settings', namespace='CELERY')

# 自动发现所有已安装应用中的任务
app.autodiscover_tasks()

@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """调试任务"""
    print(f'Request: {self.request!r}')