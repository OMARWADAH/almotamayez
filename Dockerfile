FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
# مساحة دائمة واحدة تحمل قاعدة البيانات والصور المرفوعة
ENV NODE_ENV=production DATA_DIR=/data/db UPLOADS_DIR=/data/uploads PORT=3000
VOLUME ["/data"]
EXPOSE 3000
CMD ["node", "server.js"]
