var {parseHtml, parseCss, parseJs, parseEsm} = require('../index.js')
var {assert} = require('chai')
var fs = require('fs')
var {promisify} = require('util')
var readFile = promisify(fs.readFile)
var stat = promisify(fs.stat)


describe('.parseHtml', () => {

	it('simple', async () => {
		var code = await readFile('fixture-simple.html')
		var urls = parseHtml(code.toString())
		var expected = [
			// css
			'fixture-simple.css',
			// js
			'../uwp-fs/index.js',
			'/node_modules_bundled/jpg-stream.js',
			'runtime.js',
			'./fixture-simple.js',
			// content
			'logo1.svg',
		]
		assert.deepEqual(urls, expected)
	})

	it('complex', async () => {
		var code = await readFile('fixture-complex.html')
		var urls = parseHtml(code.toString())
		var expected = [
			// linked css <link>
			'../flexus/flexus-neon.css',
			'/neon-icons.css',
			'fixture-complex.css',
			'css/flexus-lite.css',
			// inline js <script type="module">...</script>, esm first
			'./fixture-complex.mjs',
			// js <script type="module" src="">, esm first
			'./something.mjs',
			// js <script src="">, esm first
			'https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.4/lodash.js',
			'//code.jquery.com/pep/0.4.3/pep.min.js',
			'../uwp-fs/index.js',
			'./node_modules/pics/index.js',
			'/node_modules_bundled/jpg-stream.js',
			'runtime.js',
			// <link> json
			'manifest.json',
			// <link> html imports
			'paper-tabs.html',
			// out of content links
			'http://example.com/myicon.png',
			'nice-highres.png',
			'niceicon.png',
			'niceicon2.png',
			'niceicon3.png',
			// inline css <style>
			'/img/embeded-something.png',
			'./embeded-something-else.jpg',
			// inline css styles [style=""]
			'/inlined-style.png',
			'./another-inline.jpg',
			// assets from within <body>
			'folder.svg',
			'my-photo.jpg',
		]
		assert.deepEqual(urls, expected)
	})

	it('iframe', async () => {
		var code = await readFile('fixture-iframe.html')
		var urls = parseHtml(code.toString())
		var expected = [
			// css
			'flexus/flexus-neon.css?v1.0.0',
			'flexus/flexus-neon-icons.css',
			'style/style.css',
			'./style/notfound.css',
			// js
			'./js/index.js',
			// html
			'frame.html?some=query',
			// content
			'img/bg.jpg',
			'img/pattern.png',
			'./img/img.png',
		]
		assert.deepEqual(urls, expected)
	})

})


describe('.parseCss', () => {

	it('simple', async () => {
		var code = await readFile('fixture-simple.css')
		var urls = parseCss(code.toString())
		var expected = [
			'/fonts/foo.woff2',
			'./fonts/bar.woff',
			'baz.png',
			'img/quox.jpg',
		]
		assert.deepEqual(urls, expected)
	})

	it('complex', async () => {
		var code = await readFile('fixture-complex.css')
		var urls = parseCss(code.toString())
		var expected = [
			// order of urls is not by appearance in code due to various regexes used for extraction.
			'c.css',
			'/d.css',
			'fixture-simple.css',
			'a.css',
			'./b.css',
			'e.css',
			'/fonts/OpenSans-Regular-webfont.woff2',
			'./fonts/OpenSans-Regular-webfont.woff',
			'something - Copy (2).png',
			'./img/something.jpg',
			'/img/logo-large.png',
			`./img/logo's mask (big).png`,
			'img/logo-bg.jpg',
		]
		assert.deepEqual(urls, expected)
	})

	it('fonts', async () => {
		var code = await readFile('fixture-fonts.css')
		var urls = parseCss(code.toString())
		var expected = [
			'MaterialIcons-Regular.woff',
		]
		assert.deepEqual(urls, expected)
	})

})


describe('.parseEsm', () => {

	it('simple', async () => {
		var code = await readFile('fixture-simple.mjs')
		var urls = parseEsm(code.toString())
		var expected = [
			'https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.4/lodash.js',
			'./foo.mjs',
			'./bar.mjs',
		]
		assert.deepEqual(urls, expected)
	})

	it('complex', async () => {
		var code = await readFile('fixture-complex.mjs')
		var urls = parseEsm(code.toString())
		var expected = [
			// imports
			'https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.4/lodash.js',
			'./foo.mjs',
			'./bar.mjs',
			'./foobar.mjs',
			'./src/foobar2.mjs',
			'../foobar3.mjs',
			'./foobar4.mjs',
			'./foobar5.mjs',
			'./foobar6.mjs',
			'/foobar7.mjs',
			// export from
			'./baz.mjs',
			'./qux.mjs',
		]
		assert.deepEqual(urls, expected)
	})

})
