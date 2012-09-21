#!/bin/sh

apt-get update
iptables -I INPUT -p tcp --dport 28101 -j ACCEPT
iptables -I INPUT -p tcp --dport 27101 -j ACCEPT
#service iptables save
iptables-save > /etc/network/iptables
echo "iptables-apply /etc/network/iptables" > /etc/network/if-pre-up.d/iptables

# Too old
#apt-get install -y mongodb
sh /vagrant/dist/mongodb/bin/install

#sudo sed -i 's/^\s*bind_ip\s*=\s*.*$/bind_ip = 0.0.0.0/' /etc/mongodb.conf
#service mongodb restart

mkdir -p /data/mydb
mkdir -p /var/log/mongodb/shard
mongod --shardsvr --dbpath /data/mydb --logpath /var/log/mongodb/shard/mongo.log --port 27101 &

