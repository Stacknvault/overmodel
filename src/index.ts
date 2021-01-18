#!/usr/bin/env node
import YAML from 'yaml';
import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync } from "fs";
import properties from 'dot-properties';
import { dirname } from 'path';

// import Mustache from 'mustache';
interface Command {
    name: string;
    flags?: string[];
};
const validCommands:Command[] = [
    {
        name:'apply',
        flags: [
            'model-dir', 'config-dir', 'rule', 'accept'
        ],
    },
    {
        name:'help',
    },
];
const validConfigExtensions = ['json', 'yaml', 'properties'];
// const configFilesPrefix = '_overmodel/files';
// const configFilesStatePrefix = '_overmodel/.files';
const isCommandValid = (command) => validCommands.filter(c=>c.name===command).length===1;
const isFlagValid = (command, flag) => validCommands.filter(c=>c.name===command && c.flags && c.flags.filter(f=>f===flag).length>0).length===1;

const usage = () =>{
    // const openBrowser = require('react-dev-utils/openBrowser');
    console.log('Usage:\n');
    console.log('overmodel apply --model-dir <model directory 1> --model-dir <model directory 2> ... [--config-dir <config directory for the application you are configuring. It defaults to _overmodel] [--rule <rule name 1>=<rule value 1> --rule <rule name 2>=<rule value 2>, ...] [--accept <file to explicitly accept for configuration changes>]');
    console.log('\nTo get this help:\n');
    console.log('overmodel help');
    console.log('\nPlease visit https://www.npmjs.com/package/overmodel for more details\n');
}

let merge = (...objects: {}[]) => {
    let target = {};
    // Merge the object into the target object
    let merger = (obj) => {
        for (let prop in obj) {
          if (obj.hasOwnProperty(prop)) {
            if (Object.prototype.toString.call(obj[prop]) === '[object Object]'){
              // If we're doing a deep merge 
              // and the property is an object
              target[prop] = merge(target[prop], obj[prop]);
            } else {
              // Otherwise, do a regular merge
              target[prop] = obj[prop];
            }
           }
        }
    };
     //Loop through each object and conduct a merge
     for (let i = 0; i < objects.length; i++) {
        merger(objects[i]);
     }
       return target;
  };
const getOject = (str) => {
    // this turns the string into an array = 'one.two.three' becomes ['one', 'two', 'three']
    var arr = str.split('.');

    // this will be our final object
    var obj = {};

    // this is the current level of the object - in the first iteration we will add the "one" object here
    var curobj = obj;

    var i = 0;
    // we loop until the next-to-last element because we want the last element ("three") to contain an empty string instead of an empty object
    while (i < (arr.length-1)) {
        // add a new level to the object and set the curobj to the new level
        curobj[arr[i]] = {};
        curobj = curobj[arr[i++]];
    }
    // finally, we append the empty string to the final object
    curobj[arr[i]] = '';
    return obj;
}


var walk    = require('walk');

interface Arguments {
    model?: string[];
    rule?: string[];
    accept?: string[];
    _: string[];
}
interface ModelFile {
    root: string;
    file: string;
}
interface RenderResult {
    missingVariables: string[];
    contentsRendered: string;
}
function ensureDirectoryExistence(filePath) {
    var dName = dirname(filePath);
    if (existsSync(dName)) {
      return true;
    }
    ensureDirectoryExistence(dName);
    mkdirSync(dName);
  }
const walkDir = async (path: string) => {
    return new Promise((resolve, reject)=>{
        var files:string[] = [];
        const walker = walk.walk(path, { followLinks: true });
        walker.on('file', (root, stat, next) => {
            // Add this file to the list of files
            files.push(`${root}/${stat.name}`);
            next();
        });
        walker.on('end', function() {
           resolve(files);
        });
    });   
}
const parseProperties = (contents: string) => {
    const parsedFile=properties.parse(contents);
    var result={}
    Object.keys(parsedFile).map(key=>{
        const newKey = key + (key.indexOf('_metadata')<0?'.value':'');
        var obj = getOject(newKey);
        eval(`obj.${newKey}=\"${parsedFile[key]}\"`)
        result=merge(result, obj);
    });
    return result;
}
async function getModelFiles(modelDirs: string[]) {
    return (await Promise.all(modelDirs.map(async (modelDir: string) => {
        const files = await walkDir(modelDir) as string[];
        return files.map((file: string) => ({ root: modelDir, file: file.substring(modelDir.length + 1) } as ModelFile));
    }))).flatMap(item => item)
        .sort((item1, item2) => {
            const file1 = item1 as ModelFile;
            const file2 = item2 as ModelFile;
            const depth1 = file1.file.split('/').length - 1;
            const depth2 = file2.file.split('/').length - 1;
            if (depth1 !== depth2) {
                return depth1 - depth2;
            }
            return file1.file.localeCompare((item2 as ModelFile).file);
        }) as ModelFile[];
}
async function getConfigurationFiles(configDir: string) {
    return  await walkDir(`${configDir}/files`) as string[];
}
function getConfiguration(files: ModelFile[], rules: string[]) {
    return files
        .filter(item => {
            // we see if the rules apply
            var remainingFile = (item as ModelFile).file;
            if (remainingFile.indexOf('/') < 0) {
                return true;
            }
            rules.map((rule: string) => {
                remainingFile = remainingFile.replace(rule.replace(/=/gi, '/'), '');
            });
            const matches = remainingFile.startsWith('.') && validConfigExtensions.filter(item => item === remainingFile.substring(1)).length > 0;
            return matches;
        })
        .map((file) => {
            const modelFile = file as ModelFile;
            return (modelFile.file.endsWith('json') && JSON.parse(readFileSync(`${modelFile.root}/${modelFile.file}`, 'utf-8')))
                || (modelFile.file.endsWith('yaml') && YAML.parse(readFileSync(`${modelFile.root}/${modelFile.file}`, 'utf-8')))
                || (modelFile.file.endsWith('properties') && parseProperties(readFileSync(`${modelFile.root}/${modelFile.file}`, 'utf-8')))
                || {};
        })
        .reduce((previous, current) => merge(previous, current));
}

function renderContent(contents: string, configuration):RenderResult {
    var missingVariables:string[] = [];
    var contentsRendered = contents;
    // console.log('contents', contents);
    const configMatches = (contents.match(/\{{([^}]+)\}}/g) || []).filter((value, index, self) => self.indexOf(value) === index); // filtering unique
    configMatches.map((match) => {
        // this match is like {{foo.bar}}
        const variable = (match.match(/\{{([^}]+)\}}/) || [''])[1];
        var value = '';
        const toEval = `value=configuration.${variable}.value`;
        // console.log('toEval', toEval);
        try{
            eval(toEval);
        }catch (e){}
        // we recursively decode the value itself too
        var depth=0;
        while (depth<10 && value.match(/\{{([^}]+)\}}/g)){
            const valueRender = renderContent(value, configuration);
            if (valueRender.missingVariables.length > 0){
                missingVariables.push(...valueRender.missingVariables);
                break;
            }else{
                value = valueRender.contentsRendered;
            }
            depth++; 
        }
        // END we recursively decode the value itself too
        if (value) {
            try{
                eval(`contentsRendered = contentsRendered.replace(/${match}/gi, value)`);
            }catch (e){}
        } else {
            // console.error(`Variable ${variable} not decoded`);
            missingVariables.push(variable);
        }
    });
    return {missingVariables, contentsRendered};
}

function configureFile(configDir: string, file: string, configuration):boolean {
    const contents = readFileSync(file, 'utf-8');
    const {missingVariables, contentsRendered} = renderContent(contents, configuration);
    if (missingVariables.length>0){
        console.log('contentsRendered', contentsRendered);
        console.error(`Can't configure ${file}. The following variables are't decoded for the given rules: `, JSON.stringify(missingVariables));
        return false;
    }
    const targetFile = file.substring(`${configDir}/files/`.length);
    writeFileSync(targetFile, contentsRendered);
    return true;
    
}
const help = async (args: Arguments) => {
    usage();
}
const apply = async (args: Arguments) => {
    var rules = args.rule||[];
    rules = typeof rules === 'string'?[rules]:rules;
    var modelDirs = args['model-dir'];
    modelDirs = typeof modelDirs === 'string'?[modelDirs]:modelDirs;
    if (!modelDirs || modelDirs.length === 0){
        console.error('No model directories given');
        return -1;
    }
    var configDir = args['config-dir'];
    if (!configDir){
        console.log('No config directory given. Defaulting to _overmodel');
        configDir = '_overmodel';
    }
    var accepts = args.accept||[]; // the list of files we accept
    accepts = typeof accepts === 'string'?[accepts]:accepts;
    const modelFiles = await getModelFiles(modelDirs);
    //console.log('modelfiles', JSON.stringify({modelDirs, modelFiles}, null, 2));
    const configuration = await getConfiguration(modelFiles, rules);
    // console.log(JSON.stringify(configuration, null, 2));

    // now we have the configuration, we need to deal with all the configuration files
    const configurationFiles = await getConfigurationFiles(configDir);
    // let's see if we can compute the hashes
    var issues = configurationFiles.map(file=>{
        const targetFile = `${file.substring(`${configDir}/files/`.length)}`;
        // console.log(`checking if ${previousFile} exists`);
        if (!existsSync(targetFile)){
            console.error(`The target file ${targetFile} doesn't even exist!!`)
            return false;
        }
        return true;
    }).filter(result => !result).length;
    if (issues > 0){
        return -2;
    }
    // END let's see if we can compute the hashes
    // console.log('configurationFiles', configurationFiles);
    issues = configurationFiles.map(file=>{
        const previousFile = `${configDir}/.files/${file.substring(`${configDir}/files/`.length)}`;
        // console.log('previous file', previousFile)
        const targetFile = `${file.substring(`${configDir}/files/`.length)}`;
        const accepted = accepts.filter(item=>item===targetFile).length>0
        // console.log('target file', targetFile)
        // console.log(`checking if ${previousFile} exists`);
        if (!existsSync(previousFile)){
            console.warn(`There is no previous track of the file ${file}`);
        }else {
            const previousFileContents = readFileSync(previousFile, 'utf-8');
            const targetFileContents = readFileSync(targetFile, 'utf-8');
            if (targetFileContents !== previousFileContents && !accepted){
                // let's see if we're accepting the file
                console.error(`The contents of ${targetFile} changed since last time configuration was applied. Can't continue. Please model that file afain under ${configDir}/files`)
                require('colors');
                const Diff = require('diff');
                const diff = Diff.diffChars(previousFileContents, targetFileContents);
                diff.forEach((part) => {
                    // green for additions, red for deletions
                    // grey for common parts
                    const color = part.added ? 'green' :
                      part.removed ? 'red' : 'grey';
                    process.stderr.write(part.value[color]);
                  });
                console.log();
                return false;
            }
        }
        ensureDirectoryExistence(previousFile);
        // if accepted we copy after, otherwise we do it before
        if (!accepted){
            copyFileSync(targetFile, previousFile);
        }
        const ret = configureFile(configDir, file, configuration);
        if (accepted){
            copyFileSync(targetFile, previousFile);
        }
        return ret;
    }).filter(result => !result).length;
    if (issues > 0){
        return -2;
    }
    return 0;
}
const overmodel = async () => {
    
    var args = require('minimist')(process.argv.slice(2)) as Arguments;
    if (args._.length===0){
      console.error('Command is missing');
      usage();
      return;
    }
    const command=args._[0];
    // console.log('args', args);

    if (!isCommandValid(command)){
        console.error('Invalid command');
        usage();
        return;
    }
    Object.keys(args).map(key=>{
        if (key!=='_'){
            if (!isFlagValid(command, key)){
                console.error( `invalid flag --${key} for the ${command} command`);
                usage();
                process.exit(-3);
            }
        }
    })
    const ret = await eval(command)(args);
    if (ret != 0){
        console.error(`There were errors executing ${command} (error ${ret})`);
        process.exit(ret);
    }else{
        console.log('Configuration successfully applied');
    }
}
overmodel();

