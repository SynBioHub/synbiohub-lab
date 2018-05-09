

const pug = require('pug')
import db from 'synbiohub/db'
import config from 'synbiohub/config'

module.exports = function(req, res) {

    const token = req.params.token.trim()

    if(token.length === 0) {
        res.status(500).send('invalid token')
        return
    }

    let user = await db.model.User.findOne({

        where: {
            resetPasswordLink: token
        } 

    })

    if (!user) {
        res.status(500).send('bad token')
        return
    }

    req.session.user = user.id
    req.user = user

    var locals = {
        config: config.get(),
        section: 'enterNewPassword',
        nextPage: req.query.next || '/',
        user: req.user,
        token: token
    }

    res.send(pug.renderFile('templates/views/enterNewPassword.jade', locals))
}


