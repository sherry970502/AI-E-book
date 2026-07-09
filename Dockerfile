# 自定义构建镜像——绕开 Zeabur 默认 Nixpacks，解决 better-sqlite3 原生二进制
# 在 Nix 环境下装不出可加载 .node 的问题（Could not locate the bindings file）。
# 标准 Debian(glibc) 基础镜像 + 构建工具，npm ci 时 prebuild-install 拉取或
# 现场编译 better-sqlite3，与运行时同镜像同 Node，二进制必然匹配。
FROM node:22-bookworm-slim

WORKDIR /src

# better-sqlite3 若无对应 prebuilt 会退回 node-gyp 源码编译，需要这些工具
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# 先只装依赖（利用缓存）。npm ci 默认执行 install 脚本 → 装好 better-sqlite3 原生二进制
COPY package.json package-lock.json ./
RUN npm ci

# 再拷源码（node_modules/.next/*.db 已由 .dockerignore 排除，不会覆盖上面装好的依赖）
COPY . .

RUN npm run build

ENV NODE_ENV=production
# next start 读取 PORT 环境变量；Zeabur 会注入 PORT，容器监听该端口
EXPOSE 3000
CMD ["npm", "run", "start"]
