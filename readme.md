Add below code in .env file:-

JWT_SECRET=mysecret

MONGO_URI=mongodb+srv://darshan:darshan@codeeditor.sn3az0i.mongodb.net/?retryWrites=true&w=majority&appName=CodeEditor



command to install ssh in ubuntu:-

sudo apt install openssh-server -y

sudo systemctl start ssh

sudo systemctl enable ssh

sudo systemctl status ssh


command to install node and npm in ubuntu:-

sudo apt install nodejs -y

sudo apt install npm

check node and npm version:-

node -v

npm -v

if the node version is 12 or lower than execute below command to install uptodate node

curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

nvm install 20

nvm use 20

nvm alias default 20

to run the project (windows and ubuntu)

cd backend

npm install

node server.js


project will run at:-

http://localhost:3000 
