FROM node:22-slim

# ---------------------------------------------------------
# System dependencies
# ---------------------------------------------------------
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    ca-certificates \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------
# Install Deno
# Required by yt-dlp for YouTube JavaScript challenges
# ---------------------------------------------------------
RUN curl -fsSL https://deno.land/install.sh | sh

ENV DENO_INSTALL=/root/.deno
ENV PATH="${DENO_INSTALL}/bin:${PATH}"

# ---------------------------------------------------------
# Application
# Copy application inputs before installing yt-dlp so code changes invalidate
# this layer and refresh yt-dlp instead of silently reusing an old version.
# ---------------------------------------------------------
WORKDIR /app
COPY package*.json ./
COPY index.js ./

# ---------------------------------------------------------
# Install yt-dlp
# ---------------------------------------------------------
RUN pip3 install --no-cache-dir -U "yt-dlp[default]" --break-system-packages

# ---------------------------------------------------------
# Verify runtime dependencies during image build
# ---------------------------------------------------------
RUN set -eux; \
    node --version; \
    python3 --version; \
    yt-dlp --version; \
    ffmpeg -version | sed -n '1p'; \
    deno --version | sed -n '1p'

# Install Node dependencies after copying manifests for Docker layer caching.
RUN npm install --omit=dev

# Northflank/Render supplies PORT at runtime.
# 3000 is the fallback defined in index.js.
EXPOSE 3000

# Start server
CMD ["node", "index.js"]
