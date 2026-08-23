FROM node:22-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    ca-certificates \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install latest yt-dlp + EJS challenge solver
RUN pip3 install --no-cache-dir -U "yt-dlp[default]" --break-system-packages

# Install Deno for YouTube JavaScript challenge solving
RUN curl -fsSL https://deno.land/install.sh | sh

ENV DENO_INSTALL="/root/.deno"
ENV PATH="${DENO_INSTALL}/bin:${PATH}"

# Fail the image build if a required runtime tool is missing.
RUN set -eux; \
    node --version; \
    python3 --version; \
    yt-dlp --version; \
    ffmpeg -version | sed -n '1p'; \
    deno --version | sed -n '1p'

WORKDIR /app

# Install Node dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy server
COPY index.js ./

# Render provides PORT dynamically
EXPOSE 3000

CMD ["node", "index.js"]
