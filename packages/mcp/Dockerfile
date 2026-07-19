FROM node:22-alpine
WORKDIR /app
RUN npm install -g courseforge-mcp
ENV CANVAS_BASE_URL=""
EXPOSE 3980
# HTTP mode: token arrives per-request via X-Canvas-Token; CANVAS_BASE_URL must be set at run time.
CMD ["courseforge-mcp", "--http", "3980"]
