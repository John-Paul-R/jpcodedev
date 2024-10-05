#!/bin/bash
. .ports
fuser -k $www/tcp $static/tcp
