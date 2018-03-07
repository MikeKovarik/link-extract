(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('path'), require('fs'), require('util')) :
	typeof define === 'function' && define.amd ? define(['exports', 'path', 'fs', 'util'], factory) :
	(factory((global['link-extract'] = {}),global.path,global.fs,global.util));
}(this, (function (exports,path,fs,util) { 'use strict';

path = path && path.hasOwnProperty('default') ? path['default'] : path;
fs = fs && fs.hasOwnProperty('default') ? fs['default'] : fs;
util = util && util.hasOwnProperty('default') ? util['default'] : util;

var {promisify} = util;
var stat = promisify(fs.stat);
var readFile = promisify(fs.readFile);


var defaultOptions = {
	order: ['css', 'esm', 'js', 'json', 'html', 'images', 'fonts', 'video', 'audio', 'other'],
	// include src and hrefs from <link> <meta> <script> and css and js source codes
	includeJs: true,
	includeCss: true,
	includeHtml: true, // html imports
	includeJson: true,
	includeFonts: true,
	includeImages: true,
	includeVideo: true,
	includeAudio: true,
	// include contents from <body>
	includeAssets: true,
	parseCss: true,
	parseJs: true,
	parseInlineCss: true,
	parseEmbededCss: true,
	parseEmbededJs: true,
};

function getOptions(options) {
	if (options)
		return Object.assign({}, defaultOptions, options)
	else
		return defaultOptions
}

function parse(code, extOrMime) {
	switch (extOrMime) {
		case 'text/javascript':
		case 'js':
		//	return parseJs(code)
		case 'mjs':
			return parseEsm(code)
		case 'css':
			return parseCss(code)
		case 'html':
			return parseHtml(code)
	}
}

function createUrlStructure() {
	return {
		css: [],
		esm: [],
		js: [],
		json: [],
		html: [],
		images: [],
		fonts: [],
		video: [],
		audio: [],
		other: [],
	}
}

function filterUrlsByExtension(array, urlLists, options) {
	for (var i = 0; i < array.length; i++)
		filterUrlByExtension(array[i], urlLists, options);
}
function filterUrlByExtension(url, urlLists, options) {
	var temp = url;
	var queryIndex = temp.indexOf('?');
	if (queryIndex !== -1)
		temp = temp.slice(0, queryIndex);
	switch(getExtension(temp)) {
		case 'mjs':
			if (options.includeJs)
				urlLists.esm.push(url);
			break
		case 'js':
			if (options.includeJs)
				urlLists.js.push(url);
			break
		case 'json':
			if (options.includeJson)
				urlLists.json.push(url);
			break
		case 'css':
			if (options.includeCss)
				urlLists.css.push(url);
			break
		case 'html':
			if (options.includeHtml)
				urlLists.html.push(url);
			break
		case 'png':
		case 'gif':
		case 'webp':
		case 'jpg':
		case 'jpeg':
		case 'svg':
			if (options.includeImages)
				urlLists.images.push(url);
			break
		case 'eot':
		case 'woff':
		case 'woff2':
		case 'ttf':
			if (options.includeFonts)
				urlLists.fonts.push(url);
			break
		case 'wmv':
		case 'webm':
		case 'mp4':
			if (options.includeVideo)
				urlLists.video.push(url);
			break
		case 'vma':
		case 'vaw':
		case 'flac':
		case 'ogg':
		case 'mp3':
			if (options.includeAudio)
				urlLists.audio.push(url);
			break
		default:
			urlLists.other.push(url);
			break
	}
}

function parseHtml(code, options) {
	options = getOptions(options);
	code = removeHtmlComments(code);

	var urlLists = createUrlStructure();

	var assignUrl  = url  => filterUrlByExtension(url,   urlLists, options);
	var assignUrls = urls => filterUrlsByExtension(urls, urlLists, options);

	//var relPaths = getMatches(code, /(src|<link.*href)="(.*?)"/gm, 2)
	//return relPaths

	getMatches(code, /<link[\s\S]*?>/gm)
		.map(extractHref)
		.forEach(assignUrl);

	if (options.parseEmbededCss) {
		getMatches(code, /<style[\s\S]*?<\/style>/gm)
			.map(removeInlineTag)
			.map(parseCss)
			.forEach(assignUrls);
	}

	if (options.includeJs) {
		var scriptTags = code.match(/<script[\s\S]*?<\/script>/gm) || [];
		var moduleScripts = scriptTags.filter(isScriptModule);
		var classicScripts = scriptTags.filter(isNotScriptModule);

		// if <script> contains type="module" attribute, the file is interpreted as ES module
		urlLists.esm.push(...moduleScripts.filter(isNotInlineTag).map(extractSrc));
		// All other scripts should be disallowed to use 'import' syntax
		urlLists.js.push(...classicScripts.filter(isNotInlineTag).map(extractSrc));

		if (options.parseJs && options.parseEmbededJs) {
			moduleScripts
				.filter(isInlineTag)
				.map(removeInlineTag)
				.map(parseEsm)
				.forEach(assignUrls);
		}
	}

	if (options.parseCss && options.parseInlineCss) {
		// TODO: some filtering maybe? asking for includeImages
		getMatches(code, /style=((".*?")|('.*?'))/gm)
			.map(code => code.slice(7, -1))
			.map(parseCss)
			.forEach(assignUrls);
	}

	// todo - filter .html link
	// todo <img>, <a>, srcset, <picture> <div style="...">
	if (options.includeAssets) {
		// TODO: some filtering maybe? asking for includeImages
		getMatches(code, /<(?!script).*(src|srcset)="(.*?)"/gm, 2)
			.forEach(assignUrl);
	}


	var orderedLists = options.order.map(name => urlLists[name]);
	return flatten(orderedLists)
		.map(trim)
		.filter(exists)
}

// NOTE: does not include .map files because those aren't downloaded by normal visitors unless dev tools are open
function parseCss(code) {
	code = removeCssComments(code);
	// TODO
	if (code === undefined || code.length === 0) return []
	var imports = getMatches(code, /@import\s['"](.*?)['"]/g, 1);
	var urls = getMatches(code, /(url\(\s?[^'"].*?[^'"]\s?\))|(url\(\s?['"].*?['"]\s?\))/g)
		.map(string => string.slice(4, -1).trim())
		.map(unwrapStringParentheses);
	return [...imports, ...urls]
}

function parseJs(code) {
	//if (isEsm(code))
		return parseEsm(code)
	//if (isCjs(code))
	//	return parseCjs(code)
}

function parseEsm(code) {
	code = removeJsComments(code);
	if (code === undefined || code.length === 0) return []
	var imports = getMatches(code, /import(\s|\()[\s\S]*?['"`](.*?)['"`]/gm, 2).filter(url => !url.includes('${'));
	var exports = getMatches(code, /export\s[\s\S]*?from[\s\S]*?['"`](.*?)['"`]/gm, 1);
	return [...imports, ...exports]
}

function parseCjs(code) {
	// Not sure if this is even needed. Node scripts are not served on http servers, and bundles strip require functions away.
	code = removeJsComments(code);
	var urls = getMatches(code, /(require\(\s?[^'"`].*?[^'"`]\s?\))|(require\(\s?['"`].*?['"`]\s?\))/g)
		.map(string => string.slice(8, -1).trim())
		.map(unwrapStringParentheses);
	return []
}

function removeCssComments(code) {
	return code.replace(/\/\*[\s\S]*?\*\//gm, '')
}

function removeJsComments(code) {
	// NOTE: regex can't reliably remove all comments, especially string containing // will result
	//       in false positive. Parser would be needed. This implementation is very naive.
	return code.replace(/\/\*[\s\S]*?\*\//gm, '')
				.replace(/[^:]\/\/.*/g, '')
}

function removeHtmlComments(code) {
	return code.replace(/<!--[\s\S]*?-->/gm, '')
}

function getMatches(code, regex, index) {
	if (index === undefined) {
		return code.match(regex) || []
	} else {
		var matches = [];
		var match;
		while (match = regex.exec(code)) {
			matches.push(match[index]);
		}
		return matches
	}
}

function isEsm(code) {
	return code.includes('import ')
}

function isCjs(code) {
	return code.includes('require(')
}

function isNotScriptModule(code) {
	return !isScriptModule(code)
}
function isScriptModule(code) {
	var openingTag = getOpeningTag(code);
	return openingTag.includes('type="module"')
		|| openingTag.includes('type=\'module\'')
}

function isNotInlineTag(code) {
	var openingTag = getOpeningTag(code);
	return openingTag.includes('href=')
		|| openingTag.includes('src=')
}
function isInlineTag(code) {
	return !isNotInlineTag(code)
}

function extractHref(code) {
	return extractAttr(code, 'href')
}
function extractSrc(code) {
	return extractAttr(code, 'src')
}
function extractAttr(code, attr) {
	var index = code.indexOf(attr);
	if (index === -1) return
	var quoteChar = code[index + attr.length + 1];
	code = code.slice(index + attr.length + 2);
	code = code.slice(0, code.indexOf(quoteChar));
	return code
}

function getExtension(url) {
	return url.slice(url.lastIndexOf('.') + 1)
}

function removeInlineTag(code) {
	code = code.slice(code.indexOf('>') + 1);
	code = code.slice(0, code.indexOf('<'));
	return code.trim()
}

function getOpeningTag(code) {
	return code.slice(code.indexOf('<'), code.indexOf('>') + 1)
}

function flatten(arrays) {
	var out = [];
	for (var i = 0; i < arrays.length; i++)
		out.push(...arrays[i]);
	return out
}

function exists(string) {
	return string !== undefined
}

function trim(string) {
	if (string !== undefined)
		return string.trim()
}

function unwrapStringParentheses(string) {
	var firstChar = string[0];
	var lastChar = string[string.length -1];
	if (firstChar === lastChar)
		string = string.slice(1, -1);
	return string
}

exports.parse = parse;
exports['default'] = parse;
exports.parseHtml = parseHtml;
exports.parseCss = parseCss;
exports.parseJs = parseJs;
exports.parseEsm = parseEsm;
exports.parseCjs = parseCjs;

Object.defineProperty(exports, '__esModule', { value: true });

})));
