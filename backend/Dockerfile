FROM python:3.12-alpine

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=8080 WEB_CONCURRENCY=2
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY gunicorn.conf.py .

RUN adduser -D -u 1000 appuser && mkdir -p /app/uploads && chown -R appuser /app
USER 1000

EXPOSE 8080
CMD ["gunicorn", "app.main:app", "-c", "gunicorn.conf.py"]
