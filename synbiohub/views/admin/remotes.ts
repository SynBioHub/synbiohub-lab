
import pug from 'pug';
import * as sparql from 'synbiohub/sparql/sparql';
import db from 'synbiohub/db';
import config from 'synbiohub/config';
import { getSnapshots } from 'synbiohub/snapshots';

export default function(req, res) {

    const remotesConfig = config.get('remotes')

    const remotes = Object.keys(remotesConfig).map((id) => remotesConfig[id])

    var locals = {
        config: config.get(),
        section: 'admin',
        adminSection: 'remotes',
        user: req.user,
        remotes: remotes,
        remoteTypes: ['ice', 'benchling'],
    }

    res.send(pug.renderFile('templates/views/admin/remotes.jade', locals))

};

