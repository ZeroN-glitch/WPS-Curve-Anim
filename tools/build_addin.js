// 在线构建：等价于 wpsjs build 选「在线插件」，但不需要交互
process.chdir(require('path').join(__dirname, '..', 'addin'))
const { buildWithArgs } = require('../node_modules/wpsjs/src/lib/build.js')

buildWithArgs({ pluginType: 'online' })
    .then(() => console.log('在线构建完成 -> addin/wps-addon-build/'))
    .catch(e => { console.error('构建失败:', e); process.exit(1) })
