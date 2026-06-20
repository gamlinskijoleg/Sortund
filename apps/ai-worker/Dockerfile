FROM python:3.11-slim

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Create user
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

WORKDIR $HOME/app

# Install dependencies using uv
COPY --chown=user pyproject.toml uv.lock ./ 
RUN uv sync --frozen --no-install-project --no-dev

# Copy code
COPY --chown=user . .
RUN uv sync --frozen --no-dev

# Change port to 8000 (standard for local development)
EXPOSE 8000

# Run via uv run uvicorn
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]