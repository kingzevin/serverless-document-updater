#!/bin/bash

rm -rf *.zip
zip -r ${1}.zip * &> /dev/null
wsk -i action update $1 ${1}.zip --kind  nodejs:10 --web true
wsk -i action invoke $1 -b
