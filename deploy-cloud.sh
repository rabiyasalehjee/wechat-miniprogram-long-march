#!/bin/bash
BUILD="./unpackage/dist/dev/mp-weixin"

# Copy cloud functions
cp -rf ./cloudfunctions "$BUILD/cloudfunctions"

# Ensure private config has cloudfunctionRoot + env (survives HBuilder rebuilds)
node -e "
const fs = require('fs');
const path = '$BUILD/project.private.config.json';
const cfg = JSON.parse(fs.readFileSync(path, 'utf8'));
cfg.cloudfunctionRoot = 'cloudfunctions/';
cfg.envList = [{ envId: 'cloud1-1gs1ugxif2016ac5', alias: 'cloud1' }];
fs.writeFileSync(path, JSON.stringify(cfg, null, 2));
console.log('Done — now right-click getSteps in WeChat DevTools → Upload and Deploy');
"
