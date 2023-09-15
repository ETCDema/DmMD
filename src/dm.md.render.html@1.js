/************************************************
 * DmMarkdown 1.0 - Работа с markdown разметкой *
 * Генератор HTML                               *
 ************************************************/
(function (global, factory)
{
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory()
	: typeof define === 'function' && define.amd				 ? define(factory)
	: (global = typeof globalThis !== 'undefined'				 ? globalThis 
	: global || self, (global.DmMD || (global.DmMD = {})).HTML = factory());
})(this, function ()
{
	'use strict';
	
	function _noWriter(el, buf, urls, ext)
	{
		buf.html('<div class="no-writer"><label>No writer for type=').t(el.type).html('</label>');
		el.text && buf.t(el.text);
		el.items && el.items.forEach(buf.el);
		buf.html('</div>');
	}

	const _chars				= { '<': '&lt;', '&': '&amp;' };
	function _encode(t)
	{
		return t && t.replace(/[<&]/g, (m) => _chars[m]);
	}

	function render(doc, ext)
	{
		if (!ext) ext			= {};
		const start				= performance.now();
		
		const urls				= doc.urls;
		const result			= [];
		const buf				= {
			t					: (t) => { result.push(_encode(t)); return buf; },
			html				: (...args) => { result.push(...args); return buf; },
			el					: (el) => { typeof(el)==='string' ? buf.t(el) : ((this[el.type] || _noWriter)(el, buf, urls, ext)); },
		};

		buf.el(doc);
		
		const html				= result.join('');
		doc.renderTime			= (performance.now()-start)+'ms';
		doc.htmlLen				= html.length;
		return html;
	}

	function use(renders)
	{
		return renders && Object.freeze(Object.assign({}, this, renders)) || this;
	}

	function root(el, buf, urls, ext)
	{
		buf.html('<article>');
		el.items.forEach(buf.el);
		buf.html('</article>');
	}

	function block(el, buf, urls, ext)
	{
		buf.html('<div class="', el.type.toLowerCase(), '">');
		el.items.forEach(buf.el);
		buf.html('</div>');
	}

	function heading(el, buf, urls, ext)
	{
		buf.html('<h', el.lvl, '>');
		el.items && el.items.forEach(buf.el);
		buf.html('</h', el.lvl, '>');
	}

	function list(el, buf, urls, ext)
	{
		const tag				= el.type.toLowerCase();
		buf.html('<', tag, '>');
		el.items.forEach(buf.el);
		buf.html('</', tag, '>');
	}

	function alert(el, buf, urls, ext)
	{
		buf.html('<div class="alert ', el.alert, '">', ext.alertLabel && ext.alertLabel(el.alert) || alert.defaultLabels[el.alert]);
		el.items.forEach(buf.el);
		buf.html('</div>');
	}
	alert.defaultLabels			= {
		note					: '<label>[i] Note</label>',
		important				: '<label>[!] Important</label>',
		warning					: '<label>[‼] Warning</label>',
	};

	function p(el, buf, urls, ext)
	{
		buf.html('<p>');
		el.items.forEach(buf.el);
		buf.html('</p>');
	}
	
	function pre(el, buf, urls, ext)
	{
		const html				= ext.code && ext.code(el.code, el.text);
		html ? buf.html(html)
		     : buf.html('<pre>').t(el.text).html('</pre>');
	}

	function hr(el, buf, urls, ext)
	{
		buf.html('<hr/>');
	}

	function br(el, buf, urls, ext)
	{
		buf.html('<br/>');
	}
	
	function code(el, buf, urls, ext)
	{
		buf.html('<code>');
		buf.t(el.text);
		buf.html('</code>');
	}

	function em(el, buf, urls, ext)
	{
		buf.html(el.lvl===3 ? '<b><i>' : el.lvl===2 ? '<b>' : '<i>');
		el.items.forEach(buf.el);
		buf.html(el.lvl===3 ? '</i></b>' : el.lvl===2 ? '</b>' : '</i>');
	}

	function del(el, buf, urls, ext)
	{
		buf.html('<del>');
		el.items.forEach(buf.el);
		buf.html('</del>');
	}

	function media(el, buf, urls, ext)
	{
		const url				= urls[el.urlid] || { using: 0, url: '#' };
		url.using++;
		if (el.block)
		{
			buf.html('<span class="media">');
			_mediaIMG(url, null, buf);
			el.items.forEach(buf.el);
			buf.html('</span>');	
		} else
		{
			const tbuf			= [];
			el.toText((...args) => tbuf.push(...args));
			_mediaIMG(url, tbuf.join(''), buf);
		}
	}

	function _mediaIMG(url, alt, buf)
	{
		const title				= url.title || alt;
		buf.html('<img src="', url.url, '"');
		if(url.width)  buf.html(' width="', url.width, '"');
		if(url.height) buf.html(' height="', url.height, '"');
		if(title)  	   buf.html(' title="').t(title).html('"');
		buf.html('>');
	}

	function link(el, buf, urls, ext)
	{
		const url				= urls[el.urlid] || { using: 0, url: '#' };
		const target			= ext.linkTarget && ext.linkTarget(url);
		url.using++;
		buf.html('<a href="', url.url, '"');
		if (url.title) buf.html(' title="').t(url.title).html('"');
		if (target)    buf.html(' target="').t(target).html('"');
		buf.html('>');
		el.items.forEach(buf.el);
		buf.html('</a>');
	}

	function mention(el, buf, urls, ext)
	{
		if (ext.mention && ext.mention(el, buf)!==false) return;
		buf.html('<span class="mention"><span class="icon">@</span>');
		if(el.group) buf.t(el.group).html('/');
		buf.t(el.id);
		buf.html('</span>');
	}

	return Object.freeze({
		// Block elements
		ROOT					: root,
		H						: heading,
		ALERT					: alert,
		QUOTE					: block,
		UL						: list,
		OL						: list,
		LI						: list,
		P						: p,
		CODEBLOCK				: pre,
		HR						: hr,
		// Inline elements
		CODE					: code,
		BR						: br,
		EM						: em,
		DEL						: del,
		SUB						: list,
		SUP						: list,
		MEDIA					: media,
		LINK					: link,
		MENTION					: mention,
		// Methods
		render					: render,
		use						: use
	});
});