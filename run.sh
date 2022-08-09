#!/bin/bash
docker build -t wsbstonks_server .
docker run -d -p 8085:8085 -e "PORT=8085" --network=proxy --ip="172.23.0.5" -v /mnt/user/mycontainers/wsbstonks/server:/src --name wsbstonks_server wsbstonks_server
