# Використовуємо офіційний легкий образ Python
FROM python:3.11-slim

# 1. Встановлюємо системні залежності для обробки аудіо (потрібно для librosa)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# 2. Створюємо безпечного користувача (Hugging Face вимагає UID 1000)
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

WORKDIR $HOME/app

# 3. Копіюємо requirements.txt та встановлюємо залежності
# Робимо це окремим кроком, щоб Docker кешував шари і збірка йшла швидше
COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 4. Копіюємо весь інший код аппки
# (Нагадую, завдяки нашому CI скрипту, сюди потрапить ТІЛЬКИ вміст папки apps/ai-worker)
COPY --chown=user . .

# 5. Відкриваємо порт 7860 (дефолтний порт для Hugging Face Spaces)
EXPOSE 7860

# 6. Запускаємо FastAPI сервер через uvicorn
# Вказуємо порт 7860 і хост 0.0.0.0
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]