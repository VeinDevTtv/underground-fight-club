fx_version 'cerulean'
game 'gta5'

name 'underground-fight-club'
description 'A standalone underground fighting club script with framework integration'
author 'Claude AI'
version '1.0.0'

lua54 'yes'

ui_page 'web/index.html'

shared_scripts {
    '@ox_lib/init.lua',
    'dist/shared/*.js'
}

client_scripts {
    'dist/client/*.js'
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'dist/server/*.js'
}

files {
    'web/**/*',
    'locales/*.json'
}

dependencies {
    'ox_lib'
} 