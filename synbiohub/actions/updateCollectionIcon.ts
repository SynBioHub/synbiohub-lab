
const fs = require('fs')
import config from 'synbiohub/config'
const extend = require('xtend')

import getUrisFromReq from 'synbiohub/getUrisFromReq'
import DefaultMDFetcher from 'synbiohub/fetch/DefaultMDFetcher';

import pug = require('pug')

export default async function (req, res) {

    const { graphUri, uri, designId } = getUrisFromReq(req)

    let ownedBy = await DefaultMDFetcher.get(req).getOwnedBy(uri)

    if (ownedBy.indexOf(config.get('databasePrefix') + 'user/' + req.user.username) === -1) {
        //res.status(401).send('not authorized to edit this submission')
        const locals = {
            config: config.get(),
            section: 'errors',
            user: req.user,
            errors: ['Not authorized to remove this submission']
        }
        res.send(pug.renderFile('templates/views/errors/errors.jade', locals))
    }

    if (req.file) {
        let iconFile = req.file

        var collectionIcons = config.get('collectionIcons')
        const iconFilename = 'public/local/' + iconFile.originalname

        fs.writeFileSync(iconFilename, iconFile.buffer)

        collectionIcons = extend(collectionIcons, {
            [req.body.collectionUri]: '/local/' + iconFile.originalname
        })

        config.set('collectionIcons', collectionIcons)
    }

    res.redirect(req.body.collectionUrl)
}

