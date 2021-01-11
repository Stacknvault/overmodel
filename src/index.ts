// import fs from 'fs';
// import YAML from 'yaml';

// const parseJSON = async () => {
//     const rawData = fs.readFileSync('test/config/model/test.json', 'utf8');
//     const config = JSON.parse(rawData);
//     console.log(config);
//     const mustache = require("mustache");
//     console.log(mustache.render('{{host.name.value}}', config));
// }

// const parseYAML = async () => {
//     const rawData = fs.readFileSync('test/config/model/test.yaml', 'utf8');
//     const config = YAML.parse(rawData);
//     console.log(config);
//     const mustache = require("mustache");
//     console.log(mustache.render('{{host.name.value}}', config));
// }

// const object1 = {
//     name: 'Flavio',
//     foo: {
//         bar: 'hey',
//         baz: 'meh',
//     }
//   }
  
//   const object2 = {
//     age: 35,
//     foo: {
//         bar: 'hooo',
//         pla: 'mik',
//     }
//   }
  
//   // Merge a `source` object to a `target` recursively
//   const merge = (target, source) => {
//     // Iterate through `source` properties and if an `Object` set property to merge of `target` and `source` properties
//     for (const key of Object.keys(source)) {
//       if (source[key] instanceof Object) Object.assign(source[key], merge(target[key], source[key]))
//     }
  
//     // Join `target` and modified `source`
//     Object.assign(target || {}, source)
//     return target
//   }
  
//   const object3 = merge(object1, object2);
  
  

// parseJSON();
// parseYAML();

console.log('Just a hello world');