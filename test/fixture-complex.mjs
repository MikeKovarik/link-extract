import _ from 'https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.4/lodash.js'
import './foo.mjs';

import(`./bar.mjs`)
	.then(bar => {})

export * from './baz.mjs'
export {qux} from './qux.mjs'

import foobar from './foobar.mjs';
import * as foobar2 from "./src/foobar2.mjs";
import {foobar3} from "../foobar3.mjs"
import {export1, export2 as alias2} from './foobar4.mjs';
import foobar5, {foo5} from './foobar5.mjs';
import foobar6, * as name from `./foobar6.mjs`;

import {
	export1,
	export2,
	export3
} from '/foobar7.mjs';
