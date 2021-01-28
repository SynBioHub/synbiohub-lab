import config from "synbiohub/config";
import * as theme from "synbiohub/theme";
import App from "synbiohub/app";
import db from "synbiohub/db";
import { fs } from "mz";



if(fs.existsSync('./data/synbiohub.sqlite') && config.get('firstLaunch') === true) {
    fs.unlinkSync('./data/synbiohub.sqlite')
}



if(!fs.existsSync('./data/synbiohub.sqlite')) {
    db.sequelize.sync({ force: true }).then(startServer)
} else {
    db.umzug.up().then(() => {
        startServer()
    })
}

function startServer() {

    return initSliver()
                .then(() => theme.setCurrentThemeFromConfig())
                .then(() => {

        var app = App()

        app.listen(parseInt(config.get('port')))
    })
}


function initSliver() {

    return new Promise((resolve, reject) => {

        // TODO
        resolve()


    })
}
