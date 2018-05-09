
import config from './config';
import * as fs from 'mz/fs';
import * as path from 'path'

var themeName
var themePath
var theme

export function setCurrentThemeFromConfig() {

    themeName = config.get('theme')
    themePath = path.normalize('./themes/' + themeName)

    return fs.readFile(themePath + '/theme.json').then((res) => {

        theme = JSON.parse(res + '')

    }).then(generateLess)

}

export function getCurrentTheme() {

    return theme

}

export function getCurrentThemeName() {

    return themeName

}

export function generateLess() {

    const outputPath = './public/styles/theme'

    return unlinkOldFiles()
                .then(symlinkNewFiles)
                .then(generateParameters)

    function unlinkOldFiles() {

        return new Promise((resolve, reject) => {
            
            fs.unlink(outputPath + '/before.less')
                    .then(() => fs.unlink(outputPath + '/after.less'))
                    .then(() => fs.unlink(outputPath + '/parameters.less'))
                    .then(() => resolve())
                    .catch((e) => resolve())

        })
                
    }

    function symlinkNewFiles() {
    
        return fs.symlink(themePath + '/less/after.less', outputPath + '/after.less')
                     .then(() => fs.symlink(themePath + '/less/before.less', outputPath + '/before.less'))

    }

    function generateParameters() {

        const lines = [
            '/* Generated by SynBioHub. Modify in config.local.json, not in this file. */',
            ''
        ]

        theme.parameters.forEach((param) => {

            const value = getParameterValue(param)

            lines.push('@' + param.variable + ': ' + value + ';')
            
        })

        lines.push('', '')

        return fs.writeFile(outputPath + '/parameters.less', lines.join('\n'))

    }
}

export function getParameterValue(param) {

    const configParameters = config.get('themeParameters')[themeName] || {}

    var value = configParameters[param.variable]

    if(value === undefined)
        value = param['default']

    return value

}


