import YAML from 'yaml';

import { readFileSync, readdirSync, fstat } from "fs";
import properties from 'dot-properties';

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

const validCommands = ['apply'];
const validConfigExtensions = ['json', 'yaml', 'properties'];
const isCommandValid = (command) => validCommands.filter(c=>c===command).length===1;

var walk    = require('walk');

interface Arguments {
    model: string[];
    rule: string[];
    _: string[];
}
interface ModelFile {
    root: string;
    file: string;
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
const apply = async (args: Arguments) => {
    const modelDirs = args['model-dir'];
    const rules = args.rule||[];
    if (!modelDirs || modelDirs.length === 0){
        console.error('No model directories given');
        return;
    }
    const files = (await Promise.all(modelDirs.map(async (modelDir: string)=>{
        const files = await walkDir(modelDir) as string[];
        return files.map((file: string)=>({root: modelDir, file: file.substring(modelDir.length+1)} as ModelFile));
    }))).flatMap(item=>item)
    .sort((item1, item2) => {
        const file1 = item1 as ModelFile;
        const file2 = item2 as ModelFile;
        const depth1 = file1.file.split('/').length -1;
        const depth2 = file2.file.split('/').length -1;
        if (depth1 !== depth2){
            return depth1 - depth2
        }
        return file1.file.localeCompare((item2 as ModelFile).file)
    });
    const configuration = files
    .filter(item=>{
        // we see if the rules apply
        var remainingFile=(item as ModelFile).file;
        if (remainingFile.indexOf('/')<0){
            return true;
        }
        rules.map((rule:string)=>{
            remainingFile=remainingFile.replace(rule.replace(/=/gi, '/'), '');
        });
        const matches = remainingFile.startsWith('.') && validConfigExtensions.filter(item=>item===remainingFile.substring(1)).length>0;
        return matches;
    })
    .map((file)=>{
        const modelFile=file as ModelFile;
        return (modelFile.file.endsWith('json') && JSON.parse(readFileSync(`${modelFile.root}/${modelFile.file}`, 'utf-8')))
            || (modelFile.file.endsWith('yaml') && YAML.parse(readFileSync(`${modelFile.root}/${modelFile.file}`, 'utf-8')))
            || (modelFile.file.endsWith('properties') && parseProperties(readFileSync(`${modelFile.root}/${modelFile.file}`, 'utf-8')))
            || {};
    })
    .reduce((previous, current)=>merge(previous, current));
    console.log(JSON.stringify(configuration, null, 2));
}
const ubermodel = () => {
    const usage = () =>{
        console.log('This is how you use this:')
    }
    
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
    eval(command)(args);
}
ubermodel();
