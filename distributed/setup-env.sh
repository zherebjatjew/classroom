#!/bin/sh

# Create router
mongos --configdb 192.168.50.10:27100 --port 27000 --logpath /var/log/mongodb/configdb.log &
