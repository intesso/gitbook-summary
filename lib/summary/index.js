var _ = require("lodash");
var color = require('bash-color');
var fs = require('fs');
var path = require('path');
var async = require('async');

var bookJson = require('../bookJson');
var utils = require('../utils');
var readFile = require('../files');

/**
 * Get a summary from a fold such as `/path/to/your/book` or `../book`
 * @param root root
 */

// Give some variables
var root,
  bookname, // don`t use `name`?
  outputFile,
  catalog,
  ignores,
  unchanged,
  prettify,
  strip,
  sort;

// Get options
function init(options) {
  root = options.root || '.';
  var bookConfig = bookJson(root);
  utils.rewrite(options, bookConfig);

  outputFile = bookConfig.outputfile;
  catalog = bookConfig.catalog;
  ignores = bookConfig.ignores;
  unchanged = bookConfig.unchanged;
  bookname = bookConfig.bookname;
  prettify = bookConfig.prettify;
  strip = bookConfig.strip;
  sort = bookConfig.sort;
}

// Get summary
function Summary(options) {
  console.log('options', options);
  var result = '',
    desc = '',
    step = 0,
    skip = null,
    filesObj;

   async.auto({
        init: function(next) {
            init(options);

            // Ignore the outputFile, for example `SUMMARY`
            ignores.push(_.trim(outputFile, '.md'));

            next();
        },

        files: ['init', function(next) {
            filesObj = getFiles(root);
            if(filesObj){
                next();
            }else{
                next(color.red("Sorry, something is going wrong or no markdowns."));
            }
        }],

        parse: ['files', function(next) {
            work(filesObj);
            next();
        }],

        write: ['parse', function(next) {
            bookname = "# " + bookname + "\n\n";
            result += bookname + desc;

            writeFile(outputFile, result);
        }]
    }, function(err, results) {
        console.log(err);
  });

  function work(filesObj) {
    _.forEach(filesObj, function(n, key) {
      if (!_.includes(ignores, key)) {
        if (_.isObject(n)) {

          // It means folderName == subFileName, for example: */assets/assets.md or */Assets/assets.md
          if (_.isString(n[key]) || _.isString(n[key.toLowerCase()])) {
            var file = n[key] || n[key.toLowerCase()];
            desc += _.repeat(' ', step) + formatCatalog(key, '-') + file;

            // Mark it to skip
            skip = key;
          }

          // The file is `readme.md`
          if (_.isString(n['readme']) || _.isString(n['Readme']) || _.isString(n['README'])) {
            var readmeDir = n['readme'] || n['Readme'] || n['README'];
            desc += _.repeat(' ', step) + formatCatalog(key, '-') + readmeDir;
          } else {
            desc += _.repeat(' ', step) + "- " + prettyCatalogName(key) + "\n";
          }

          // Start a loop
          step += 2;
          work(n);
          step -= 2;
        } else {
          // Skip if `skip` exists or key == `readme`
          if (isSkiped(key, skip)) {
            return;
          }

          desc += _.repeat(' ', step) + formatCatalog(key) + n;
        }
      }
    });
  }
}

// Get a filesJson Object
function getFiles(root) {
  var result = null,
    filesJson = {};

  readFile(root, filesJson, sort);

  if(filesJson){
      result = _.pick(filesJson, filterRules);
  }

  return result;
}

// Filter in the `catalog` and exclude in the `ignores`
function filterRules(n, key) {
  var result = null;

  // Ignore hidden files, for example `.git`
  if (/^[\.]/.test(key)) {
    ignores.push(key);
  }

  if (catalog === 'all') {
    result = !_.includes(ignores, key);
  } else {
    result = _.includes(catalog, key) && !_.includes(ignores, key);
  }

  return result;
}

// Sign is `-` when folders, `*` when files
function formatCatalog(folderName, sign) {
  sign = sign || '*';
  return sign + " [" + prettyCatalogName(folderName) + "](";
}

// Don`t format the files like `req.options.*` using dot, unchanged or Chinese string.
function prettyCatalogName(folderName) {
  if (!prettify) return folderName;
  if (strip && /^[\da-zA-Z]*-/.test(folderName)) {
    folderName = folderName.match(/[\da-zA-Z]-(.*)/)[1];
  }

  if (_.size(folderName.split(".")) > 1 || _.includes(unchanged, folderName) || isChinese(folderName)) {
    return folderName;
  }
  return _.startCase(folderName);
}

function isChinese(string) {
  var req = /[\u4E00-\u9FA5]|[\uFE30-\uFFA0]/gi;
  if (!req.exec(string)) {
    return false;
  } else {
    return true;
  }
}

function isSkiped(key, skip) {
  var result = !_.isEmpty(skip) && _.isEqual(key.toLowerCase(), skip.toLowerCase()) || _.isEqual(key.toLowerCase(), 'readme');
  return result;
}

// Write to file  encoded with utf-8
function writeFile(fileName, data) {
  fs.writeFile(fileName, data, 'utf-8', function() {
    console.log(color.green("Finished, generate a SUMMARY.md successfully."));
  })
}

module.exports = Summary;
