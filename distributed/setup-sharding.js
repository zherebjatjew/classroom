#!/bin/sh

mongo localhost:27000/admin --eval 'db.runCommand({addshard: "192.168.50.11:27101"}); db.runCommand({addshard: "192.168.50.12:27101"}); db.runCommand({enablesharding : "mydb"}); db.runCommand({shardcollection : "mydb.users", key: {name:1}});'

