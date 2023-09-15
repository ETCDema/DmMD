/**************************************************
 * DmMarkdown 1.0 - Работа с markdown разметкой   *
 **************************************************/
(function (global, factory)
{
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory()
	: typeof define === 'function' && define.amd				 ? define(factory)
	: (global = typeof globalThis !== 'undefined'				 ? globalThis 
	: global || self, (global.DmMD = factory()));
})(this, function ()
{
	'use strict';
	return { elements: elements(), parser: parser(), HTML: HTML() };

	// Insert elements(), parser() and HTML() here.
});