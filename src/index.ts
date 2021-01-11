import fs from 'fs';
import YAML from 'yaml';

const parseJSON = async () => {
    const rawData = fs.readFileSync('test/config/model/test.json', 'utf8');
    const config = JSON.parse(rawData);
    console.log(config);
    const mustache = require("mustache");
    console.log(mustache.render('{{host.name.value}}', config));
}

const parseYAML = async () => {
    const rawData = fs.readFileSync('test/config/model/test.yaml', 'utf8');
    const config = YAML.parse(rawData);
    console.log(config);
    const mustache = require("mustache");
    console.log(mustache.render('{{host.name.value}}', config));
}

parseJSON();
parseYAML();