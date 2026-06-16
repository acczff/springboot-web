# 第一阶段：构建前端
FROM node:20-alpine AS builder
WORKDIR /build

# 利用层缓存：先复制 package.json 下载依赖
COPY package.json package-lock.json ./
RUN npm ci

# 复制源码并构建
COPY . .
RUN npm run build

# 第二阶段：用 Nginx 托管构建产物
FROM nginx:alpine
# 把构建好的前端文件复制到 Nginx 的默认目录
COPY --from=builder /build/dist /usr/share/nginx/html
# 用我们自己的 Nginx 配置替换默认配置
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
