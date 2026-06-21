FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt requirements-rag.txt ./
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir chromadb>=0.5 && \
    pip install --no-cache-dir sentence-transformers>=2.7 --extra-index-url https://download.pytorch.org/whl/cpu

COPY app ./app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]