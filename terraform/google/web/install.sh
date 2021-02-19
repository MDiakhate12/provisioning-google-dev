apt update && \
    apt install nginx && \
    curl -fsSL https://deb.nodesource.com/setup_14.x | sudo -E bash - && \
    apt-get install -y nodejs && \
    npm install pm2 -g 