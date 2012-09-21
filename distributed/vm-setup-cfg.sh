#!/bin/sh

#apt-get install -y mongodb
sh /vagrant/dist/mongodb/bin/install

# Create configuration server
mkdir -p /data/config
mkdir -p /var/log/mongodb
mongod --configsvr --rest --logpath /var/log/mongodb/configsvr.log --port 27100 --dbpath /data/config &

