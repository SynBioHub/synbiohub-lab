
import pug = require('pug');
import config from 'synbiohub/config';
import * as theme from 'synbiohub/theme';
import updateLogo from 'synbiohub/actions/admin/updateLogo';
import updateWor from 'synbiohub/actions/admin/updateWor';

export default function(req, res) {
    if(req.method === 'POST') {
        post(req, res)
    } else {
        form(req, res)
    }
};


function form(req, res) {

    const currentTheme = theme.getCurrentTheme()

    const themeParameters = currentTheme.parameters.map((parameter) => {
        return {
            name: parameter.name,
            variable: parameter.variable,
            value: theme.getParameterValue(parameter)
        }
    })

	const locals = {
        config: config.get(),
        instanceName: config.get('instanceName'),
        frontPageText: config.get('frontPageText'),
        section: 'admin',
        adminSection: 'theme',
        user: req.user,
        currentTheme: currentTheme,
        themeParameters: themeParameters
    }
	
    res.send(pug.renderFile('templates/views/admin/theme.jade', locals))
}

async function post(req, res) {
    const currentTheme = theme.getCurrentTheme()

    const newParameters = {}

    currentTheme.parameters.map((parameter) => {

        const newParameter = req.body[parameter.variable]

        if(newParameter !== undefined) {
            if(newParameter !== parameter['default']) {
                newParameters[parameter.variable] = newParameter
            }
        }
    })

    const localConfig = config.getLocal()

    const themeName = theme.getCurrentThemeName()

    if(localConfig.themeParameters === undefined)
        localConfig.themeParameters = {}

    localConfig.themeParameters[themeName] = newParameters 

    config.setAll(localConfig)

    let publishUpdate = false;

    if(req.body.frontPageText != config.get('frontPageText')) {
        config.set('frontPageText', req.body.frontPageText)
        publishUpdate = true;
    }

    if(req.body.instanceName != config.get('instanceName')) {
        config.set('instanceName', req.body.instanceName)
        publishUpdate = true;
    }

    if(publishUpdate) {
        updateWor();
    }

    if(req.file) {
        updateLogo(req.file)
    }

    await theme.setCurrentThemeFromConfig()

    form(req, res)
}



