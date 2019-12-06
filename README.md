# TypeScript Style Hook Plugin

TypeScript server plugin that adds intellisense to [style hook](https://github.com/style-hook/style-hook) css strings


## develop
```shell
# install dependencies
yarn
yarn link
cd e2e
yarn link typescript-style-hook-plugin
yarn
cd ..
# compile ts to js
yarn watch:compile
# open another terminal session to do some test
yarn jest --watch
```
