#!/bin/bash
###########

while true
do
 inotifywait --exclude .swp -e create -e modify -e delete -e move /nodeman_data
 nginx -t
 if [ $? -eq 0 ]
 then
  echo "Detected Nginx Configuration Change"
  echo "Executing: nginx -s reload"
  nginx -s reload
 fi
done