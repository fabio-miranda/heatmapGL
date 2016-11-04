#!/bin/bash
#fuser -k 8080/tcp
lsof -i tcp:8080 | awk '/pypy|python|Python/{print $2}' | xargs kill -9
