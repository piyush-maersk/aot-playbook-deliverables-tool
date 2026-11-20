import os

bind = f"0.0.0.0:{os.getenv('PORT', '8080')}"
workers = int(os.getenv("WEB_CONCURRENCY", "2"))
worker_class = "uvicorn.workers.UvicornWorker"
timeout = 60
graceful_timeout = 30
max_requests = 2000
max_requests_jitter = 200
accesslog = "-"
